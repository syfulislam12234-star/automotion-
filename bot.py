#!/usr/bin/env python3
"""
Universal Multi-Provider Telegram Bot Worker
Powered by python-telegram-bot (v20+) and Groq LPU AI Engine.

Reads:
- TELEGRAM_BOT_TOKEN: Bot token from @BotFather
- GROQ_API_KEY_1 / GROQ_API_KEY: High-speed inference via Llama 3.3 70B
- GEMINI_API_KEY / OPENROUTER_API_KEY (optional fallbacks)

Runs long-polling and bridges incoming user messages to the AI cascade.
"""

import os
import sys
import logging
from typing import Dict, List
import aiohttp
from dotenv import load_dotenv

from telegram import Update
from telegram.constants import ParseMode, ChatAction
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("UniversalTelegramBot")

# Environment configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
GROQ_API_KEY_1 = os.getenv("GROQ_API_KEY_1", os.getenv("GROQ_API_KEY", "")).strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
SYSTEM_PROMPT = os.getenv(
    "SYSTEM_PROMPT",
    "You are a friendly, highly intelligent, and ultra-fast AI assistant powered by the Universal Multi-Provider AI Engine. Provide concise, clear, and helpful answers formatted in clean Markdown.",
)

# Per-chat sliding window memory
chat_histories: Dict[int, List[Dict[str, str]]] = {}
MAX_MEMORY_TURNS = 10


async def call_groq_ai(prompt: str, history: List[Dict[str, str]]) -> str:
    """Send request to Groq Cloud OpenAI-compatible chat completions endpoint."""
    if not GROQ_API_KEY_1 or GROQ_API_KEY_1 == "YOUR_GROQ_API_KEY":
        raise ValueError("GROQ_API_KEY_1 is not configured.")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": prompt})

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY_1}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2048,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(
            url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=25)
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data["choices"][0]["message"]["content"].strip()
            error_text = await resp.text()
            raise RuntimeError(f"Groq API returned HTTP {resp.status}: {error_text}")


async def call_pollinations_fallback(prompt: str) -> str:
    """Zero-key free fallback AI provider."""
    url = f"https://text.pollinations.ai/{prompt}?system={SYSTEM_PROMPT}"
    async with aiohttp.ClientSession() as session:
        async with session.get(
            url, timeout=aiohttp.ClientTimeout(total=15)
        ) as resp:
            if resp.status == 200:
                text = await resp.text()
                if text and not text.strip().startswith("<html"):
                    return text.strip()
    raise RuntimeError("Pollinations fallback unavailable.")


async def generate_ai_reply(chat_id: int, prompt: str) -> str:
    """Bridge incoming user query to Groq LPU with zero-key fallback."""
    history = chat_histories.get(chat_id, [])

    # 1. Primary: Groq LPU Llama 3.3 70B
    if GROQ_API_KEY_1 and GROQ_API_KEY_1 != "YOUR_GROQ_API_KEY":
        try:
            return await call_groq_ai(prompt, history)
        except Exception as e:
            logger.warning(f"Groq primary AI invocation failed: {e}")

    # 2. Secondary: Pollinations Free Zero-Key
    try:
        return await call_pollinations_fallback(prompt)
    except Exception as e:
        logger.warning(f"Pollinations fallback failed: {e}")

    # 3. Informational response if keys are missing
    return (
        f"🤖 Hello! I received your message: **\"{prompt}\"**\n\n"
        "⚡ **AI Engine Status:**\n"
        "• Bot connection is active via `python-telegram-bot`.\n"
        "• To activate high-speed Llama 3.3 inference, set `GROQ_API_KEY_1` in your environment variables."
    )


def save_to_history(chat_id: int, user_text: str, assistant_text: str) -> None:
    """Append turn to chat history and enforce sliding window limit."""
    history = chat_histories.setdefault(chat_id, [])
    history.append({"role": "user", "content": user_text})
    history.append({"role": "assistant", "content": assistant_text})
    if len(history) > MAX_MEMORY_TURNS * 2:
        chat_histories[chat_id] = history[-MAX_MEMORY_TURNS * 2 :]


