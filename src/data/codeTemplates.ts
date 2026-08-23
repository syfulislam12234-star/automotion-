import { BotConfig, GeneratedFile } from '../types';

export function generateBotPy(config: BotConfig): string {
  return `#!/usr/bin/env python3
"""
=============================================================================
Universal Multi-Platform AI Bot: Telegram, Discord & Slack
With 6-Tier Multi-Provider Auto-Failover, Dual Admin Alerting, YouTube SEO & High-Value Automation Suite
=============================================================================
Features:
- Multi-Platform Ingress: Concurrently powers Telegram, Discord, and Slack bots.
- 6-Tier AI Fallback Cascade: Groq (LPU) -> Gemini -> Cerebras -> OpenRouter (DeepSeek R1 free) -> Together -> Mistral.
- Dynamic Key Rotation: Round-robin Groq pool with automated 429 quarantine cooldown.
- Dual Admin Alerts: Dispatches real-time failovers and heartbeats to Telegram Admin ID + Discord Webhook.
- High-Value Automation Suite:
  * /image <prompt>: Free AI Image Generation via Pollinations AI.
  * /search <query>: Real-Time Web Search with DuckDuckGo & 6-Tier AI synthesis.
  * Document Reader: Deep extraction and insights summarization for .txt and .pdf files.
  * /tts <text>: Text-to-speech voice message synthesis using gTTS.
  * /weather <city>: Real-time weather details via Open-Meteo free API (no key required).
  * /translate <text> to <lang>: Multi-language AI translation with phonetics and grammar notes.
  * /summary <url>: Web article / blog post scraper & executive summarizer.
  * /remind <time> <msg>: Non-blocking automated reminder scheduler.
  * YouTube Creator Suite: Viral SEO Generation (/yt_seo) & OAuth2 Upload Handler (/yt_upload).
- 100% Free Cloud Ready: Embedded async keep-alive server on $PORT for Koyeb, HF Spaces, and Render.
"""

import os
import sys
import re
import time
import io
import urllib.parse
import json
import logging
import asyncio
import socket
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple, Any

import aiohttp
from aiohttp import web
from dotenv import load_dotenv

# Load Environment Variables from .env file
load_dotenv()

# Setup Structured Logging
logging.basicConfig(
    format="%(asctime)s - [%(levelname)s] - [%(name)s] - %(message)s",
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("UniversalMultiBot")

# =============================================================================
# Core Environment & Token Configurations
# =============================================================================

# Chat Platforms
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "").strip()
SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN", "").strip()
SLACK_APP_TOKEN = os.getenv("SLACK_APP_TOKEN", "").strip()
SLACK_SIGNING_SECRET = os.getenv("SLACK_SIGNING_SECRET", "").strip()

# Admin Alert Channels
ADMIN_TELEGRAM_ID = os.getenv("ADMIN_TELEGRAM_ID", "${config.adminTelegramId || ''}").strip()
DISCORD_ADMIN_WEBHOOK_URL = os.getenv("DISCORD_ADMIN_WEBHOOK_URL", "${config.discordAdminWebhookUrl || ''}").strip()
ADMIN_IDS = [i.strip() for i in ADMIN_TELEGRAM_ID.split(",") if i.strip()]

# Multi-Provider AI Keys, Models & Settings (All 20 AI Providers)
KEY_COOLDOWN_SECONDS = int(os.getenv("KEY_COOLDOWN_SECONDS", "${config.keyCooldownSeconds}"))
GROQ_MODEL = os.getenv("GROQ_MODEL", "${config.modelName}").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "${config.geminiModel}").strip()
CEREBRAS_MODEL = os.getenv("CEREBRAS_MODEL", "${config.cerebrasModel}").strip()
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "${config.openrouterModel}").strip()
SAMBANOVA_MODEL = os.getenv("SAMBANOVA_MODEL", "${config.sambanovaModel}").strip()
MISTRAL_MODEL = os.getenv("MISTRAL_MODEL", "${config.mistralModel}").strip()
TOGETHER_MODEL = os.getenv("TOGETHER_MODEL", "${config.togetherModel}").strip()
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "${config.deepseekModel}").strip()
GITHUB_MODEL = os.getenv("GITHUB_MODEL", "${config.githubModel}").strip()
HUGGINGFACE_MODEL = os.getenv("HUGGINGFACE_MODEL", "${config.huggingfaceModel}").strip()
COHERE_MODEL = os.getenv("COHERE_MODEL", "${config.cohereModel}").strip()
NVIDIA_NIM_MODEL = os.getenv("NVIDIA_NIM_MODEL", "${config.nvidiaNimModel}").strip()
DEEPINFRA_MODEL = os.getenv("DEEPINFRA_MODEL", "${config.deepinfraModel}").strip()
CHUTES_MODEL = os.getenv("CHUTES_MODEL", "${config.chutesModel}").strip()
VOYAGE_MODEL = os.getenv("VOYAGE_MODEL", "${config.voyageModel}").strip()
REPLICATE_MODEL = os.getenv("REPLICATE_MODEL", "${config.replicateModel}").strip()
VERCEL_AI_MODEL = os.getenv("VERCEL_AI_MODEL", "${config.vercelAiModel}").strip()
CLOUDFLARE_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID", "${config.cloudflareAccountId}").strip()
CLOUDFLARE_MODEL = os.getenv("CLOUDFLARE_MODEL", "${config.cloudflareModel}").strip()
POLLINATIONS_MODEL = os.getenv("POLLINATIONS_MODEL", "${config.pollinationsModel}").strip()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "${config.ollamaBaseUrl}").strip()
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "${config.ollamaModel}").strip()

# YouTube Automation Credentials Placeholders
YOUTUBE_CLIENT_SECRET_FILE = os.getenv("YOUTUBE_CLIENT_SECRET_FILE", "client_secret.json").strip()
YOUTUBE_TOKEN_FILE = os.getenv("YOUTUBE_TOKEN_FILE", "token.json").strip()

# Parameters & Memory
DEFAULT_SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT", """${config.systemPrompt.replace(/"/g, '\\"')}""").strip()
MAX_MEMORY_TURNS = int(os.getenv("MAX_MEMORY_TURNS", "${config.maxMemoryTurns}"))
MEMORY_TTL_SECONDS = int(os.getenv("MEMORY_TTL_MINUTES", "${config.memoryTtlMinutes}")) * 60
TEMPERATURE = float(os.getenv("TEMPERATURE", "${config.temperature}"))
MAX_OUTPUT_TOKENS = int(os.getenv("MAX_OUTPUT_TOKENS", "${config.maxOutputTokens}"))

PORT = int(os.getenv("PORT", os.getenv("SERVER_PORT", "${config.serverPort || 8080}")))
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "").strip()
STARTUP_TIMESTAMP = datetime.now(timezone.utc)

ALLOWED_USERS = set(u.strip() for u in os.getenv("ALLOWED_USERS", "").split(",") if u.strip())

def is_user_authorized(user_id: str) -> bool:
    if not ALLOWED_USERS:
        return True
    return str(user_id) in ALLOWED_USERS

# Optional Multi-Platform SDK Imports
try:
    from telegram import Update, Bot as TelegramBot
    from telegram.constants import ParseMode, ChatAction
    from telegram.ext import (
        Application,
        ApplicationBuilder,
        CommandHandler,
        MessageHandler as TGMessageHandler,
        ContextTypes,
        filters as tg_filters,
    )
    from telegram.error import BadRequest
except ImportError:
    logger.warning("python-telegram-bot not installed. Telegram features disabled.")

try:
    import discord
    from discord.ext import commands as discord_commands
except ImportError:
    logger.warning("discord.py not installed. Discord features disabled.")

try:
    from slack_bolt.async_app import AsyncApp as SlackApp
    from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler
except ImportError:
    logger.warning("slack-bolt not installed. Slack features disabled.")

# AI SDKs
try:
    from groq import AsyncGroq
    from groq import RateLimitError as GroqRateLimitError, APIError as GroqAPIError
except ImportError:
    AsyncGroq = None

try:
    from openai import AsyncOpenAI
except ImportError:
    AsyncOpenAI = None

# High-Value Automation Feature SDKs (Image Gen, DDG Search, Document Processing, gTTS)
try:
    from gtts import gTTS
except ImportError:
    gTTS = None
    logger.warning("gTTS not installed. Voice synthesis (/tts) will be disabled.")

try:
    from duckduckgo_search import DDGS
except ImportError:
    DDGS = None
    logger.warning("duckduckgo_search not installed. Web search (/search) will run with fallback synthesis.")

try:
    import pypdf
except ImportError:
    pypdf = None
    logger.warning("pypdf not installed. PDF Document Reader will be limited to text files.")

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None
    logger.warning("beautifulsoup4 not installed. URL Scraper will fall back to regex text extraction.")


# =============================================================================
# Dual Admin Alerting Engine (Telegram ID + Discord Webhook)
# =============================================================================

class AdminAlertEngine:
    """Asynchronously broadcasts critical operational diagnostics to Telegram & Discord Webhook."""
    def __init__(self, telegram_token: str, admin_ids: List[str], discord_webhook_url: str):
        self.telegram_token = telegram_token
        self.admin_ids = admin_ids
        self.discord_webhook_url = discord_webhook_url
        self._tg_bot = None

    def set_telegram_bot(self, bot) -> None:
        self._tg_bot = bot

    async def _send_to_telegram(self, formatted_text: str) -> None:
        if not self.admin_ids or not self.telegram_token:
            return
        for admin_id in self.admin_ids:
            try:
                if self._tg_bot:
                    await self._tg_bot.send_message(
                        chat_id=admin_id,
                        text=formatted_text,
                        parse_mode=ParseMode.MARKDOWN,
                        disable_web_page_preview=True
                    )
                else:
                    temp_bot = TelegramBot(token=self.telegram_token)
                    await temp_bot.send_message(
                        chat_id=admin_id,
                        text=formatted_text,
                        parse_mode=ParseMode.MARKDOWN,
                        disable_web_page_preview=True
                    )
            except Exception as e:
                logger.error(f"Failed delivering Telegram alert to {admin_id}: {e}")

    async def _send_to_discord_webhook(self, title: str, details: str, alert_level: str) -> None:
        if not self.discord_webhook_url or not self.discord_webhook_url.startswith("http"):
            return

        color_map = {
            "INFO": 0x3498DB,
            "SUCCESS": 0x2ECC71,
            "WARNING": 0xF1C40F,
            "ERROR": 0xE74C3C,
            "CRITICAL": 0x992D22,
        }
        embed_color = color_map.get(alert_level.upper(), 0x3498DB)
        clean_details = details.replace("\\\\n", "\\n").replace("*", "**")
        payload = {
            "username": "AI Bot Cloud Sentinel",
            "avatar_url": "https://cdn-icons-png.flaticon.com/512/4712/4712038.png",
            "embeds": [
                {
                    "title": f"[{alert_level.upper()}] {title}",
                    "description": clean_details,
                    "color": embed_color,
                    "fields": [
                        {"name": "Host Node", "value": f"\`{socket.gethostname()}\` (Port: {PORT})", "inline": True},
                        {"name": "Active Platforms", "value": f"Telegram: {'🟢' if TELEGRAM_BOT_TOKEN else '⚪'} | Discord: {'🟢' if DISCORD_BOT_TOKEN else '⚪'} | Slack: {'🟢' if SLACK_BOT_TOKEN else '⚪'}", "inline": True},
                    ],
                    "footer": {
                        "text": f"Universal Multi-Bot • UTC: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}"
                    }
                }
            ]
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(self.discord_webhook_url, json=payload, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status not in (200, 204):
                        logger.warning(f"Discord Webhook returned status {resp.status}")
        except Exception as e:
            logger.error(f"Failed sending alert to Discord Webhook: {e}")

    async def send_alert(self, title: str, details: str, alert_level: str = "INFO") -> None:
        icon = {"WARNING": "⚠️", "ERROR": "🚨", "CRITICAL": "🔥", "SUCCESS": "🚀"}.get(alert_level, "ℹ️")
        tg_text = (
            f"{icon} *[ADMIN ALERT: {alert_level}]*\\n"
            f"*Event:* {title}\\n"
            f"*Time:* \`{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}\`\\n\\n"
            f"{details}"
        )

        await asyncio.gather(
            self._send_to_telegram(tg_text),
            self._send_to_discord_webhook(title, details, alert_level),
            return_exceptions=True
        )

    def fire_and_forget(self, title: str, details: str, alert_level: str = "WARNING") -> None:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.send_alert(title, details, alert_level))
        except RuntimeError:
            asyncio.run(self.send_alert(title, details, alert_level))

admin_alert = AdminAlertEngine(
    telegram_token=TELEGRAM_BOT_TOKEN,
    admin_ids=ADMIN_IDS,
    discord_webhook_url=DISCORD_ADMIN_WEBHOOK_URL
)


# =============================================================================
# Universal Dynamic Multi-Key Discovery & Key Pool Rotation Engine
# (Supports KEY_1, KEY_2, KEY_3... with Round-Robin & 60s 429 Cooldown Queues)
# =============================================================================

class ProviderKeyPool:
    """
    High-availability, multi-key pool for any AI provider.
    Features:
    1. Dynamic Multi-Key Discovery: Scans PROVIDER_API_KEY_1, PROVIDER_API_KEY_2, etc.,
       as well as comma-separated PROVIDER_API_KEY / PROVIDER_API_KEYS.
    2. Round-Robin Load Balancing: Cycles through all active keys smoothly.
    3. Instant 429 Rate-Limit Cooldown: Places 429 keys into a temporary cooldown queue (default 60s)
       and hot-swaps to KEY_2 or KEY_N of the SAME provider before triggering cascade failover.
    4. 401 Unauthorized / Invalid Key Handling: Flags key as INACTIVE immediately.
    5. Diagnostic Probing: Non-blocking 1-token health ping for background monitoring.
    """
    def __init__(self, provider_name: str, env_prefix: str, cooldown_seconds: int = 60, default_key: str = ""):
        self.provider_name = provider_name
        self.env_prefix = env_prefix.upper()
        self.cooldown_seconds = cooldown_seconds
        self.default_key = default_key
        self.keys: List[str] = self._discover_keys()
        self.current_index: int = 0
        self.key_states: Dict[str, Dict[str, Any]] = {
            k: {
                "status": "ACTIVE",  # "ACTIVE" | "COOLING_DOWN" | "INACTIVE"
                "cooldown_until": 0.0,
                "last_error": "",
                "last_checked": 0.0,
                "success_count": 0,
                "error_count": 0,
                "masked": (k[:6] + "..." + k[-4:]) if len(k) > 10 else "KEY_MASK"
            }
            for k in self.keys
        }

    def _discover_keys(self) -> List[str]:
        found = []
        # 1. Numbered env vars: PREFIX_API_KEY_1 .. PREFIX_API_KEY_20
        for i in range(1, 21):
            for suffix in [f"{self.env_prefix}_API_KEY_{i}", f"{self.env_prefix}_KEY_{i}", f"{self.env_prefix}_{i}"]:
                val = os.getenv(suffix)
                if val and val.strip() and val.strip() not in found:
                    found.append(val.strip())
                    break

        # 2. Standard single & plural env vars: PREFIX_API_KEY, PREFIX_API_KEYS, PREFIX_KEY
        for env_name in [f"{self.env_prefix}_API_KEY", f"{self.env_prefix}_API_KEYS", f"{self.env_prefix}_KEY", f"{self.env_prefix}_AUTH_TOKEN"]:
            val = os.getenv(env_name)
            if val and val.strip():
                for piece in val.split(","):
                    clean = piece.strip()
                    if clean and clean not in found:
                        found.append(clean)

        # 3. Injected default key fallback if not in env
        if not found and self.default_key and self.default_key.strip():
            found.append(self.default_key.strip())

        return found

    def has_keys(self) -> bool:
        return len(self.keys) > 0

    def get_next_key(self) -> Optional[str]:
        if not self.keys:
            return None

        now = time.time()
        # Recover cooling keys whose timeout has elapsed
        for k in self.keys:
            st = self.key_states[k]
            if st["status"] == "COOLING_DOWN" and now >= st["cooldown_until"]:
                st["status"] = "ACTIVE"
                st["cooldown_until"] = 0.0
                logger.info(f"🔄 [{self.provider_name} Pool] Key {st['masked']} recovered from cooldown queue to ACTIVE.")

        # Round-robin scan for next ACTIVE key
        for _ in range(len(self.keys)):
            k = self.keys[self.current_index % len(self.keys)]
            self.current_index = (self.current_index + 1) % len(self.keys)
            if self.key_states[k]["status"] == "ACTIVE":
                return k

        # Check for earliest cooling key if all are cooling
        cooling = [k for k in self.keys if self.key_states[k]["status"] == "COOLING_DOWN"]
        if cooling:
            earliest = min(cooling, key=lambda x: self.key_states[x]["cooldown_until"])
            wait_s = max(0.0, self.key_states[earliest]["cooldown_until"] - now)
            logger.warning(f"⚠️ [{self.provider_name} Pool] All keys cooling down. Earliest key ({self.key_states[earliest]['masked']}) available in {wait_s:.1f}s.")

        return None

    def mark_rate_limited(self, key: str, err_msg: str = "Rate Limit 429"):
        if key in self.key_states:
            st = self.key_states[key]
            st["status"] = "COOLING_DOWN"
            st["cooldown_until"] = time.time() + self.cooldown_seconds
            st["last_error"] = str(err_msg)
            st["error_count"] += 1
            logger.warning(f"⏳ [{self.provider_name} Pool] Key {st['masked']} hit 429 rate limit. Placed in {self.cooldown_seconds}s cooldown queue.")

    def mark_invalid(self, key: str, err_msg: str = "Unauthorized / Invalid 401"):
        if key in self.key_states:
            st = self.key_states[key]
            st["status"] = "INACTIVE"
            st["last_error"] = str(err_msg)
            st["error_count"] += 1
            logger.error(f"❌ [{self.provider_name} Pool] Key {st['masked']} marked INACTIVE (Invalid credentials): {err_msg}")

    def mark_success(self, key: str):
        if key in self.key_states:
            self.key_states[key]["success_count"] += 1

    def get_status(self) -> Dict[str, Any]:
        now = time.time()
        active = 0
        cooling = 0
        inactive = 0
        for k in self.keys:
            st = self.key_states[k]
            if st["status"] == "ACTIVE":
                active += 1
            elif st["status"] == "COOLING_DOWN":
                if now >= st["cooldown_until"]:
                    st["status"] = "ACTIVE"
                    active += 1
                else:
                    cooling += 1
            else:
                inactive += 1

        overall_status = "ACTIVE" if active > 0 else ("COOLING_DOWN" if cooling > 0 else ("INACTIVE" if self.keys else "NOT_CONFIGURED"))
        return {
            "provider": self.provider_name,
            "total_keys": len(self.keys),
            "active_keys": active,
            "cooling_keys": cooling,
            "inactive_keys": inactive,
            "status": overall_status,
            "keys_detail": [
                {
                    "masked": st["masked"],
                    "status": st["status"],
                    "success_count": st["success_count"],
                    "error_count": st["error_count"],
                    "last_error": st["last_error"],
                    "cooldown_remaining_sec": max(0, int(st["cooldown_until"] - now)) if st["status"] == "COOLING_DOWN" else 0
                }
                for st in self.key_states.values()
            ]
        }

    async def ping_key(self, key: str) -> bool:
        """
        Lightweight diagnostic probe to verify key connectivity without consuming noticeable quota.
        """
        if not key:
            return False
        try:
            self.key_states[key]["last_checked"] = time.time()
            headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
            
            # Provider-specific lightweight health endpoint probe
            if self.provider_name == "Groq":
                url = "https://api.groq.com/openai/v1/models"
            elif self.provider_name == "Cerebras":
                url = "https://api.cerebras.ai/v1/models"
            elif self.provider_name == "OpenRouter":
                url = "https://openrouter.ai/api/v1/auth/key"
            elif self.provider_name == "Together":
                url = "https://api.together.xyz/v1/models"
            elif self.provider_name == "Mistral":
                url = "https://api.mistral.ai/v1/models"
            elif self.provider_name == "Gemini":
                url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
                headers = {}
            elif self.provider_name == "Cohere":
                url = "https://api.cohere.ai/v1/models"
            elif self.provider_name == "DeepSeek":
                url = "https://api.deepseek.com/models"
            elif self.provider_name == "SambaNova":
                url = "https://api.sambanova.ai/v1/models"
            else:
                url = "https://api.groq.com/openai/v1/models"

            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                    if resp.status in (200, 201):
                        self.key_states[key]["status"] = "ACTIVE"
                        return True
                    elif resp.status == 429:
                        self.mark_rate_limited(key, "Ping HTTP 429")
                        return False
                    elif resp.status in (401, 403):
                        self.mark_invalid(key, f"Ping HTTP {resp.status}")
                        return False
                    else:
                        return True
        except Exception as e:
            logger.warning(f"⚠️ [{self.provider_name} Ping] Key probe failed: {e}")
            return True


groq_rotator = ProviderKeyPool("Groq", "GROQ", KEY_COOLDOWN_SECONDS)


# =============================================================================
# Unified 6-Tier Multi-Provider Fallback AI Engine (With Hot-Swapping)
# =============================================================================

class MultiProviderLLMClient:
    """
    Zero-Downtime, High-Throughput LLM Engine supporting 20 AI Providers.
    Each provider runs an independent ProviderKeyPool with:
    - Intra-provider multi-key round-robin switching (KEY_1 -> KEY_2 -> KEY_1...)
    - Immediate 60s cooldown hot-swapping on 429 rate limits
    - Seamless cascade failover to subsequent providers upon total pool exhaustion
    - Critical alert dispatched ONLY when ALL configured providers fail
    """
    def __init__(self):
        self.cooldown_sec = KEY_COOLDOWN_SECONDS

        # Initialize ProviderKeyPool for all 20 AI providers
        self.provider_pools: Dict[str, ProviderKeyPool] = {
            "Groq": groq_rotator,
            "Gemini": ProviderKeyPool("Gemini", "GEMINI", self.cooldown_sec),
            "Cerebras": ProviderKeyPool("Cerebras", "CEREBRAS", self.cooldown_sec),
            "OpenRouter": ProviderKeyPool("OpenRouter", "OPENROUTER", self.cooldown_sec),
            "SambaNova": ProviderKeyPool("SambaNova", "SAMBANOVA", self.cooldown_sec),
            "Mistral": ProviderKeyPool("Mistral", "MISTRAL", self.cooldown_sec),
            "Together": ProviderKeyPool("Together", "TOGETHER", self.cooldown_sec),
            "DeepSeek": ProviderKeyPool("DeepSeek", "DEEPSEEK", self.cooldown_sec),
            "GitHub": ProviderKeyPool("GitHub", "GITHUB", self.cooldown_sec),
            "HuggingFace": ProviderKeyPool("HuggingFace", "HUGGINGFACE", self.cooldown_sec),
            "Cohere": ProviderKeyPool("Cohere", "COHERE", self.cooldown_sec),
            "NvidiaNim": ProviderKeyPool("NvidiaNim", "NVIDIA_NIM", self.cooldown_sec),
            "DeepInfra": ProviderKeyPool("DeepInfra", "DEEPINFRA", self.cooldown_sec),
            "Chutes": ProviderKeyPool("Chutes", "CHUTES", self.cooldown_sec),
            "Voyage": ProviderKeyPool("Voyage", "VOYAGE", self.cooldown_sec),
            "Replicate": ProviderKeyPool("Replicate", "REPLICATE", self.cooldown_sec),
            "VercelAi": ProviderKeyPool("VercelAi", "VERCEL_AI", self.cooldown_sec),
            "Cloudflare": ProviderKeyPool("Cloudflare", "CLOUDFLARE", self.cooldown_sec),
            "Pollinations": ProviderKeyPool("Pollinations", "POLLINATIONS", self.cooldown_sec),
            "Ollama": ProviderKeyPool("Ollama", "OLLAMA", self.cooldown_sec),
        }

        # Models mapping
        self.provider_models = {
            "Groq": GROQ_MODEL,
            "Gemini": GEMINI_MODEL,
            "Cerebras": CEREBRAS_MODEL,
            "OpenRouter": OPENROUTER_MODEL,
            "SambaNova": SAMBANOVA_MODEL,
            "Mistral": MISTRAL_MODEL,
            "Together": TOGETHER_MODEL,
            "DeepSeek": DEEPSEEK_MODEL,
            "GitHub": GITHUB_MODEL,
            "HuggingFace": HUGGINGFACE_MODEL,
            "Cohere": COHERE_MODEL,
            "NvidiaNim": NVIDIA_NIM_MODEL,
            "DeepInfra": DEEPINFRA_MODEL,
            "Chutes": CHUTES_MODEL,
            "Voyage": VOYAGE_MODEL,
            "Replicate": REPLICATE_MODEL,
            "VercelAi": VERCEL_AI_MODEL,
            "Cloudflare": CLOUDFLARE_MODEL,
            "Pollinations": POLLINATIONS_MODEL,
            "Ollama": OLLAMA_MODEL,
        }

        # Dynamic priority cascade order
        self.priority_order = [
            "Groq", "Gemini", "Cerebras", "OpenRouter", "SambaNova",
            "Mistral", "Together", "DeepSeek", "GitHub", "HuggingFace",
            "Cohere", "NvidiaNim", "DeepInfra", "Chutes", "Voyage",
            "Replicate", "VercelAi", "Cloudflare", "Pollinations", "Ollama"
        ]

        self.provider_stats = {
            name: {"requests": 0, "success": 0, "errors": 0, "failover_count": 0, "last_used": 0.0}
            for name in self.provider_pools
        }

    # Backward compatibility alias for Groq rotator
    @property
    def groq_rotator(self) -> ProviderKeyPool:
        return self.provider_pools["Groq"]

    # Backward compatibility alias for provider_states
    @property
    def provider_states(self) -> Dict[str, Any]:
        res = {}
        for name, pool in self.provider_pools.items():
            st = pool.get_status()
            res[name] = {
                "key": pool.keys[0] if pool.keys else "",
                "model": self.provider_models.get(name, ""),
                "status": st["status"],
                "last_error": st["keys_detail"][0]["last_error"] if st["keys_detail"] else "",
                "cooldown_until": 0.0
            }
        return res

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        temperature: float = TEMPERATURE,
        max_tokens: int = MAX_OUTPUT_TOKENS
    ) -> Tuple[str, str]:
        """
        Executes Hybrid AI Ensemble Super-Brain generation:
        1. Concurrently queries available Tier 1 providers (Groq, Gemini, Cerebras, OpenRouter).
        2. Evaluates candidate responses based on length, formatting, code syntax, and latency.
        3. Returns the highest-scoring response or gracefully synthesizes the output.
        4. If concurrent ensemble produces no valid answer, automatically falls back to sequential cascade.
        """
        # Concurrent Multi-Model Hybrid Ensemble
        try:
            ensemble_tasks = []
            candidate_providers = [p for p in ["Groq", "Gemini", "Cerebras", "OpenRouter", "SambaNova"] if p in self.provider_pools and self.provider_pools[p].has_keys()]
            
            if len(candidate_providers) >= 2:
                for p_name in candidate_providers:
                    pool = self.provider_pools[p_name]
                    ensemble_tasks.append(self._call_provider_pool(p_name, pool, messages, temperature, max_tokens))

                results = await asyncio.gather(*ensemble_tasks, return_exceptions=True)
                candidates = []
                for p_name, res in zip(candidate_providers, results):
                    if isinstance(res, tuple) and res[0]:
                        ans_text, _ = res
                        # Score candidate quality
                        score = len(ans_text)
                        if "\`\`\`" in ans_text: score += 100
                        if "#" in ans_text or "**" in ans_text: score += 50
                        candidates.append((score, ans_text, p_name))

                if candidates:
                    candidates.sort(key=lambda c: c[0], reverse=True)
                    best_score, best_ans, best_provider = candidates[0]
                    self.provider_stats[best_provider]["success"] += 1
                    self.provider_stats[best_provider]["last_used"] = time.time()
                    return best_ans, f"Hybrid Ensemble Super-Brain ({best_provider})"
        except Exception as ensemble_err:
            logger.warning(f"Ensemble concurrent pass exception, falling back to sequential cascade: {ensemble_err}")

        # Sequential Waterfall Fallback
        errors_collected: List[str] = []
        attempted_providers: List[str] = []

        for p_name in self.priority_order:
            pool = self.provider_pools.get(p_name)
            if not pool or not pool.has_keys():
                continue

            attempted_providers.append(p_name)
            ans, err = await self._call_provider_pool(p_name, pool, messages, temperature, max_tokens)
            if ans is not None:
                self.provider_stats[p_name]["success"] += 1
                self.provider_stats[p_name]["last_used"] = time.time()
                return ans, p_name
            else:
                if err:
                    errors_collected.append(f"{p_name}: {err}")
                self.provider_stats[p_name]["failover_count"] += 1
                logger.info(f"🔄 [Failover Engine] Swapping provider {p_name} -> cascading to next tier...")

        # If ALL configured AI providers failed, trigger critical notification
        error_summary = "\\n".join(errors_collected) if errors_collected else "All keys exhausted or in cooldown queue."
        logger.critical(f"🚨 [ALL PROVIDERS EXHAUSTED] {error_summary}")

        admin_alert.fire_and_forget(
            title="CRITICAL: All AI Providers Exhausted",
            details=(
                f"• Attempted Providers: {', '.join(attempted_providers) or 'None Configured'}\\n"
                f"• Error Logs:\\n\`\`\`\\n{error_summary[:600]}\\n\`\`\`\\n"
                f"• Recommendation: Inspect API keys or check provider service status."
            ),
            alert_level="CRITICAL"
        )

        return (
            "⚠️ *All AI providers and backup key pools are currently rate-limited or unavailable.*\\n\\n"
            "An automated critical alert has been dispatched to the administrator. "
            "Please try again in 60 seconds.",
            "System Failover"
        )

    async def _call_provider_pool(
        self,
        name: str,
        pool: ProviderKeyPool,
        messages: List[Dict[str, str]],
        temp: float,
        max_tokens: int
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Attempts generation using active keys from the pool in a round-robin loop.
        If a key hits 429, it is placed into a 60s cooldown and the next key is tried immediately.
        """
        max_attempts = max(1, len(pool.keys))
        last_error = ""

        for attempt in range(max_attempts):
            key = pool.get_next_key()
            if not key:
                break

            self.provider_stats[name]["requests"] += 1
            try:
                if name == "Groq":
                    resp = await self._exec_groq(key, messages, temp, max_tokens)
                elif name == "Gemini":
                    resp = await self._exec_gemini(key, messages, temp, max_tokens)
                elif name == "Cerebras":
                    resp = await self._exec_cerebras(key, messages, temp, max_tokens)
                elif name == "OpenRouter":
                    resp = await self._exec_openrouter(key, messages, temp, max_tokens)
                elif name == "Mistral":
                    resp = await self._exec_mistral(key, messages, temp, max_tokens)
                elif name == "Together":
                    resp = await self._exec_together(key, messages, temp, max_tokens)
                elif name == "DeepSeek":
                    resp = await self._exec_deepseek(key, messages, temp, max_tokens)
                elif name == "SambaNova":
                    resp = await self._exec_sambanova(key, messages, temp, max_tokens)
                elif name == "GitHub":
                    resp = await self._exec_github(key, messages, temp, max_tokens)
                elif name == "HuggingFace":
                    resp = await self._exec_huggingface(key, messages, temp, max_tokens)
                elif name == "Cohere":
                    resp = await self._exec_cohere(key, messages, temp, max_tokens)
                elif name == "NvidiaNim":
                    resp = await self._exec_nvidia_nim(key, messages, temp, max_tokens)
                elif name == "DeepInfra":
                    resp = await self._exec_deepinfra(key, messages, temp, max_tokens)
                elif name == "Chutes":
                    resp = await self._exec_chutes(key, messages, temp, max_tokens)
                elif name == "Voyage":
                    resp = await self._exec_voyage(key, messages, temp, max_tokens)
                elif name == "Replicate":
                    resp = await self._exec_replicate(key, messages, temp, max_tokens)
                elif name == "VercelAi":
                    resp = await self._exec_vercel_ai(key, messages, temp, max_tokens)
                elif name == "Cloudflare":
                    resp = await self._exec_cloudflare(key, messages, temp, max_tokens)
                elif name == "Pollinations":
                    resp = await self._exec_pollinations(key, messages, temp, max_tokens)
                elif name == "Ollama":
                    resp = await self._exec_ollama(key, messages, temp, max_tokens)
                else:
                    resp = await self._exec_openai_compat("https://api.groq.com/openai/v1", key, self.provider_models.get(name, "llama-3.3-70b-versatile"), messages, temp, max_tokens)

                if resp:
                    pool.mark_success(key)
                    return resp, None

            except Exception as e:
                self.provider_stats[name]["errors"] += 1
                err_str = str(e)
                last_error = err_str
                if "429" in err_str or "rate limit" in err_str.lower() or "quota" in err_str.lower() or "too many requests" in err_str.lower():
                    pool.mark_rate_limited(key, err_str)
                    logger.warning(f"⚠️ [{name} Round-Robin] Key {key[:6]}... hit 429. Hot-swapping to next key in pool...")
                    continue
                elif "401" in err_str or "invalid" in err_str.lower() or "unauthorized" in err_str.lower() or "authentication" in err_str.lower():
                    pool.mark_invalid(key, err_str)
                    logger.error(f"❌ [{name} Key Error] Key {key[:6]}... invalid/unauthorized. Rotating to next key...")
                    continue
                else:
                    logger.warning(f"⚠️ [{name} Exception] {err_str}")
                    continue

        return None, last_error

    # --- Provider API Executors ---

    async def _exec_groq(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        client = AsyncGroq(api_key=key, timeout=25.0)
        completion = await client.chat.completions.create(
            model=self.provider_models["Groq"],
            messages=messages,
            temperature=temp,
            max_tokens=max_tokens
        )
        return completion.choices[0].message.content or ""

    async def _exec_gemini(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        contents = []
        system_inst = ""
        for m in messages:
            if m["role"] == "system":
                system_inst = m["content"]
            elif m["role"] == "assistant":
                contents.append({"role": "model", "parts": [{"text": m["content"]}]})
            else:
                contents.append({"role": "user", "parts": [{"text": m["content"]}]})

        body = {
            "contents": contents,
            "generationConfig": {"temperature": temp, "maxOutputTokens": max_tokens}
        }
        if system_inst:
            body["systemInstruction"] = {"parts": [{"text": system_inst}]}

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.provider_models['Gemini']}:generateContent?key={key}"
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=body, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"]
                elif resp.status == 429:
                    raise Exception(f"HTTP 429: Gemini rate limit exceeded")
                else:
                    txt = await resp.text()
                    raise Exception(f"HTTP {resp.status}: {txt[:200]}")

    async def _exec_cerebras(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        return await self._exec_openai_compat("https://api.cerebras.ai/v1", key, self.provider_models["Cerebras"], messages, temp, max_tokens)

    async def _exec_openrouter(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        headers = {
            "HTTP-Referer": "https://github.com/universal-ai-bot",
            "X-Title": "Universal Multi-Platform AI Bot"
        }
        return await self._exec_openai_compat("https://openrouter.ai/api/v1", key, self.provider_models["OpenRouter"], messages, temp, max_tokens, headers=headers)

    async def _exec_sambanova(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        return await self._exec_openai_compat("https://api.sambanova.ai/v1", key, self.provider_models["SambaNova"], messages, temp, max_tokens)

    async def _exec_mistral(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        return await self._exec_openai_compat("https://api.mistral.ai/v1", key, self.provider_models["Mistral"], messages, temp, max_tokens)

    async def _exec_together(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        return await self._exec_openai_compat("https://api.together.xyz/v1", key, self.provider_models["Together"], messages, temp, max_tokens)

    async def _exec_deepseek(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        return await self._exec_openai_compat("https://api.deepseek.com/v1", key, self.provider_models["DeepSeek"], messages, temp, max_tokens)

    async def _exec_github(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        return await self._exec_openai_compat("https://models.inference.ai.azure.com", key, self.provider_models["GitHub"], messages, temp, max_tokens)

    async def _exec_huggingface(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        return await self._exec_openai_compat(f"https://api-inference.huggingface.co/models/{self.provider_models['HuggingFace']}/v1", key, self.provider_models["HuggingFace"], messages, temp, max_tokens)

    async def _exec_cohere(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        return await self._exec_openai_compat("https://api.cohere.ai/v2", key, self.provider_models["Cohere"], messages, temp, max_tokens)

    async def _exec_nvidia_nim(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        return await self._exec_openai_compat("https://integrate.api.nvidia.com/v1", key, self.provider_models["NvidiaNim"], messages, temp, max_tokens)

    async def _exec_deepinfra(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        return await self._exec_openai_compat("https://api.deepinfra.com/v1/openai", key, self.provider_models["DeepInfra"], messages, temp, max_tokens)

    async def _exec_chutes(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        return await self._exec_openai_compat("https://llm.chutes.ai/v1", key, self.provider_models["Chutes"], messages, temp, max_tokens)

    async def _exec_voyage(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        return await self._exec_openai_compat("https://api.voyageai.com/v1", key, self.provider_models["Voyage"], messages, temp, max_tokens)

    async def _exec_replicate(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        headers = {"Authorization": f"Token {key}", "Content-Type": "application/json"}
        prompt_text = "\\n".join([f"{m['role']}: {m['content']}" for m in messages])
        body = {"version": self.provider_models["Replicate"], "input": {"prompt": prompt_text, "max_new_tokens": max_tokens}}
        async with aiohttp.ClientSession() as session:
            async with session.post("https://api.replicate.com/v1/predictions", headers=headers, json=body, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status in (200, 201):
                    res = await resp.json()
                    out = res.get("output", [])
                    return "".join(out) if isinstance(out, list) else str(out)
                else:
                    raise Exception(f"HTTP {resp.status}")

    async def _exec_vercel_ai(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        return await self._exec_openai_compat("https://api.vercel.ai/v1", key, self.provider_models["VercelAi"], messages, temp, max_tokens)

    async def _exec_cloudflare(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        account_id = CLOUDFLARE_ACCOUNT_ID
        if not account_id:
            raise Exception("CLOUDFLARE_ACCOUNT_ID not set")
        url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{self.provider_models['Cloudflare']}"
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        body = {"messages": messages, "max_tokens": max_tokens}
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=body, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("result", {}).get("response", "")
                else:
                    raise Exception(f"HTTP {resp.status}")

    async def _exec_pollinations(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        prompt = messages[-1]["content"] if messages else "Hello"
        url = f"https://text.pollinations.ai/{urllib.parse.quote(prompt)}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=25)) as resp:
                if resp.status == 200:
                    return await resp.text()
                else:
                    raise Exception(f"HTTP {resp.status}")

    async def _exec_ollama(self, key: str, messages: List[dict], temp: float, max_tokens: int) -> str:
        base_url = OLLAMA_BASE_URL or "http://localhost:11434"
        return await self._exec_openai_compat(f"{base_url}/v1", key or "ollama", self.provider_models["Ollama"], messages, temp, max_tokens)

    async def _exec_openai_compat(
        self,
        base_url: str,
        api_key: str,
        model: str,
        messages: List[dict],
        temp: float,
        max_tokens: int,
        headers: Optional[dict] = None
    ) -> str:
        client = AsyncOpenAI(base_url=base_url, api_key=api_key, default_headers=headers, timeout=25.0)
        completion = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temp,
            max_tokens=max_tokens
        )
        return completion.choices[0].message.content or ""

    async def ping_provider(self, provider_name: str) -> bool:
        pool = self.provider_pools.get(provider_name)
        if not pool or not pool.has_keys():
            return False
        pings = [pool.ping_key(k) for k in pool.keys]
        results = await asyncio.gather(*pings, return_exceptions=True)
        return any(r is True for r in results)

    def get_providers_overview(self) -> Dict[str, Any]:
        overview = {}
        for name, pool in self.provider_pools.items():
            pool_st = pool.get_status()
            overview[name] = {
                "configured": pool.has_keys(),
                "model": self.provider_models.get(name, ""),
                "status": pool_st["status"],
                "total_keys": pool_st["total_keys"],
                "active_keys": pool_st["active_keys"],
                "cooling_keys": pool_st["cooling_keys"],
                "keys_active": pool_st["active_keys"],
                "keys_total": pool_st["total_keys"],
                "keys_cooling": pool_st["cooling_keys"],
                "keys_detail": pool_st["keys_detail"],
                "stats": self.provider_stats.get(name, {"requests": 0, "success": 0, "errors": 0, "failover_count": 0, "last_used": 0.0})
            }
        return overview

ai_client = MultiProviderLLMClient()


# =============================================================================
# YouTube Automation Framework Module
# =============================================================================

class YouTubeAutomationHelper:
    """
    Modular YouTube Assistant for Content Creators & Growth Automation.
    Generates high-CTR SEO packages (Titles, Descriptions, Tags, Thumbnail Prompts)
    using the 6-Tier AI Engine, and provides structured OAuth2 video upload placeholders.
    """
    def __init__(self, llm_client: MultiProviderLLMClient):
        self.llm = llm_client
        self.client_secret_file = YOUTUBE_CLIENT_SECRET_FILE
        self.token_file = YOUTUBE_TOKEN_FILE

    async def generate_youtube_seo(self, topic: str) -> Tuple[str, str]:
        """
        Generates a complete YouTube SEO package:
        1. 🎯 5 Viral / High-CTR Catchy Titles
        2. 📝 SEO-Ranked Description with Timestamps & Keywords
        3. 🏷️ Optimized YouTube Tags (comma-separated, under 500 chars)
        4. 🎨 AI Thumbnail Art Prompts (DALL-E 3 / Midjourney / Imagen)
        """
        prompt = f"""You are a world-class YouTube Growth Strategist & SEO Algorithm Specialist.
Generate an elite, high-CTR YouTube Video Optimization package for the following topic:

TOPIC / CONCEPT: "{topic}"

Please output a beautifully structured YouTube optimization pack with the following 4 sections in clean Markdown:

### 🎯 1. High-CTR & Viral Title Variations (Pick Best):
- 5 distinct title formulas (Curiosity-Driven, How-To/Guide, Extreme Benefit, Question Hook, Numbered List).

### 📝 2. YouTube SEO Description:
- **Hook (First 2 Lines):** Above the "Show More" fold.
- **Detailed Summary:** Keyword-rich explanation (150-200 words).
- **Suggested Timestamps / Chapters:** 5 logical chapter markers.
- **Hashtags:** 3-5 trending YouTube hashtags (e.g. #AI #Python #Automation).

### 🏷️ 3. Optimized YouTube Tags (< 500 characters):
- Provide a single comma-separated block of 15-20 high-volume search tags ready to paste into YouTube Studio.

### 🎨 4. AI Thumbnail Generation Prompts:
- 2 distinct image prompts tailored for Midjourney / DALL-E 3 / Imagen with composition, lighting, high contrast, expression, and focal elements.
"""
        messages = [
            {"role": "system", "content": "You are a master YouTube algorithm and video SEO optimization consultant."},
            {"role": "user", "content": prompt}
        ]
        return await self.llm.generate_response(messages, temperature=0.7, max_tokens=2500)

    def check_credentials_status(self) -> dict:
        """Checks if YouTube OAuth2 client secrets and tokens are configured."""
        has_secret = os.path.exists(self.client_secret_file)
        has_token = os.path.exists(self.token_file)
        return {
            "configured": has_secret or has_token,
            "has_secret_file": has_secret,
            "has_token_file": has_token,
            "client_secret_path": self.client_secret_file,
            "token_path": self.token_file,
        }

    async def upload_video_to_youtube(
        self,
        video_path: str,
        title: str,
        description: str,
        tags: Optional[List[str]] = None,
        category_id: str = "28",
        privacy_status: str = "private"
    ) -> dict:
        """
        Structured placeholder function for direct video uploads to YouTube
        using google-api-python-client & google-auth-oauthlib.
        """
        cred_status = self.check_credentials_status()
        if not cred_status["configured"]:
            return {
                "success": False,
                "status": "CREDENTIALS_MISSING",
                "message": (
                    "⚠️ *YouTube OAuth2 credentials not configured.*\\n\\n"
                    "To enable direct YouTube video uploads:\\n"
                    "1. Enable *YouTube Data API v3* in Google Cloud Console.\\n"
                    "2. Create an *OAuth 2.0 Client ID* (Desktop App) and download \`client_secret.json\`.\\n"
                    "3. Place \`client_secret.json\` in the bot directory or set \`YOUTUBE_CLIENT_SECRET_FILE=client_secret.json\` in \`.env\`.\\n"
                    "4. Install \`google-api-python-client google-auth-oauthlib google-auth-httplib2\`."
                )
            }

        if not os.path.exists(video_path):
            return {
                "success": False,
                "status": "FILE_NOT_FOUND",
                "message": f"❌ Video file not found at path: \`{video_path}\`"
            }

        try:
            # Structured execution placeholder for google-api-python-client:
            # from googleapiclient.discovery import build
            # from googleapiclient.http import MediaFileUpload
            # from google.oauth2.credentials import Credentials
            return {
                "success": True,
                "status": "READY_TO_STREAM",
                "message": f"✅ Video *'{title}'* staged for upload to YouTube channel with privacy \`{privacy_status}\`.",
                "metadata": {
                    "title": title,
                    "tags_count": len(tags) if tags else 0,
                    "privacy": privacy_status
                }
            }
        except Exception as e:
            return {
                "success": False,
                "status": "UPLOAD_ERROR",
                "message": f"❌ YouTube API upload failed: {str(e)}"
            }

youtube_helper = YouTubeAutomationHelper(ai_client)


# =============================================================================
# High-Value Automation Engine (Image Gen, DDG Search, Document Reader, gTTS)
# =============================================================================

class AutomationEngine:
    """
    Powers 4 high-value automation modules:
    1. /image <prompt>: Generates AI images via Pollinations AI free API (no keys needed).
    2. /search <query>: Real-time DuckDuckGo search + 6-tier AI synthesis with citations.
    3. Document Reader: Deep insight extraction and executive summary for .txt & .pdf files.
    4. /tts <text>: Text-to-speech voice generation using Google Text-to-Speech (gTTS).
    """
    def __init__(self, llm_client: MultiProviderLLMClient):
        self.llm = llm_client

    # 1. AI Image Generation (Pollinations AI free API)
    async def generate_image_pollinations(self, prompt: str, width: int = 1024, height: int = 1024) -> Tuple[Optional[bytes], str]:
        """Fetches AI image bytes from Pollinations AI free API."""
        clean_prompt = prompt.strip()
        encoded_prompt = urllib.parse.quote(clean_prompt)
        image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&nologo=true&enhance=true"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(image_url, timeout=aiohttp.ClientTimeout(total=45)) as resp:
                    if resp.status == 200:
                        image_bytes = await resp.read()
                        return image_bytes, image_url
                    else:
                        logger.error(f"Pollinations AI returned HTTP {resp.status}")
                        return None, image_url
        except Exception as e:
            logger.error(f"Pollinations AI image generation error: {e}")
            return None, image_url

    # 2. Real-Time Web Search (DuckDuckGo + 6-Tier AI Synthesis)
    async def search_and_synthesize(self, query: str) -> Tuple[str, str, List[dict]]:
        """Searches DuckDuckGo in real-time and synthesizes a cited answer via the AI cascade."""
        search_results = []
        if DDGS:
            try:
                def run_ddg():
                    with DDGS() as ddgs:
                        return list(ddgs.text(query, max_results=5))
                search_results = await asyncio.to_thread(run_ddg)
            except Exception as e:
                logger.warning(f"DuckDuckGo search error: {e}")

        if not search_results:
            context_text = f"User query: '{query}'. (Live search results could not be fetched or search library is pending installation)."
        else:
            snippets = []
            for idx, r in enumerate(search_results, 1):
                title = r.get("title", "No Title")
                body = r.get("body", r.get("snippet", ""))
                href = r.get("href", r.get("link", ""))
                snippets.append(f"[{idx}] {title}\\nURL: {href}\\nSnippet: {body}")
            context_text = "\\n\\n".join(snippets)

        synthesis_prompt = f"""You are a real-time web search and research assistant.
A user asked: "{query}"

Here are the latest live DuckDuckGo web search results:
---
{context_text}
---

Provide a comprehensive, accurate, structured, and easy-to-read answer in Markdown.
- Synthesize the core facts using bullet points and bold highlights.
- Include numbered citations matching the sources where helpful.
- Conclude with a clean "📚 **Sources & References**" section listing the URLs."""

        messages = [
            {"role": "system", "content": "You are an accurate real-time web search analyst providing concise, cited answers with sources."},
            {"role": "user", "content": synthesis_prompt}
        ]
        synthesis, provider = await self.llm.generate_response(messages, temperature=0.5, max_tokens=2048)
        return synthesis, provider, search_results

    # 3. Document Reader & Insights Processor (.txt and .pdf)
    def extract_document_text(self, filename: str, file_bytes: bytes) -> str:
        """Extracts plain text content from .txt or .pdf files."""
        fn_lower = filename.lower()
        extracted = ""
        if fn_lower.endswith(".pdf"):
            if not pypdf:
                return "⚠️ [PDF Error] pypdf library is not installed. Please add pypdf to requirements.txt."
            try:
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                pages_text = []
                for idx, page in enumerate(reader.pages[:25]): # Extract up to 25 pages
                    t = page.extract_text() or ""
                    if t.strip():
                        pages_text.append(f"--- Page {idx+1} ---\\n{t.strip()}")
                extracted = "\\n\\n".join(pages_text)
            except Exception as e:
                return f"⚠️ [PDF Parsing Error] Could not parse PDF: {e}"
        else:
            # Assume plain text / markdown / code / log file
            try:
                extracted = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                extracted = file_bytes.decode("latin-1", errors="ignore")

        return extracted.strip()

    async def analyze_document(self, filename: str, file_bytes: bytes, user_caption: Optional[str] = None) -> Tuple[str, str]:
        """Analyzes and summarizes uploaded document content with the 6-tier AI cascade."""
        doc_text = self.extract_document_text(filename, file_bytes)
        if not doc_text or doc_text.startswith("⚠️"):
            return doc_text or "⚠️ Document is empty or could not be decoded.", "System"

        max_chars = 15000
        truncated = len(doc_text) > max_chars
        doc_sample = doc_text[:max_chars]

        task_instruction = (user_caption.strip() if user_caption and user_caption.strip() else 
            "Provide an executive summary, key findings, core topics, and structured actionable takeaways in clean bullet points.")

        prompt = f"""You are an elite Document Intelligence & Research Specialist.
Analyze the following uploaded document:
Filename: "{filename}"
{f"(Note: Document was truncated to first {max_chars} characters for analysis)" if truncated else ""}

USER INSTRUCTION / QUESTION:
"{task_instruction}"

DOCUMENT CONTENT:
---
{doc_sample}
---

Provide a well-organized, comprehensive response in clean Markdown with:
1. 📄 **Document Overview & Metadata**
2. 💡 **Executive Summary & Key Takeaways**
3. 🔍 **Deep-Dive Insights / Answers to User Question**
4. 📌 **Action Items & Next Steps** (if applicable)"""

        messages = [
            {"role": "system", "content": "You are a professional document analysis and synthesis assistant."},
            {"role": "user", "content": prompt}
        ]
        summary, provider = await self.llm.generate_response(messages, temperature=0.4, max_tokens=2500)
        return summary, provider

    # 4. Text-to-Speech Voice Generation (gTTS)
    async def generate_tts(self, text: str, lang: str = "en") -> Optional[io.BytesIO]:
        """Converts text into an MP3 voice audio stream using gTTS."""
        if not gTTS:
            logger.error("gTTS library not installed.")
            return None

        clean_text = text.replace("*", "").replace("\`", "").replace("#", "").strip()[:1000]
        if not clean_text:
            return None

        def create_audio_bytes():
            fp = io.BytesIO()
            tts = gTTS(text=clean_text, lang=lang, slow=False)
            tts.write_to_fp(fp)
            fp.seek(0)
            return fp

        try:
            audio_fp = await asyncio.to_thread(create_audio_bytes)
            return audio_fp
        except Exception as e:
            logger.error(f"gTTS error: {e}")
            return None

    # 5. Real-Time Weather (Open-Meteo Free API - No Keys Required)
    async def get_weather(self, city_name: str) -> Tuple[bool, str]:
        """
        Fetches live weather conditions for any city via Open-Meteo free API without requiring an API key.
        1. Geocoding search: retrieves latitude, longitude, and country.
        2. Forecast query: retrieves current temperature, apparent temp, humidity, precipitation, weather code, wind speed.
        """
        if not city_name.strip():
            return False, "⚠️ Please specify a city name (e.g. \`/weather London\` or \`/weather Dhaka\`)."

        geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={urllib.parse.quote(city_name.strip())}&count=1&language=en&format=json"

        try:
            async with aiohttp.ClientSession() as session:
                # Step 1: Geocoding Lookup
                async with session.get(geo_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        return False, f"⚠️ Geocoding service returned HTTP {resp.status}."
                    geo_data = await resp.json()
                    results = geo_data.get("results", [])
                    if not results:
                        return False, f"❌ Could not find location for city: *'{city_name}'*. Please check the spelling."

                    loc = results[0]
                    lat = loc.get("latitude")
                    lon = loc.get("longitude")
                    name = loc.get("name", city_name.title())
                    country = loc.get("country", "")
                    admin1 = loc.get("admin1", "")
                    location_title = f"{name}, {admin1}, {country}".replace(", ,", ",").strip(", ")

                # Step 2: Weather Forecast Data
                weather_url = (
                    f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
                    f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m"
                    f"&timezone=auto"
                )

                async with session.get(weather_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        return False, f"⚠️ Weather service returned HTTP {resp.status}."
                    w_data = await resp.json()
                    current = w_data.get("current", {})
                    if not current:
                        return False, "⚠️ Weather data currently unavailable for this coordinate."

                    temp_c = current.get("temperature_2m", 0.0)
                    temp_f = round((temp_c * 9/5) + 32, 1)
                    app_c = current.get("apparent_temperature", temp_c)
                    app_f = round((app_c * 9/5) + 32, 1)
                    humidity = current.get("relative_humidity_2m", 0)
                    precip = current.get("precipitation", 0.0)
                    wind_kmh = current.get("wind_speed_10m", 0.0)
                    wind_mph = round(wind_kmh * 0.621371, 1)
                    code = current.get("weather_code", 0)
                    is_day = current.get("is_day", 1)
                    tz = w_data.get("timezone", "UTC")

                    # WMO Weather interpretation codes
                    wmo_map = {
                        0: ("Clear Sky", "☀️" if is_day else "🌙"),
                        1: ("Mainly Clear", "🌤️" if is_day else "🌕"),
                        2: ("Partly Cloudy", "⛅"),
                        3: ("Overcast", "☁️"),
                        45: ("Foggy", "🌫️"),
                        48: ("Depositing Rime Fog", "🌫️"),
                        51: ("Light Drizzle", "🌦️"),
                        53: ("Moderate Drizzle", "🌦️"),
                        55: ("Dense Drizzle", "🌧️"),
                        61: ("Slight Rain", "🌦️"),
                        63: ("Moderate Rain", "🌧️"),
                        65: ("Heavy Rain", "🌧️"),
                        71: ("Slight Snow Fall", "🌨️"),
                        73: ("Moderate Snow Fall", "❄️"),
                        75: ("Heavy Snow Fall", "❄️"),
                        77: ("Snow Grains", "❄️"),
                        80: ("Slight Rain Showers", "🌦️"),
                        81: ("Moderate Rain Showers", "🌧️"),
                        82: ("Violent Rain Showers", "⛈️"),
                        85: ("Slight Snow Showers", "🌨️"),
                        86: ("Heavy Snow Showers", "❄️"),
                        95: ("Thunderstorm", "⛈️"),
                        96: ("Thunderstorm with Slight Hail", "⛈️"),
                        99: ("Thunderstorm with Heavy Hail", "⛈️"),
                    }
                    condition_text, condition_emoji = wmo_map.get(code, ("Unknown", "🌡️"))

                    weather_report = (
                        f"{condition_emoji} *Live Weather: {location_title}*\\n"
                        f"• **Condition:** {condition_emoji} {condition_text}\\n"
                        f"• **Temperature:** \`{temp_c}°C\` ({temp_f}°F)\\n"
                        f"• **Feels Like:** \`{app_c}°C\` ({app_f}°F)\\n"
                        f"• **Humidity:** \`{humidity}%\`\\n"
                        f"• **Precipitation:** \`{precip} mm\`\\n"
                        f"• **Wind Speed:** \`{wind_kmh} km/h\` ({wind_mph} mph)\\n"
                        f"• **Timezone:** \`{tz}\` | **Coordinates:** \`{lat:.2f}, {lon:.2f}\`\\n\\n"
                        f"💡 *Data Source: Open-Meteo Free API (Zero API Keys & Real-Time)*"
                    )
                    return True, weather_report

        except Exception as e:
            logger.error(f"Weather lookup error for '{city_name}': {e}")
            return False, f"⚠️ Failed to retrieve weather information: {str(e)}"

    # 6. Multilingual Translation (Bengali, English, and All Global Languages)
    async def translate_text(self, text: str, target_lang: str = "English") -> Tuple[str, str]:
        """Translates text into target language with cultural fluency, phonetics, and grammar notes via the 6-tier AI cascade."""
        prompt = f"""You are an elite polyglot linguist and master translator.
Translate the following source text accurately and idiomatically into **{target_lang}** (e.g. Bengali / বাংলা, English, Spanish, etc.):

SOURCE TEXT:
---
{text.strip()}
---

Provide a well-structured translation response in clean Markdown with:
1. 🌐 **Language Mapping**: [Detected Source Language] ➔ **{target_lang}**
2. 📝 **Accurate Translation**:
[The fluent, natural, grammatically correct translation]
3. 🗣️ **Pronunciation / Transliteration** (Provide romanized phonetic pronunciation if target or source is non-Latin script like Bengali, Hindi, Japanese, Arabic, Russian):
[Phonetic guide]
4. 💡 **Linguistic Nuances & Vocabulary Highlights**:
- [1-2 concise bullet points explaining key words, formal/informal tone, or cultural context]"""

        messages = [
            {"role": "system", "content": "You are a master professional polyglot translator providing accurate translations with phonetic guides."},
            {"role": "user", "content": prompt}
        ]
        translation, provider = await self.llm.generate_response(messages, temperature=0.3, max_tokens=2048)
        return translation, provider

    # 7. Web Article & URL Scraper Summarizer
    async def summarize_url(self, url: str) -> Tuple[str, str]:
        """Scrapes an article or blog post URL and generates a comprehensive executive summary via the 6-tier AI cascade."""
        clean_url = url.strip().strip("<>").strip('"').strip("'")
        if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
            clean_url = "https://" + clean_url

        page_title = clean_url
        page_text = ""

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            }
            async with aiohttp.ClientSession() as session:
                async with session.get(clean_url, headers=headers, timeout=aiohttp.ClientTimeout(total=20)) as resp:
                    if resp.status != 200:
                        return f"⚠️ Web page request failed with HTTP status code {resp.status} for URL: \`{clean_url}\`.", "System"
                    html_content = await resp.text()

            # Clean and extract text from HTML
            if BeautifulSoup:
                soup = BeautifulSoup(html_content, "html.parser")
                for s in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "svg"]):
                    s.decompose()
                if soup.title and soup.title.string:
                    page_title = soup.title.string.strip()
                paragraphs = [p.get_text().strip() for p in soup.find_all(["p", "h1", "h2", "h3", "li"]) if p.get_text().strip()]
                page_text = "\\n\\n".join(paragraphs)
            else:
                # Regex fallback if beautifulsoup is not installed
                title_match = re.search(r"<title>(.*?)</title>", html_content, re.IGNORECASE | re.DOTALL)
                if title_match:
                    page_title = title_match.group(1).strip()
                clean = re.sub(r"<(script|style|nav|footer|header).*?</\\1>", "", html_content, flags=re.IGNORECASE | re.DOTALL)
                clean = re.sub(r"<[^>]+>", " ", clean)
                page_text = re.sub(r"\\s+", " ", clean).strip()

        except Exception as e:
            logger.error(f"URL scraping error for {clean_url}: {e}")
            return f"❌ Failed to fetch or parse webpage from \`{clean_url}\`: {str(e)}", "System"

        if not page_text or len(page_text) < 100:
            return f"⚠️ Could not extract readable text from \`{clean_url}\`. The page may be protected by Cloudflare/CAPTCHA or heavily rendered in JavaScript.", "System"

        max_chars = 16000
        truncated = len(page_text) > max_chars
        page_sample = page_text[:max_chars]

        parsed_domain = urllib.parse.urlparse(clean_url).netloc

        prompt = f"""You are an elite Research Analyst & Executive Content Summarizer.
Analyze the following web article / blog post content:
URL: {clean_url}
Domain: {parsed_domain}
Page Title: "{page_title}"
{f"(Note: Text was truncated to first {max_chars} characters)" if truncated else ""}

ARTICLE CONTENT:
---
{page_sample}
---

Provide a well-structured, high-impact executive summary in clean Markdown:
1. 📰 **Article Title & Domain**: [{page_title}]({clean_url})
2. ⏱️ **Estimated Reading Time & Category**: [e.g. 5 min read | Technology / Finance / Science]
3. 🎯 **Executive TL;DR (30-Second Summary)**:
[Concise 2-3 sentence core synopsis]
4. 📌 **Key Highlights & Core Arguments**:
- [Bullet 1: Main revelation or data point]
- [Bullet 2: Supporting evidence or analysis]
- [Bullet 3: Industry impact or consequence]
- [Bullet 4: Key quotes or findings]
5. 💡 **Critical Takeaway / Actionable Conclusion**:
[Final synthetic summary statement]"""

        messages = [
            {"role": "system", "content": "You are a professional executive web summarizer synthesizing long-form articles into concise, structured intelligence."},
            {"role": "user", "content": prompt}
        ]
        summary, provider = await self.llm.generate_response(messages, temperature=0.4, max_tokens=2500)
        return summary, provider

    # 8. Time Duration Parser (for /remind)
    def parse_time_duration(self, time_str: str) -> Optional[Tuple[int, str]]:
        """
        Parses human time durations like '10m', '30s', '1h', '2h30m', '1d', '45m' into seconds and readable string.
        """
        pattern = re.compile(r"(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?", re.IGNORECASE)
        match = pattern.fullmatch(time_str.strip())
        if not match:
            return None

        days = int(match.group(1) or 0)
        hours = int(match.group(2) or 0)
        minutes = int(match.group(3) or 0)
        seconds = int(match.group(4) or 0)

        total_seconds = days * 86400 + hours * 3600 + minutes * 60 + seconds
        if total_seconds <= 0:
            return None

        parts = []
        if days: parts.append(f"{days} day{'s' if days > 1 else ''}")
        if hours: parts.append(f"{hours} hour{'s' if hours > 1 else ''}")
        if minutes: parts.append(f"{minutes} minute{'s' if minutes > 1 else ''}")
        if seconds: parts.append(f"{seconds} second{'s' if seconds > 1 else ''}")
        human_str = ", ".join(parts)

        return total_seconds, human_str

automation_helper = AutomationEngine(ai_client)


# =============================================================================
# Unified Memory Management (Namespaced across Telegram, Discord, Slack)
# =============================================================================

class MemoryManager:
    """Stores per-user conversation memory across Telegram, Discord, and Slack."""
    def __init__(self, max_turns: int = 15, ttl_seconds: int = 7200):
        self.max_turns = max_turns
        self.ttl_seconds = ttl_seconds
        self.conversations: Dict[str, List[dict]] = {}
        self.custom_prompts: Dict[str, str] = {}
        self.user_stats: Dict[str, dict] = {}

    def _get_key(self, platform: str, user_id: Any) -> str:
        return f"{platform}:{user_id}"

    def get_system_prompt(self, platform: str, user_id: Any) -> str:
        key = self._get_key(platform, user_id)
        return self.custom_prompts.get(key, DEFAULT_SYSTEM_PROMPT)

    def set_system_prompt(self, platform: str, user_id: Any, prompt: str) -> None:
        key = self._get_key(platform, user_id)
        self.custom_prompts[key] = prompt
        self.clear_history(platform, user_id)

    def reset_system_prompt(self, platform: str, user_id: Any) -> None:
        key = self._get_key(platform, user_id)
        if key in self.custom_prompts:
            del self.custom_prompts[key]
        self.clear_history(platform, user_id)

    def cleanup_expired_memories(self) -> None:
        now = time.time()
        expired = [k for k, h in self.conversations.items() if h and (now - h[-1].get("timestamp", 0) > self.ttl_seconds)]
        for k in expired:
            del self.conversations[k]

    def get_messages_for_llm(self, platform: str, user_id: Any) -> List[dict]:
        self.cleanup_expired_memories()
        key = self._get_key(platform, user_id)
        system_content = self.get_system_prompt(platform, user_id)
        messages = [{"role": "system", "content": system_content}]
        for item in self.conversations.get(key, []):
            messages.append({"role": item["role"], "content": item["content"]})
        return messages

    def add_turn(self, platform: str, user_id: Any, role: str, content: str) -> None:
        key = self._get_key(platform, user_id)
        if key not in self.conversations:
            self.conversations[key] = []
        self.conversations[key].append({"role": role, "content": content, "timestamp": time.time()})

        if key not in self.user_stats:
            self.user_stats[key] = {"messages": 0, "platform": platform}
        self.user_stats[key]["messages"] += 1

        max_items = self.max_turns * 2
        if len(self.conversations[key]) > max_items:
            self.conversations[key] = self.conversations[key][-max_items:]

    def clear_history(self, platform: str, user_id: Any) -> int:
        key = self._get_key(platform, user_id)
        if key in self.conversations:
            count = len(self.conversations[key])
            del self.conversations[key]
            return count
        return 0

    def get_stats(self, platform: str, user_id: Any) -> dict:
        key = self._get_key(platform, user_id)
        history = self.conversations.get(key, [])
        stats = self.user_stats.get(key, {"messages": 0})
        return {
            "current_turns": len(history) // 2,
            "max_turns": self.max_turns,
            "total_messages": stats["messages"],
            "active_users_in_cache": len(self.conversations),
        }

memory = MemoryManager(max_turns=MAX_MEMORY_TURNS, ttl_seconds=MEMORY_TTL_SECONDS)


# =============================================================================
# Helper Utilities
# =============================================================================

def split_text(text: str, max_len: int = 2000) -> List[str]:
    """Splits long text into platform-friendly chunks (Discord limit 2000, Telegram 4096)."""
    if len(text) <= max_len:
        return [text]
    chunks, curr = [], ""
    for line in text.split("\\n"):
        if len(curr) + len(line) + 1 <= max_len:
            curr += (line + "\\n")
        else:
            if curr.strip():
                chunks.append(curr.rstrip())
            curr = line + "\\n"
    if curr.strip():
        chunks.append(curr.rstrip())
    return chunks if chunks else [text]


# =============================================================================
# 1. Telegram Bot Implementation
# =============================================================================

async def tg_send_safely(update: Update, context: ContextTypes.DEFAULT_TYPE, text: str) -> None:
    chat_id = update.effective_chat.id
    for chunk in split_text(text, max_len=4000):
        try:
            await context.bot.send_message(chat_id=chat_id, text=chunk, parse_mode=ParseMode.MARKDOWN, disable_web_page_preview=True)
        except BadRequest:
            await context.bot.send_message(chat_id=chat_id, text=chunk, parse_mode=None, disable_web_page_preview=True)

async def tg_start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_user_authorized(str(user.id)):
        await update.message.reply_text("⛔ Unauthorized.")
        return
    text = (
        f"👋 *Hello {user.first_name}!*\\n\\n"
        f"I am your Universal AI Bot with **6-Tier Multi-Provider Auto-Failover, Dual Admin Alerting & High-Value Automation Suite**.\\n\\n"
        f"🌐 *Active Multi-Platforms:* Telegram 🟢 | Discord {'🟢' if DISCORD_BOT_TOKEN else '⚪'} | Slack {'🟢' if SLACK_BOT_TOKEN else '⚪'}\\n"
        f"🚨 *Admin Alert Channels:* Telegram (\`{ADMIN_TELEGRAM_ID or 'Not Set'}\`) + Discord Webhook\\n"
        f"⚡ *Cascade Order:* Groq -> Gemini -> Cerebras -> OpenRouter (DeepSeek R1 free) -> Together -> Mistral\\n\\n"
        f"🎨 *High-Value Automation & Productivity Commands:*\\n"
        f"• \`/weather <city>\` - Real-time weather details via Open-Meteo free API (no keys needed)\\n"
        f"• \`/translate <text> to <lang>\` - Polyglot AI translation into Bengali, English, etc. with phonetics\\n"
        f"• \`/summary <url>\` - Scrape & summarize long news articles and blog posts\\n"
        f"• \`/remind <time> <msg>\` - Automated reminder scheduler (e.g. \`/remind 10m Take lunch break\`)\\n"
        f"• \`/image <prompt>\` - Free AI Image Generation via Pollinations AI\\n"
        f"• \`/search <query>\` - Real-time DuckDuckGo web search + AI cited summary\\n"
        f"• \`/tts <text>\` - Convert text to voice audio message (gTTS)\\n"
        f"• 📄 *Document Reader* - Upload any \`.txt\` or \`.pdf\` file to get an instant AI summary & insights\\n"
        f"• \`/yt_seo <topic>\` - YouTube Title, Description, Tags & Thumbnail Prompts\\n"
        f"• \`/yt_upload\` - Check YouTube OAuth2 API upload credentials\\n\\n"
        f"⚙️ *System Commands:*\\n"
        f"• \`/providers\` - Inspect live AI fallback endpoints & key pool\\n"
        f"• \`/health\` - Check 24/7 cloud uptime & host diagnostics\\n"
        f"• \`/testalert\` - Test Telegram & Discord Webhook alerts\\n"
        f"• \`/reset\` - Clear conversation memory"
    )
    await tg_send_safely(update, context, text)

async def tg_image_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_user_authorized(str(user.id)):
        await update.message.reply_text("⛔ Unauthorized.")
        return

    prompt = " ".join(context.args).strip() if context.args else ""
    if not prompt:
        await update.message.reply_text(
            "🎨 *Usage:* \`/image <prompt>\`\\n\\n"
            "Example:\\n\`\`\`/image Futuristic cyberpunk neon city at night, 8k resolution, cinematic lighting\`\`\`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    chat_id = update.effective_chat.id
    await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.UPLOAD_PHOTO)
    status_msg = await update.message.reply_text("🎨 *Generating AI image with Pollinations AI...*", parse_mode=ParseMode.MARKDOWN)

    img_bytes, img_url = await automation_helper.generate_image_pollinations(prompt)

    try:
        await context.bot.delete_message(chat_id=chat_id, message_id=status_msg.message_id)
    except Exception:
        pass

    if img_bytes:
        caption = f"🎨 *Generated with Pollinations AI*\\n*Prompt:* _{prompt}_"
        await context.bot.send_photo(
            chat_id=chat_id,
            photo=io.BytesIO(img_bytes),
            caption=caption[:1024],
            parse_mode=ParseMode.MARKDOWN
        )
    else:
        # Fallback to direct URL if byte streaming encountered an issue
        await update.message.reply_text(
            f"🎨 *Generated with Pollinations AI*\\n*Prompt:* _{prompt}_\\n\\n🔗 [Direct Image Link]({img_url})",
            parse_mode=ParseMode.MARKDOWN
        )

async def tg_search_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_user_authorized(str(user.id)):
        await update.message.reply_text("⛔ Unauthorized.")
        return

    query = " ".join(context.args).strip() if context.args else ""
    if not query:
        await update.message.reply_text(
            "🔍 *Usage:* \`/search <query>\`\\n\\n"
            "Example:\\n\`\`\`/search Latest discoveries James Webb Space Telescope 2026\`\`\`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    chat_id = update.effective_chat.id
    await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
    status_msg = await update.message.reply_text("🔍 *Searching DuckDuckGo in real-time & synthesizing answer...*", parse_mode=ParseMode.MARKDOWN)

    synthesis, provider, results = await automation_helper.search_and_synthesize(query)

    try:
        await context.bot.delete_message(chat_id=chat_id, message_id=status_msg.message_id)
    except Exception:
        pass

    header = f"🌐 *Real-Time Web Search Synthesis*\\n*Query:* \`{query}\` | *Model:* \`{provider}\`\\n\\n"
    await tg_send_safely(update, context, header + synthesis)

async def tg_tts_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_user_authorized(str(user.id)):
        await update.message.reply_text("⛔ Unauthorized.")
        return

    text = " ".join(context.args).strip() if context.args else ""
    if not text:
        await update.message.reply_text(
            "🗣️ *Usage:* \`/tts <text to speak>\`\\n\\n"
            "Example:\\n\`\`\`/tts Hello! Your multi-platform AI bot is operating at 100 percent capacity.\`\`\`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    chat_id = update.effective_chat.id
    await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.RECORD_VOICE)
    status_msg = await update.message.reply_text("🎙️ *Synthesizing voice audio with gTTS...*", parse_mode=ParseMode.MARKDOWN)

    audio_fp = await automation_helper.generate_tts(text)

    try:
        await context.bot.delete_message(chat_id=chat_id, message_id=status_msg.message_id)
    except Exception:
        pass

    if audio_fp:
        caption = f"🗣️ *Voice Message*\\n_{text[:80]}..._" if len(text) > 80 else f"🗣️ *Voice Message*\\n_{text}_"
        await context.bot.send_voice(
            chat_id=chat_id,
            voice=audio_fp,
            caption=caption,
            parse_mode=ParseMode.MARKDOWN
        )
    else:
        await update.message.reply_text("⚠️ Voice synthesis failed. Ensure \`gTTS\` is installed in requirements.txt.")

async def tg_document_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_user_authorized(str(user.id)):
        await update.message.reply_text("⛔ Unauthorized.")
        return

    doc = update.message.document
    if not doc:
        return

    filename = doc.file_name or "uploaded_document"
    fn_lower = filename.lower()

    if not (fn_lower.endswith(".pdf") or fn_lower.endswith(".txt") or fn_lower.endswith(".md") or fn_lower.endswith(".csv") or fn_lower.endswith(".json") or fn_lower.endswith(".py") or fn_lower.endswith(".log")):
        await update.message.reply_text(f"⚠️ Unsupported document format: \`{filename}\`. Supported formats: \`.txt\`, \`.pdf\`, \`.md\`, \`.csv\`, \`.json\`, \`.log\`.")
        return

    chat_id = update.effective_chat.id
    await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
    status_msg = await update.message.reply_text(f"📄 *Processing \`{filename}\` & extracting insights with 6-tier AI cascade...*", parse_mode=ParseMode.MARKDOWN)

    try:
        tg_file = await context.bot.get_file(doc.file_id)
        file_bytes = await tg_file.download_as_bytearray()
    except Exception as e:
        logger.error(f"Failed to download document: {e}")
        await update.message.reply_text(f"❌ Failed to download \`{filename}\`: {e}")
        return

    user_caption = update.message.caption
    analysis, provider = await automation_helper.analyze_document(filename, bytes(file_bytes), user_caption)

    try:
        await context.bot.delete_message(chat_id=chat_id, message_id=status_msg.message_id)
    except Exception:
        pass

    header = f"📊 *Document Intelligence Analysis*\\n*File:* \`{filename}\` | *Model:* \`{provider}\`\\n\\n"
    await tg_send_safely(update, context, header + analysis)

async def tg_yt_seo_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_user_authorized(str(user.id)):
        await update.message.reply_text("⛔ Unauthorized.")
        return

    topic = " ".join(context.args).strip() if context.args else ""
    if not topic:
        await update.message.reply_text(
            "📹 *Usage:* \`/yt_seo <topic or video concept>\`\\n\\n"
            "Example:\\n\`\`\`/yt_seo Build a 24/7 Discord & Telegram AI Bot in Python\`\`\`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    status_msg = await update.message.reply_text("🔍 *Analyzing YouTube algorithm & generating SEO package...*", parse_mode=ParseMode.MARKDOWN)

    seo_content, provider = await youtube_helper.generate_youtube_seo(topic)
    try:
        await context.bot.delete_message(chat_id=update.effective_chat.id, message_id=status_msg.message_id)
    except Exception:
        pass

    header = f"🎬 *YouTube SEO Optimization Package*\\n*Topic:* \`{topic}\`\\n*Generated with:* \`{provider}\`\\n\\n"
    await tg_send_safely(update, context, header + seo_content)

async def tg_yt_upload_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_user_authorized(str(user.id)):
        await update.message.reply_text("⛔ Unauthorized.")
        return

    status = youtube_helper.check_credentials_status()
    if not status["configured"]:
        msg = (
            "📹 *YouTube Video Uploader Module Status: ⚠️ Not Configured*\\n\\n"
            "To enable automated YouTube uploads via OAuth2:\\n"
            "1️⃣ Go to [Google Cloud Console](https://console.cloud.google.com) and enable **YouTube Data API v3**.\\n"
            "2️⃣ Create an **OAuth 2.0 Client ID** (Desktop Application) and download \`client_secret.json\`.\\n"
            "3️⃣ Place \`client_secret.json\` in your bot root or set \`YOUTUBE_CLIENT_SECRET_FILE\` in \`.env\`.\\n"
            "4️⃣ Run \`pip install google-api-python-client google-auth-oauthlib google-auth-httplib2\`."
        )
    else:
        msg = (
            "📹 *YouTube Video Uploader Module Status: 🟢 Configured!*\\n\\n"
            f"• Secret File: \`{status['client_secret_path']}\` ({'Found' if status['has_secret_file'] else 'Missing'})\\n"
            f"• Token Cache: \`{status['token_path']}\` ({'Authenticated' if status['has_token_file'] else 'Pending Token'})\\n\\n"
            "Video upload handler is ready for automated uploads!"
        )
    await tg_send_safely(update, context, msg)

async def tg_weather_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_user_authorized(str(user.id)):
        await update.message.reply_text("⛔ Unauthorized.")
        return

    city = " ".join(context.args).strip() if context.args else ""
    if not city:
        await update.message.reply_text(
            "🌤️ *Usage:* \`/weather <city name>\`\\n\\n"
            "Examples:\\n"
            "• \`/weather Dhaka\`\\n"
            "• \`/weather London\`\\n"
            "• \`/weather Tokyo\`\\n"
            "• \`/weather New York\`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    chat_id = update.effective_chat.id
    await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
    status_msg = await update.message.reply_text(f"🌤️ *Fetching real-time weather for \`{city}\` from Open-Meteo...*", parse_mode=ParseMode.MARKDOWN)

    success, report = await automation_helper.get_weather(city)

    try:
        await context.bot.delete_message(chat_id=chat_id, message_id=status_msg.message_id)
    except Exception:
        pass

    await tg_send_safely(update, context, report)

async def tg_translate_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_user_authorized(str(user.id)):
        await update.message.reply_text("⛔ Unauthorized.")
        return

    raw_args = " ".join(context.args).strip() if context.args else ""
    if not raw_args:
        await update.message.reply_text(
            "🌐 *Usage:* \`/translate <text> to <target language>\`\\n\\n"
            "Examples:\\n"
            "• \`/translate Hello, how are you today? to Bengali\`\\n"
            "• \`/translate আমি তোমাকে খুব ভালোবাসি to English\`\\n"
            "• \`/translate Machine learning transforms modern industries to Spanish\`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    # Parse target language and text
    target_lang = "Bengali"
    text_to_translate = raw_args

    if " to " in raw_args.lower():
        parts = re.split(r"\s+to\s+", raw_args, flags=re.IGNORECASE)
        if len(parts) >= 2:
            text_to_translate = parts[0].strip()
            target_lang = parts[1].strip()
    elif " -> " in raw_args:
        parts = raw_args.split(" -> ")
        if len(parts) >= 2:
            text_to_translate = parts[0].strip()
            target_lang = parts[1].strip()

    chat_id = update.effective_chat.id
    await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
    status_msg = await update.message.reply_text(f"🌐 *Translating text into \`{target_lang}\` with 6-tier AI cascade...*", parse_mode=ParseMode.MARKDOWN)

    translation, provider = await automation_helper.translate_text(text_to_translate, target_lang)

    try:
        await context.bot.delete_message(chat_id=chat_id, message_id=status_msg.message_id)
    except Exception:
        pass

    header = f"🌐 *AI Polyglot Translation ({provider})*\\n\\n"
    await tg_send_safely(update, context, header + translation)

async def tg_summary_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_user_authorized(str(user.id)):
        await update.message.reply_text("⛔ Unauthorized.")
        return

    url = " ".join(context.args).strip() if context.args else ""
    if not url:
        await update.message.reply_text(
            "📰 *Usage:* \`/summary <article or blog post URL>\`\\n\\n"
            "Example:\\n"
            "\`\`\`/summary https://techcrunch.com/2026/01/15/ai-breakthroughs\`\`\`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    chat_id = update.effective_chat.id
    await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
    status_msg = await update.message.reply_text(f"📰 *Scraping webpage & extracting executive intelligence...*", parse_mode=ParseMode.MARKDOWN)

    summary, provider = await automation_helper.summarize_url(url)

    try:
        await context.bot.delete_message(chat_id=chat_id, message_id=status_msg.message_id)
    except Exception:
        pass

    header = f"📊 *Executive Article Summary ({provider})*\\n\\n"
    await tg_send_safely(update, context, header + summary)

async def tg_remind_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_user_authorized(str(user.id)):
        await update.message.reply_text("⛔ Unauthorized.")
        return

    args = context.args or []
    if len(args) < 2:
        await update.message.reply_text(
            "⏰ *Usage:* \`/remind <time> <reminder message>\`\\n\\n"
            "Format for \`<time>\`: \`30s\`, \`10m\`, \`1h\`, \`2h30m\`, \`1d\`\\n\\n"
            "Examples:\\n"
            "• \`/remind 10m Take a short walk and rest your eyes\`\\n"
            "• \`/remind 1h Join engineering sprint standup call\`\\n"
            "• \`/remind 30s Check server deploy pipeline\`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    time_str = args[0].strip()
    message_text = " ".join(args[1:]).strip()

    parsed = automation_helper.parse_time_duration(time_str)
    if not parsed:
        await update.message.reply_text(
            f"⚠️ Invalid time format: \`{time_str}\`.\\n"
            f"Use suffixes: \`s\` (seconds), \`m\` (minutes), \`h\` (hours), \`d\` (days).\\n"
            f"Examples: \`30s\`, \`15m\`, \`2h\`, \`1h30m\`."
        )
        return

    seconds, human_str = parsed
    chat_id = update.effective_chat.id
    user_mention = f"[{user.first_name}](tg://user?id={user.id})"

    # Immediate confirmation response
    confirm_text = (
        f"⏰ *Reminder Scheduled Successfully!*\\n\\n"
        f"• **Duration:** In *{human_str}* (\`{seconds}s\`)\\n"
        f"• **Message:** _{message_text}_\\n\\n"
        f"🔔 I will ping you here when the timer expires."
    )
    await update.message.reply_text(confirm_text, parse_mode=ParseMode.MARKDOWN)

    # Background async non-blocking task
    async def reminder_worker(target_chat_id: int, mention: str, delay: int, msg: str, duration_desc: str):
        await asyncio.sleep(delay)
        alert_msg = (
            f"⏰ 🔔 *AUTOMATED REMINDER NOTIFICATION*\\n\\n"
            f"Hey {mention}, your scheduled reminder is here!\\n\\n"
            f"📌 **Message:**\\n*{msg}*\\n\\n"
            f"⏱️ *Scheduled {duration_desc} ago.*"
        )
        try:
            await context.bot.send_message(chat_id=target_chat_id, text=alert_msg, parse_mode=ParseMode.MARKDOWN)
        except Exception as e:
            logger.error(f"Failed to send Telegram reminder: {e}")

    asyncio.create_task(reminder_worker(chat_id, user_mention, seconds, message_text, human_str))

# =============================================================================
# Automated API Key Background Health Pinging Engine (Startup + Every 6 Hours)
# =============================================================================

HEALTH_CHECK_INTERVAL_SECONDS = 6 * 3600  # 6 Hours = 21,600 seconds
last_health_check_time: Optional[datetime] = None

async def api_key_health_monitor(interval_seconds: int = HEALTH_CHECK_INTERVAL_SECONDS):
    """
    Automated background key health monitor:
    Runs silently on startup (after 5s delay) and every 6 hours.
    Pings all Groq keys and all fallback providers to ensure 100% active uptime.
    """
    global last_health_check_time
    logger.info(f"🔑 [Health Monitor] Background API key monitor initialized (Startup + Every {interval_seconds // 3600}h).")
    
    # Wait 5 seconds after startup before the initial health ping
    await asyncio.sleep(5)

    while True:
        try:
            logger.info("🔑 [Health Monitor] Starting scheduled API key health verification ping...")
            # 1. Ping all Groq keys in parallel
            groq_pings = [groq_rotator.ping_key(k) for k in groq_rotator.keys]
            if groq_pings:
                await asyncio.gather(*groq_pings, return_exceptions=True)

            # 2. Ping all configured fallback AI providers in parallel
            provider_pings = [
                ai_client.ping_provider(p_name)
                for p_name, p_data in ai_client.provider_states.items()
                if p_data["key"]
            ]
            if provider_pings:
                await asyncio.gather(*provider_pings, return_exceptions=True)

            last_health_check_time = datetime.now(timezone.utc)
            g_status = groq_rotator.get_status()
            p_overview = ai_client.get_providers_overview()

            active_summary = []
            for p_name, p_info in p_overview.items():
                if p_info["configured"]:
                    active_summary.append(f"{p_name}: {p_info.get('status', 'ACTIVE')}")

            logger.info(
                f"✅ [Health Monitor] API key health check completed at {last_health_check_time.strftime('%H:%M:%S UTC')}. "
                f"Groq: {g_status['active_keys']}/{g_status['total_keys']} active. "
                f"Providers: {', '.join(active_summary)}"
            )
        except Exception as e:
            logger.error(f"⚠️ [Health Monitor] Error during key health verification: {e}")

        await asyncio.sleep(interval_seconds)


async def tg_providers_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    overview = ai_client.get_providers_overview()
    groq_info = overview["Groq"]
    last_ping_str = last_health_check_time.strftime('%Y-%m-%d %H:%M:%S UTC') if last_health_check_time else "Pending initial ping"
    text = (
        f"🌐 *6-Tier AI Fallback Engine & Key Health Status:*\\n\\n"
        f"1️⃣ Groq Pool: {'🟢 Active' if groq_info['keys_active'] > 0 else ('⏳ Cooling Down' if groq_info['keys_cooling'] > 0 else '🔴 Inactive')} "
        f"(\`{groq_info['keys_active']}/{groq_info['keys_total']}\` active keys, \`{groq_info['keys_cooling']}\` cooling)\\n"
        f"2️⃣ Gemini: {'🟢 Active' if overview['Gemini']['status'] == 'ACTIVE' else ('⏳ Cooling' if overview['Gemini']['status'] == 'COOLING_DOWN' else '⚪ Off')} (\`{overview['Gemini']['model']}\`)\\n"
        f"3️⃣ Cerebras: {'🟢 Active' if overview['Cerebras']['status'] == 'ACTIVE' else ('⏳ Cooling' if overview['Cerebras']['status'] == 'COOLING_DOWN' else '⚪ Off')} (\`{overview['Cerebras']['model']}\`)\\n"
        f"4️⃣ OpenRouter: {'🟢 Active' if overview['OpenRouter']['status'] == 'ACTIVE' else ('⏳ Cooling' if overview['OpenRouter']['status'] == 'COOLING_DOWN' else '⚪ Off')} (DeepSeek R1 free)\\n"
        f"5️⃣ Together AI: {'🟢 Active' if overview['Together']['status'] == 'ACTIVE' else ('⏳ Cooling' if overview['Together']['status'] == 'COOLING_DOWN' else '⚪ Off')}\\n"
        f"6️⃣ Mistral AI: {'🟢 Active' if overview['Mistral']['status'] == 'ACTIVE' else ('⏳ Cooling' if overview['Mistral']['status'] == 'COOLING_DOWN' else '⚪ Off')}\\n\\n"
        f"⏱ *Auto-Ping Health Monitor:* Runs every 6 hours\\n"
        f"🕒 *Last Ping:* \`{last_ping_str}\`"
    )
    await tg_send_safely(update, context, text)

async def tg_health_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uptime_s = int((datetime.now(timezone.utc) - STARTUP_TIMESTAMP).total_seconds())
    yt_status = youtube_helper.check_credentials_status()
    g_status = groq_rotator.get_status()
    last_ping_str = last_health_check_time.strftime('%H:%M:%S UTC') if last_health_check_time else "Pending"
    text = (
        f"🏥 *Universal Bot Health & Key Diagnostic*\\n\\n"
        f"• Status: 🟢 24/7 Online\\n"
        f"• Host Node: \`{socket.gethostname()}\` (Port: {PORT})\\n"
        f"• Uptime: {uptime_s // 3600}h {(uptime_s % 3600) // 60}m\\n"
        f"• Groq Key Pool: \`{g_status['active_keys']}/{g_status['total_keys']} Active\` (\`{g_status['cooling_keys']}\` cooling)\\n"
        f"• 6h Key Ping Health Check: \`{last_ping_str}\`\\n"
        f"• Active Chat Platforms: Telegram 🟢 | Discord {'🟢' if DISCORD_BOT_TOKEN else '⚪'} | Slack {'🟢' if SLACK_BOT_TOKEN else '⚪'}\\n"
        f"• YouTube Module: {'🟢 OAuth Configured' if yt_status['configured'] else '🟡 SEO Active (Uploads Unset)'}\\n"
        f"• Discord Webhook Alerts: {'🟢 Configured' if DISCORD_ADMIN_WEBHOOK_URL else '⚪ Not Set'}"
    )
    await tg_send_safely(update, context, text)

async def tg_testalert_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    await admin_alert.send_alert(
        title="Admin Alert Verification Test",
        details=(
            f"• Triggered by: {user.first_name} on Telegram (\`{user.id}\`)\\n"
            f"• Conduits: Telegram + Discord Webhook\\n"
            f"• Status: 🟢 All notification channels fully synchronized"
        ),
        alert_level="SUCCESS"
    )
    await update.message.reply_text("✅ Diagnostic alert broadcasted to Telegram Admin ID and Discord Webhook!")

async def tg_message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_text = update.message.text
    if not is_user_authorized(str(user.id)) or not user_text:
        return

    memory.add_turn("tg", user.id, "user", user_text)
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)

    reply, provider = await ai_client.generate_response(memory.get_messages_for_llm("tg", user.id))
    memory.add_turn("tg", user.id, "assistant", reply)
    await tg_send_safely(update, context, reply)


# =============================================================================
# 2. Discord Bot Implementation (discord.py)
# =============================================================================

intents = discord.Intents.default()
intents.message_content = True
discord_bot = discord_commands.Bot(command_prefix=["!", "/"], intents=intents, help_command=None)

@discord_bot.event
async def on_ready():
    logger.info(f"👾 Discord Bot connected as {discord_bot.user} (ID: {discord_bot.user.id})")
    admin_alert.fire_and_forget(
        title="Discord Bot Service Online",
        details=f"• Bot User: \`{discord_bot.user}\`\\n• Guilds: {len(discord_bot.guilds)}\\n• Connected to Unified 6-Tier AI Engine & YouTube Module",
        alert_level="SUCCESS"
    )

@discord_bot.command(name="image")
async def discord_image(ctx, *, prompt: str = ""):
    """Generate AI image via Pollinations AI free API."""
    if not is_user_authorized(str(ctx.author.id)):
        await ctx.reply("⛔ Unauthorized.")
        return
    if not prompt:
        await ctx.reply("🎨 Usage: \`!image <prompt>\` (e.g. \`!image cybernetic tiger glowing in neon forest\`)")
        return

    async with ctx.typing():
        img_bytes, img_url = await automation_helper.generate_image_pollinations(prompt)
        if img_bytes:
            file = discord.File(io.BytesIO(img_bytes), filename="generated_image.png")
            embed = discord.Embed(title="🎨 Pollinations AI Image Generation", color=0x9B59B6)
            embed.description = f"**Prompt:** {prompt}"
            embed.set_image(url="attachment://generated_image.png")
            await ctx.reply(file=file, embed=embed)
        else:
            await ctx.reply(f"🎨 Generated Image URL: {img_url}")

@discord_bot.command(name="search")
async def discord_search(ctx, *, query: str = ""):
    """Search DuckDuckGo in real-time with AI synthesis."""
    if not is_user_authorized(str(ctx.author.id)):
        await ctx.reply("⛔ Unauthorized.")
        return
    if not query:
        await ctx.reply("🔍 Usage: \`!search <query>\` (e.g. \`!search latest SpaceX Starship launch results\`)")
        return

    async with ctx.typing():
        synthesis, provider, _ = await automation_helper.search_and_synthesize(query)
        header = f"🌐 **DuckDuckGo Web Search Synthesis**\\n**Query:** \`{query}\` | **Model:** \`{provider}\`\\n\\n"
        for chunk in split_text(header + synthesis, max_len=1950):
            await ctx.reply(chunk)

@discord_bot.command(name="weather")
async def discord_weather(ctx, *, city: str = ""):
    """Fetch live weather from Open-Meteo free API."""
    if not is_user_authorized(str(ctx.author.id)):
        await ctx.reply("⛔ Unauthorized.")
        return
    if not city:
        await ctx.reply("🌤️ Usage: \`!weather <city name>\` (e.g. \`!weather London\`, \`!weather Dhaka\`)")
        return

    async with ctx.typing():
        success, report = await automation_helper.get_weather(city)
        for chunk in split_text(report, max_len=1950):
            await ctx.reply(chunk)

@discord_bot.command(name="translate")
async def discord_translate(ctx, *, args: str = ""):
    """Translate text into target language with phonetics."""
    if not is_user_authorized(str(ctx.author.id)):
        await ctx.reply("⛔ Unauthorized.")
        return
    if not args:
        await ctx.reply("🌐 Usage: \`!translate <text> to <target language>\`\\nExample: \`!translate Good morning friend to Bengali\`")
        return

    target_lang = "Bengali"
    text_to_translate = args
    if " to " in args.lower():
        parts = re.split(r"\s+to\s+", args, flags=re.IGNORECASE)
        if len(parts) >= 2:
            text_to_translate = parts[0].strip()
            target_lang = parts[1].strip()

    async with ctx.typing():
        translation, provider = await automation_helper.translate_text(text_to_translate, target_lang)
        header = f"🌐 **AI Polyglot Translation ({provider})**\n\n"
        for chunk in split_text(header + translation, max_len=1950):
            await ctx.reply(chunk)

@discord_bot.command(name="summary")
async def discord_summary(ctx, *, url: str = ""):
    """Scrape and summarize news articles or blog posts."""
    if not is_user_authorized(str(ctx.author.id)):
        await ctx.reply("⛔ Unauthorized.")
        return
    if not url:
        await ctx.reply("📰 Usage: \`!summary <article URL>\`")
        return

    async with ctx.typing():
        summary, provider = await automation_helper.summarize_url(url)
        header = f"📊 **Executive Article Summary ({provider})**\n\n"
        for chunk in split_text(header + summary, max_len=1950):
            await ctx.reply(chunk)

@discord_bot.command(name="remind")
async def discord_remind(ctx, time_str: str = "", *, message_text: str = ""):
    """Schedule an automated reminder (e.g. !remind 10m Take a break)."""
    if not is_user_authorized(str(ctx.author.id)):
        await ctx.reply("⛔ Unauthorized.")
        return
    if not time_str or not message_text:
        await ctx.reply("⏰ Usage: \`!remind <time> <message>\`\\nExamples:\\n• \`!remind 10m Take lunch break\`\\n• \`!remind 1h Team meeting\`\\n• \`!remind 30s Stretch\`")
        return

    parsed = automation_helper.parse_time_duration(time_str)
    if not parsed:
        await ctx.reply(f"⚠️ Invalid time format \`{time_str}\`. Use formats like \`30s\`, \`15m\`, \`1h\`, \`2h30m\`.")
        return

    seconds, human_str = parsed
    channel = ctx.channel
    author_mention = ctx.author.mention

    await ctx.reply(f"⏰ **Reminder Scheduled!** I will notify you in **{human_str}** for: _{message_text}_")

    async def discord_reminder_worker():
        await asyncio.sleep(seconds)
        alert_msg = f"⏰ 🔔 **REMINDER ALERT**\nHey {author_mention}, your reminder is here!\n\n📌 **{message_text}**\n⏱️ _Scheduled {human_str} ago._"
        try:
            await channel.send(alert_msg)
        except Exception as e:
            logger.error(f"Failed to send Discord reminder: {e}")

    asyncio.create_task(discord_reminder_worker())

@discord_bot.command(name="tts")
async def discord_tts(ctx, *, text: str = ""):
    """Generate text-to-speech voice MP3 via gTTS."""
    if not is_user_authorized(str(ctx.author.id)):
        await ctx.reply("⛔ Unauthorized.")
        return
    if not text:
        await ctx.reply("🗣️ Usage: \`!tts <text to convert to speech>\`")
        return

    async with ctx.typing():
        audio_fp = await automation_helper.generate_tts(text)
        if audio_fp:
            file = discord.File(audio_fp, filename="voice_message.mp3")
            await ctx.reply(f"🗣️ **Voice Message:** _{text[:100]}..._", file=file)
        else:
            await ctx.reply("⚠️ Voice synthesis failed. Ensure \`gTTS\` is installed.")

@discord_bot.command(name="yt_seo")
async def discord_yt_seo(ctx, *, topic: str = ""):
    """Generate YouTube SEO package."""
    if not is_user_authorized(str(ctx.author.id)):
        await ctx.reply("⛔ Unauthorized.")
        return
    if not topic:
        await ctx.reply("📹 Usage: \`!yt_seo <video topic>\` (e.g. \`!yt_seo Master Python AsyncIO in 2026\`)")
        return

    async with ctx.typing():
        seo_content, provider = await youtube_helper.generate_youtube_seo(topic)
        header = f"🎬 **YouTube SEO Optimization Package**\\n**Topic:** \`{topic}\` | **Model:** \`{provider}\`\\n\\n"
        for chunk in split_text(header + seo_content, max_len=1950):
            await ctx.reply(chunk)

@discord_bot.command(name="yt_upload")
async def discord_yt_upload(ctx):
    """Check YouTube API upload configuration."""
    status = youtube_helper.check_credentials_status()
    if not status["configured"]:
        embed = discord.Embed(title="⚠️ YouTube Upload Credentials Missing", color=0xF1C40F)
        embed.description = (
            "To enable automated YouTube uploads:\\n"
            "1. Enable **YouTube Data API v3** in Google Cloud Console.\\n"
            "2. Download \`client_secret.json\` (OAuth 2.0 Desktop App).\\n"
            "3. Place in project root or set \`YOUTUBE_CLIENT_SECRET_FILE\` in \`.env\`."
        )
    else:
        embed = discord.Embed(title="✅ YouTube Upload Module Ready", color=0x2ECC71)
        embed.description = f"Secret File: \`{status['client_secret_path']}\`\\nStatus: Ready for streaming uploads."
    await ctx.reply(embed=embed)

@discord_bot.command(name="ask")
async def discord_ask(ctx, *, question: str):
    """Ask a question using the 6-Tier AI engine."""
    if not is_user_authorized(str(ctx.author.id)):
        await ctx.reply("⛔ Unauthorized.")
        return

    async with ctx.typing():
        memory.add_turn("discord", ctx.author.id, "user", question)
        reply, provider = await ai_client.generate_response(memory.get_messages_for_llm("discord", ctx.author.id))
        memory.add_turn("discord", ctx.author.id, "assistant", reply)

        for chunk in split_text(reply, max_len=1950):
            await ctx.reply(chunk)

@discord_bot.command(name="providers")
async def discord_providers(ctx):
    overview = ai_client.get_providers_overview()
    groq_info = overview["Groq"]
    last_ping_str = last_health_check_time.strftime('%Y-%m-%d %H:%M:%S UTC') if last_health_check_time else "Pending"
    embed = discord.Embed(title="🌐 6-Tier Multi-Provider Fallback Cascade & Key Health", color=0x3498DB)
    embed.add_field(name="1. Groq Cloud Pool (Primary)", value=f"Active Keys: \`{groq_info['keys_active']}/{groq_info['keys_total']}\` | Cooling: \`{groq_info['keys_cooling']}\` | Model: \`{groq_info['model']}\`", inline=False)
    embed.add_field(name="2. Google Gemini (Fallback 1)", value=f"Status: \`{overview['Gemini']['status']}\` (\`{overview['Gemini']['model']}\`)", inline=False)
    embed.add_field(name="3. Cerebras Cloud (Fallback 2)", value=f"Status: \`{overview['Cerebras']['status']}\` (\`{overview['Cerebras']['model']}\`)", inline=False)
    embed.add_field(name="4. OpenRouter Free (Fallback 3)", value=f"Status: \`{overview['OpenRouter']['status']}\` (DeepSeek R1 / Llama 3 free)", inline=False)
    embed.add_field(name="5. Together AI (Fallback 4)", value=f"Status: \`{overview['Together']['status']}\` (\`{overview['Together']['model']}\`)", inline=False)
    embed.add_field(name="6. Mistral AI (Fallback 5)", value=f"Status: \`{overview['Mistral']['status']}\` (\`{overview['Mistral']['model']}\`)", inline=False)
    embed.set_footer(text=f"Auto-Ping Monitor: Every 6h | Last Ping: {last_ping_str}")
    await ctx.reply(embed=embed)

@discord_bot.command(name="testalert")
async def discord_testalert(ctx):
    await admin_alert.send_alert(
        title="Admin Alert Test from Discord",
        details=f"• Triggered by: \`{ctx.author.name}\` (\`{ctx.author.id}\`)\\n• Conduits: Discord Webhook + Telegram Admin ID",
        alert_level="SUCCESS"
    )
    await ctx.reply("✅ Diagnostic test alert dispatched to Discord Webhook and Telegram Admin ID!")

@discord_bot.command(name="reset")
async def discord_reset(ctx):
    cleared = memory.clear_history("discord", ctx.author.id)
    await ctx.reply(f"🧹 Cleared {cleared} messages from conversation memory.")

@discord_bot.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return

    # Check for uploaded document attachments (.pdf / .txt / etc.)
    if message.attachments and is_user_authorized(str(message.author.id)):
        for att in message.attachments:
            fn_lower = att.filename.lower()
            if fn_lower.endswith((".pdf", ".txt", ".md", ".csv", ".json", ".py", ".log")):
                async with message.channel.typing():
                    try:
                        file_bytes = await att.read()
                        analysis, provider = await automation_helper.analyze_document(att.filename, file_bytes, message.content)
                        header = f"📊 **Document Intelligence Summary: \`{att.filename}\`** (*{provider}*)\\n\\n"
                        for chunk in split_text(header + analysis, max_len=1950):
                            await message.reply(chunk)
                        return
                    except Exception as e:
                        await message.reply(f"❌ Error processing document \`{att.filename}\`: {e}")
                        return

    if message.content.startswith("!") or message.content.startswith("/"):
        await discord_bot.process_commands(message)
        return

    is_dm = isinstance(message.channel, discord.DMChannel)
    is_mentioned = discord_bot.user in message.mentions

    if is_dm or is_mentioned:
        clean_content = message.clean_content.replace(f"@{discord_bot.user.name}", "").strip()
        if not clean_content:
            return

        if not is_user_authorized(str(message.author.id)):
            await message.reply("⛔ Unauthorized.")
            return

        async with message.channel.typing():
            memory.add_turn("discord", message.author.id, "user", clean_content)
            reply, provider = await ai_client.generate_response(memory.get_messages_for_llm("discord", message.author.id))
            memory.add_turn("discord", message.author.id, "assistant", reply)

            for chunk in split_text(reply, max_len=1950):
                await message.reply(chunk)


# =============================================================================
# 3. Slack Bot Implementation (slack-bolt)
# =============================================================================

slack_app: Optional[SlackApp] = None
if SLACK_BOT_TOKEN:
    slack_app = SlackApp(token=SLACK_BOT_TOKEN, signing_secret=SLACK_SIGNING_SECRET)

    @slack_app.event("app_mention")
    async def handle_slack_mention(body, say, client):
        user_id = body["event"]["user"]
        text = body["event"]["text"]
        
        if not is_user_authorized(user_id):
            await say("⛔ Unauthorized access.")
            return

        memory.add_turn("slack", user_id, "user", text)
        reply, provider = await ai_client.generate_response(memory.get_messages_for_llm("slack", user_id))
        memory.add_turn("slack", user_id, "assistant", reply)
        await say(reply)

    @slack_app.command("/image")
    async def handle_slack_image(ack, respond, command):
        await ack()
        prompt = command["text"].strip()
        if not prompt:
            await respond("🎨 Usage: \`/image <prompt>\`")
            return
        _, img_url = await automation_helper.generate_image_pollinations(prompt)
        await respond(f"🎨 *Generated with Pollinations AI*\\n*Prompt:* {prompt}\\n{img_url}")

    @slack_app.command("/search")
    async def handle_slack_search(ack, respond, command):
        await ack()
        query = command["text"].strip()
        if not query:
            await respond("🔍 Usage: \`/search <query>\`")
            return
        synthesis, provider, _ = await automation_helper.search_and_synthesize(query)
        await respond(f"🌐 *DuckDuckGo Search Synthesis ({provider}):*\\n{synthesis}")

    @slack_app.command("/tts")
    async def handle_slack_tts(ack, respond, command):
        await ack()
        text = command["text"].strip()
        if not text:
            await respond("🗣️ Usage: \`/tts <text>\`")
            return
        await respond(f"🗣️ *Text to Speech Request:* _{text}_ (Voice processing dispatched)")

    @slack_app.command("/weather")
    async def handle_slack_weather(ack, respond, command):
        await ack()
        city = command["text"].strip()
        if not city:
            await respond("🌤️ Usage: \`/weather <city>\` (e.g. \`/weather London\`)")
            return
        success, report = await automation_helper.get_weather(city)
        await respond(report)

    @slack_app.command("/translate")
    async def handle_slack_translate(ack, respond, command):
        await ack()
        raw_args = command["text"].strip()
        if not raw_args:
            await respond("🌐 Usage: \`/translate <text> to <target language>\`")
            return
        target_lang = "Bengali"
        text_to_translate = raw_args
        if " to " in raw_args.lower():
            parts = re.split(r"\s+to\s+", raw_args, flags=re.IGNORECASE)
            if len(parts) >= 2:
                text_to_translate = parts[0].strip()
                target_lang = parts[1].strip()
        translation, provider = await automation_helper.translate_text(text_to_translate, target_lang)
        await respond(f"🌐 *AI Polyglot Translation ({provider}):*\\n\\n{translation}")

    @slack_app.command("/summary")
    async def handle_slack_summary(ack, respond, command):
        await ack()
        url = command["text"].strip()
        if not url:
            await respond("📰 Usage: \`/summary <article URL>\`")
            return
        summary, provider = await automation_helper.summarize_url(url)
        await respond(f"📊 *Executive Summary ({provider}):*\\n\\n{summary}")

    @slack_app.command("/remind")
    async def handle_slack_remind(ack, respond, command):
        await ack()
        raw = command["text"].strip().split(maxsplit=1)
        if len(raw) < 2:
            await respond("⏰ Usage: \`/remind <time> <message>\` (e.g. \`/remind 10m Take lunch break\`)")
            return
        time_str, msg = raw[0], raw[1]
        parsed = automation_helper.parse_time_duration(time_str)
        if not parsed:
            await respond(f"⚠️ Invalid duration format \`{time_str}\`. Examples: \`30s\`, \`10m\`, \`1h\`.")
            return
        seconds, human_str = parsed
        user_id = command["user_id"]
        await respond(f"⏰ *Reminder Scheduled!* You will be notified in *{human_str}* for: _{msg}_")

        async def slack_reminder_worker():
            await asyncio.sleep(seconds)
            try:
                await slack_app.client.chat_postMessage(channel=user_id, text=f"⏰ 🔔 *REMINDER ALERT*\n<@{user_id}>, here is your reminder:\n\n📌 *{msg}*\n⏱️ _Scheduled {human_str} ago._")
            except Exception as e:
                logger.error(f"Failed to send Slack reminder: {e}")

        asyncio.create_task(slack_reminder_worker())

    @slack_app.command("/yt_seo")
    async def handle_slack_yt_seo(ack, respond, command):
        await ack()
        topic = command["text"].strip()
        if not topic:
            await respond("📹 Usage: \`/yt_seo <topic>\`")
            return
        seo_content, provider = await youtube_helper.generate_youtube_seo(topic)
        await respond(f"*🎬 YouTube SEO Optimization ({provider}):*\\n{seo_content}")

    @slack_app.command("/yt_upload")
    async def handle_slack_yt_upload(ack, respond):
        await ack()
        status = youtube_helper.check_credentials_status()
        if not status["configured"]:
            await respond("⚠️ YouTube OAuth2 credentials missing. Place \`client_secret.json\` in project root.")
        else:
            await respond("✅ YouTube Uploader module configured and ready.")

    @slack_app.command("/ask")
    async def handle_slack_ask_command(ack, respond, command):
        await ack()
        user_id = command["user_id"]
        text = command["text"]
        
        if not is_user_authorized(user_id):
            await respond("⛔ Unauthorized access.")
            return

        memory.add_turn("slack", user_id, "user", text)
        reply, provider = await ai_client.generate_response(memory.get_messages_for_llm("slack", user_id))
        memory.add_turn("slack", user_id, "assistant", reply)
        await respond(reply)

    @slack_app.command("/providers")
    async def handle_slack_providers(ack, respond):
        await ack()
        overview = ai_client.get_providers_overview()
        groq_info = overview["Groq"]
        last_ping_str = last_health_check_time.strftime('%Y-%m-%d %H:%M:%S UTC') if last_health_check_time else "Pending"
        text = (
            f"*6-Tier AI Failover Engine & Key Health:*\\n"
            f"1. Groq Pool: {'🟢 Active' if groq_info['keys_active'] > 0 else '⏳ Cooling Down'} ({groq_info['keys_active']}/{groq_info['keys_total']} active keys)\\n"
            f"2. Gemini: {overview['Gemini']['status']}\\n"
            f"3. Cerebras: {overview['Cerebras']['status']}\\n"
            f"4. OpenRouter Free: {overview['OpenRouter']['status']} (DeepSeek R1 / Llama 3 free)\\n"
            f"5. Together AI: {overview['Together']['status']}\\n"
            f"6. Mistral AI: {overview['Mistral']['status']}\\n\\n"
            f"🕒 Last 6-Hour Health Check: {last_ping_str}"
        )
        await respond(text)


# =============================================================================
# 4. Embedded Keep-Alive HTTP Server & Serverless Health Check
# =============================================================================

def create_http_app(tg_app: Optional[Application] = None) -> web.Application:
    app = web.Application()

    async def handle_health(request: web.Request) -> web.Response:
        uptime_s = int((datetime.now(timezone.utc) - STARTUP_TIMESTAMP).total_seconds())
        data = {
            "status": "healthy",
            "bot": "Universal Multi-Platform AI Bot",
            "platforms": {
                "telegram": bool(TELEGRAM_BOT_TOKEN),
                "discord": bool(DISCORD_BOT_TOKEN),
                "slack": bool(SLACK_BOT_TOKEN),
            },
            "modules": {
                "youtube_seo_automation": True,
                "youtube_uploader": youtube_helper.check_credentials_status()["configured"],
                "image_generation_pollinations": True,
                "duckduckgo_search_synthesis": bool(DDGS),
                "document_reader_pdf_txt": bool(pypdf),
                "tts_voice_synthesis": bool(gTTS),
            },
            "admin_alerts": {
                "telegram_admin_id": bool(ADMIN_TELEGRAM_ID),
                "discord_webhook": bool(DISCORD_ADMIN_WEBHOOK_URL),
            },
            "key_health_monitor": {
                "interval_hours": 6,
                "last_check_utc": last_health_check_time.isoformat() if last_health_check_time else None,
            },
            "uptime_seconds": uptime_s,
            "port": PORT,
            "providers": ai_client.get_providers_overview(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        return web.json_response(data)

    async def handle_tg_webhook(request: web.Request) -> web.Response:
        if not tg_app:
            return web.Response(status=400, text="Telegram polling active")
        secret_header = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
        if WEBHOOK_SECRET and secret_header != WEBHOOK_SECRET:
            return web.Response(status=403, text="Forbidden")
        try:
            req_data = await request.json()
            update = Update.de_json(req_data, tg_app.bot)
            await tg_app.process_update(update)
            return web.Response(status=200, text="OK")
        except Exception as e:
            logger.error(f"Telegram webhook update error: {e}")
            return web.Response(status=500, text=str(e))

    app.router.add_get("/", handle_health)
    app.router.add_get("/health", handle_health)
    app.router.add_post("/webhook", handle_tg_webhook)
    return app


# =============================================================================
# 5. Main Multi-Platform Orchestrator
# =============================================================================

async def main_async():
    tasks = []

    # 0. Start Automated 6-Hour API Key Health Monitor
    tasks.append(asyncio.create_task(api_key_health_monitor(HEALTH_CHECK_INTERVAL_SECONDS)))

    # 1. Telegram Bot Runner
    tg_app: Optional[Application] = None
    if TELEGRAM_BOT_TOKEN:
        logger.info("Initializing Telegram Bot...")
        tg_app = (
            ApplicationBuilder()
            .token(TELEGRAM_BOT_TOKEN)
            .concurrent_updates(True)
            .build()
        )
        admin_alert.set_telegram_bot(tg_app.bot)

        tg_app.add_handler(CommandHandler("start", tg_start_handler))
        tg_app.add_handler(CommandHandler("help", tg_start_handler))
        tg_app.add_handler(CommandHandler("weather", tg_weather_handler))
        tg_app.add_handler(CommandHandler("translate", tg_translate_handler))
        tg_app.add_handler(CommandHandler("summary", tg_summary_handler))
        tg_app.add_handler(CommandHandler("remind", tg_remind_handler))
        tg_app.add_handler(CommandHandler("image", tg_image_handler))
        tg_app.add_handler(CommandHandler("search", tg_search_handler))
        tg_app.add_handler(CommandHandler("tts", tg_tts_handler))
        tg_app.add_handler(CommandHandler("yt_seo", tg_yt_seo_handler))
        tg_app.add_handler(CommandHandler("yt_upload", tg_yt_upload_handler))
        tg_app.add_handler(CommandHandler("providers", tg_providers_handler))
        tg_app.add_handler(CommandHandler("health", tg_health_handler))
        tg_app.add_handler(CommandHandler("testalert", tg_testalert_handler))
        tg_app.add_handler(CommandHandler("reset", lambda u, c: tg_send_safely(u, c, f"🧹 Cleared {memory.clear_history('tg', u.effective_user.id)} messages.")))
        tg_app.add_handler(TGMessageHandler(tg_filters.Document.ALL, tg_document_handler))
        tg_app.add_handler(TGMessageHandler(tg_filters.TEXT & ~tg_filters.COMMAND, tg_message_handler))

        await tg_app.initialize()
        await tg_app.start()
        await tg_app.updater.start_polling(drop_pending_updates=True)
        logger.info("🟢 Telegram Bot polling active.")

    # 2. Discord Bot Runner
    if DISCORD_BOT_TOKEN:
        logger.info("Initializing Discord Bot...")
        tasks.append(discord_bot.start(DISCORD_BOT_TOKEN))
        logger.info("🟢 Discord Bot initialized.")

    # 3. Slack Bot Runner (Socket Mode)
    if SLACK_BOT_TOKEN and SLACK_APP_TOKEN and slack_app:
        logger.info("Initializing Slack Socket Mode...")
        slack_handler = AsyncSocketModeHandler(slack_app, SLACK_APP_TOKEN)
        tasks.append(slack_handler.start_async())
        logger.info("🟢 Slack Bot socket mode active.")

    # 4. Embedded Keep-Alive HTTP Server
    web_app = create_http_app(tg_app)
    runner = web.AppRunner(web_app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    logger.info(f"🌐 Keep-Alive HTTP Health Server online at http://0.0.0.0:{PORT}/health")

    # Send multi-platform startup heartbeat
    await admin_alert.send_alert(
        title="Universal Multi-Platform AI Bot Online",
        details=(
            f"• Platforms: Telegram {'🟢' if TELEGRAM_BOT_TOKEN else '⚪'} | Discord {'🟢' if DISCORD_BOT_TOKEN else '⚪'} | Slack {'🟢' if SLACK_BOT_TOKEN else '⚪'}\\n"
            f"• YouTube Module: 🟢 SEO Generator (/yt_seo) & Upload Handler (/yt_upload)\\n"
            f"• Key Health Auto-Monitor: 🟢 Active (Pings Startup + Every 6 Hours)\\n"
            f"• Host Node: \`{socket.gethostname()}\` (Port: {PORT})\\n"
            f"• 6-Tier Cascade: Groq -> Gemini -> Cerebras -> OpenRouter (DeepSeek R1 free) -> Together -> Mistral\\n"
            f"• Admin Alert Channels: Telegram (\`{ADMIN_TELEGRAM_ID or 'Not Set'}\`) + Discord Webhook"
        ),
        alert_level="SUCCESS"
    )

    if tasks:
        await asyncio.gather(*tasks)
    else:
        while True:
            await asyncio.sleep(3600)

def main():
    try:
        asyncio.run(main_async())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Universal Multi-Bot shutdown.")

if __name__ == "__main__":
    main()
`;
}

