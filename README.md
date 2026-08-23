# Universal Multi-Provider Telegram Bot & AI Gateway

A production-ready Telegram Bot built with `python-telegram-bot` (v21+), `aiohttp`, and a multi-tier AI inference cascade featuring Groq LPU (Llama 3.3 70B) with automatic Google Gemini 2.5 Flash fallback.

---

## 🚀 Railway Deployment Guide

Deploying this bot to [Railway](https://railway.app) takes less than 2 minutes:

### 1. Create a New Service on Railway
1. Go to your **Railway Dashboard**.
2. Click **New Project** → **Deploy from GitHub Repo** (or upload this repository directly).
3. Railway will automatically detect the `Dockerfile` and `railway.json`.

### 2. Configure Environment Variables
In your Railway Service Settings, navigate to the **Variables** tab and configure:

| Variable | Description | Required | Example / Default |
| :--- | :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Bot API Token obtained from [@BotFather](https://t.me/BotFather) | **YES** | `123456789:ABCdefGhI_jklMnoPQRstuVWXyz` |
| `GROQ_API_KEY` | Groq Cloud API Key for ultra-fast Llama 3.3 inference | **YES** (Primary AI) | `gsk_xxxxxxxxxxxxxxxxxxxx` |
| `GEMINI_API_KEY` | Google AI Studio Gemini API Key for fallback redundancy | Recommended | `AIzaSyxxxxxxxxxxxxxxxxxxxx` |
| `RUN_MODE` | Delivery architecture mode (`polling` or `webhook`) | Optional | `polling` (Default) |
| `WEBHOOK_SECRET` | Secret token string to validate Telegram webhook headers | Only if `RUN_MODE=webhook` | `my_random_secret_token_123` |
| `PUBLIC_BASE_URL` | Deployed Railway public domain URL | Only if `RUN_MODE=webhook` | `https://your-service.up.railway.app` |

> 💡 **Recommendation**: Keep `RUN_MODE=polling`. Long-polling automatically runs on Railway, clears any previous webhook lock on startup, and doesn't require public DNS routing for Telegram updates.

### 3. Deploy and Verify
- **Healthcheck Path**: `/health` (automatically verified by Railway on port `$PORT`).
- **Start Command**: `python bot.py`

---

## 📡 API Endpoints

The internal `aiohttp` HTTP service runs on `0.0.0.0:$PORT` to serve health checks and webhook updates:

- `GET /health` & `GET /api/health` — Returns JSON system health, uptime, and AI provider status.
- `POST /webhook` & `POST /api/webhook` — Telegram update receivers for webhook mode.

---

## 🧪 Local Testing & Verification

### 1. Syntax Check
```bash
python3 -m py_compile bot.py
```

### 2. Local Healthcheck Test
```bash
curl -s http://localhost:3000/health
```
Expected response:
```json
{
  "status": "ok",
  "service": "Universal Telegram Bot Worker & Gateway",
  "mode": "polling",
  "uptimeSeconds": 12,
  "telegram": {
    "tokenConfigured": true,
    "mode": "polling",
    "activeChatBuffers": 0
  },
  "aiProviders": {
    "groq": true,
    "gemini": true
  }
}
```

### 3. Webhook Simulation Test
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"update_id": 1001, "message": {"message_id": 1, "chat": {"id": 123456789}, "text": "/ping", "from": {"id": 123456789, "is_bot": false, "first_name": "Tester"}}}'
```
Expected response:
```json
{"ok": true}
```
