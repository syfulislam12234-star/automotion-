#!/usr/bin/env python3
"""
Universal Multi-Provider Telegram Bot Worker & Production Web Service
Powered by python-telegram-bot (v21+) and Multi-Tier AI Cascade (Groq & Gemini).

Features:
- Dual execution mode: RUN_MODE=polling (default) or RUN_MODE=webhook
- Asynchronous HTTP server (aiohttp) binding to 0.0.0.0:$PORT
- Healthcheck routes: GET /health and GET /api/health
- Webhook routes: POST /webhook and POST /api/webhook
- Multi-tier AI routing: Groq Llama 3.3 70B (Primary) -> Google Gemini (Fallback) -> Informational guidance
- Robust regex handling for /translate, /summarize, and /remind
- Automatic deleteWebhook on long-polling startup to prevent conflict locks
"""

import os
import sys
import re
import json
import logging
import asyncio
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

# AI Provider Credentials
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", os.getenv("GROQ_API_KEY_1", os.getenv("GROQ_API_KEY_2", ""))).strip()
GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", os.getenv("GEMINI_API_KEY_1", os.getenv("GEMINI_API_KEY_2", ""))).strip()
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()

SYSTEM_PROMPT: str = os.getenv(
    "SYSTEM_PROMPT",
    "You are a friendly, highly intelligent, and ultra-fast AI assistant powered by the Universal Multi-Provider AI Engine. Provide clear, concise, and helpful answers formatted in Markdown.",
).strip()

# Conversation history state (chat_id -> List of message turns)
chat_histories: Dict[int, List[Dict[str, str]]] = {}
MAX_MEMORY_TURNS: int = 10
start_time: float = 0.0

# Lazy-loaded python-telegram-bot modules
try:
    from telegram import Update
    from telegram.constants import ParseMode, ChatAction
    from telegram.ext import (
        Application,
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
    """Call Groq Cloud OpenAI-compatible chat completions API."""
    if not GROQ_API_KEY or GROQ_API_KEY.startswith("YOUR_"):
        raise ValueError("GROQ_API_KEY not configured or is a placeholder.")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": prompt})

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROQ_MODEL,
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
            error_body = await resp.text()
            raise RuntimeError(f"Groq API error HTTP {resp.status}: {error_body}")


async def call_gemini_ai(prompt: str, history: List[Dict[str, str]]) -> str:
    """Call Google Gemini REST generateContent API with multi-model fallback."""
    if not GEMINI_API_KEY or GEMINI_API_KEY.startswith("YOUR_"):
        raise ValueError("GEMINI_API_KEY not configured or is a placeholder.")

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

    candidate_models = []
    for m in [GEMINI_MODEL, "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.7-flash"]:
        if m and m not in candidate_models:
            candidate_models.append(m)

    last_error = "Unknown error"
    async with aiohttp.ClientSession() as session:
        for model_name in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={GEMINI_API_KEY}"
            try:
                async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=20)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts and "text" in parts[0]:
                                return parts[0]["text"].strip()
                    error_body = await resp.text()
                    last_error = f"HTTP {resp.status}: {error_body[:200]}"
                    logger.warning(f"⚠️ Gemini model {model_name} returned {resp.status}. Trying next candidate...")
            except Exception as e:
                last_error = str(e)
                logger.warning(f"⚠️ Gemini model {model_name} exception: {e}. Trying next candidate...")

    raise RuntimeError(f"All Gemini models exhausted. Last error: {last_error}")


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
    """Cascade query across Groq -> Gemini -> Pollinations AI -> Guidance."""
    history = chat_histories.get(chat_id, [])

    # Tier 1: Groq LPU (Primary)
    if GROQ_API_KEY and not GROQ_API_KEY.startswith("YOUR_"):
        try:
            return await call_groq_ai(prompt, history)
        except Exception as e:
            logger.warning(f"⚠️ Tier 1 (Groq) failed: {e}. Attempting fallback...")

    # Tier 2: Google Gemini (Fallback)
    if GEMINI_API_KEY and not GEMINI_API_KEY.startswith("YOUR_"):
        try:
            return await call_gemini_ai(prompt, history)
        except Exception as e:
            logger.warning(f"⚠️ Tier 2 (Gemini) failed: {e}. Attempting Tier 3 fallback...")

    # Tier 3: Pollinations AI (Zero-Key Dynamic Fallback)
    try:
        return await call_pollinations_ai(prompt)
    except Exception as e:
        logger.warning(f"⚠️ Tier 3 (Pollinations) notice: {e}.")

    # Clear guidance if no AI keys are configured or all tiers failed
    if not GROQ_API_KEY and not GEMINI_API_KEY:
        return (
            "⚠️ <b>AI Provider Not Configured</b>\n\n"
            "To enable live AI conversational answers, please add at least one AI key in your environment variables:\n"
            "• <code>GROQ_API_KEY</code> (Recommended for sub-50ms inference)\n"
            "• <code>GEMINI_API_KEY</code> (Google Gemini 2.5 Flash fallback)\n\n"
            "Once set on Railway/VPS, restart the service to chat!"
        )

    return "⚠️ <i>All AI providers are currently unavailable or experiencing rate limits. Please try again shortly.</i>"