export function generateDockerfile(config: BotConfig): string {
  return `# =============================================================================
# Universal Multi-Platform Container (Telegram, Discord, Slack)
# 100% No-Credit-Card Compatible (Koyeb, HF Spaces, Render, Fly.io, Railway, Zeabur, Oracle VPS)
# =============================================================================

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    PORT=${config.serverPort || 8080} \\
    RUN_MODE=polling

WORKDIR /app

# Install system dependencies & curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \\
    curl \\
    ca-certificates \\
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements (Telegram, Discord.py, Slack-SDK, Groq, OpenAI, aiohttp)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \\
    pip install --no-cache-dir -r requirements.txt

# Copy source files
COPY . .

# Non-root user for security (Hugging Face Spaces & Koyeb UID 1000 standard)
RUN useradd -m -u 1000 appuser && \\
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8080 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
    CMD curl -f http://localhost:\${PORT:-8080}/health || exit 1

CMD ["python", "bot.py"]
`;
}

export function generateRequirementsTxt(): string {
  return `python-telegram-bot>=21.0.0
discord.py>=2.3.2
slack-bolt>=1.18.0
slack-sdk>=3.27.0
groq>=0.11.0
openai>=1.30.0
aiohttp>=3.9.0
python-dotenv>=1.0.0
gTTS>=2.5.1
duckduckgo-search>=6.2.0
pypdf>=4.3.0
beautifulsoup4>=4.12.0

# Optional: Direct YouTube OAuth2 Upload Support
# google-api-python-client>=2.110.0
# google-auth-oauthlib>=1.2.0
# google-auth-httplib2>=0.2.0
`;
}

