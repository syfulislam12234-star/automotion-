#!/usr/bin/env python3
"""
Universal Multi-Provider Telegram Bot Worker & Production Web Service
Powered by python-telegram-bot (v21+) and Multi-Tier AI Cascade.

Key Capabilities:
1. Multi-Tier AI Failover Cascade: Groq LPU (Llama 3.3 70B) -> Google Gemini 2.5/3.7 Flash -> OpenRouter DeepSeek R1 -> Cerebras -> Pollinations AI
2. Sliding-Window Context Memory Buffer with auto-pruning per chat ID
3. Expanded Utilities: /translate, /summarize, /image, /weather, /search, /code, /remind, /memory, /status, /ping, /id, /reset
4. Telegram Markdown Chunking (up to 4000 chars) with automatic plain-text fallback for parse errors
5. Async HTTP server (aiohttp) for /health and /webhook endpoints
"""

import os
import sys
import re
import json
import html
import logging
import asyncio
import hashlib
import time
from datetime import datetime, timedelta
from urllib.parse import unquote
from typing import Dict, List, Any, Optional

import aiohttp
from aiohttp import web
from dotenv import load_dotenv

# Load local environment variables from .env if present
load_dotenv()

# Setup logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("UniversalTelegramBot")

# ==========================================
# ENVIRONMENT & CONFIGURATION
# ==========================================
TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", os.getenv("BOT_TOKEN", "")).strip()
RUN_MODE: str = os.getenv("RUN_MODE", "polling").strip().lower()
PORT: int = int(os.getenv("PORT", "3000"))
WEBHOOK_SECRET: str = os.getenv("WEBHOOK_SECRET", os.getenv("TELEGRAM_WEBHOOK_SECRET_TOKEN", "")).strip()
PUBLIC_BASE_URL: str = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
# Optional override: root URL of a (self-hosted) Telegram Bot API server.
# Empty string means the official https://api.telegram.org endpoint.
TELEGRAM_API_BASE_URL: str = os.getenv("TELEGRAM_API_BASE_URL", "").strip().rstrip("/")

# AI Provider Credentials
GROQ_API_KEYS: List[str] = [
    k.strip() for k in [
        os.getenv("GROQ_API_KEY", ""),
        os.getenv("GROQ_API_KEY_1", ""),
        os.getenv("GROQ_API_KEY_2", ""),
        os.getenv("GROQ_API_KEY_3", ""),
    ] if k.strip() and not k.strip().startswith("YOUR_")
]
GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()

GEMINI_API_KEYS: List[str] = [
    k.strip() for k in [
        os.getenv("GEMINI_API_KEY", ""),
        os.getenv("GEMINI_API_KEY_1", ""),
        os.getenv("GEMINI_API_KEY_2", ""),
        os.getenv("GEMINI_API_KEY_3", ""),
    ] if k.strip() and not k.strip().startswith("YOUR_")
]
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()

OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-r1:free").strip()

CEREBRAS_API_KEY: str = os.getenv("CEREBRAS_API_KEY", "").strip()
CEREBRAS_MODEL: str = os.getenv("CEREBRAS_MODEL", "llama3.3-70b").strip()

SYSTEM_PROMPT: str = os.getenv(
    "SYSTEM_PROMPT",
    "You are a friendly, highly intelligent, and ultra-fast AI assistant. Always format your response using clean Markdown, clear headings, appropriate emojis, and bullet points to make it look stylish and easy to read on Telegram.",
).strip()

# Conversation history state (chat_id -> dict with turns and context summary)
class ChatMemory:
    def __init__(self):
        self.turns: List[Dict[str, str]] = []
        self.summary: str = ""
        self.last_active: float = asyncio.get_event_loop().time() if asyncio.get_event_loop().is_running() else 0.0

chat_memories: Dict[int, ChatMemory] = {}
telegram_sessions: Dict[str, "Application"] = {}
telegram_session_lock = asyncio.Lock()
# Per-user tokens that run in dynamic webhook mode (instead of polling mode)
webhook_sessions: set = set()
# Derived, URL-safe webhook session id -> bot token routing table
webhook_routes: Dict[str, str] = {}
MAX_MEMORY_TURNS: int = 16
MAX_CHAR_BUDGET: int = 12000
start_time: float = 0.0

# Owner-level YouTube connection & preference state surfaced through /youtube and
# /settings. Populated from the environment (durable) and mutable at runtime via
# the interactive settings menu (Auto-Upload ON/OFF toggle).
OWNER_SETTINGS: Dict[str, object] = {
    "youtubeClientId": os.getenv("OWNER_YOUTUBE_CLIENT_ID", "").strip(),
    "youtubeClientSecret": os.getenv("OWNER_YOUTUBE_CLIENT_SECRET", "").strip(),
    "youtubeRefreshToken": os.getenv("OWNER_YOUTUBE_REFRESH_TOKEN", "").strip(),
    "youtubeChannelId": os.getenv("OWNER_YOUTUBE_CHANNEL_ID", "").strip(),
    "autoUpload": os.getenv("OWNER_AUTO_UPLOAD", "on").strip().lower() in ("1", "on", "true", "yes"),
}

# ==========================================
# PHASE 4: SYSTEM CONFIG (ADS + AI PROVIDERS) — read-only mirror of data_store.json
# The Node.js server owns data_store.json; this worker only READS it (never writes)
# so admin AI-provider toggles/priority ordering apply to the Python cascade without
# any file-clobbering risk. Any read failure falls back to the legacy cascade order.
# ==========================================
_SYSTEM_CONFIG_CACHE: Dict[str, Any] = {"data": None, "readAt": 0.0}
_SYSTEM_CONFIG_TTL_SECONDS = 60.0

# Legacy hardcoded cascade order (Groq -> Gemini -> OpenRouter -> Cerebras -> Pollinations)
LEGACY_AI_PROVIDER_ORDER: List[Dict[str, Any]] = [
    {"id": "groq", "priority": 10},
    {"id": "gemini", "priority": 20},
    {"id": "openrouter", "priority": 30},
    {"id": "cerebras", "priority": 40},
    {"id": "pollinations", "priority": 50},
]


def load_system_config() -> Dict[str, Any]:
    """Read the shared admin system config (ads + AI providers) with a 60s cache."""
    now = time.time()
    cached = _SYSTEM_CONFIG_CACHE.get("data")
    if cached is not None and now - float(_SYSTEM_CONFIG_CACHE.get("readAt", 0.0)) < _SYSTEM_CONFIG_TTL_SECONDS:
        return cached  # type: ignore[return-value]
    config: Dict[str, Any] = {}
    try:
        store_path = os.path.join(os.getcwd(), "data_store.json")
        if os.path.exists(store_path):
            with open(store_path, "r", encoding="utf-8") as handle:
                raw = json.load(handle)
            stored = raw.get("systemConfig") if isinstance(raw, dict) else None
            if isinstance(stored, dict):
                config = stored
    except Exception as exc:  # never break the bot because of a config read
        logger.warning(f"⚠️ System config read failed (using legacy defaults): {exc}")
    _SYSTEM_CONFIG_CACHE["data"] = config
    _SYSTEM_CONFIG_CACHE["readAt"] = now
    return config


def get_ai_provider_order() -> List[Dict[str, Any]]:
    """
    Ordered enabled AI provider tiers from the admin system config.
    - Providers with enabled=false are excluded (admin toggles respected).
    - Tries are sorted by the admin-configured priority (lower = first).
    - No config file / no providers list → legacy hardcoded order (zero-break).
    - Config present but every provider disabled → empty list (AI fully paused).
    """
    config = load_system_config()
    providers = config.get("aiProviders") if isinstance(config, dict) else None
    saw_config = False
    entries: List[Dict[str, Any]] = []
    if isinstance(providers, list) and providers:
        saw_config = True
        for entry in providers:
            if not isinstance(entry, dict) or entry.get("enabled") is False:
                continue
            provider_id = str(entry.get("id", "")).strip().lower()
            if provider_id == "google":
                provider_id = "gemini"  # the Node config names Gemini's route 'google'
            try:
                priority = float(entry.get("priority", 50))
            except (TypeError, ValueError):
                priority = 50.0
            entries.append({"id": provider_id, "priority": priority})
    if not saw_config:
        entries = [dict(item) for item in LEGACY_AI_PROVIDER_ORDER]
    entries.sort(key=lambda item: item["priority"])
    return entries


def is_maintenance_mode() -> bool:
    """True while the admin has Maintenance Mode ON (read-only system config)."""
    config = load_system_config()
    return bool(config.get("maintenanceMode", False))


def get_maintenance_message() -> str:
    """The admin-configured announcement shown while maintenance mode is active."""
    config = load_system_config()
    return str(config.get("maintenanceMessage", "") or "🛠️ We are performing scheduled maintenance. Please check back shortly!")


def is_feature_enabled(feature: str) -> bool:
    """
    True when the platform feature toggle for `feature` (ytCheck / ytSeo / ytViral /
    autoUpload / liveStreaming) is enabled. With no config, every toggle is ON so the
    pre-Phase-5 bot behaviour is preserved (zero-break).
    """
    config = load_system_config()
    toggles = config.get("featureToggles") if isinstance(config, dict) else None
    if isinstance(toggles, dict) and feature in toggles:
        return toggles.get(feature) is not False
    return True

# Lazy-loaded python-telegram-bot modules
try:
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
    from telegram.constants import ParseMode, ChatAction
    from telegram.ext import (
        Application,
        CallbackQueryHandler,
        CommandHandler,
        MessageHandler,
        ContextTypes,
        filters,
    )
except ImportError as e:
    logger.error("❌ Critical: python-telegram-bot is not installed! Run: pip install -r requirements.txt")
    sys.exit(1)


# ==========================================
# AI GENERATION CASCADE ENGINE
# ==========================================

async def call_groq_ai(prompt: str, history: List[Dict[str, str]]) -> str:
    """Call Groq Cloud chat completions with multi-key rotation."""
    if not GROQ_API_KEYS:
        raise ValueError("No valid GROQ_API_KEYS configured.")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": prompt})

    url = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2048,
    }

    async with aiohttp.ClientSession() as session:
        for key in GROQ_API_KEYS:
            headers = {
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            }
            try:
                async with session.post(url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=20)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        reply = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                        if reply and reply.strip():
                            return reply.strip()
            except Exception as e:
                logger.warning(f"⚠️ Groq key error: {e}. Trying next key...")

    raise RuntimeError("All Groq keys exhausted.")


async def call_gemini_ai(prompt: str, history: List[Dict[str, str]]) -> str:
    """Call Google Gemini REST generateContent API with multi-model fallback."""
    if not GEMINI_API_KEYS:
        raise ValueError("No valid GEMINI_API_KEYS configured.")

    contents = []
    for turn in history:
        role = "model" if turn.get("role") == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": turn.get("content", "")}]})
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    payload = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2048},
    }

    candidate_models = [GEMINI_MODEL, "gemini-3.7-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"]
    candidate_models = list(dict.fromkeys(filter(None, candidate_models)))

    async with aiohttp.ClientSession() as session:
        for api_key in GEMINI_API_KEYS:
            for model_name in candidate_models:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                try:
                    async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=20)) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            candidates = data.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                if parts and "text" in parts[0]:
                                    return parts[0]["text"].strip()
                except Exception as e:
                    logger.warning(f"⚠️ Gemini model {model_name} error: {e}. Trying next...")

    raise RuntimeError("All Gemini keys and models exhausted.")


async def call_openrouter_ai(prompt: str, history: List[Dict[str, str]]) -> str:
    """Call OpenRouter API (DeepSeek R1 / Llama 3.3 Free)."""
    if not OPENROUTER_API_KEY or OPENROUTER_API_KEY.startswith("YOUR_"):
        raise ValueError("OPENROUTER_API_KEY not configured.")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": prompt})

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2048,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=25)) as resp:
            if resp.status == 200:
                data = await resp.json()
                reply = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                if reply and reply.strip():
                    return reply.strip()
            raise RuntimeError(f"OpenRouter returned HTTP {resp.status}")


async def call_cerebras_ai(prompt: str, history: List[Dict[str, str]]) -> str:
    """Call Cerebras ultra-fast LPU inference."""
    if not CEREBRAS_API_KEY or CEREBRAS_API_KEY.startswith("YOUR_"):
        raise ValueError("CEREBRAS_API_KEY not configured.")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": prompt})

    url = "https://api.cerebras.ai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {CEREBRAS_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": CEREBRAS_MODEL,
        "messages": messages,
        "temperature": 0.7,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status == 200:
                data = await resp.json()
                reply = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                if reply and reply.strip():
                    return reply.strip()
            raise RuntimeError(f"Cerebras returned HTTP {resp.status}")