def update_chat_history(chat_id: int, user_text: str, assistant_text: str) -> None:
    """Save exchange to local history with sliding window pruning."""
    history = chat_histories.setdefault(chat_id, [])
    history.append({"role": "user", "content": user_text})
    history.append({"role": "assistant", "content": assistant_text})
    if len(history) > MAX_MEMORY_TURNS * 2:
        chat_histories[chat_id] = history[-MAX_MEMORY_TURNS * 2:]


# ==========================================
# TELEGRAM BOT HANDLERS
# ==========================================

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command."""
    if not update.effective_message:
        return
    user = update.effective_user
    username = user.first_name if user else "User"

    welcome_msg = (
        f"🤖 <b>Universal AI Assistant & Telegram Gateway</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"Hello, <b>{username}</b>! Welcome to your production Telegram AI bot.\n\n"
        f"⚡ <b>Key Capabilities:</b>\n"
        f"• <b>Groq LPU Acceleration:</b> Ultra-fast answers powered by Llama 3.3 70B\n"
        f"• <b>Gemini Fallback:</b> Automatic zero-downtime redundancy\n"
        f"• <b>Multi-Language Translation:</b> <code>/translate &lt;text&gt; to &lt;language&gt;</code>\n"
        f"• <b>Smart Summaries:</b> <code>/summarize &lt;text&gt;</code>\n"
        f"• <b>Reminders & Utilities:</b> <code>/status</code>, <code>/ping</code>, <code>/id</code>, <code>/reset</code>\n\n"
        f"💬 <i>Send me any text question to get started!</i>"
    )
    await update.effective_message.reply_text(welcome_msg, parse_mode=ParseMode.HTML)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command."""
    if not update.effective_message:
        return
    help_msg = (
        "📖 <b>Available Commands:</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "• <code>/start</code> - Welcome overview & feature summary\n"
        "• <code>/help</code> - Show this command list\n"
        "• <code>/status</code> - Live service uptime, mode & AI provider status\n"
        "• <code>/ping</code> or <code>/health</code> - Heartbeat latency check\n"
        "• <code>/id</code> - Show your Chat ID and user info\n"
        "• <code>/reset</code> - Clear conversation memory\n"
        "• <code>/translate &lt;text&gt; to &lt;target_lang&gt;</code> - Instant translation\n"
        "• <code>/summarize &lt;content&gt;</code> - Bulleted executive summary\n"
        "• <code>/remind &lt;minutes&gt; &lt;task&gt;</code> - Set an async reminder timer\n\n"
        "💬 <i>You can also simply type any message to chat with the AI!</i>"
    )
    await update.effective_message.reply_text(help_msg, parse_mode=ParseMode.HTML)


async def ping_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /ping and /health command."""
    if not update.effective_message:
        return
    await update.effective_message.reply_text(
        "🏓 <b>Pong!</b> Service is operational on Railway/Cloud.",
        parse_mode=ParseMode.HTML,
    )


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /status command."""
    if not update.effective_message:
        return

    uptime_secs = int(asyncio.get_event_loop().time() - start_time) if start_time else 0
    mins, secs = divmod(uptime_secs, 60)
    hours, mins = divmod(mins, 60)

    has_groq = bool(GROQ_API_KEY and not GROQ_API_KEY.startswith("YOUR_"))
    has_gemini = bool(GEMINI_API_KEY and not GEMINI_API_KEY.startswith("YOUR_"))

    status_msg = (
        "🟢 <b>UNIVERSAL BOT PLATFORM STATUS</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"• <b>Runtime:</b> <code>Python {sys.version.split()[0]} (python-telegram-bot v21+)</code>\n"
        f"• <b>Delivery Mode:</b> <code>{RUN_MODE.upper()}</code>\n"
        f"• <b>Uptime:</b> <code>{hours}h {mins}m {secs}s</code>\n"
        f"• <b>Active Chat Buffers:</b> <code>{len(chat_histories)}</code>\n"
        f"• <b>Groq LPU ({GROQ_MODEL}):</b> <code>{'ACTIVE 🟢' if has_groq else 'UNCONFIGURED 🟡'}</code>\n"
        f"• <b>Gemini ({GEMINI_MODEL}):</b> <code>{'ACTIVE 🟢' if has_gemini else 'UNCONFIGURED 🟡'}</code>\n"
        f"• <b>HTTP Server:</b> <code>0.0.0.0:{PORT} (OK)</code>"
    )
    await update.effective_message.reply_text(status_msg, parse_mode=ParseMode.HTML)