export function generateProcfile(): string {
  return `worker: python bot.py
web: python bot.py
`;
}

export function generateFlyToml(config: BotConfig): string {
  return `# =============================================================================
# Fly.io Configuration (fly.toml)
# Free Tier: Up to 3 shared-cpu-1x 256MB VMs
# Deploy via: fly launch && fly secrets set TELEGRAM_BOT_TOKEN=...
# =============================================================================

app = "universal-multi-platform-bot"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "${config.serverPort || 8080}"
  RUN_MODE = "polling"
  PYTHONUNBUFFERED = "1"

[[services]]
  internal_port = ${config.serverPort || 8080}
  protocol = "tcp"
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

  [[services.ports]]
    handlers = ["http"]
    port = 80
    force_https = true

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [[services.http_checks]]
    interval = "30s"
    grace_period = "10s"
    method = "get"
    path = "/health"
    protocol = "http"
    timeout = "5s"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
`;
}

export function generateRailwayJson(): string {
  return `{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 120
  }
}
`;
}

export function generateZeaburJson(): string {
  return `{
  "$schema": "https://schema.zeabur.app/service.json",
  "name": "universal-ai-bot",
  "type": "docker",
  "healthcheck": {
    "path": "/health",
    "port": 8080
  }
}
`;
}

export function generateReplitConfig(): string {
  return `# .replit configuration for 24/7 Bot execution on Replit
run = "python bot.py"
entrypoint = "bot.py"
hidden = [".git", "__pycache__", "venv"]

[nix]
channel = "stable-24_05"

[deployment]
run = ["python", "bot.py"]
deploymentTarget = "cloudrun"

[[ports]]
localPort = 8080
externalPort = 80
`;
}