async def call_pollinations_ai(prompt: str) -> str:
    """Call Pollinations AI free zero-key text generation."""
    url = f"https://text.pollinations.ai/{prompt}?system={SYSTEM_PROMPT}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status == 200:
                text = await resp.text()
                if text and text.strip() and not text.startswith("<!DOCTYPE") and "<html" not in text:
                    return text.strip()
            raise RuntimeError(f"Pollinations AI returned HTTP {resp.status}")


async def generate_ai_reply(chat_id: int, prompt: str) -> str:
    """Cascade query across Groq -> Gemini -> OpenRouter -> Cerebras -> Pollinations AI."""
    mem = chat_memories.get(chat_id)
    history = mem.turns if mem else []

    # Inject context summary if available
    effective_history = list(history)
    if mem and mem.summary:
        effective_history.insert(0, {"role": "user", "content": f"[Context Summary]: {mem.summary}"})
        effective_history.insert(1, {"role": "assistant", "content": "Understood, continuing conversation context."})

    # Phase 4: config-driven tier cascade — the admin's AI provider toggles and
    # priority ordering decide which providers run and in which order. Unavailable
    # providers (no API key) are skipped; an empty order means AI is fully paused.
    tier_calls = {
        "groq": lambda: call_groq_ai(prompt, effective_history),
        "gemini": lambda: call_gemini_ai(prompt, effective_history),
        "openrouter": lambda: call_openrouter_ai(prompt, effective_history),
        "cerebras": lambda: call_cerebras_ai(prompt, effective_history),
        "pollinations": lambda: call_pollinations_ai(prompt),
    }
    tier_availability = {
        "groq": bool(GROQ_API_KEYS),
        "gemini": bool(GEMINI_API_KEYS),
        "openrouter": bool(OPENROUTER_API_KEY) and not OPENROUTER_API_KEY.startswith("YOUR_"),
        "cerebras": bool(CEREBRAS_API_KEY) and not CEREBRAS_API_KEY.startswith("YOUR_"),
        "pollinations": True,
    }

    for index, tier in enumerate(get_ai_provider_order(), start=1):
        provider_id = str(tier.get("id", ""))
        runner = tier_calls.get(provider_id)
        if not runner or not tier_availability.get(provider_id):
            continue
        try:
            return await runner()
        except Exception as e:
            logger.warning(f"⚠️ Tier {index} ({provider_id}) failed: {e}. Falling back to next tier...")

    return "দুঃখিত, কোনো এআই প্রদানকারী উত্তর দিতে পারেনি। অনুগ্রহ করে আবার চেষ্টা করুন।"


def update_chat_history(chat_id: int, user_text: str, assistant_text: str) -> None:
    """Save exchange to local sliding-window buffer with auto-pruning."""
    if chat_id not in chat_memories:
        chat_memories[chat_id] = ChatMemory()
    mem = chat_memories[chat_id]
    mem.last_active = asyncio.get_event_loop().time()
    mem.turns.append({"role": "user", "content": user_text})
    mem.turns.append({"role": "assistant", "content": assistant_text})

    # Auto prune by turn count & character budget
    total_chars = sum(len(t.get("content", "")) for t in mem.turns)
    while len(mem.turns) > MAX_MEMORY_TURNS * 2 or total_chars > MAX_CHAR_BUDGET:
        if len(mem.turns) >= 2:
            pruned_user = mem.turns.pop(0)
            mem.turns.pop(0)
            if not mem.summary:
                mem.summary = f"User asked about: {pruned_user.get('content', '')[:80]}..."
        total_chars = sum(len(t.get("content", "")) for t in mem.turns)


def chunk_text(text: str, max_len: int = 3900) -> List[str]:
    """Safely split message for Telegram without breaking codeblocks or sentences."""
    if len(text) <= max_len:
        return [text]
    chunks = []
    remaining = text
    while remaining:
        if len(remaining) <= max_len:
            chunks.append(remaining)
            break
        split_idx = remaining.rfind("\n\n", 0, max_len)
        if split_idx == -1 or split_idx < max_len * 0.5:
            split_idx = remaining.rfind("\n", 0, max_len)
        if split_idx == -1 or split_idx < max_len * 0.3:
            split_idx = remaining.rfind(" ", 0, max_len)
        if split_idx == -1 or split_idx < max_len * 0.2:
            split_idx = max_len
        chunks.append(remaining[:split_idx])
        remaining = remaining[split_idx:].lstrip()
    return chunks


# ==========================================
# TELEGRAM BOT COMMAND HANDLERS
# ==========================================

async def safe_reply(
    update: Update,
    text: str,
    parse_mode: Optional[str] = ParseMode.MARKDOWN,
    reply_markup: Optional[InlineKeyboardMarkup] = None,
) -> None:
    """Send text in chunks with automatic fallback to plain text if parsing errors occur."""
    if not update.effective_message:
        return

    chunks = chunk_text(text, 3900)
    for index, chunk in enumerate(chunks):
        try:
            await update.effective_message.reply_text(
                chunk,
                parse_mode=parse_mode,
                disable_web_page_preview=True,
                # Attach the inline keyboard to the first chunk only so long
                # replies keep a single interactive menu.
                reply_markup=reply_markup if index == 0 else None,
            )
        except Exception as e:
            logger.warning(f"Parse error with mode {parse_mode}: {e}. Retrying as plain text.")
            try:
                # Strip HTML tags if HTML parse mode failed
                clean_chunk = re.sub(r"<[^>]+>", "", chunk) if parse_mode == ParseMode.HTML else chunk
                await update.effective_message.reply_text(clean_chunk, disable_web_page_preview=True)
            except Exception as retry_err:
                logger.error(f"Failed to send plain text message: {retry_err}")


def _youtube_connected() -> bool:
    """Whether the owner's YouTube OAuth credentials are configured."""
    return bool(OWNER_SETTINGS.get("youtubeClientId") and OWNER_SETTINGS.get("youtubeClientSecret") and OWNER_SETTINGS.get("youtubeRefreshToken"))


def youtube_status_text() -> str:
    """Report the connected YouTube OAuth token status."""
    connected = _youtube_connected()
    lines = [
        "📺 <b>YouTube Connection Status</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━",
        f"• OAuth 2.0: <b>{'✅ Connected' if connected else '❌ Not connected'}</b>",
    ]
    if connected:
        lines.append(f"• Client ID: <code>{str(OWNER_SETTINGS.get('youtubeClientId'))[:24]}…</code>")
    channel = str(OWNER_SETTINGS.get("youtubeChannelId") or "")
    lines.append(f"• Channel ID: <code>{channel if channel else 'default channel'}</code>")
    lines.append(f"• Auto-Upload: <b>{'ON ✅' if OWNER_SETTINGS.get('autoUpload') else 'OFF ❌'}</b>")
    lines.append("")
    lines.append(
        "Ready: send /upload to attach a video and publish with viral AI SEO."
        if connected
        else "To connect: Web App → Config Panel → YouTube OAuth (Client ID, Secret, Refresh Token), then save."
    )
    return "\n".join(lines)


def main_menu_keyboard() -> InlineKeyboardMarkup:
    """Interactive main menu (YouTube Upload / AI SEO / Status / Settings)."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📤 YouTube Upload", callback_data="menu:upload"),
            InlineKeyboardButton("🔥 AI SEO", callback_data="menu:seo"),
        ],
        [
            InlineKeyboardButton("📊 Status", callback_data="menu:status"),
            InlineKeyboardButton("⚙️ Settings", callback_data="menu:settings"),
        ],
    ])


def settings_keyboard() -> InlineKeyboardMarkup:
    """Settings menu with the Auto-Upload ON/OFF toggle."""
    auto = bool(OWNER_SETTINGS.get("autoUpload"))
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(f"🔄 Auto-Upload: {'ON ✅' if auto else 'OFF ❌'}", callback_data="settings:toggle_autoupload")],
        [InlineKeyboardButton("⬅️ Back to Main Menu", callback_data="menu:home")],
    ])


def yt_check_keyboard() -> InlineKeyboardMarkup:
    """Quick actions attached to the /yt_check analytics report."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🔄 Refresh", callback_data="yt:analytics"),
            InlineKeyboardButton("🔥 AI SEO Boost", callback_data="yt:seo"),
        ],
        [
            InlineKeyboardButton("📤 Upload Video", callback_data="menu:upload"),
            InlineKeyboardButton("🔮 Viral Ideas", callback_data="yt:viral"),
            InlineKeyboardButton("⬅️ Main Menu", callback_data="menu:home"),
        ],
    ])


def yt_seo_keyboard() -> InlineKeyboardMarkup:
    """Quick actions attached to the /yt_seo AI recommendations."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📤 Upload with this SEO", callback_data="menu:upload"),
            InlineKeyboardButton("📊 View Analytics", callback_data="yt:analytics"),
        ],
        [
            InlineKeyboardButton("🔥 Regenerate SEO", callback_data="yt:seo"),
            InlineKeyboardButton("⬅️ Main Menu", callback_data="menu:home"),
        ],
    ])


def yt_viral_keyboard() -> InlineKeyboardMarkup:
    """Quick actions attached to the /yt_viral predictions report."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📤 Use for New Upload", callback_data="menu:upload"),
            InlineKeyboardButton("📊 Video History", callback_data="yt:analytics"),
        ],
        [
            InlineKeyboardButton("🔁 Regenerate Ideas", callback_data="yt:viral"),
            InlineKeyboardButton("🔥 AI SEO Boost", callback_data="yt:seo"),
        ],
        [
            InlineKeyboardButton("⬅️ Main Menu", callback_data="menu:home"),
        ],
    ])


# ==========================================
# YOUTUBE ANALYTICS & SEO DATA LAYER (OAuth)
# ==========================================

_YT_ACCESS_TOKEN_CACHE: Dict[str, object] = {"token": "", "expiresAt": 0.0}


async def _youtube_access_token() -> str:
    """Exchange the owner's refresh token for an access token (cached until near-expiry)."""
    import time
    cached_token = str(_YT_ACCESS_TOKEN_CACHE.get("token") or "")
    expires_at = float(_YT_ACCESS_TOKEN_CACHE.get("expiresAt") or 0.0)
    if cached_token and expires_at - 300 > time.time():
        return cached_token
    client_id = str(OWNER_SETTINGS.get("youtubeClientId") or "")
    client_secret = str(OWNER_SETTINGS.get("youtubeClientSecret") or "")
    refresh_token = str(OWNER_SETTINGS.get("youtubeRefreshToken") or "")
    if not refresh_token:
        raise RuntimeError("YouTube is not connected. Add OAuth credentials in the Config Panel.")
    if not client_id or not client_secret:
        client_id = os.getenv("YOUTUBE_CLIENT_ID", "").strip() or os.getenv("GOOGLE_CLIENT_ID", "").strip()
        client_secret = os.getenv("YOUTUBE_CLIENT_SECRET", "").strip() or os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise RuntimeError("YouTube OAuth client credentials are missing.")
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    async with aiohttp.ClientSession() as session:
        async with session.post("https://oauth2.googleapis.com/token", json=payload, timeout=aiohttp.ClientTimeout(total=20)) as resp:
            data = await resp.json()
            if resp.status != 200 or not data.get("access_token"):
                detail = data.get("error_description") or data.get("error") or f"HTTP {resp.status}"
                raise RuntimeError(f"YouTube OAuth token refresh failed: {detail}")
    _YT_ACCESS_TOKEN_CACHE["token"] = data["access_token"]
    _YT_ACCESS_TOKEN_CACHE["expiresAt"] = time.time() + max(60, int(data.get("expires_in", 3600)))
    return str(data["access_token"])


async def _yt_get_json(url: str, token: str) -> object:
    """Authorized GET returning parsed JSON (raises with the API error detail)."""
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=25)) as resp:
            data = await resp.json()
            if resp.status != 200:
                detail = str(data.get("error", {}).get("message") if isinstance(data, dict) else "") or f"HTTP {resp.status}"
                raise RuntimeError(f"YouTube API error: {detail}")
            return data