async def id_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /id command."""
    if not update.effective_message or not update.effective_chat:
        return
    chat_id = update.effective_chat.id
    user = update.effective_user
    username = user.username if (user and user.username) else (user.first_name if user else "Unknown")
    await update.effective_message.reply_text(
        f"🆔 <b>Chat Telemetry:</b>\n• <b>Chat ID:</b> <code>{chat_id}</code>\n• <b>Username:</b> @{username}",
        parse_mode=ParseMode.HTML,
    )


async def reset_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /reset command."""
    if not update.effective_message or not update.effective_chat:
        return
    chat_id = update.effective_chat.id
    chat_histories.pop(chat_id, None)
    await update.effective_message.reply_text(
        "🧹 <b>Conversation buffer cleared!</b> Starting a fresh context.",
        parse_mode=ParseMode.HTML,
    )


async def translate_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /translate <text> to <language> with fixed regex matching."""
    if not update.effective_message or not update.effective_chat:
        return
    
    raw_args = " ".join(context.args) if context.args else ""
    if not raw_args:
        await update.effective_message.reply_text(
            "🌐 <b>Usage:</b> <code>/translate &lt;text&gt; to &lt;language&gt;</code>\n"
            "<i>Example: /translate Hello, how are you? to Spanish</i>",
            parse_mode=ParseMode.HTML,
        )
        return

    # Fixed regex matching "\s+to\s+" cleanly
    split_parts = re.split(r"\s+to\s+", raw_args, maxsplit=1, flags=re.IGNORECASE)
    if len(split_parts) == 2:
        source_text, target_lang = split_parts[0].strip(), split_parts[1].strip()
    else:
        source_text, target_lang = raw_args.strip(), "English"

    prompt = f"Translate the following text accurately into {target_lang}. Return only the translation followed by brief pronunciation notes if applicable:\n\n\"{source_text}\""
    
    try:
        await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    except Exception:
        pass

    reply = await generate_ai_reply(update.effective_chat.id, prompt)
    await update.effective_message.reply_text(
        f"🌐 <b>Translation ({target_lang}):</b>\n━━━━━━━━━━━━━━━━━━━━\n{reply}",
        parse_mode=ParseMode.HTML if "<" in reply else ParseMode.MARKDOWN,
    )


async def summarize_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /summarize <text> command."""
    if not update.effective_message or not update.effective_chat:
        return

    raw_text = " ".join(context.args) if context.args else ""
    if not raw_text:
        await update.effective_message.reply_text(
            "📝 <b>Usage:</b> <code>/summarize &lt;long text or article&gt;</code>",
            parse_mode=ParseMode.HTML,
        )
        return

    prompt = f"Provide a concise executive summary with key takeaways in bullet points for the following text:\n\n\"{raw_text}\""
    
    try:
        await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    except Exception:
        pass

    summary = await generate_ai_reply(update.effective_chat.id, prompt)
    await update.effective_message.reply_text(
        f"📝 <b>Executive Summary:</b>\n━━━━━━━━━━━━━━━━━━━━\n{summary}",
        parse_mode=ParseMode.MARKDOWN,
    )


async def remind_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /remind <minutes> <message> command."""
    if not update.effective_message or not update.effective_chat:
        return

    if not context.args or len(context.args) < 2:
        await update.effective_message.reply_text(
            "⏰ <b>Usage:</b> <code>/remind &lt;minutes&gt; &lt;reminder text&gt;</code>\n"
            "<i>Example: /remind 10 Check server deployment</i>",
            parse_mode=ParseMode.HTML,
        )
        return

    try:
        minutes = float(context.args[0])
        reminder_text = " ".join(context.args[1:])
    except ValueError:
        await update.effective_message.reply_text(
            "⚠️ Please specify a valid number of minutes. Example: <code>/remind 5 Drink water</code>",
            parse_mode=ParseMode.HTML,
        )
        return

    chat_id = update.effective_chat.id
    delay_secs = int(minutes * 60)

    await update.effective_message.reply_text(
        f"⏰ <b>Reminder scheduled!</b> I will notify you in <b>{minutes} minute(s)</b> about: <i>\"{reminder_text}\"</i>",
        parse_mode=ParseMode.HTML,
    )

    async def _send_later():
        await asyncio.sleep(delay_secs)
        try:
            await context.bot.send_message(
                chat_id=chat_id,
                text=f"🔔 <b>REMINDER ALERT:</b>\n━━━━━━━━━━━━━━━━━━━━\n{reminder_text}",
                parse_mode=ParseMode.HTML,
            )
        except Exception as err:
            logger.error(f"Failed to trigger reminder alert to {chat_id}: {err}")

    asyncio.create_task(_send_later())


async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Process normal user chat messages and bridge to AI cascade."""
    if not update.effective_message or not update.effective_chat:
        return

    user_text = (update.effective_message.text or "").strip()
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

    # Save to sliding window history
    update_chat_history(chat_id, user_text, reply_text)

    # Send formatted response with fallback
    try:
        await update.effective_message.reply_text(reply_text, parse_mode=ParseMode.MARKDOWN)
    except Exception:
        # Fallback to plain text if Markdown format has unmatched characters
        await update.effective_message.reply_text(reply_text)