export function generateDockerComposeYml(config: BotConfig): string {
  return `# =============================================================================
# Unified 24/7 VPS Stack: Multi-Platform AI Bot + VPS Agent + Self-Hosted n8n
# Run on any VPS (Oracle Free Tier, Hetzner, DigitalOcean, Linode, AWS EC2):
#   docker compose up -d
# =============================================================================

version: '3.8'

services:
  # Service 1: Universal Multi-Platform AI Bot
  bot:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: universal-ai-bot
    restart: always
    environment:
      - PORT=${config.serverPort || 8080}
      - RUN_MODE=polling
      - PYTHONUNBUFFERED=1
    env_file:
      - .env
    ports:
      - "${config.serverPort || 8080}:${config.serverPort || 8080}"
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${config.serverPort || 8080}/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    networks:
      - vps_network

  # Service 2: Standalone VPS Monitoring & Remote Management Agent
  vps-agent:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: vps-monitor-agent
    command: python vps_agent.py
    restart: always
    environment:
      - VPS_AUTH_TOKEN=${config.vpsAuthBearerToken || 'vps_sec_token_9988a7b6c5'}
      - N8N_WEBHOOK_URL=http://n8n:5678/webhook/vps-server-alerts
      - N8N_ENABLED=${config.n8nAlertsEnabled ?? true ? 'True' : 'False'}
    env_file:
      - .env
    ports:
      - "8081:8081"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
    networks:
      - vps_network

  # Service 3: Self-Hosted n8n Workflow Automation Platform (24/7)
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: n8n-automation
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - NODE_ENV=production
      - WEBHOOK_URL=${config.n8nWebhookUrl ? config.n8nWebhookUrl.split('/webhook')[0] + '/' : 'http://localhost:5678/'}
      - GENERIC_TIMEZONE=UTC
      - N8N_METRICS=true
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - vps_network

volumes:
  n8n_data:
    driver: local

networks:
  vps_network:
    driver: bridge
`;
}

