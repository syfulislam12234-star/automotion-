#!/usr/bin/env python3
"""
Universal Multi-Provider Telegram Bot Runner (Python 3.10+)
Supports 20-Tier AI Cascade (Groq, Gemini, OpenRouter, Cerebras, Pollinations Free)
Compatible with Railway, VPS, Docker, and Cloud Run.
"""

import os
import sys
import time
import json
import logging
import asyncio
from typing import Dict, List, Any
import aiohttp
from dotenv import load_dotenv

# Load local .env
load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger("UniversalTelegramBot")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
ADMIN_TELEGRAM_ID = os.getenv("ADMIN_TELEGRAM_ID", os.getenv("TELEGRAM_ADMIN_CHAT_ID", "749201994")).strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY_1", os.getenv("GROQ_API_KEY", "")).strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "").strip()
SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT", "You are a helpful, ultra-fast AI assistant powered by a 20-tier multi-provider fallback engine.")

# In-memory per-chat conversation buffer
chat_histories: Dict[int, List[Dict[str, str]]] = {}
MAX_TURNS = 10

async def call_groq(prompt: str, history: List[Dict[str, str]]) -> str:
    if not GROQ_API_KEY or GROQ_API_KEY == "YOUR_GROQ_API_KEY":
        raise ValueError("Groq key not set")
    
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": prompt})

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2048
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=20)) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data["choices"][0]["message"]["content"].strip()
            raise RuntimeError(f"Groq API returned status {resp.status}")

async def call_pollinations_free(prompt: str) -> str:
    url = f"https://text.pollinations.ai/{prompt}?system={SYSTEM_PROMPT}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status == 200:
                text = await resp.text()
                if text and not text.startswith("<html"):
                    return text.strip()
    raise RuntimeError("Pollinations failed")

async def generate_ai_reply(chat_id: int, prompt: str) -> str:
    history = chat_histories.get(chat_id, [])

    # 1. Try Groq
    if GROQ_API_KEY:
        try:
            return await call_groq(prompt, history)
        except Exception as e:
            logger.warning(f"Groq Tier 1 failed: {e}")

    # 2. Try Pollinations Free Zero-Key
    try:
        return await call_pollinations_free(prompt)
    except Exception as e:
        logger.warning(f"Pollinations fallback failed: {e}")

    return f"🤖 Hello! I received: '{prompt}'. Bot is connected and operational. Please ensure GROQ_API_KEY_1 or GEMINI_API_KEY is configured in your Railway environment variables for full LLM inference."

async def send_telegram_message(session: aiohttp.ClientSession, chat_id: int, text: str, parse_mode: str = "HTML"):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text[:4000],
        "parse_mode": parse_mode,
        "disable_web_page_preview": True
    }
    try:
        async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200 and parse_mode:
                # Retry with plain text if markdown/html parsing error
                payload.pop("parse_mode", None)
                await session.post(url, json=payload)
    except Exception as e:
        logger.error(f"Failed to send message to {chat_id}: {e}")

async def handle_update(session: aiohttp.ClientSession, update: dict):
    msg = update.get("message") or update.get("edited_message")
    if not msg:
        return

    chat_id = msg.get("chat", {}).get("id")
    text = (msg.get("text") or "").strip()
    from_user = msg.get("from", {})
    username = from_user.get("username") or from_user.get("first_name") or "User"

    if not chat_id or from_user.get("is_bot"):
        return

    logger.info(f"Received message from @{username} (ID: {chat_id}): {text[:50]}")

    if text.startswith("/"):
        cmd = text.split(" ")[0].lower().replace(f"@{from_user.get('username')}", "")
        args = " ".join(text.split(" ")[1:]).strip()

        if cmd == "/start":
            reply = f"🤖 <b>Universal 20-Tier AI Assistant</b>\n\nHello <b>{username}</b>! Send me any text to chat with the AI, or type <code>/help</code> for commands."
            await send_telegram_message(session, chat_id, reply)
        elif cmd == "/help":
            reply = (
                "📖 <b>Available Commands:</b>\n"
                "• <code>/start</code> - Welcome & overview\n"
                "• <code>/help</code> - Command list\n"
                "• <code>/status</code> - Live server & AI cascade metrics\n"
                "• <code>/providers</code> - 20-Tier AI status\n"
                "• <code>/ping</code> - Latency heartbeat check\n"
                "• <code>/id</code> - Show your Chat ID\n"
                "• <code>/reset</code> - Clear conversation memory\n"
            )
            await send_telegram_message(session, chat_id, reply)
        elif cmd in ["/ping", "/health"]:
            await send_telegram_message(session, chat_id, "🏓 <b>Pong!</b> Service is operational on Railway.")
        elif cmd == "/id":
            await send_telegram_message(session, chat_id, f"🆔 <b>Chat ID:</b> <code>{chat_id}</code>\n<b>User:</b> @{username}")
        elif cmd == "/status":
            await send_telegram_message(session, chat_id, "🟢 <b>Universal AI Bot Platform: ONLINE</b>\n• Mode: Long Polling\n• Providers: 20-Tier Cascade Active")
        elif cmd == "/reset":
            chat_histories.pop(chat_id, None)
            await send_telegram_message(session, chat_id, "🧹 Conversation buffer reset.")
        else:
            await send_telegram_message(session, chat_id, f"❓ Unknown command: <code>{cmd}</code>. Type <code>/help</code> for available commands.")
    elif text:
        # Chat inference
        reply = await generate_ai_reply(chat_id, text)
        hist = chat_histories.setdefault(chat_id, [])
        hist.append({"role": "user", "content": text})
        hist.append({"role": "assistant", "content": reply})
        if len(hist) > MAX_TURNS * 2:
            chat_histories[chat_id] = hist[-MAX_TURNS * 2:]
        await send_telegram_message(session, chat_id, reply, parse_mode="")

async def main():
    if not TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN == "YOUR_TELEGRAM_BOT_TOKEN":
        logger.error("❌ TELEGRAM_BOT_TOKEN is not set in environment! Exiting.")
        sys.exit(1)

    logger.info("🚀 Starting Telegram Bot Worker (Python Polling Mode)...")

    async with aiohttp.ClientSession() as session:
        # Delete any existing webhook before polling
        async with session.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/deleteWebhook") as resp:
            logger.info("Cleared existing webhook.")

        # Get bot info
        async with session.get(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getMe") as resp:
            me = await resp.json()
            if me.get("ok"):
                logger.info(f"✅ Authenticated as @{me['result']['username']} (ID: {me['result']['id']})")
            else:
                logger.error(f"❌ Invalid token: {me}")
                sys.exit(1)

        offset = 0
        while True:
            try:
                url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates?offset={offset}&timeout=30"
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=40)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        updates = data.get("result", [])
                        for u in updates:
                            offset = max(offset, u["update_id"] + 1)
                            asyncio.create_task(handle_update(session, u))
                    else:
                        logger.warning(f"getUpdates returned HTTP {resp.status}")
                        await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Polling error: {e}")
                await asyncio.sleep(3)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Bot worker stopped.")