# ==========================================
# AIOHTTP HTTP SERVER & WEBHOOK DISPATCHER
# ==========================================

def create_web_application(tg_app: Optional[Application]) -> web.Application:
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
                "tokenConfigured": bool(TELEGRAM_BOT_TOKEN and ":" in TELEGRAM_BOT_TOKEN),
                "mode": RUN_MODE,
                "activeChatBuffers": len(chat_histories),
            },
            "aiProviders": {
                "groq": bool(GROQ_API_KEY and not GROQ_API_KEY.startswith("YOUR_")),
                "gemini": bool(GEMINI_API_KEY and not GEMINI_API_KEY.startswith("YOUR_")),
            },
        }
        return web.json_response(status_data, status=200)

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
                asyncio.create_task(tg_app.process_update(update))
            return web.json_response({"ok": True}, status=200)
        except Exception as err:
            logger.error(f"❌ Webhook update processing error: {err}")
            return web.json_response({"ok": False, "error": str(err)}, status=200)

    # Register both standard and prefixed routes for compatibility
    web_app.router.add_get("/", health_handler)
    web_app.router.add_get("/health", health_handler)
    web_app.router.add_get("/api/health", health_handler)
    
    web_app.router.add_post("/webhook", webhook_handler)
    web_app.router.add_post("/api/webhook", webhook_handler)

    return web_app


# ==========================================
# MAIN APPLICATION LIFECYCLE
# ==========================================

def build_telegram_application() -> Application:
    """Build and configure the python-telegram-bot Application instance."""
    if not TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN.startswith("YOUR_") or ":" not in TELEGRAM_BOT_TOKEN:
        logger.error(
            "❌ [TelegramBot] TELEGRAM_BOT_TOKEN is missing or invalid! "
            "Please provide a valid bot token from @BotFather in your environment variables."
        )
        sys.exit(1)

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Register Command Handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler(["ping", "health"], ping_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("id", id_command))
    app.add_handler(CommandHandler("reset", reset_command))
    app.add_handler(CommandHandler("translate", translate_command))
    app.add_handler(CommandHandler("summarize", summarize_command))
    app.add_handler(CommandHandler("remind", remind_command))

    # Register General Text Message Handler
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message))

    return app


async def main_async() -> None:
    """Async main entrypoint initializing Telegram Bot & aiohttp Web Server."""
    global start_time
    start_time = asyncio.get_event_loop().time()

    is_token_configured = bool(TELEGRAM_BOT_TOKEN and ":" in TELEGRAM_BOT_TOKEN)
    is_groq_configured = bool(GROQ_API_KEY and not GROQ_API_KEY.startswith("YOUR_"))
    is_gemini_configured = bool(GEMINI_API_KEY and not GEMINI_API_KEY.startswith("YOUR_"))
    is_ai_configured = is_groq_configured or is_gemini_configured

    # Formatted startup logs
    logger.info(f"Telegram token configured: {is_token_configured}")
    logger.info(f"AI provider configured: {is_ai_configured}")
    logger.info(f"Telegram mode: {RUN_MODE}")

    tg_app = build_telegram_application()

    # Initialize Telegram Application
    await tg_app.initialize()
    await tg_app.start()

    # Handle Mode Specific Initialization
    if RUN_MODE == "polling":
        # Delete any active webhook before starting polling
        try:
            logger.info("🧹 Calling deleteWebhook to ensure no lingering webhook locks...")
            await tg_app.bot.delete_webhook(drop_pending_updates=True)
            logger.info("✅ deleteWebhook succeeded.")
        except Exception as e:
            logger.warning(f"⚠️ deleteWebhook notice: {e}")

        # Start background polling in updater
        if tg_app.updater:
            await tg_app.updater.start_polling(drop_pending_updates=True)
            logger.info("✅ Telegram bot polling worker started.")
    elif RUN_MODE == "webhook":
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
        if tg_app.updater and tg_app.updater.running:
            await tg_app.updater.stop()
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