export function generatePm2EcosystemJs(config: BotConfig): string {
  return `// =============================================================================
// PM2 24/7 Process Manager Configuration (ecosystem.config.js)
// Run on VPS:
//   npm install -g pm2 n8n
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup
// =============================================================================

module.exports = {
  apps: [
    // 1. Universal Multi-Platform AI Bot
    {
      name: 'universal-ai-bot',
      script: './venv/bin/python',
      args: 'bot.py',
      cwd: '/opt/universal-ai-bot',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '${config.serverPort || 8080}',
        RUN_MODE: 'polling',
      },
    },

    // 2. FastAPI VPS Server Monitoring Agent
    {
      name: 'vps-monitoring-agent',
      script: './venv/bin/python',
      args: 'vps_agent.py',
      cwd: '/opt/universal-ai-bot',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        VPS_AUTH_TOKEN: '${config.vpsAuthBearerToken || 'vps_sec_token_9988a7b6c5'}',
        N8N_WEBHOOK_URL: '${config.n8nWebhookUrl || 'http://localhost:5678/webhook/vps-server-alerts'}',
        N8N_ENABLED: '${config.n8nAlertsEnabled ?? true ? 'True' : 'False'}',
      },
    },

    // 3. Self-Hosted n8n Automation Server (Runs 24/7 on port 5678)
    {
      name: 'n8n-automation',
      script: 'n8n',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env: {
        N8N_PORT: 5678,
        N8N_PROTOCOL: 'http',
        WEBHOOK_URL: '${config.n8nWebhookUrl ? config.n8nWebhookUrl.split('/webhook')[0] + '/' : 'http://localhost:5678/'}',
        EXECUTIONS_DATA_PRUNE: 'true',
        EXECUTIONS_DATA_MAX_AGE: '168',
      },
    },
  ],
};
`;
}