def _fmt_compact(value: object) -> str:
    """1234567 -> '1.23M' style formatting for report lines."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "0"
    if number >= 1_000_000_000:
        return f"{number / 1_000_000_000:.2f}B"
    if number >= 1_000_000:
        return f"{number / 1_000_000:.2f}M"
    if number >= 1_000:
        return f"{number / 1_000:.1f}K"
    return str(int(number))


_TRAFFIC_LABELS = {
    "YT_SEARCH": "YouTube Search", "SUBSCRIBER": "Subscribers / Feed", "RELATED_VIDEO": "Suggested Videos",
    "YT_CHANNEL": "Channel Pages", "NOTIFICATION": "Notifications", "PLAYLIST": "Playlists",
    "EXT_URL": "External Websites", "SHORTS": "Shorts Feed", "ADVERTISING": "Ads",
    "YT_OTHER_PAGE": "Other YouTube Pages", "NO_LINK_OTHER": "Direct / Unknown", "HASHTAGS": "Hashtags",
}


async def fetch_channel_stats_and_audit() -> dict:
    """Data API v3: lifetime views, subscribers, video count + status/audit signals."""
    token = await _youtube_access_token()
    channel_id = str(OWNER_SETTINGS.get("youtubeChannelId") or "").strip()
    if channel_id:
        stats_url = (
            "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,status"
            f"&id={channel_id}"
        )
    else:
        stats_url = "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,status&mine=true"
    data = await _yt_get_json(stats_url, token)
    items = data.get("items") or []
    if not items:
        raise RuntimeError("No YouTube channel found for these credentials.")
    channel = items[0]
    snippet = channel.get("snippet", {}) or {}
    stats = channel.get("statistics", {}) or {}
    status = channel.get("status", {}) or {}

    privacy = str(status.get("privacyStatus") or "unknown")
    upload_status = str(status.get("uploadStatus") or "unknown")
    is_linked = bool(status.get("isLinked", False))
    long_uploads = str(status.get("longUploadsStatus") or "unknown")
    made_for_kids = status.get("madeForKids")
    notes: List[str] = []
    if upload_status not in ("processed", "quoted", "uploading"):
        notes.append(f"Upload status is '{upload_status}' — the channel may be blocked from uploading.")
    if privacy != "public":
        notes.append(f"Channel privacy is '{privacy}'.")
    if not is_linked:
        notes.append("Channel is not linked to a Content Owner account (usually fine for personal channels).")
    if long_uploads == "longUploadsUneligible":
        notes.append("Long uploads (>15 min) are not enabled — verify the account by phone.")
    if notes:
        health, emoji = ("warning", "⚠️")
    elif upload_status in ("processed", "quoted"):
        health, emoji = ("clean", "✅")
    else:
        health, emoji = ("warning", "⚠️")
    copyright_status = "restricted" if upload_status in ("blocked", "terminated") or privacy == "private" else ("review" if notes else "clean")
    if upload_status in ("blocked", "terminated"):
        health, emoji = ("restricted", "⛔")
        notes.insert(0, "Channel uploads are restricted — resolve strikes in YouTube Studio.")
    return {
        "channelId": channel.get("id", ""),
        "title": snippet.get("title", "Unknown channel"),
        "description": snippet.get("description", ""),
        "customUrl": snippet.get("customUrl", ""),
        "publishedAt": snippet.get("publishedAt", ""),
        "country": snippet.get("country", ""),
        "thumbnailUrl": ((snippet.get("thumbnails", {}) or {}).get("default", {}) or {}).get("url", ""),
        "totalViews": int(float(stats.get("viewCount") or 0)),
        "subscriberCount": int(float(stats.get("subscriberCount"))) if stats.get("subscriberCount") else None,
        "subscriberCountHidden": bool(stats.get("hiddenSubscriberCount", False)),
        "videoCount": int(float(stats.get("videoCount") or 0)),
        "status": upload_status,
        "audit": {
            "health": health,
            "healthEmoji": emoji,
            "communityGuidelineStrikes": 0 if health == "clean" else 1,
            "copyrightStatus": copyright_status,
            "privacyStatus": privacy,
            "isLinked": is_linked,
            "longUploadsStatus": long_uploads,
            "madeForKids": made_for_kids,
            "auditNotes": notes,
        },
    }


async def fetch_channel_analytics() -> dict:
    """Analytics API v2: impressions, CTR, watch time and top traffic sources.

    Resilient by design: newer tokens expose the `impressions`/`impressionCtr` metrics,
    older scope grants do not — the query gracefully degrades to core metrics instead
    of failing the whole report.
    """
    token = await _youtube_access_token()
    end_date = datetime.utcnow().strftime("%Y-%m-%d")
    start_date_90 = (datetime.utcnow() - timedelta(days=90)).strftime("%Y-%m-%d")

    async def _query(metrics: str, dimensions: str = "", sort: str = "") -> object:
        params = [
            "ids=channel==MINE",
            f"start_date={start_date_90}",
            f"end_date={end_date}",
            f"metrics={metrics}",
        ]
        if dimensions:
            params.append(f"dimensions={dimensions}")
        if sort:
            params.append(f"sort={sort}")
        url = "https://youtubeanalytics.googleapis.com/v2/reports?" + "&".join(params)
        return await _yt_get_json(url, token)

    def _rows_to_totals(payload: object) -> dict:
        report = (payload or {}).get("reports", [{}])[0] if isinstance(payload, dict) else {}
        rows = report.get("rows") or []
        header_cells = (((report.get("columnHeader", {}) or {}).get("metricHeader", {}) or {})
                        .get("metricHeaderEntries", []) or [])
        names = [str(entry.get("name", "")) for entry in header_cells]
        totals: Dict[str, object] = {"views": 0.0, "estimatedMinutesWatched": 0.0,
                                     "averageViewDuration": 0.0, "impressions": None, "impressionCtr": None}
        for row in rows:
            for index, name in enumerate(names):
                value = row[index] if index < len(row) else 0
                if name not in totals:
                    continue
                if name in ("impressions", "impressionCtr"):
                    totals[name] = float(value or 0)
                else:
                    totals[name] = float(totals.get(name) or 0) + float(value or 0)
        return totals

    # Tier 1: full metric set including impressions; Tier 2: core metrics only.
    core_metrics = "views,estimatedMinutesWatched,averageViewDuration"
    note = None
    try:
        overview = _rows_to_totals(await _query(f"{core_metrics},impressions,impressionCtr"))
        if overview.get("impressions") is None:
            raise RuntimeError("impressions metric absent")
    except Exception:
        overview = _rows_to_totals(await _query(core_metrics))
        note = "Impressions & CTR need the yt-analytics-monetary readonly OAuth scope (reconnect to unlock)."

    # Traffic-source breakdown (never fatal — falls back to an empty list).
    traffic: List[Dict[str, object]] = []
    try:
        traffic_payload = await _query(core_metrics, dimensions="insightTrafficSourceType", sort="-estimatedMinutesWatched")
        report = traffic_payload.get("reports", [{}])[0] if isinstance(traffic_payload, dict) else {}
        header_cells = (((report.get("columnHeader", {}) or {}).get("metricHeader", {}) or {})
                        .get("metricHeaderEntries", []) or [])
        names = [str(entry.get("name", "")) for entry in header_cells]
        for row in (report.get("rows") or [])[:6]:
            source = str(row[0] if row else "")
            stat: Dict[str, object] = {"source": source, "label": _TRAFFIC_LABELS.get(source, source.title()),
                                       "views": 0.0, "watchTimeMinutes": 0.0}
            for index, name in enumerate(names):
                if index == 0:
                    continue
                value = float(row[index] or 0) if index < len(row) else 0.0
                if name == "views":
                    stat["views"] = value
                elif name == "estimatedMinutesWatched":
                    stat["watchTimeMinutes"] = value
            traffic.append(stat)
    except Exception:
        pass

    impressions = overview.get("impressions")
    ctr = overview.get("impressionCtr")
    views = float(overview.get("views") or 0)
    return {
        "startDate": start_date_90,
        "endDate": end_date,
        "totalViews": views,
        "impressions": impressions,
        "impressionCtr": ctr,
        "watchTimeMinutes": float(overview.get("estimatedMinutesWatched") or 0),
        "averageViewDurationSeconds": float(overview.get("averageViewDuration") or 0),
        "averageViewPercentage": round((views / float(impressions)) * 100.0, 2)
        if isinstance(impressions, float) and impressions > 0 else None,
        "trafficSources": traffic,
        "note": note,
    }



async def fetch_channel_seo_context() -> dict:
    """Data API v3: channel snippet + latest uploads metadata for the AI SEO engine."""
    token = await _youtube_access_token()
    channel_id = str(OWNER_SETTINGS.get("youtubeChannelId") or "").strip()
    base = "https://www.googleapis.com/youtube/v3"
    channel_url = (
        f"{base}/channels?part=snippet,statistics,contentDetails"
        + (f"&id={channel_id}" if channel_id else "&mine=true")
    )
    data = await _yt_get_json(channel_url, token)
    items = data.get("items") or []
    if not items:
        raise RuntimeError("No YouTube channel found for these credentials.")
    channel = items[0]
    snippet = channel.get("snippet", {}) or {}
    stats = channel.get("statistics", {}) or {}
    keywords_raw = str(snippet.get("keywords", "") or "")
    keywords = [part.strip('"') for part in keywords_raw.split('"') if part.strip()] if '"' in keywords_raw \
        else [part.strip() for part in keywords_raw.split() if part.strip()]

    latest_videos: List[Dict[str, object]] = []
    uploads_playlist = ((channel.get("contentDetails", {}) or {})
                        .get("relatedPlaylists", {}) or {}).get("uploads", "")
    if uploads_playlist:
        try:
            playlist_url = f"{base}/playlistItems?part=contentDetails&playlistId={uploads_playlist}&maxResults=5"
            playlist_data = await _yt_get_json(playlist_url, token)
            video_ids = [str(item.get("contentDetails", {}).get("videoId", ""))
                         for item in (playlist_data.get("items") or []) if item.get("contentDetails")]
            video_ids = [video_id for video_id in video_ids if video_id]
            if video_ids:
                details_url = f"{base}/videos?part=snippet,statistics&id=" + ",".join(video_ids)
                details_data = await _yt_get_json(details_url, token)
                for item in (details_data.get("items") or []):
                    item_snippet = item.get("snippet", {}) or {}
                    item_stats = item.get("statistics", {}) or {}
                    latest_videos.append({
                        "videoId": item.get("id", ""),
                        "title": item_snippet.get("title", ""),
                        "description": str(item_snippet.get("description", "") or "")[:600],
                        "tags": list(item_snippet.get("tags") or [])[:20],
                        "publishedAt": item_snippet.get("publishedAt", ""),
                        "viewCount": int(float(item_stats.get("viewCount") or 0)) if item_stats.get("viewCount") else None,
                        "likeCount": int(float(item_stats.get("likeCount") or 0)) if item_stats.get("likeCount") else None,
                        "commentCount": int(float(item_stats.get("commentCount") or 0)) if item_stats.get("commentCount") else None,
                    })
        except Exception:
            pass
    return {
        "channelId": channel.get("id", ""),
        "title": snippet.get("title", "Unknown channel"),
        "description": str(snippet.get("description", "") or "")[:800],
        "customUrl": snippet.get("customUrl", ""),
        "country": snippet.get("country", ""),
        "publishedAt": snippet.get("publishedAt", ""),
        "totalViews": int(float(stats.get("viewCount") or 0)),
        "subscriberCount": int(float(stats.get("subscriberCount"))) if stats.get("subscriberCount") else None,
        "videoCount": int(float(stats.get("videoCount") or 0)),
        "keywords": keywords,
        "latestVideos": latest_videos,
        }


def _format_iso_duration(iso8601: str) -> str:
    """PT1H2M3S -> 'H:MM:SS' or 'MM:SS'."""
    if not iso8601:
        return ""
    match = re.match(r"^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$", iso8601, re.IGNORECASE)
    if not match:
        return ""
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
        return f"{minutes}:{seconds:02d}"


async def fetch_recent_video_history(limit: int = 10) -> List[Dict[str, object]]:
    """Data API v3: channel uploads playlist -> hydrated video metadata + performance score."""
    token = await _youtube_access_token()
    base = "https://www.googleapis.com/youtube/v3"
    channel_id = str(OWNER_SETTINGS.get("youtubeChannelId") or "").strip()
    channel_url = (
        f"{base}/channels?part=snippet,statistics,contentDetails,status"
        + (f"&id={channel_id}" if channel_id else "&mine=true")
    )
    data = await _yt_get_json(channel_url, token)
    items = data.get("items") or []
    if not items:
        raise RuntimeError("No YouTube channel found for these credentials.")
    channel = items[0]
    uploads_playlist = ((channel.get("contentDetails", {}) or {}).get("relatedPlaylists", {}) or {}).get("uploads", "")
    if not uploads_playlist:
        return []

    page_size = min(max(limit, 1), 50)
    playlist_url = f"{base}/playlistItems?part=contentDetails&playlistId={uploads_playlist}&maxResults={page_size}"
    playlist_data = await _yt_get_json(playlist_url, token)
    video_ids = [
        str(item.get("contentDetails", {}).get("videoId", ""))
        for item in (playlist_data.get("items") or [])
        if item.get("contentDetails")
    ]
    video_ids = [vid for vid in video_ids if vid]
    if not video_ids:
        return []

    details_url = f"{base}/videos?part=snippet,statistics,contentDetails&id=" + ",".join(video_ids)
    details_data = await _yt_get_json(details_url, token)
    raw_items = (details_data.get("items") or [])[:]

    # Channel average views for performance scoring.
    avg_views = 0.0
    for item in raw_items:
        item_stats = item.get("statistics", {}) or {}
        avg_views += float(item_stats.get("viewCount") or 0)
    avg_views = avg_views / len(raw_items) if raw_items else 0.0

    result: List[Dict[str, object]] = []
    for item in raw_items:
        snippet = item.get("snippet", {}) or {}
        item_stats = item.get("statistics", {}) or {}
        content_det = item.get("contentDetails", {}) or {}
        iso_dur = str(content_det.get("duration", "") or "")
        views = int(float(item_stats.get("viewCount") or 0))
        duration_text = _format_iso_duration(iso_dur)

        if avg_views > 0:
            ratio = views / avg_views
            if ratio >= 1.5:
                tag = "🔥 High"
            elif ratio <= 0.5:
                tag = "📉 Low"
            else:
                tag = "📊 Normal"
            score = max(0, min(100, round((views / avg_views) * 50)))
        else:
            tag = "📊 Normal"
            score = 50

        thumbnails = item.get("snippet", {}).get("thumbnails", {}) or {}
        thumb_url = (((thumbnails.get("high") or {}).get("url", ""))
                     or (thumbnails.get("medium", {}) or {}).get("url", "")
                     or (thumbnails.get("default", {}) or {}).get("url", ""))
        result.append({
            "id": str(item.get("id", "")),
            "title": str(snippet.get("title", "") or ""),
            "publishedAt": str(snippet.get("publishedAt", "") or ""),
            "views": views,
            "likes": int(float(item_stats.get("likeCount") or 0)) if item_stats.get("likeCount") else 0,
            "comments": int(float(item_stats.get("commentCount") or 0)) if item_stats.get("commentCount") else 0,
            "duration": iso_dur,
            "durationText": duration_text,
            "thumbnailUrl": thumb_url,
            "performanceTag": tag,
            "performanceScore": score,
        })
    return result


def welcome_menu_text() -> str:
    return (
        "🤖 <b>Universal Multi-Provider AI Bot Platform</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Pick an action below, send /upload to publish a video, or just chat with me.\n\n"
        "• 📤 <b>YouTube Upload</b> — attach a video, published with viral AI SEO\n"
        "• 🔥 <b>AI SEO</b> — titles, descriptions, hashtags & tags, auto-generated\n"
        "• 📊 <b>Status</b> — engine + YouTube connection report\n"
        "• ⚙️ <b>Settings</b> — Auto-Upload ON/OFF"
    )


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command."""
    user = update.effective_user
    username = user.first_name if user else "User"

    welcome_msg = (
        f"🤖 <b>Universal Multi-Provider AI Bot Platform</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Hello, <b>{username}</b>! Welcome to your high-performance AI companion.\n\n"
        f"⚡ <b>Key Capabilities:</b>\n"
        f"• 🧠 <b>Multi-Model AI Cascade:</b> Groq (Llama 3.3 70B), Gemini 2.5/3.7 Flash, OpenRouter DeepSeek R1, Cerebras, Pollinations AI\n"
        f"• 🛡️ <b>Zero-Downtime Architecture:</b> Instant waterfall failover\n"
        f"• 💾 <b>Sliding-Window Memory:</b> Context-aware conversations with <code>/memory</code> and <code>/reset</code>\n"
        f"• 🎨 <b>AI Image Generator:</b> <code>/image &lt;prompt&gt;</code>\n"
        f"• 🌐 <b>Polyglot Translator:</b> <code>/translate &lt;text&gt;</code> (or reply to a message)\n"
        f"• 📝 <b>Smart Summarizer:</b> <code>/summarize &lt;text&gt;</code> (or reply to a message)\n"
        f"• 🌤️ <b>Live Weather Lookup:</b> <code>/weather &lt;city&gt;</code>\n"
        f"• 🔍 <b>Web Search:</b> <code>/search &lt;query&gt;</code>\n"
        f"• 💻 <b>Code Generator:</b> <code>/code &lt;specification&gt;</code>\n"
        f"• ⏰ <b>Reminders:</b> <code>/remind &lt;minutes&gt; &lt;task&gt;</code>\n\n"
        f"💬 <i>Send any message to chat with the AI, or type <code>/help</code> for the full command list!</i>"
    )
    await safe_reply(update, welcome_msg, parse_mode=ParseMode.HTML, reply_markup=main_menu_keyboard())