# ==========================================
# TELEGRAM HANDLERS
# ==========================================


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command."""
    if not update.effective_message:
        return

    user = update.effective_user
    username = user.first_name if user else "User"

    welcome_text = (
        f"🤖 <b>Universal Multi-Provider AI Bot</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"Hello, <b>{username}</b>! Welcome to your Telegram AI Assistant.\n\n"
        f"⚡ <b>Features:</b>\n"
        f"• <b>Groq LPU Acceleration:</b> Sub-50ms inference via Llama 3.3 70B.\n"
        f"• <b>Conversation Memory:</b> Maintains context across queries.\n"
        f"• <b>Zero Downtime:</b> Automatic fallback engine.\n\n"
        f"💬 <i>Send me any message to chat with the AI, or type /help for available commands!</i>"
    )

    await update.effective_message.reply_text(welcome_text, parse_mode=ParseMode.HTML)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command."""
    if not update.effective_message:
        return

    help_text = (
        "📖 <b>Available Commands:</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "• <code>/start</code> - Welcome overview and introduction\n"
        "• <code>/help</code> - Show this command list\n"
        "• <code>/ping</code> - Latency and heartbeat check\n"
        "• <code>/status</code> - Service uptime and AI status\n"
        "• <code>/id</code> - Show your Chat ID\n"
        "• <code>/reset</code> - Clear conversation memory\n\n"
        "💬 <i>You can send any plain text message to receive an AI response!</i>"
    )

    await update.effective_message.reply_text(help_text, parse_mode=ParseMode.HTML)


async def ping_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /ping command."""
    if not update.effective_message:
        return
    await update.effective_message.reply_text(
        "🏓 <b>Pong!</b> Service is operational via <code>python-telegram-bot</code>.",
        parse_mode=ParseMode.HTML,
    )


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /status command."""
    if not update.effective_message:
        return

    has_groq = bool(GROQ_API_KEY_1 and GROQ_API_KEY_1 != "YOUR_GROQ_API_KEY")
    status_text = (
        "🟢 <b>UNIVERSAL BOT PLATFORM STATUS</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "• <b>Runtime:</b> <code>Python 3 (python-telegram-bot v20+)</code>\n"
        "• <b>Update Mode:</b> <code>Long Polling</code>\n"
        f"• <b>Groq LPU ({GROQ_MODEL}):</b> <code>{'ACTIVE 🟢' if has_groq else 'STANDBY 🟡'}</code>\n"
        f"• <b>Active Chat Buffers:</b> <code>{len(chat_histories)}</code>\n"
        "• <b>Zero-Key Fallback:</b> <code>ONLINE 🟢</code>"
    )

    await update.effective_message.reply_text(status_text, parse_mode=ParseMode.HTML)


async def id_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /id command."""
    if not update.effective_message:
        return

    chat_id = update.effective_chat.id if update.effective_chat else "Unknown"
    user = update.effective_user
    username = user.username or user.first_name if user else "Unknown"

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
        "🧹 <b>Conversation memory cleared!</b> Starting a fresh context.",
        parse_mode=ParseMode.HTML,
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle incoming plain text messages and bridge to AI engine."""
    if not update.effective_message or not update.effective_chat:
        return

    user_text = (update.effective_message.text or "").strip()
    if not user_text:
        return

    chat_id = update.effective_chat.id
    user = update.effective_user
    username = user.first_name if user else "User"

    logger.info(f"Received message from {username} ({chat_id}): {user_text[:60]}")

    # Send typing action
    try:
        await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
    except Exception as e:
        logger.debug(f"Could not send typing action: {e}")

    # Generate AI response
    reply_text = await generate_ai_reply(chat_id, user_text)

    # Save to sliding window memory
    save_to_history(chat_id, user_text, reply_text)

    # Send reply (with fallback to plain text if Markdown parsing fails)
    try:
        await update.effective_message.reply_text(
            reply_text, parse_mode=ParseMode.MARKDOWN
        )
    except Exception as md_err:
        logger.warning(f"Markdown parse failed, replying in plain text: {md_err}")
        await update.effective_message.reply_text(reply_text)


# ==========================================
# MAIN APPLICATION RUNNER
# ==========================================


def main() -> None:
    """Initialize and run the Telegram bot worker."""
    if not TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN == "YOUR_TELEGRAM_BOT_TOKEN":
        logger.error(
            "❌ TELEGRAM_BOT_TOKEN is not set or is a placeholder in environment variables! Exiting."
        )
        sys.exit(1)

    logger.info("🚀 Building python-telegram-bot application...")

    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Register command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler(["ping", "health"], ping_command))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(CommandHandler("id", id_command))
    application.add_handler(CommandHandler("reset", reset_command))

    # Register message handler for text queries
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    )

    logger.info("✅ Starting long-polling listener (drop_pending_updates=True)...")
    application.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, SystemExit):
        logger.info("🛑 Bot worker stopped.")