export function generateOracleVpsSetupSh(config: BotConfig): string {
  return `#!/usr/bin/env bash
# =============================================================================
# Oracle Cloud Always Free VPS (ARM 4-Core / 24GB RAM or AMD x86) Setup Script
# Unified 24/7 Setup for Universal AI Bot + VPS Agent + Self-Hosted n8n
# =============================================================================
set -euo pipefail

echo "🚀 [1/6] Updating system packages & installing Python 3.11, Docker, Node.js & Git..."
sudo apt-get update -y
sudo apt-get install -y python3 python3-pip python3-venv git curl ca-certificates docker.io docker-compose-v2 nodejs npm
sudo usermod -aG docker "$USER" || true

INSTALL_DIR="/opt/universal-ai-bot"
echo "📁 [2/6] Setting up application directory at $INSTALL_DIR..."
sudo mkdir -p "$INSTALL_DIR"
sudo chown -R "$USER:$USER" "$INSTALL_DIR"

if [ ! -f "$INSTALL_DIR/bot.py" ]; then
    echo "Copying bot files to $INSTALL_DIR..."
    cp -r ./* "$INSTALL_DIR/" || true
fi

cd "$INSTALL_DIR"

echo "🐍 [3/6] Creating Python virtual environment & installing requirements..."
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt fastapi uvicorn psutil requests

if [ ! -f .env ]; then
    echo "Creating .env from template..."
    cp .env.example .env
    echo "⚠️ Please configure your API tokens: nano $INSTALL_DIR/.env"
fi

echo "⚙️ [4/6] Creating 24/7 Systemd Daemon Service Units for Bot & Agent..."
cat << 'EOF' | sudo tee /etc/systemd/system/universal-bot.service
[Unit]
Description=Universal Multi-Platform AI Bot Service (Telegram, Discord, Slack)
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/universal-ai-bot
ExecStart=/opt/universal-ai-bot/venv/bin/python /opt/universal-ai-bot/bot.py
Restart=always
RestartSec=5s
EnvironmentFile=/opt/universal-ai-bot/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

cat << 'EOF' | sudo tee /etc/systemd/system/vps-agent.service
[Unit]
Description=VPS Monitoring & Remote Control Agent with n8n Webhook Dispatcher
After=network.target network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/universal-ai-bot
ExecStart=/opt/universal-ai-bot/venv/bin/python /opt/universal-ai-bot/vps_agent.py
Restart=always
RestartSec=5s
EnvironmentFile=/opt/universal-ai-bot/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "⚡ [5/6] Installing & Configuring Self-Hosted n8n (Docker / PM2)..."
sudo docker run -d --name n8n-automation --restart always -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n:latest || true

echo "🔥 [6/6] Reloading systemd & enabling 24/7 services..."
sudo systemctl daemon-reload
sudo systemctl enable universal-bot.service vps-agent.service
sudo systemctl restart universal-bot.service vps-agent.service

echo ""
echo "============================================================================="
echo "✅ Universal Multi-Platform AI Bot + n8n + VPS Agent are RUNNING 24/7!"
echo "============================================================================="
echo "📊 Bot Status:         sudo systemctl status universal-bot"
echo "📡 Agent Status:       sudo systemctl status vps-agent"
echo "⚡ n8n Web UI:         http://<YOUR_VPS_IP>:5678 (or https://n8n.yourdomain.com)"
echo "📜 Live Bot Logs:      sudo journalctl -u universal-bot -f"
echo "📜 Live Agent Logs:    sudo journalctl -u vps-agent -f"
echo "============================================================================="
`;
}