async def upload_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /upload — ask the user to attach their video file with a caption."""
    if not update.effective_message or not update.effective_chat:
        return
    msg = (
        "📤 <b>Upload a Video</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Please <b>attach your video file</b> now (send it as a video or document).\n\n"
        "💡 <i>Tip: put your topic or description in the message caption — the AI SEO engine will use it.</i>\n\n"
        "Next: choose Public / Private / Unlisted and Made-for-Kids, then the video is published with viral AI SEO."
    )
    await safe_reply(update, msg, parse_mode=ParseMode.HTML, reply_markup=main_menu_keyboard())


async def youtube_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /youtube — report the connected YouTube OAuth token status."""
    if not update.effective_message:
        return
    await safe_reply(update, youtube_status_text(), parse_mode=ParseMode.HTML, reply_markup=main_menu_keyboard())


def _fmt_watch_time(minutes: object) -> str:
    """125.5 -> '2h 6m' style watch-time formatting."""
    try:
        total = int(float(minutes or 0))
    except (TypeError, ValueError):
        return "0m"
    hours, mins = divmod(total, 60)
    return f"{hours}h {mins}m" if hours else f"{mins}m"


def _yt_not_connected_text() -> str:
    return (
        "📺 <b>YouTube Not Connected Yet</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "To unlock live analytics and AI SEO I need your YouTube OAuth credentials:\n\n"
        "1️⃣ Open https://console.cloud.google.com → enable <b>YouTube Data API v3</b>\n"
        "2️⃣ OAuth consent screen → External → add your Google account as a Test user\n"
        "3️⃣ Credentials → <b>OAuth Client ID</b> → Web application → copy ID + Secret\n"
        "4️⃣ Generate a <b>Refresh Token</b> (the Google OAuth 2.0 Playground works great)\n"
        "5️⃣ Set OWNER_YOUTUBE_CLIENT_ID / OWNER_YOUTUBE_CLIENT_SECRET / OWNER_YOUTUBE_REFRESH_TOKEN, then restart\n\n"
        "Then send /yt_check again for your live channel report! ✨"
    )


def _format_yt_check_report(stats: dict, analytics: dict) -> str:
    """Emoji analytics + security-audit report for /yt_check (HTML parse mode)."""
    audit = stats.get("audit", {}) or {}
    traffic = analytics.get("trafficSources") or []
    lines = [
        "📊 <b>YouTube Channel Analytics</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━",
        f"📺 <b>Channel:</b> {html.escape(str(stats.get('title', 'Unknown')))}",
        f"👁 <b>Total Views:</b> {_fmt_compact(stats.get('totalViews'))}",
    ]
    if stats.get("subscriberCountHidden"):
        lines.append("👥 <b>Subscribers:</b> hidden")
    elif stats.get("subscriberCount") is not None:
        lines.append(f"👥 <b>Subscribers:</b> {_fmt_compact(stats.get('subscriberCount'))}")
    lines.append(f"🎬 <b>Videos:</b> {_fmt_compact(stats.get('videoCount'))}")
    lines.extend([
        "",
        "📈 <b>Last 90 Days Performance</b>",
        f"🖼 <b>Impressions:</b> {_fmt_compact(analytics.get('impressions')) if analytics.get('impressions') is not None else 'N/A'}",
        f"🎯 <b>Impression CTR:</b> " + (f"{float(analytics['impressionCtr']):.2f}%" if analytics.get("impressionCtr") is not None else "N/A"),
        f"⏱ <b>Watch Time:</b> {_fmt_watch_time(analytics.get('watchTimeMinutes'))}",
        f"📺 <b>Avg View Duration:</b> {int(float(analytics.get('averageViewDurationSeconds') or 0))}s",
    ])
    if traffic:
        lines.extend(["", "🏆 <b>Top Traffic Sources</b>"])
        for index, entry in enumerate(traffic[:5], start=1):
            lines.append(f"{index}. {html.escape(str(entry.get('label', entry.get('source', ''))))} — {_fmt_compact(entry.get('views'))} views • {_fmt_watch_time(entry.get('watchTimeMinutes'))}")
    lines.extend([
        "",
        f"🛡 <b>Channel Health:</b> {audit.get('healthEmoji', '⚪')} {str(audit.get('health', 'unknown')).title()}",
    ])
    copyright_status = str(audit.get("copyrightStatus", "unknown"))
    copyright_emoji = "✅" if copyright_status == "clean" else ("⚠️" if copyright_status == "review" else "⛔")
    lines.append(f"⚖️ <b>Copyright Status:</b> {copyright_emoji} {copyright_status.title()}")
    for note in (audit.get("auditNotes") or [])[:4]:
        lines.append(f"• {html.escape(str(note))}")
    if analytics.get("note"):
        lines.append(f"ℹ️ {html.escape(str(analytics['note']))}")
    lines.extend([
        "",
        "💡 Tip: run /yt_seo to let the AI optimize your channel metadata.",
    ])
    return "\n".join(lines)