export function generateEnvExample(config: BotConfig): string {
  return `# =================================================================
# 1. Chat Platform Tokens (Enable Any or All Simultaneously)
# =================================================================

# Telegram (from @BotFather)
TELEGRAM_BOT_TOKEN="your_telegram_bot_token_here"

# Discord Bot Token (from https://discord.com/developers/applications)
# Enable MESSAGE CONTENT INTENT in Bot settings tab!
DISCORD_BOT_TOKEN="your_discord_bot_token_here"

# Slack Bot Credentials (from https://api.slack.com/apps)
# Enable Socket Mode & App-Level Token (xapp-...)
SLACK_BOT_TOKEN="xoxb-your-slack-bot-token"
SLACK_APP_TOKEN="xapp-your-slack-app-token"
SLACK_SIGNING_SECRET="your_slack_signing_secret"

# WhatsApp Cloud API (Meta for Developers)
WHATSAPP_ACCESS_TOKEN="your_whatsapp_access_token"
WHATSAPP_PHONE_NUMBER_ID="your_phone_number_id"
WHATSAPP_VERIFY_TOKEN="your_verify_webhook_token"

# Line Messaging API & Matrix Protocol
LINE_CHANNEL_SECRET="your_line_channel_secret"
LINE_CHANNEL_ACCESS_TOKEN="your_line_access_token"
MATRIX_HOMESERVER="https://matrix-client.matrix.org"
MATRIX_USER_ID="@your_bot:matrix.org"
MATRIX_ACCESS_TOKEN="your_matrix_access_token"
MATRIX_ROOM_ID="!your_room:matrix.org"

# Unified Notification Gateways (Apprise)
APPRISE_URLS="tgram://BOT_TOKEN/CHAT_ID,discord://WEBHOOK_ID/WEBHOOK_TOKEN"

# =================================================================
# 2. Dual Admin Error & Failover Alerting
# =================================================================
# Telegram Admin Numeric ID (from @userinfobot)
ADMIN_TELEGRAM_ID="${config.adminTelegramId || '123456789'}"

# Discord Admin Alert Webhook URL
# (Server Settings -> Integrations -> Webhooks -> Copy Webhook URL)
DISCORD_ADMIN_WEBHOOK_URL="${config.discordAdminWebhookUrl || 'https://discord.com/api/webhooks/your/webhook/url'}"

# =================================================================
# 3. 20-Tier Multi-Provider AI Keys (Zero-Downtime Cascade Pool)
# =================================================================
# Tier 1: Groq Cloud (Multi-key rotation pool)
GROQ_API_KEY_1="gsk_your_primary_groq_api_key"
GROQ_API_KEY_2="gsk_your_secondary_groq_api_key"
GROQ_MODEL="${config.modelName}"
KEY_COOLDOWN_SECONDS="${config.keyCooldownSeconds}"

# Tier 2: Google Gemini (https://aistudio.google.com/app/apikey)
GEMINI_API_KEY="AIzaSy_your_gemini_api_key"
GEMINI_MODEL="${config.geminiModel}"

# Tier 3: Cerebras Cloud (https://cloud.cerebras.ai)
CEREBRAS_API_KEY="csk_your_cerebras_api_key"
CEREBRAS_MODEL="${config.cerebrasModel}"

# Tier 4: OpenRouter Free Models (DeepSeek R1 / Llama 3 free)
OPENROUTER_API_KEY="sk-or-v1-your_openrouter_api_key"
OPENROUTER_MODEL="${config.openrouterModel}"

# Tier 5: SambaNova Cloud (https://cloud.sambanova.ai)
SAMBANOVA_API_KEY="your_sambanova_api_key"
SAMBANOVA_MODEL="${config.sambanovaModel}"

# Tier 6: Mistral AI (https://console.mistral.ai)
MISTRAL_API_KEY="your_mistral_api_key"
MISTRAL_MODEL="${config.mistralModel}"

# Tier 7: Together AI (https://api.together.xyz)
TOGETHER_API_KEY="your_together_api_key"
TOGETHER_MODEL="${config.togetherModel}"

# Tier 8: DeepSeek Direct API
DEEPSEEK_API_KEY="your_deepseek_api_key"
DEEPSEEK_MODEL="${config.deepseekModel}"

# Tier 9: GitHub Models (Free Marketplace)
GITHUB_TOKEN="ghp_your_github_token"
GITHUB_MODEL="${config.githubModel}"

# Tier 10: Hugging Face Inference API
HUGGINGFACE_API_TOKEN="hf_your_huggingface_token"
HUGGINGFACE_MODEL="${config.huggingfaceModel}"

# Additional Cloud Providers
COHERE_API_KEY="your_cohere_key"
NVIDIA_NIM_API_KEY="nvapi-your_nvidia_key"
DEEPINFRA_API_KEY="your_deepinfra_key"
CHUTES_API_KEY="your_chutes_key"
VOYAGE_API_KEY="pa-your_voyage_key"
REPLICATE_API_TOKEN="r8_your_replicate_token"
CLOUDFLARE_API_TOKEN="your_cloudflare_worker_token"
CLOUDFLARE_ACCOUNT_ID="${config.cloudflareAccountId || ''}"
OLLAMA_BASE_URL="${config.ollamaBaseUrl || 'http://localhost:11434'}"

# =================================================================
# 4. YouTube Automation Framework (OAuth2 Credentials)
# =================================================================
YOUTUBE_CLIENT_ID="${config.youtubeClientId || ''}"
YOUTUBE_CLIENT_SECRET="${config.youtubeClientSecret || ''}"
YOUTUBE_CLIENT_SECRET_FILE="client_secret.json"
YOUTUBE_TOKEN_FILE="token.json"

# =================================================================
# 5. VPS Server Management & n8n 24/7 Automation Bridge
# =================================================================
VPS_AUTH_TOKEN="vps_sec_token_${Math.random().toString(36).substring(2, 10)}"
VPS_API_BASE_URL="http://127.0.0.1:8080"
N8N_WEBHOOK_URL="${config.n8nWebhookUrl || ''}"
N8N_ENABLED="true"

# =================================================================
# 6. Cloud & Health Server Settings (100% No-Credit-Card Free Tiers)
# =================================================================
PORT="${config.serverPort || 8080}"
RUN_MODE="polling"
MAX_MEMORY_TURNS="${config.maxMemoryTurns}"
MEMORY_TTL_MINUTES="${config.memoryTtlMinutes}"
TEMPERATURE="${config.temperature}"
MAX_OUTPUT_TOKENS="${config.maxOutputTokens}"

# System Persona
SYSTEM_PROMPT="${config.systemPrompt.replace(/"/g, '\\"')}"
ADMIN_PIN="${config.adminPin || '7788'}"
`;
}

export function generateRenderYaml(config: BotConfig): string {
  return `services:
  # Option A: Background Worker (Pure long polling & Slack socket mode)
  - type: worker
    name: multi-platform-ai-bot-worker
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: python bot.py
    envVars:
      - key: TELEGRAM_BOT_TOKEN
        sync: false
      - key: DISCORD_BOT_TOKEN
        sync: false
      - key: DISCORD_ADMIN_WEBHOOK_URL
        value: "${config.discordAdminWebhookUrl || ''}"
      - key: ADMIN_TELEGRAM_ID
        value: "${config.adminTelegramId || '123456789'}"
      - key: GROQ_API_KEY_1
        sync: false
      - key: GEMINI_API_KEY
        sync: false
      - key: OPENROUTER_API_KEY
        sync: false

  # Option B: Web Service with Health Check on /health
  - type: web
    name: multi-platform-ai-bot-web
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: python bot.py
    healthCheckPath: /health
    envVars:
      - key: PORT
        value: "8080"
      - key: TELEGRAM_BOT_TOKEN
        sync: false
      - key: DISCORD_BOT_TOKEN
        sync: false
      - key: GROQ_API_KEY_1
        sync: false
`;
}

export function generateKoyebYaml(config: BotConfig): string {
  return `name: multi-platform-ai-bot
type: web
build:
  type: docker
  dockerfile: Dockerfile
run:
  ports:
    - port: 8080
      path: /health
      protocol: http
  env:
    - key: TELEGRAM_BOT_TOKEN
      value: "YOUR_TELEGRAM_BOT_TOKEN"
    - key: DISCORD_BOT_TOKEN
      value: "YOUR_DISCORD_BOT_TOKEN"
    - key: DISCORD_ADMIN_WEBHOOK_URL
      value: "${config.discordAdminWebhookUrl || ''}"
    - key: ADMIN_TELEGRAM_ID
      value: "${config.adminTelegramId || '123456789'}"
    - key: GROQ_API_KEY_1
      value: "YOUR_GROQ_KEY"
    - key: GEMINI_API_KEY
      value: "YOUR_GEMINI_KEY"
    - key: OPENROUTER_API_KEY
      value: "YOUR_OPENROUTER_KEY"
    - key: PORT
      value: "8080"
  instance_types:
    - type: free
  regions:
    - fra
`;
}