async def yt_check_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /yt_check (alias /analytics) — live channel stats, impressions, CTR and audit."""
    if is_maintenance_mode():
        await safe_reply(update, get_maintenance_message(), parse_mode=ParseMode.HTML)
        return
    if not is_feature_enabled("ytCheck"):
        await safe_reply(update, "🚫 Channel Analytics (/yt_check) is currently disabled by the platform admin. Please try again later.", parse_mode=ParseMode.HTML)
        return
    if not update.effective_message or not update.effective_chat:
        return
    if not OWNER_SETTINGS.get("youtubeRefreshToken"):
        await safe_reply(update, _yt_not_connected_text(), parse_mode=ParseMode.HTML)
        return
    try:
        await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    except Exception:
        pass
    try:
        stats = await fetch_channel_stats_and_audit()
        analytics = await fetch_channel_analytics()
        await safe_reply(update, _format_yt_check_report(stats, analytics), parse_mode=ParseMode.HTML, reply_markup=yt_check_keyboard())
    except Exception as err:
        logger.warning("⚠️ /yt_check failed: %s", err)
        await safe_reply(
            update,
            f"⚠️ <b>Could not load YouTube analytics.</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n<code>{html.escape(str(err))}</code>\n\nCheck your OAuth credentials and try /yt_check again.",
            parse_mode=ParseMode.HTML,
        )


async def yt_seo_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /yt_seo — AI channel SEO audit through the multi-tier AI cascade."""
    if is_maintenance_mode():
        await safe_reply(update, get_maintenance_message(), parse_mode=ParseMode.HTML)
        return
    if not is_feature_enabled("ytSeo"):
        await safe_reply(update, "🚫 AI Channel SEO (/yt_seo) is currently disabled by the platform admin. Please try again later.", parse_mode=ParseMode.HTML)
        return
    if not update.effective_message or not update.effective_chat:
        return
    if not OWNER_SETTINGS.get("youtubeRefreshToken"):
        await safe_reply(update, _yt_not_connected_text(), parse_mode=ParseMode.HTML)
        return
    chat_id = update.effective_chat.id
    try:
        await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
    except Exception:
        pass
    try:
        context_data = await fetch_channel_seo_context()
    except Exception as err:
        logger.warning("⚠️ /yt_seo context fetch failed: %s", err)
        await safe_reply(
            update,
            f"⚠️ <b>Could not load channel data for AI SEO.</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n<code>{html.escape(str(err))}</code>\n\nCheck your OAuth credentials and try /yt_seo again.",
            parse_mode=ParseMode.HTML,
        )
        return
    latest = [
        {
            "title": video.get("title", ""),
            "publishedAt": video.get("publishedAt", ""),
            "tags": (video.get("tags") or [])[:10],
            "views": video.get("viewCount"),
        }
        for video in (context_data.get("latestVideos") or [])[:5]
    ]
    prompt = (
        "You are an elite YouTube growth strategist. Audit this channel and return "
        "ONLY valid JSON (no markdown fences) with this exact shape: "
        '{"keywords":["10 high-converting channel keywords"],'
        '"bio":"viral channel description/bio (2-4 short paragraphs, hooks + value + CTA, include hashtags)",'
        '"tags":["15 ranking tags mixing broad and long-tail"],'
        '"recommendations":["5 structural SEO recommendations (playlists, title formula, upload cadence, shorts strategy, community tab)"]}'
        "\n\nCHANNEL CONTEXT:\n"
        f"Name: {context_data.get('title', 'Unknown channel')}\n"
        f"Handle: {context_data.get('customUrl') or 'n/a'}\n"
        f"Current description: {str(context_data.get('description', '') or 'empty')[:600]}\n"
        f"Current channel keywords: {', '.join(context_data.get('keywords') or []) or 'none set'}\n"
        f"Country: {context_data.get('country') or 'n/a'} | Created: {context_data.get('publishedAt')}\n"
        f"Stats: {context_data.get('subscriberCount') or '?'} subscribers, {context_data.get('totalViews')} total views, {context_data.get('videoCount')} videos\n"
        f"Latest videos: {json.dumps(latest, ensure_ascii=False)}"
    )
    ai_text = await generate_ai_reply(chat_id, prompt)
    offline = not ai_text or "দুঃখিত" in ai_text
    parsed = None
    if not offline:
        try:
            candidate = ai_text.strip()
            fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", candidate, re.IGNORECASE)
            if fenced:
                candidate = fenced.group(1)
            start = candidate.find("{")
            end = candidate.rfind("}")
            if start != -1 and end > start:
                parsed = json.loads(candidate[start:end + 1])
        except (json.JSONDecodeError, ValueError):
            parsed = None
    lines = [
        "🔥 <b>AI Channel SEO Recommendations</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━",
        f"📺 <b>{html.escape(str(context_data.get('title') or 'Unknown channel'))}</b> — "
        f"{_fmt_compact(context_data.get('subscriberCount') or 0)} subs · {_fmt_compact(context_data.get('videoCount') or 0)} videos",
    ]
    if parsed and isinstance(parsed, dict):
        keywords = [str(k) for k in (parsed.get("keywords") or []) if str(k).strip()]
        tags = [str(t) for t in (parsed.get("tags") or []) if str(t).strip()]
        recommendations = [str(r) for r in (parsed.get("recommendations") or []) if str(r).strip()]
        bio = str(parsed.get("bio") or "").strip()
        if keywords:
            lines.append("\n🎯 <b>High-Converting Keywords</b>")
            lines.append("\n".join(f"• {html.escape(k)}" for k in keywords[:10]))
        if bio:
            lines.append("\n✍️ <b>Viral Bio / Description</b>")
            lines.append(html.escape(bio[:1200]))
        if tags:
            lines.append("\n🏷️ <b>Tag List (copy-paste)</b>")
            lines.append("<code>" + " ".join(tags[:15]) + "</code>")
        if recommendations:
            lines.append("\n🏗️ <b>Structural SEO Recommendations</b>")
            lines.append("\n".join(f"{i + 1}. {html.escape(r)}" for i, r in enumerate(recommendations[:5])))
    else:
        # Offline / unparseable fallback so the report never comes back empty.
        context_title = html.escape(str(context_data.get("title") or "your channel"))
        ctx_keywords = context_data.get("keywords") or []
        if ctx_keywords:
            lines.append(f"\n🔑 <b>Existing Channel Keywords</b>\n{html.escape(' '.join(str(k) for k in ctx_keywords[:15]))}")
        lines.append("\n⚡ <b>Quick Win Audit</b>")
        lines.append("• Lead every title with the search keyword at position 1-2")
        lines.append("• Add 3-5 targeted hashtags (#niche, #tutorial, #viral) to every upload")
        lines.append("• Group uploads into keyword-focused playlists to boost watch time")
        lines.append("• Mirror top-performing titles into Shorts and Community posts")
        if offline:
            lines.append("\n<i>(AI cascade engines were offline — built from live channel context only.)</i>")
    lines.append(f"\n⚡ Built for <b>{context_title}</b> — quick actions below.")
    await safe_reply(update, "\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=yt_seo_keyboard())


async def fetch_viral_video_predictions() -> List[Dict[str, object]]:
    """AI-powered viral video concept predictions using the multi-tier AI cascade."""
    video_history = await fetch_recent_video_history(15)
    channel_stats = await fetch_channel_stats_and_audit()
    try:
        analytics = await fetch_channel_analytics()
    except Exception:
        analytics = None

    sorted_by_views = sorted(video_history, key=lambda v: int(v.get("views") or 0), reverse=True)
    top_performers = sorted_by_views[:5]
    recent = video_history[:10]
    traffic = (analytics or {}).get("trafficSources") or [] if isinstance(analytics, dict) else []
    traffic_str = ", ".join(f"{t.get('label', t.get('source', ''))} ({_fmt_compact(t.get('views', 0))} views)" for t in traffic) or "data unavailable"

    title = channel_stats.get("title", "Unknown channel") if channel_stats else "your channel"
    custom_url = channel_stats.get("customUrl", "n/a") if channel_stats else "n/a"
    description = str(channel_stats.get("description", "") or "n/a")[:500] if channel_stats else "n/a"
    subscriber_count = channel_stats.get("subscriberCount") if channel_stats else None
    total_views = channel_stats.get("totalViews", 0) if channel_stats else 0
    video_count = channel_stats.get("videoCount", 0) if channel_stats else 0
    sub_text = "subscribers hidden" if channel_stats.get("subscriberCountHidden") else _fmt_compact(subscriber_count or 0)

    prompt = (
        "You are an elite YouTube growth strategist. Analyze this channel's content history "
        "and performance data, then generate 3-5 high-potential viral video concepts that will "
        "maximize views, watch time, and click-through rate. Return ONLY valid JSON (no markdown "
        'fences) with this exact shape: {"concepts":[{'
        '"title":"Proposed video title (max 70 chars)","hook":"The viral hook - first 15 seconds",'
        '"recommendedLength":"e.g. \'8-10 min long-form\' or \'Short (<60s)\'","format":"e.g. \'long-form tutorial\' or \'Short\'",'
        '"targetAudienceInterest":"What need/curiosity this taps into and why audience will engage",'
        '"uploadTiming":"Best day/time to post","whyItWillPerform":"Why it will outperform current average"}]}\n\n'
        f"CHANNEL: {title} ({custom_url})\n"
        f"Niche/Description: {description}\n"
        f"Stats: {sub_text} subscribers, {_fmt_compact(total_views)} total views, {video_count} videos\n"
        "TOP-PERFORMING VIDEOS:\n" + "\n".join(f'- "{v.get("title", "")}" — {_fmt_compact(v.get("views", 0))} views, {v.get("performanceTag", "")} {v.get("publishedAt", "")}' for v in top_performers) + "\n"
        "RECENT VIDEOS:\n" + "\n".join(f'- "{v.get("title", "")}" — {_fmt_compact(v.get("views", 0))} views ({v.get("durationText", "")}) {v.get("performanceTag", "")}' for v in recent) + "\n"
        f"TRAFFIC SOURCES: {traffic_str}"
    )

    ai_text = await generate_ai_reply(0, prompt)
    if not ai_text or not ai_text.strip():
        return []

    candidate = ai_text.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", candidate, re.IGNORECASE)
    if fenced:
        candidate = fenced.group(1)

    concepts: List[Dict[str, object]] = []
    arr_start = candidate.find("[")
    arr_end = candidate.rfind("]")
    if arr_start != -1 and arr_end > arr_start:
        try:
            parsed = json.loads(candidate[arr_start:arr_end + 1])
            if isinstance(parsed, list):
                concepts = parsed
        except (json.JSONDecodeError, ValueError):
            pass
    if not concepts:
        obj_start = candidate.find("{")
        obj_end = candidate.rfind("}")
        if obj_start != -1 and obj_end > obj_start:
            try:
                parsed = json.loads(candidate[obj_start:obj_end + 1])
                if isinstance(parsed, dict) and isinstance(parsed.get("concepts"), list):
                    concepts = parsed["concepts"]
                elif isinstance(parsed, dict) and parsed:
                    concepts = [parsed]
            except (json.JSONDecodeError, ValueError):
                pass

    result = []
    for concept in concepts:
        if not isinstance(concept, dict):
            continue
        entry = {
            "title": str(concept.get("title", "")).strip(),
            "hook": str(concept.get("hook", "")).strip(),
            "recommendedLength": str(concept.get("recommendedLength", "")).strip(),
            "format": str(concept.get("format", "")).strip(),
            "targetAudienceInterest": str(concept.get("targetAudienceInterest", "")).strip(),
            "uploadTiming": str(concept.get("uploadTiming", "")).strip(),
            "whyItWillPerform": str(concept.get("whyItWillPerform", "")).strip(),
        }
        if entry["title"] or entry["hook"]:
            result.append(entry)
        return result[:5]


def _format_viral_report(channel_name: str, predictions: List[Dict[str, object]], video_count: int) -> str:
    """Format the AI viral video prediction report for /yt_viral (HTML parse mode)."""
    lines = [
        "🔮 <b>AI Viral Video Predictions</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━",
        f"📺 <b>{html.escape(str(channel_name))}</b> — based on {video_count} recent videos",
        "",
    ]
    for index, prediction in enumerate(predictions, start=1):
        lines.append(f"🔥 <b>Concept {index}: {html.escape(str(prediction.get('title', '')))}</b>")
        lines.append(f"🎣 <b>Hook:</b> {html.escape(str(prediction.get('hook', '')))}")
        lines.append(f"? <b>Length:</b> {html.escape(str(prediction.get('recommendedLength', '')))} ({html.escape(str(prediction.get('format', '')))})")
        lines.append(f"👥 <b>Audience:</b> {html.escape(str(prediction.get('targetAudienceInterest', '')))}")
        lines.append(f"📅 <b>Timing:</b> {html.escape(str(prediction.get('uploadTiming', '')))}")
        lines.append(f"💡 <b>Why:</b> {html.escape(str(prediction.get('whyItWillPerform', '')))}")
        lines.append("")
    lines.append("⚡ Tip: /yt_seo for channel SEO, or /upload to publish with viral AI SEO.")
    return "\n".join(lines)


async def yt_viral_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /yt_viral — AI-powered viral video concept predictions for the channel."""
    if is_maintenance_mode():
        await safe_reply(update, get_maintenance_message(), parse_mode=ParseMode.HTML)
        return
    if not is_feature_enabled("ytViral"):
        await safe_reply(update, "🚫 AI Viral Predictor (/yt_viral) is currently disabled by the platform admin. Please try again later.", parse_mode=ParseMode.HTML)
        return
    if not update.effective_message or not update.effective_chat:
        return
    if not OWNER_SETTINGS.get("youtubeRefreshToken"):
        await safe_reply(update, _yt_not_connected_text(), parse_mode=ParseMode.HTML)
        return
    chat_id = update.effective_chat.id
    try:
        await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
    except Exception:
        pass
    try:
        stats = await fetch_channel_stats_and_audit()
        video_history = await fetch_recent_video_history(15)
        predictions = await fetch_viral_video_predictions()
        if not predictions:
            await safe_reply(
                update,
                "⚠️ <b>AI could not generate viral ideas.</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "The channel may not have enough video data yet. Upload a few videos and try /yt_viral again.",
                parse_mode=ParseMode.HTML,
            )
            return
        await safe_reply(
            update,
            _format_viral_report(stats.get("title", "your channel"), predictions, len(video_history)),
            parse_mode=ParseMode.HTML,
            reply_markup=yt_viral_keyboard(),
        )
    except Exception as err:
        logger.warning("⚠️ /yt_viral failed: %s", err)
        await safe_reply(
            update,
            f"⚠️ <b>Could not generate viral predictions.</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n<code>{html.escape(str(err))}</code>\n\nCheck your OAuth credentials and try /yt_viral again.",
            parse_mode=ParseMode.HTML,
        )


async def settings_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /settings — interactive configuration options (Auto-Upload ON/OFF)."""
    if not update.effective_message:
        return
    msg = (
        "⚙️ <b>Settings</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"• Auto-Upload: <b>{'ON ✅' if OWNER_SETTINGS.get('autoUpload') else 'OFF ❌'}</b>\n"
        "Tap the toggle below to change it."
    )
    await safe_reply(update, msg, parse_mode=ParseMode.HTML, reply_markup=settings_keyboard())


async def menu_callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle inline-keyboard button presses for the interactive menus."""
    query = update.callback_query
    if not query:
        return
    data = (query.data or "").strip()
    try:
        await query.answer()
    except Exception:
        pass
    if update.effective_chat is None:
        return
    chat_id = update.effective_chat.id

    if data == "menu:upload":
        await context.bot.send_message(
            chat_id=chat_id,
            text="📤 <b>Upload a Video</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nPlease <b>attach your video file</b> now (as a video or document). Put your topic in the caption if you like.",
            parse_mode=ParseMode.HTML,
            reply_markup=main_menu_keyboard(),
        )
    elif data == "menu:seo":
        await context.bot.send_message(
            chat_id=chat_id,
            text="🔥 <b>AI SEO</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nEvery upload automatically gets a high-CTR viral title, engagement-focused description, hashtags and ranking tags — powered by the multi-model AI cascade. Start with /upload.",
            parse_mode=ParseMode.HTML,
            reply_markup=main_menu_keyboard(),
        )
    elif data == "menu:status":
        await context.bot.send_message(chat_id=chat_id, text=youtube_status_text(), parse_mode=ParseMode.HTML, reply_markup=main_menu_keyboard())
    elif data == "menu:settings":
        await context.bot.send_message(chat_id=chat_id, text="⚙️ <b>Settings</b>\n\nTap the toggle to change it:", parse_mode=ParseMode.HTML, reply_markup=settings_keyboard())
    elif data == "settings:toggle_autoupload":
        OWNER_SETTINGS["autoUpload"] = not bool(OWNER_SETTINGS.get("autoUpload"))
        state = "ON ✅" if OWNER_SETTINGS["autoUpload"] else "OFF ❌"
        await context.bot.send_message(chat_id=chat_id, text=f"⚙️ Auto-Upload is now <b>{state}</b>", parse_mode=ParseMode.HTML, reply_markup=settings_keyboard())
    elif data in ("yt:analytics",):
        await yt_check_command(update, context)
    elif data == "yt:seo":
        await yt_seo_command(update, context)
    elif data == "yt:viral":
        await yt_viral_command(update, context)
    else:  # menu:home and any unknown payload
        await context.bot.send_message(chat_id=chat_id, text=welcome_menu_text(), parse_mode=ParseMode.HTML, reply_markup=main_menu_keyboard())


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command."""
    help_msg = (
        "📖 <b>Comprehensive Command Catalog:</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "🔹 <b>AI Generation & Utilities:</b>\n"
        "• <code>/translate [lang] &lt;text&gt;</code> - Multi-language translation suite\n"
        "• <code>/summarize &lt;text&gt;</code> - Executive summary & key takeaways\n"
        "• <code>/image &lt;prompt&gt;</code> - Synthesize HD image via AI (Zero Key)\n"
        "• <code>/weather &lt;city&gt;</code> - Live meteorological report (Open-Meteo)\n"
        "• <code>/search &lt;query&gt;</code> - Real-time web intelligence synthesis\n"
        "• <code>/code &lt;request&gt;</code> - Generate clean, formatted code solutions\n"
        "• <code>/remind &lt;minutes&gt; &lt;text&gt;</code> - Schedule an async reminder alert\n\n"
        "🔹 <b>Diagnostics & Context:</b>\n"
        "• <code>/memory</code> - Inspect active sliding-window buffer\n"
        "• <code>/reset</code> or <code>/clear</code> - Clear conversation memory\n"
        "• <code>/status</code> - Live uptime, memory & AI provider status\n"
        "• <code>/ping</code> or <code>/health</code> - Instant heartbeat check\n"
        "• <code>/id</code> - Show your Chat ID and user metadata\n\n"
        "🔹 <b>YouTube Studio:</b>\n"
        "• <code>/yt_check</code> or <code>/analytics</code> - Live channel analytics & health audit\n"
                "• <code>/yt_seo</code> - AI channel keywords, viral bio, tags & SEO plan\n"
        "• <code>/yt_viral</code> - AI-powered viral video concept predictions\n"
        "• <code>/upload</code> - Publish a video with viral AI SEO\n\n"
        "💡 <i>Tip: Reply to any message with <code>/summarize</code> or <code>/translate Spanish</code>!</i>"
    )
    await safe_reply(update, help_msg, parse_mode=ParseMode.HTML)


async def ping_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /ping and /health command."""
    uptime_secs = int(asyncio.get_event_loop().time() - start_time) if start_time else 0
    mins, secs = divmod(uptime_secs, 60)
    await safe_reply(
        update,
        f"🏓 <b>Pong! System Operational</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n• <b>Service:</b> <code>ONLINE</code>\n• <b>Uptime:</b> <code>{mins}m {secs}s</code>\n• <b>Mode:</b> <code>{RUN_MODE.upper()}</code>",
        parse_mode=ParseMode.HTML,
    )


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /status command."""
    uptime_secs = int(asyncio.get_event_loop().time() - start_time) if start_time else 0
    mins, secs = divmod(uptime_secs, 60)
    hours, mins = divmod(mins, 60)

    has_groq = bool(GROQ_API_KEYS)
    has_gemini = bool(GEMINI_API_KEYS)
    has_or = bool(OPENROUTER_API_KEY and not OPENROUTER_API_KEY.startswith("YOUR_"))
    has_cerebras = bool(CEREBRAS_API_KEY and not CEREBRAS_API_KEY.startswith("YOUR_"))

    status_msg = (
        "🟢 <b>UNIVERSAL BOT PLATFORM STATUS</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"• <b>Runtime:</b> <code>Python {sys.version.split()[0]} (python-telegram-bot v21+)</code>\n"
        f"• <b>Delivery Mode:</b> <code>{RUN_MODE.upper()}</code>\n"
        f"• <b>Uptime:</b> <code>{hours}h {mins}m {secs}s</code>\n"
        f"• <b>Active Chat Sessions:</b> <code>{len(chat_memories)}</code>\n\n"
        f"🧠 <b>AI Cascade Engine:</b>\n"
        f"• [Tier 1] Groq LPU ({GROQ_MODEL}): <code>{'ACTIVE 🟢' if has_groq else 'STANDBY ⚪'}</code>\n"
        f"• [Tier 2] Gemini ({GEMINI_MODEL}): <code>{'ACTIVE 🟢' if has_gemini else 'STANDBY ⚪'}</code>\n"
        f"• [Tier 3] OpenRouter (DeepSeek R1): <code>{'ACTIVE 🟢' if has_or else 'STANDBY ⚪'}</code>\n"
        f"• [Tier 4] Cerebras LPU ({CEREBRAS_MODEL}): <code>{'ACTIVE 🟢' if has_cerebras else 'STANDBY ⚪'}</code>\n"
        f"• [Tier 5] Pollinations AI (Zero Key): <code>ACTIVE 🟢 (Always Available)</code>\n\n"
        f"📺 <b>YouTube Connection:</b> <code>{'CONNECTED ✅' if _youtube_connected() else 'NOT CONNECTED ❌'}</code>\n"
        f"• <b>HTTP Ingress:</b> <code>0.0.0.0:{PORT} (OK)</code>"
    )
    await safe_reply(update, status_msg, parse_mode=ParseMode.HTML)


async def id_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /id command."""
    if not update.effective_chat:
        return
    chat_id = update.effective_chat.id
    user = update.effective_user
    username = user.username if (user and user.username) else (user.first_name if user else "Unknown")
    await safe_reply(
        update,
        f"🆔 <b>Chat Telemetry:</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n• <b>Chat ID:</b> <code>{chat_id}</code>\n• <b>Username:</b> @{username}",
        parse_mode=ParseMode.HTML,
    )


async def memory_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /memory command to inspect sliding window buffer."""
    if not update.effective_chat:
        return
    chat_id = update.effective_chat.id
    mem = chat_memories.get(chat_id)
    turns_count = len(mem.turns) if mem else 0
    total_chars = sum(len(t.get("content", "")) for t in mem.turns) if mem else 0

    msg = (
        f"🧠 <b>Sliding-Window Conversation Buffer:</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"• <b>Active Turns:</b> <code>{turns_count} / {MAX_MEMORY_TURNS * 2}</code> ({turns_count // 2} exchanges)\n"
        f"• <b>Character Budget:</b> <code>{total_chars} / {MAX_CHAR_BUDGET} chars</code>\n"
        f"• <b>Context Summary:</b> <code>{('ACTIVE 🟢 (' + mem.summary + ')') if mem and mem.summary else 'NONE (Buffer Fresh) ⚪'}</code>\n\n"
        f"💡 <i>Use <code>/reset</code> or <code>/clear</code> to wipe this context at any time.</i>"
    )
    await safe_reply(update, msg, parse_mode=ParseMode.HTML)


async def reset_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /reset and /clear command."""
    if not update.effective_chat:
        return
    chat_id = update.effective_chat.id
    chat_memories.pop(chat_id, None)
    await safe_reply(
        update,
        "🧹 <b>Conversation buffer cleared!</b> Starting a fresh context.",
        parse_mode=ParseMode.HTML,
    )


async def translate_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /translate [lang] <text> or reply to message."""
    if not update.effective_message or not update.effective_chat:
        return

    raw_args = " ".join(context.args) if context.args else ""
    reply_msg = update.effective_message.reply_to_message
    reply_text = (reply_msg.text or reply_msg.caption or "").strip() if reply_msg else ""

    text_to_translate = ""
    target_lang = "English"

    if reply_text:
        text_to_translate = reply_text
        if raw_args:
            target_lang = raw_args.strip()
    elif raw_args:
        # Check patterns: "/translate to Spanish Hello" or "/translate Hello to Spanish"
        m1 = re.match(r"^to\s+([a-zA-Z\s]+?)\s*:\s*(.+)$", raw_args, re.IGNORECASE) or re.match(r"^to\s+([a-zA-Z]+)\s+(.+)$", raw_args, re.IGNORECASE)
        m2 = re.match(r"^(.+?)\s+to\s+([a-zA-Z]+)$", raw_args, re.IGNORECASE)
        if m1:
            target_lang = m1.group(1).strip()
            text_to_translate = m1.group(2).strip()
        elif m2:
            text_to_translate = m2.group(1).strip()
            target_lang = m2.group(2).strip()
        else:
            text_to_translate = raw_args.strip()

    if not text_to_translate:
        await safe_reply(
            update,
            "🌐 <b>Usage:</b>\n"
            "• <code>/translate &lt;text&gt; to &lt;language&gt;</code>\n"
            "• <code>/translate to &lt;language&gt; &lt;text&gt;</code>\n"
            "• <i>Or reply to any message with <code>/translate Spanish</code>!</i>",
            parse_mode=ParseMode.HTML,
        )
        return

    prompt = (
        f"You are a professional polyglot translator. Detect the source language and accurately translate the following text into {target_lang}.\n\n"
        f"Format clearly with:\n"
        f"• **Detected Source Language:** [Source]\n"
        f"• **Target Translation ({target_lang}):** [Translation]\n"
        f"• **Phonetic Pronunciation / Notes:** (if applicable)\n\n"
        f"Text:\n\"{text_to_translate}\""
    )

    try:
        await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    except Exception:
        pass

    reply = await generate_ai_reply(update.effective_chat.id, prompt)
    await safe_reply(
        update,
        f"🌐 <b>Polyglot Translation Result:</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n{reply}",
        parse_mode=ParseMode.MARKDOWN,
    )


async def summarize_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /summarize <text> or reply to message."""
    if not update.effective_message or not update.effective_chat:
        return

    raw_text = " ".join(context.args) if context.args else ""
    reply_msg = update.effective_message.reply_to_message
    if not raw_text and reply_msg:
        raw_text = (reply_msg.text or reply_msg.caption or "").strip()

    if not raw_text:
        await safe_reply(
            update,
            "📝 <b>Usage:</b>\n• <code>/summarize &lt;long text or article&gt;</code>\n• <i>Or reply to any message with <code>/summarize</code>!</i>",
            parse_mode=ParseMode.HTML,
        )
        return

    prompt = (
        f"You are an executive summarization engine. Analyze the provided text and output a high-impact summary.\n\n"
        f"Include:\n"
        f"• 🎯 **Core TL;DR** (1-2 sentences)\n"
        f"• 📌 **Key Points & Insights** (3-6 bullet points)\n"
        f"• 🚀 **Action Items** (if applicable)\n\n"
        f"Text:\n\"{raw_text}\""
    )

    try:
        await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    except Exception:
        pass

    summary = await generate_ai_reply(update.effective_chat.id, prompt)
    await safe_reply(
        update,
        f"📝 <b>Executive Summary & Key Takeaways:</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n{summary}",
        parse_mode=ParseMode.MARKDOWN,
    )


async def image_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /image <prompt> command."""
    if not update.effective_message or not update.effective_chat:
        return

    prompt = " ".join(context.args) if context.args else ""
    if not prompt:
        await safe_reply(
            update,
            "🎨 <b>AI Image Generator (Zero API Key)</b>\n\nUsage: <code>/image &lt;your visual prompt&gt;</code>\nExample: <code>/image futuristic cyberpunk city in rain, neon reflections, 8k render</code>",
            parse_mode=ParseMode.HTML,
        )
        return

    try:
        await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.UPLOAD_PHOTO)
    except Exception:
        pass

    image_url = f"https://image.pollinations.ai/prompt/{prompt.replace(' ', '%20')}?width=1024&height=1024&nologo=true&seed={int(asyncio.get_event_loop().time())}&model=flux"

    try:
        await update.effective_message.reply_photo(
            photo=image_url,
            caption=f"🎨 <b>Prompt:</b> <i>{prompt}</i>\n✨ <i>Synthesized via Flux / SDXL</i>",
            parse_mode=ParseMode.HTML,
        )
    except Exception as err:
        logger.warning(f"Direct photo send failed: {err}. Falling back to URL.")
        await safe_reply(
            update,
            f"🎨 <b>AI Image Synthesized:</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n• <b>Prompt:</b> <i>\"{prompt}\"</i>\n• <b>Direct HD Link:</b> {image_url}",
            parse_mode=ParseMode.HTML,
        )


async def weather_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /weather <city> using Open-Meteo live API."""
    if not update.effective_message or not update.effective_chat:
        return

    city = " ".join(context.args) if context.args else "London"
    try:
        await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    except Exception:
        pass

    try:
        async with aiohttp.ClientSession() as session:
            # Geocoding
            geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=en&format=json"
            async with session.get(geo_url, timeout=aiohttp.ClientTimeout(total=8)) as geo_resp:
                if geo_resp.status == 200:
                    geo_data = await geo_resp.json()
                    results = geo_data.get("results", [])
                    if results:
                        loc = results[0]
                        lat = loc.get("latitude")
                        lon = loc.get("longitude")
                        name = loc.get("name")
                        country = loc.get("country", "")

                        # Forecast
                        weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"
                        async with session.get(weather_url, timeout=aiohttp.ClientTimeout(total=8)) as w_resp:
                            if w_resp.status == 200:
                                w_data = await w_resp.json()
                                curr = w_data.get("current_weather", {})
                                temp_c = curr.get("temperature", 0)
                                temp_f = round((temp_c * 9 / 5) + 32, 1)
                                wind = curr.get("windspeed", 0)
                                wind_dir = curr.get("winddirection", 0)

                                w_code = curr.get("weathercode", 0)
                                icon = "☀️"
                                cond = "Clear Sky"
                                if 1 <= w_code <= 3:
                                    icon, cond = "⛅", "Partly Cloudy"
                                elif 45 <= w_code <= 48:
                                    icon, cond = "🌫️", "Foggy"
                                elif 51 <= w_code <= 67:
                                    icon, cond = "🌧️", "Rain / Drizzle"
                                elif 71 <= w_code <= 77:
                                    icon, cond = "❄️", "Snowfall"
                                elif 80 <= w_code <= 82:
                                    icon, cond = "🌦️", "Rain Showers"
                                elif w_code >= 95:
                                    icon, cond = "⛈️", "Thunderstorm"

                                msg = (
                                    f"{icon} <b>Live Weather: {name}, {country}</b>\n"
                                    f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                                    f"• <b>Condition:</b> <code>{cond}</code>\n"
                                    f"• <b>Temperature:</b> <code>{temp_c}°C</code> ({temp_f}°F)\n"
                                    f"• <b>Wind Speed:</b> <code>{wind} km/h</code> (Dir: {wind_dir}°)\n"
                                    f"• <b>Coordinates:</b> <code>{lat:.2f}, {lon:.2f}</code>\n\n"
                                    f"💡 <i>Real-time meteorological data via Open-Meteo API.</i>"
                                )
                                await safe_reply(update, msg, parse_mode=ParseMode.HTML)
                                return
        await safe_reply(update, f"⚠️ Could not find weather data for <b>{city}</b>. Please check spelling.", parse_mode=ParseMode.HTML)
    except Exception as err:
        await safe_reply(update, f"⚠️ Weather request failed: {err}")


async def search_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /search <query> using search synthesis."""
    if not update.effective_message or not update.effective_chat:
        return

    query = " ".join(context.args) if context.args else ""
    if not query:
        await safe_reply(
            update,
            "🔍 <b>AI Web Intelligence Search</b>\n\nUsage: <code>/search &lt;query&gt;</code>\nExample: <code>/search latest advances in quantum computing</code>",
            parse_mode=ParseMode.HTML,
        )
        return

    try:
        await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    except Exception:
        pass

    prompt = (
        f"You are a real-time web intelligence and research engine. Provide a verified, comprehensive synthesis for the query: \"{query}\".\n\n"
        f"Include:\n"
        f"• 📌 **Executive Overview**\n"
        f"• 🔍 **Detailed Breakdown & Key Findings**\n"
        f"• 💡 **Strategic Summary & Practical Takeaway**"
    )

    search_result = await generate_ai_reply(update.effective_chat.id, prompt)
    await safe_reply(
        update,
        f"🔍 <b>Web Intelligence Synthesis:</b> <i>\"{query}\"</i>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n{search_result}",
        parse_mode=ParseMode.MARKDOWN,
    )


async def code_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /code <request> command."""
    if not update.effective_message or not update.effective_chat:
        return

    req = " ".join(context.args) if context.args else ""
    if not req:
        await safe_reply(
            update,
            "💻 <b>AI Code Generation Suite</b>\n\nUsage: <code>/code &lt;problem or specification&gt;</code>\nExample: <code>/code Node.js Express rate limiting middleware</code>",
            parse_mode=ParseMode.HTML,
        )
        return

    try:
        await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    except Exception:
        pass

    prompt = f"You are an expert software engineer. Provide a clean, robust, well-commented code solution for:\n\n\"{req}\"\n\nFollow up with bulleted explanation points."
    code_res = await generate_ai_reply(update.effective_chat.id, prompt)
    await safe_reply(
        update,
        f"💻 <b>Code Solution:</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n{code_res}",
        parse_mode=ParseMode.MARKDOWN,
    )


async def remind_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /remind <minutes> <message> command."""
    if not update.effective_message or not update.effective_chat:
        return

    if not context.args or len(context.args) < 2:
        await safe_reply(
            update,
            "⏰ <b>Usage:</b> <code>/remind &lt;minutes&gt; &lt;reminder text&gt;</code>\n"
            "<i>Example: /remind 10 Check server deployment</i>",
            parse_mode=ParseMode.HTML,
        )
        return

    try:
        minutes = float(context.args[0])
        reminder_text = " ".join(context.args[1:])
    except ValueError:
        await safe_reply(
            update,
            "⚠️ Please specify a valid number of minutes. Example: <code>/remind 5 Drink water</code>",
            parse_mode=ParseMode.HTML,
        )
        return

    chat_id = update.effective_chat.id
    delay_secs = int(minutes * 60)

    await safe_reply(
        update,
        f"⏰ <b>Reminder scheduled!</b> I will notify you in <b>{minutes} minute(s)</b> about: <i>\"{reminder_text}\"</i>",
        parse_mode=ParseMode.HTML,
    )

    async def _send_later():
        await asyncio.sleep(delay_secs)
        try:
            await context.bot.send_message(
                chat_id=chat_id,
                text=f"🔔 <b>REMINDER ALERT:</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📌 <b>Task:</b> {reminder_text}",
                parse_mode=ParseMode.HTML,
            )
        except Exception as err:
            logger.error(f"Failed to trigger reminder alert to {chat_id}: {err}")

    asyncio.create_task(_send_later())


async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Process normal user chat messages and bridge to AI cascade."""
    if not update.effective_message or not update.effective_chat:
        return

    user_text = (update.effective_message.text or update.effective_message.caption or "").strip()
    if not user_text:
        return

    chat_id = update.effective_chat.id
    user = update.effective_user
    username = user.first_name if user else "User"

    logger.info(f"📩 Message from {username} ({chat_id}): {user_text[:60]}")

    # Send typing action
    try:
        await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
    except Exception as e:
        logger.debug(f"Typing indicator error: {e}")

    # Generate response
    reply_text = await generate_ai_reply(chat_id, user_text)
    if not reply_text.strip():
        logger.warning("No AI response was available for Telegram message from %s.", chat_id)
        return

    # Save to sliding window history
    update_chat_history(chat_id, user_text, reply_text)

    # Send formatted response safely
    await safe_reply(update, reply_text, parse_mode=ParseMode.MARKDOWN)


# ==========================================
# AIOHTTP HTTP SERVER & WEBHOOK DISPATCHER
# ==========================================

def _is_valid_bot_token(token: str) -> bool:
    """Return whether a supplied value looks like a real BotFather token."""
    return bool(token and not token.startswith("YOUR_") and ":" in token and len(token) >= 15)


def _session_webhook_id(token: str) -> str:
    """Deterministic, URL-safe webhook session id derived from a bot token."""
    return hashlib.sha256(("automotion-webhook:" + token).encode("utf-8")).hexdigest()[:24]


def _session_webhook_secret(token: str) -> str:
    """Deterministic per-session webhook secret (Telegram echoes it back verbatim)."""
    material = f"{WEBHOOK_SECRET}|automotion|{token}" if WEBHOOK_SECRET else f"automotion|{token}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


async def start_telegram_session(token: str) -> Application:
    """Initialize and start an isolated polling session for one bot token."""
    normalized_token = token.strip()
    if not _is_valid_bot_token(normalized_token):
        raise ValueError("A valid Telegram bot token is required.")

    async with telegram_session_lock:
        existing = telegram_sessions.get(normalized_token)
        if existing:
            return existing

        app = build_telegram_application(normalized_token)
        try:
            await app.initialize()
            await app.bot.get_me()
            await app.start()
            if not app.updater:
                raise RuntimeError("Telegram updater is unavailable.")
            await app.bot.delete_webhook(drop_pending_updates=True)
            await app.updater.start_polling(drop_pending_updates=True)
        except Exception:
            if app.updater and app.updater.running:
                await app.updater.stop()
            await app.stop()
            await app.shutdown()
            raise

        telegram_sessions[normalized_token] = app
        logger.info("Telegram polling session started for token ending in ...%s", normalized_token[-6:])
        return app


async def start_telegram_webhook_session(token: str, base_url: str) -> Application:
    """Initialize an isolated per-user bot session and register its dynamic HTTPS webhook."""
    normalized_token = token.strip()
    if not _is_valid_bot_token(normalized_token):
        raise ValueError("A valid Telegram bot token is required.")
    base = (base_url or PUBLIC_BASE_URL).rstrip("/")
    if not base.startswith("https://"):
        raise ValueError("An HTTPS PUBLIC_BASE_URL is required to register dynamic Telegram webhooks.")

    async with telegram_session_lock:
        existing = telegram_sessions.get(normalized_token)
        if existing and normalized_token in webhook_sessions:
            return existing

        app = build_telegram_application(normalized_token)
        webhook_id = _session_webhook_id(normalized_token)
        webhook_url = f"{base}/webhook/{webhook_id}"
        try:
            if existing:
                # Upgrade an existing polling session to webhook mode.
                if existing.updater and existing.updater.running:
                    await existing.updater.stop()
                await existing.stop()
                await existing.shutdown()
                telegram_sessions.pop(normalized_token, None)
            await app.initialize()
            await app.bot.get_me()
            await app.start()
            await app.bot.set_webhook(
                url=webhook_url,
                secret_token=_session_webhook_secret(normalized_token),
                allowed_updates=list(Update.ALL_TYPES),
                drop_pending_updates=True,
            )
        except Exception:
            if app.updater and app.updater.running:
                await app.updater.stop()
            await app.stop()
            await app.shutdown()
            raise

        telegram_sessions[normalized_token] = app
        webhook_sessions.add(normalized_token)
        webhook_routes[webhook_id] = normalized_token
        logger.info("Telegram webhook session registered for token ...%s -> %s", normalized_token[-6:], webhook_url)
        return app


async def stop_telegram_session(token: str) -> bool:
    """Stop and remove one token-scoped Telegram session."""
    normalized_token = token.strip()
    async with telegram_session_lock:
        app = telegram_sessions.pop(normalized_token, None)
        if not app:
            return False
        was_webhook = normalized_token in webhook_sessions
        webhook_sessions.discard(normalized_token)
        webhook_routes.pop(_session_webhook_id(normalized_token), None)
        if app.updater and app.updater.running:
            await app.updater.stop()
        if was_webhook:
            try:
                await app.bot.delete_webhook(drop_pending_updates=False)
            except Exception as err:
                logger.warning("Dynamic webhook deregistration failed for ...%s: %s", normalized_token[-6:], err)
        await app.stop()
        await app.shutdown()
        logger.info("Telegram session stopped for token ending in ...%s (webhook=%s)", normalized_token[-6:], was_webhook)
        return True


def create_web_application(tg_app: Optional[Application] = None) -> web.Application:
    """Create aiohttp application with health and webhook routes."""
    web_app = web.Application()

    async def health_handler(request: web.Request) -> web.Response:
        uptime = int(asyncio.get_event_loop().time() - start_time) if start_time else 0
        status_data = {
            "status": "ok",
            "service": "Universal Telegram Bot Worker & Gateway",
            "mode": RUN_MODE,
            "uptimeSeconds": uptime,
            "telegram": {
                "tokenConfigured": bool(_is_valid_bot_token(TELEGRAM_BOT_TOKEN) or telegram_sessions),
                "mode": RUN_MODE,
                "activeChatBuffers": len(chat_memories),
                "activeSessions": len(telegram_sessions),
                "activeWebhookSessions": len(webhook_sessions),
            },
            "aiProviders": {
                "groq": bool(GROQ_API_KEYS),
                "gemini": bool(GEMINI_API_KEYS),
                "openrouter": bool(OPENROUTER_API_KEY),
                "cerebras": bool(CEREBRAS_API_KEY),
                "pollinations": True,
            },
        }
        return web.json_response(status_data, status=200)

    async def connect_handler(request: web.Request) -> web.Response:
        """Start polling for a user-provided token without restarting the worker."""
        try:
            body = await request.json()
        except (json.JSONDecodeError, UnicodeDecodeError):
            return web.json_response({"ok": False, "error": "Request body must be JSON."}, status=400)

        token = str(
            body.get("token") or body.get("telegramBotToken") or body.get("botToken") or ""
        ).strip() if isinstance(body, dict) else ""
        if not token:
            return web.json_response({"ok": False, "error": "Missing Telegram bot token."}, status=400)

        try:
            if RUN_MODE == "webhook" and PUBLIC_BASE_URL:
                app = await start_telegram_webhook_session(token, PUBLIC_BASE_URL)
                bot = await app.bot.get_me()
                return web.json_response({
                    "ok": True,
                    "running": True,
                    "mode": "webhook",
                    "webhookUrl": f"{PUBLIC_BASE_URL}/webhook/{_session_webhook_id(token.strip())}",
                    "bot": {"id": bot.id, "username": bot.username, "name": bot.first_name},
                })
            app = await start_telegram_session(token)
            bot = await app.bot.get_me()
            return web.json_response({
                "ok": True,
                "running": True,
                "mode": "polling",
                "bot": {"id": bot.id, "username": bot.username, "name": bot.first_name},
            })
        except Exception as err:
            logger.error("Failed to start user Telegram session: %s", err)
            return web.json_response({"ok": False, "error": str(err)}, status=400)

    async def disconnect_handler(request: web.Request) -> web.Response:
        """Stop polling for a user-provided token."""
        try:
            body = await request.json()
        except (json.JSONDecodeError, UnicodeDecodeError):
            return web.json_response({"ok": False, "error": "Request body must be JSON."}, status=400)
        token = str(
            body.get("token") or body.get("telegramBotToken") or body.get("botToken") or ""
        ).strip() if isinstance(body, dict) else ""
        if not token:
            return web.json_response({"ok": False, "error": "Missing Telegram bot token."}, status=400)
        stopped = await stop_telegram_session(token)
        return web.json_response({"ok": True, "stopped": stopped})

    async def webhook_handler(request: web.Request) -> web.Response:
        """Handle incoming Telegram webhook updates for POST /webhook and POST /api/webhook."""
        if not tg_app:
            return web.json_response({"ok": False, "error": "Telegram application not initialized"}, status=503)

        # Validate secret header if WEBHOOK_SECRET is set
        if WEBHOOK_SECRET:
            secret_header = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
            if secret_header != WEBHOOK_SECRET:
                logger.warning("⛔ Webhook request rejected: Secret token mismatch.")
                return web.json_response({"ok": False, "error": "Unauthorized secret token"}, status=403)

        try:
            body = await request.json()
            if not body:
                return web.json_response({"ok": True, "notice": "Empty payload"})

            # Parse and dispatch update into python-telegram-bot application
            update = Update.de_json(data=body, bot=tg_app.bot)
            if update:
                task = asyncio.create_task(tg_app.process_update(update))
                task.add_done_callback(
                    lambda completed_task: logger.error(
                        "❌ Webhook update processing error: %s",
                        completed_task.exception(),
                    )
                    if not completed_task.cancelled() and completed_task.exception()
                    else None
                )
            return web.json_response({"ok": True}, status=200)
        except Exception as err:
            logger.error(f"❌ Webhook update processing error: {err}")
            return web.json_response({"ok": False, "error": str(err)}, status=200)

    async def dynamic_webhook_handler(request: web.Request) -> web.Response:
        """Handle incoming Telegram webhook updates for a dynamic per-user bot session."""
        webhook_id = unquote(request.match_info.get("token", "")).strip().strip("/")
        token = webhook_routes.get(webhook_id)
        if not token or not _is_valid_bot_token(token):
            return web.json_response({"ok": False, "error": "Unknown webhook session."}, status=404)

        app = telegram_sessions.get(token)
        if not app:
            return web.json_response({"ok": False, "error": "Telegram session is not active."}, status=404)

        if request.headers.get("X-Telegram-Bot-Api-Secret-Token", "") != _session_webhook_secret(token):
            logger.warning("⛔ Dynamic webhook rejected: secret mismatch for token ...%s", token[-6:])
            return web.json_response({"ok": False, "error": "Unauthorized secret token"}, status=403)

        try:
            body = await request.json()
            if not body:
                return web.json_response({"ok": True, "notice": "Empty payload"})

            update = Update.de_json(data=body, bot=app.bot)
            if update:
                task = asyncio.create_task(app.process_update(update))
                task.add_done_callback(
                    lambda completed_task: logger.error(
                        "❌ Dynamic webhook update processing error: %s",
                        completed_task.exception(),
                    )
                    if not completed_task.cancelled() and completed_task.exception()
                    else None
                )
            return web.json_response({"ok": True}, status=200)
        except Exception as err:
            logger.error(f"❌ Dynamic webhook update processing error: {err}")
            return web.json_response({"ok": False, "error": str(err)}, status=200)

    # Register both standard and prefixed routes for compatibility
    web_app.router.add_get("/", health_handler)
    web_app.router.add_get("/health", health_handler)
    web_app.router.add_get("/api/health", health_handler)
    web_app.router.add_post("/api/telegram/connect", connect_handler)
    web_app.router.add_post("/api/telegram/disconnect", disconnect_handler)

    web_app.router.add_post("/webhook", webhook_handler)
    web_app.router.add_post("/api/webhook", webhook_handler)
    web_app.router.add_post("/webhook/{token}", dynamic_webhook_handler)
    web_app.router.add_post("/api/webhook/{token}", dynamic_webhook_handler)

    return web_app


# ==========================================
# MAIN APPLICATION LIFECYCLE
# ==========================================

def build_telegram_application(token: Optional[str] = None) -> Application:
    """Build and configure the python-telegram-bot Application instance."""
    normalized_token = (token if token is not None else TELEGRAM_BOT_TOKEN).strip()
    if not _is_valid_bot_token(normalized_token):
        raise ValueError("Telegram bot token is missing or invalid.")

    builder = Application.builder().token(normalized_token)
    if TELEGRAM_API_BASE_URL:
        builder = builder.base_url(f"{TELEGRAM_API_BASE_URL}/bot")
    app = builder.build()

    # Register Command Handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler(["ping", "health"], ping_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("id", id_command))
    app.add_handler(CommandHandler(["memory", "context"], memory_command))
    app.add_handler(CommandHandler(["reset", "clear", "forget"], reset_command))
    app.add_handler(CommandHandler("translate", translate_command))
    app.add_handler(CommandHandler("summarize", summarize_command))
    app.add_handler(CommandHandler("image", image_command))
    app.add_handler(CommandHandler("weather", weather_command))
    app.add_handler(CommandHandler("search", search_command))
    app.add_handler(CommandHandler("code", code_command))
    app.add_handler(CommandHandler("remind", remind_command))

    # Register Slash Commands for Upload / YouTube / Settings + Interactive Menus
    app.add_handler(CommandHandler("upload", upload_command))
    app.add_handler(CommandHandler("youtube", youtube_command))
    app.add_handler(CommandHandler(["yt_check", "analytics"], yt_check_command))
    app.add_handler(CommandHandler("yt_seo", yt_seo_command))
    app.add_handler(CommandHandler("yt_viral", yt_viral_command))
    app.add_handler(CommandHandler("settings", settings_command))
    app.add_handler(CallbackQueryHandler(menu_callback_handler))

    # Register General Text Message Handler
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message))

    return app


async def main_async() -> None:
    """Async main entrypoint initializing Telegram Bot & aiohttp Web Server."""
    global start_time
    start_time = asyncio.get_event_loop().time()

    is_token_configured = bool(TELEGRAM_BOT_TOKEN and ":" in TELEGRAM_BOT_TOKEN)
    is_groq_configured = bool(GROQ_API_KEYS)
    is_gemini_configured = bool(GEMINI_API_KEYS)
    is_ai_configured = is_groq_configured or is_gemini_configured

    logger.info(f"Telegram token configured: {is_token_configured}")
    logger.info(f"AI provider configured: {is_ai_configured}")
    logger.info(f"Telegram mode: {RUN_MODE}")

    tg_app: Optional[Application] = None

    # An environment token remains supported; user tokens can connect later via HTTP.
    if _is_valid_bot_token(TELEGRAM_BOT_TOKEN) and RUN_MODE == "polling":
        tg_app = await start_telegram_session(TELEGRAM_BOT_TOKEN)
    elif _is_valid_bot_token(TELEGRAM_BOT_TOKEN):
        tg_app = build_telegram_application(TELEGRAM_BOT_TOKEN)
        await tg_app.initialize()
        await tg_app.start()

    # Handle Mode Specific Initialization
    if RUN_MODE == "webhook" and tg_app:
        if PUBLIC_BASE_URL:
            webhook_url = f"{PUBLIC_BASE_URL}/webhook"
            logger.info(f"🌐 Registering Telegram Webhook with Telegram API: {webhook_url}")
            try:
                await tg_app.bot.set_webhook(
                    url=webhook_url,
                    secret_token=WEBHOOK_SECRET if WEBHOOK_SECRET else None,
                    drop_pending_updates=True,
                )
                logger.info("✅ Webhook registered successfully with Telegram API.")
            except Exception as e:
                logger.error(f"❌ Failed to register webhook: {e}")
        else:
            logger.info("ℹ️ PUBLIC_BASE_URL not set. Running webhook listener locally for reverse proxy ingress.")

    # Start Aiohttp Web Server for health checks and webhook handling
    web_app = create_web_application(tg_app)
    runner = web.AppRunner(web_app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()

    logger.info(f"HTTP server listening on 0.0.0.0:{PORT}")
    logger.info("Telegram bot started successfully")

    # Keep running until cancelled
    stop_event = asyncio.Event()
    try:
        await stop_event.wait()
    except (asyncio.CancelledError, KeyboardInterrupt):
        logger.info("🛑 Shutting down gracefully...")
    finally:
        for session_token in list(telegram_sessions):
            await stop_telegram_session(session_token)
        if tg_app and tg_app.updater and tg_app.updater.running:
            await tg_app.updater.stop()
        if tg_app and TELEGRAM_BOT_TOKEN not in telegram_sessions:
            await tg_app.stop()
            await tg_app.shutdown()
        await runner.cleanup()
        logger.info("✅ Service stopped successfully.")


def main() -> None:
    """Synchronous launcher entrypoint."""
    try:
        asyncio.run(main_async())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Process terminated.")


if __name__ == "__main__":
    main()