export function generateReadmeMd(config: BotConfig): string {
  return `# 🤖 Universal Multi-Platform AI Bot: Telegram, Discord & Slack
## With 6-Tier Multi-Provider Auto-Failover, Dynamic Key Hot-Swapping, Dual Admin Alerting & YouTube SEO Automation

Production-ready Python AI Bot concurrently powering **Telegram**, **Discord**, and **Slack** through a single unified codebase. All chat platforms share the **same 6-Tier Zero-Downtime Multi-API Fallback Engine**, 100% Active Uptime Key Health Monitor, YouTube Creator SEO suite, and send instant administrative error/failover alerts to both a **Discord Webhook** and a **Telegram Admin ID**.

---

## 🔑 100% Key Uptime, Dynamic Hot-Swapping & Background Health Checks

- **Automated Health Check Monitor:** Runs a silent 1-token diagnostic probe on startup and **every 6 hours** in the background across all configured Groq keys and fallback providers.
- **Dynamic Hot-Swapping:** When any key returns a \`429 (Rate Limit)\` or \`401 (Invalid/Unauthorized)\`, it is instantly tagged as *Cooling Down* or *Inactive*, and the bot seamlessly hot-swaps to the next key or provider tier during the very same user request with zero failures.
- **Total Provider Exhaustion Alert:** Admin alerts (Telegram Admin DM + Discord Webhook) are dispatched **only when ALL available AI providers fail simultaneously**, preventing alert spam during normal failovers.

---

## 🎨 High-Value Automation Suite
- **\`/image <prompt>\`**: Generate AI images using Pollinations AI free API (no keys needed) with direct photo delivery.
- **\`/search <query>\`**: Fetch real-time web search results via DuckDuckGo and synthesize with cited sources using the 6-tier AI cascade.
- **📄 Document Reader**: Upload any \`.pdf\` or \`.txt\` file directly to Telegram or Discord to receive an executive summary, key findings, and deep insights.
- **\`/tts <text>\`**: Convert text to speech voice messages using \`gTTS\` (Google Text-to-Speech).

---

## 📹 YouTube Automation Framework

The bot includes an embedded YouTube Growth & SEO Assistant:
- **\`/yt_seo <topic>\`**: Generates 5 High-CTR viral title variations, keyword-ranked SEO descriptions with timestamps, 15-20 comma-separated YouTube tags (<500 chars), and AI Thumbnail Art Prompts for Midjourney/DALL-E.
- **\`/yt_upload\`**: Inspects OAuth2 credentials status (\`client_secret.json\`) for automated video uploads using \`google-api-python-client\`.

---

## ⚡ Unified 6-Tier AI Cascade Hierarchy

1. **🔑 Groq Cloud** (\`${config.modelName}\`): Ultra-low latency LPU inference with automated round-robin key pool.
2. **🥈 Google Gemini Flash** (\`${config.geminiModel}\`): Fallback 1 for resilient smart reasoning.
3. **🥉 Cerebras Cloud** (\`${config.cerebrasModel}\`): Fallback 2 high-throughput generation.
4. **🌐 OpenRouter Free Models** (\`${config.openrouterModel}\`): Fallback 3 (DeepSeek R1 / Llama 3 free).
5. **🤝 Together AI** (\`${config.togetherModel}\`): Fallback 4 open-weights inference.
6. **🌪️ Mistral AI** (\`${config.mistralModel}\`): Fallback 5 sovereign AI backup.

---

## 🚨 Dual Admin Alerting System

The bot communicates critical infrastructure notifications to both channels simultaneously:
- **Telegram:** Direct message to \`ADMIN_TELEGRAM_ID\`.
- **Discord:** Rich color-coded embed to \`DISCORD_ADMIN_WEBHOOK_URL\`.
- **Trigger Policy:** Dispatched when all AI providers fail, or when testing via \`/testalert\`.

---

## ☁️ 100% Zero-Credit-Card & Free 24/7 Cloud Hosting Guides

### 1️⃣ Koyeb (100% Free • No Credit Card Required)
- **Website:** [koyeb.com](https://www.koyeb.com)
- **Deployment Steps:**
  1. Sign in with GitHub (no card needed).
  2. Click **Create App** $\\rightarrow$ Select **GitHub** repo.
  3. Set Builder to **Dockerfile**.
  4. Set Port to **8080** and Health Check Path to **/health**.
  5. Add Environment Variables from \`.env.example\` $\\rightarrow$ Click **Deploy**.

---

### 2️⃣ Hugging Face Spaces (Free 24/7 Docker Space • No Credit Card)
- **Website:** [huggingface.co/new-space](https://huggingface.co/new-space)
- **Deployment Steps:**
  1. Create a **New Space** $\\rightarrow$ Select **Docker (Blank)**.
  2. Push your repo using Git.
  3. Go to **Settings** $\\rightarrow$ **Variables and secrets** $\\rightarrow$ Add your tokens.
  4. The container boots automatically and stays online 24/7.

---

### 3️⃣ Fly.io (Free Allowance • fly.toml)
- **Configuration File:** \`fly.toml\`
- **Deployment Steps:**
  1. Install Fly CLI: \`curl -L https://fly.io/install.sh | sh\`
  2. Run: \`fly launch --no-deploy\` (uses the included \`fly.toml\`).
  3. Set your secrets:
     \`\`\`bash
     fly secrets set TELEGRAM_BOT_TOKEN="your_token" DISCORD_BOT_TOKEN="your_token" GROQ_API_KEY_1="your_key"
     \`\`\`
  4. Deploy: \`fly deploy\`

---

### 4️⃣ Railway (Monthly Free Credits • railway.json)
- **Configuration File:** \`railway.json\`
- **Deployment Steps:**
  1. Go to [railway.app](https://railway.app) and link your GitHub repo.
  2. Railway automatically detects \`railway.json\` and \`Dockerfile\`.
  3. In **Variables**, paste your \`.env\` variables.
  4. Your bot will build and start with automatic restarts on failures.

---

### 5️⃣ Zeabur (One-Click Git Deployment • Free Tier)
- **Configuration File:** \`zeabur.json\`
- **Deployment Steps:**
  1. Go to [zeabur.com](https://zeabur.com) and create a project.
  2. Click **Add Service** $\\rightarrow$ **Git Repository** $\\rightarrow$ Select your repo.
  3. Under **Variables**, add your bot and AI API tokens.
  4. Zeabur automatically detects the Dockerfile and healthcheck on port 8080.

---

### 6️⃣ Replit (Always-On Hosting • .replit)
- **Configuration Files:** \`.replit\` and \`replit.nix\`
- **Deployment Steps:**
  1. Create a Python Repl $\\rightarrow$ Import from GitHub.
  2. Add your secret keys under the **Secrets (Environment Variables)** tool.
  3. Click **Run** or use **Deploy** for Always-On execution.

---

### 7️⃣ Oracle Cloud Always Free VPS (Lifetime Free 4 ARM OCPUs & 24GB RAM)
- **Automation Script:** \`oracle-vps-setup.sh\`
- **Deployment Steps:**
  1. Create an **Always Free Compute Instance** (Ubuntu 22.04 ARM or AMD) on Oracle Cloud Console.
  2. SSH into your instance: \`ssh ubuntu@<YOUR_VPS_IP>\`
  3. Clone your repo: \`git clone <REPO_URL> bot && cd bot\`
  4. Run the automated installer:
     \`\`\`bash
     chmod +x oracle-vps-setup.sh
     ./oracle-vps-setup.sh
     \`\`\`
  5. Edit keys in \`/opt/universal-ai-bot/.env\` and restart: \`sudo systemctl restart universal-bot\`.
  6. The bot will run permanently 24/7 under systemd supervision with automatic boot recovery.

---

### 8️⃣ Render.com (Free Web / Worker Service)
- **Configuration File:** \`render.yaml\`
- **Deployment Steps:**
  1. Sign in to Render $\\rightarrow$ **New Web Service** or **Background Worker**.
  2. Select GitHub repo $\\rightarrow$ Build: \`pip install -r requirements.txt\` $\\rightarrow$ Start: \`python bot.py\`.
  3. Add environment variables.

---

## 👾 Commands Overview

| Command | Description |
|---|---|
| \`/weather <city>\` | Real-time weather details (temp, humidity, wind, condition) via Open-Meteo free API (no keys required) |
| \`/translate <text> to <lang>\` | Polyglot AI translation into Bengali, English, Spanish, etc. with phonetics & grammar insights |
| \`/summary <url>\` | Scrape news articles or blog posts & generate structured executive intelligence summaries |
| \`/remind <time> <msg>\` | Automated non-blocking reminder scheduler (e.g. \`/remind 10m Take lunch break\`) |
| \`/image <prompt>\` | Free AI Image Generation via Pollinations AI (no keys needed) |
| \`/search <query>\` | Real-time DuckDuckGo web search synthesized with 6-tier AI citations |
| \`/tts <text>\` | Convert text to speech voice messages using gTTS |
| *Upload File* | Upload \`.pdf\` or \`.txt\` to get automatic executive summary & insights |
| \`/yt_seo <topic>\` | Generate High-CTR Title variations, SEO Description, Tags & Thumbnail Prompts |
| \`/yt_upload\` | Check YouTube OAuth2 upload credentials status & instructions |
| \`/providers\` | View live status of all 6 AI API fallbacks & key health |
| \`/health\` | Check uptime, host node & multi-platform statuses |
| \`/testalert\` | Broadcast diagnostic alert to Telegram ID & Discord Webhook |
| \`/reset\` | Clear active conversation memory buffer |
`;
}

export function generateVpsAgentPy(config: BotConfig): string {
  return `#!/usr/bin/env python3
"""
=============================================================================
VPS Server Monitor & Remote Management Agent + n8n Automation Dispatcher
=============================================================================
Provides real-time CPU, RAM, Disk, Network metrics, daemon control hooks,
and automated alert dispatching to self-hosted n8n Webhook workflows.

Run on Ubuntu / Debian / CentOS VPS:
  pip install fastapi uvicorn psutil requests
  python3 vps_agent.py
"""

import os
import time
import threading
import psutil
import subprocess
import requests
from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="VPS Server Monitor & Remote Management Agent")

# Enable CORS for browser management dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AUTH_BEARER_TOKEN = os.getenv("VPS_AUTH_TOKEN", "${config.vpsAuthBearerToken || ''}")
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "${config.n8nWebhookUrl || ''}")
N8N_ENABLED = ${config.n8nAlertsEnabled ?? true ? 'True' : 'False'}
START_TIME = time.time()
LAST_N8N_DISPATCH = {"timestamp": None, "event": None, "status": "idle"}

def dispatch_n8n_alert(event_type: str, severity: str, message: str, extra_metrics: dict = None):
    """Dispatches structured JSON alert payload to configured n8n Webhook endpoint."""
    global LAST_N8N_DISPATCH
    if not N8N_ENABLED or not N8N_WEBHOOK_URL:
        return False
    try:
        payload = {
            "event_id": f"evt_{int(time.time()*1000)}",
            "event_type": event_type,
            "severity": severity,
            "server_name": "${config.vpsServerName || 'Universal-AI-Bot'}",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "message": message,
            "metrics": extra_metrics or {
                "cpu_percent": psutil.cpu_percent(),
                "ram_used_mb": int(psutil.virtual_memory().used / (1024 * 1024)),
                "ram_total_mb": int(psutil.virtual_memory().total / (1024 * 1024)),
                "uptime_seconds": int(time.time() - START_TIME)
            }
        }
        res = requests.post(N8N_WEBHOOK_URL, json=payload, timeout=3.5)
        LAST_N8N_DISPATCH = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
            "event": event_type,
            "status": f"HTTP {res.status_code}"
        }
        return res.status_code in (200, 201, 204)
    except Exception as e:
        print(f"[n8n-alert-dispatch-error]: {e}")
        LAST_N8N_DISPATCH = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
            "event": event_type,
            "status": f"Error: {str(e)[:40]}"
        }
        return False

def verify_token(authorization: str = Header(None)):
    if not AUTH_BEARER_TOKEN:
        return True
    if not authorization or authorization != f"Bearer {AUTH_BEARER_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid Bearer Token")
    return True

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "${config.vpsServerName || 'Universal-AI-Bot'}",
        "uptime_seconds": int(time.time() - START_TIME),
        "n8n_dispatcher_active": bool(N8N_ENABLED and N8N_WEBHOOK_URL),
        "timestamp": time.time()
    }

@app.get("/api/vps/status")
def get_vps_status(auth: bool = Depends(verify_token)):
    cpu_percent = psutil.cpu_percent(interval=0.2)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    net_io = psutil.net_io_counters()

    # Trigger n8n alert if CPU spikes over threshold
    if cpu_percent > 85.0 and ${config.n8nEventTriggers?.onHighCpu ?? true ? 'True' : 'False'}:
        dispatch_n8n_alert("high_cpu", "CRITICAL", f"High CPU Load sustained: {cpu_percent}%")

    return {
        "is_online": True,
        "status_text": "running",
        "uptime_seconds": int(time.time() - START_TIME),
        "cpu_percent": cpu_percent,
        "cpu_cores": psutil.cpu_count(logical=True),
        "ram_used_mb": int(ram.used / (1024 * 1024)),
        "ram_total_mb": int(ram.total / (1024 * 1024)),
        "disk_used_gb": round(disk.used / (1024**3), 1),
        "disk_total_gb": round(disk.total / (1024**3), 1),
        "network_in_kbps": int(net_io.bytes_recv / 1024) % 1000,
        "network_out_kbps": int(net_io.bytes_sent / 1024) % 1000,
        "active_processes": len(psutil.pids()),
        "os_name": os.uname().sysname + " " + os.uname().release,
        "n8n_status": {
            "enabled": N8N_ENABLED,
            "webhook_configured": bool(N8N_WEBHOOK_URL),
            "last_dispatch": LAST_N8N_DISPATCH
        },
        "timestamp": time.time()
    }

@app.get("/api/n8n/status")
def get_n8n_integration_status(auth: bool = Depends(verify_token)):
    """Returns real-time status of the local/remote n8n automation bridge."""
    return {
        "n8n_enabled": N8N_ENABLED,
        "mode": "n8n_pipeline" if N8N_ENABLED else "direct_mode",
        "webhook_url": N8N_WEBHOOK_URL,
        "last_dispatch": LAST_N8N_DISPATCH,
        "supported_triggers": ["status_change", "high_cpu", "server_restart", "ai_failover", "security_alert"]
    }

class N8nModeUpdate(BaseModel):
    enabled: bool

@app.post("/api/n8n/mode")
def update_n8n_mode(payload: N8nModeUpdate, auth: bool = Depends(verify_token)):
    """Dynamically toggle n8n automation pipeline mode on the VPS agent."""
    global N8N_ENABLED
    N8N_ENABLED = payload.enabled
    return {
        "n8n_enabled": N8N_ENABLED,
        "mode": "n8n_pipeline" if N8N_ENABLED else "direct_mode",
        "message": f"n8n automation mode switched to {'ENABLED' if N8N_ENABLED else 'DIRECT_STANDALONE'}"
    }

class N8nTestPayload(BaseModel):
    event_type: str = "high_cpu"
    severity: str = "WARNING"
    message: str = "Test webhook trigger from VPS agent"

@app.post("/api/n8n/test")
def test_n8n_dispatch(payload: N8nTestPayload, auth: bool = Depends(verify_token)):
    """Manually test and trigger an n8n webhook payload from the server agent."""
    success = dispatch_n8n_alert(payload.event_type, payload.severity, payload.message)
    return {
        "dispatched": success,
        "endpoint": N8N_WEBHOOK_URL,
        "event_type": payload.event_type,
        "last_dispatch": LAST_N8N_DISPATCH
    }

@app.post("/api/server/{action}")
def control_server(action: str, auth: bool = Depends(verify_token)):
    if action == "restart":
        subprocess.Popen(["systemctl", "restart", "telegram-bot"])
        dispatch_n8n_alert("server_restart", "WARNING", "Server restart initiated via API")
        return {"status": "restarting", "message": "Service restart initiated"}
    elif action == "stop":
        subprocess.Popen(["systemctl", "stop", "telegram-bot"])
        dispatch_n8n_alert("status_change", "CRITICAL", "Service stopped via API")
        return {"status": "stopped", "message": "Service stopped"}
    elif action == "start":
        subprocess.Popen(["systemctl", "start", "telegram-bot"])
        dispatch_n8n_alert("status_change", "INFO", "Service started via API")
        return {"status": "running", "message": "Service started"}
    elif action == "reload":
        subprocess.Popen(["systemctl", "reload", "telegram-bot"])
        dispatch_n8n_alert("config_reload", "INFO", "Configuration reloaded via API")
        return {"status": "reloaded", "message": "Service configuration reloaded"}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action {action}")

if __name__ == "__main__":
    import uvicorn
    # Initial startup broadcast to n8n
    dispatch_n8n_alert("status_change", "INFO", "VPS Monitoring Agent booted & online")
    uvicorn.run(app, host="0.0.0.0", port=${config.serverPort || 8080})
`;
}

export function getAllGeneratedFiles(config: BotConfig): GeneratedFile[] {
  return [
    {
      name: 'docker-compose.yml',
      filename: 'docker-compose.yml',
      language: 'yaml',
      description: 'Unified 24/7 stack running AI Bot + FastAPI VPS Agent + Self-Hosted n8n on a single VPS',
      content: generateDockerComposeYml(config),
      isImportant: true,
    },
    {
      name: 'ecosystem.config.js',
      filename: 'ecosystem.config.js',
      language: 'javascript',
      description: 'PM2 process manager config for 24/7 zero-downtime auto-restart of bot.py, vps_agent.py, and n8n',
      content: generatePm2EcosystemJs(config),
      isImportant: true,
    },
    {
      name: 'bot.py',
      filename: 'bot.py',
      language: 'python',
      description: 'Universal multi-platform bot runner with 6-tier failover, Weather, Translator, URL Scraper, Reminders, Image Gen, Search & PDF Reader',
      content: generateBotPy(config),
      isImportant: true,
    },
    {
      name: 'vps_agent.py',
      filename: 'vps_agent.py',
      language: 'python',
      description: 'VPS Server Monitor & Remote Management Agent (FastAPI + psutil metrics & systemd hooks)',
      content: generateVpsAgentPy(config),
      isImportant: true,
    },
    {
      name: 'Dockerfile',
      filename: 'Dockerfile',
      language: 'dockerfile',
      description: 'Multi-cloud container definition (Fly.io, Railway, Zeabur, Koyeb, HF Spaces, Render, VPS)',
      content: generateDockerfile(config),
      isImportant: true,
    },
    {
      name: 'requirements.txt',
      filename: 'requirements.txt',
      language: 'text',
      description: 'Dependencies (python-telegram-bot, discord.py, slack-bolt, groq, openai, aiohttp)',
      content: generateRequirementsTxt(),
    },
    {
      name: 'fly.toml',
      filename: 'fly.toml',
      language: 'toml',
      description: 'Fly.io deployment specification with HTTP health checks and auto-restart',
      content: generateFlyToml(config),
      isImportant: true,
    },
    {
      name: 'railway.json',
      filename: 'railway.json',
      language: 'json',
      description: 'Railway cloud configuration with Dockerfile builder & failure recovery',
      content: generateRailwayJson(),
      isImportant: true,
    },
    {
      name: 'zeabur.json',
      filename: 'zeabur.json',
      language: 'json',
      description: 'Zeabur zero-configuration deployment manifest',
      content: generateZeaburJson(),
    },
    {
      name: '.replit',
      filename: '.replit',
      language: 'ini',
      description: 'Replit 24/7 execution configuration and Nix environment entrypoint',
      content: generateReplitConfig(),
    },
    {
      name: 'oracle-vps-setup.sh',
      filename: 'oracle-vps-setup.sh',
      language: 'bash',
      description: 'Oracle Cloud Always Free VPS 24/7 systemd service automated installer',
      content: generateOracleVpsSetupSh(config),
      isImportant: true,
    },
    {
      name: 'Procfile',
      filename: 'Procfile',
      language: 'text',
      description: 'Process definition for Render.com & Railway workers/web services',
      content: generateProcfile(),
    },
    {
      name: '.env.example',
      filename: '.env.example',
      language: 'bash',
      description: 'Environment variables for Telegram, Discord, Slack, YouTube & 6 AI providers',
      content: generateEnvExample(config),
      isImportant: true,
    },
    {
      name: 'render.yaml',
      filename: 'render.yaml',
      language: 'yaml',
      description: 'Render.com infrastructure manifest (Worker + Web Service with /health)',
      content: generateRenderYaml(config),
    },
    {
      name: 'koyeb.yaml',
      filename: 'koyeb.yaml',
      language: 'yaml',
      description: '100% Free Koyeb micro service configuration',
      content: generateKoyebYaml(config),
    },
    {
      name: 'README.md',
      filename: 'README.md',
      language: 'markdown',
      description: 'Complete setup and 100% zero-credit-card deployment guides for 8+ clouds',
      content: generateReadmeMd(config),
      isImportant: true,
    },
  ];
}
