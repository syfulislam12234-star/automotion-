#!/usr/bin/env python3
"""
Atomic patcher: applies all Telegram per-user dynamic HTTPS webhook fixes to bot.py.

Design guarantees
-----------------
1. All-or-nothing ("atomic"): every patch anchor must match exactly once before
   anything is written. If any patch fails, bot.py is left untouched.
2. The patched file is syntax-validated (ast.parse) before it replaces the original.
3. The replacement is performed with a temp file in the same directory + os.replace,
   which is atomic on Windows and POSIX alike.
4. Idempotent: if a patch's target is already applied, it is skipped, so the script
   can safely be re-run.

Run:  python patches/apply_telegram_webhook_patch.py
"""

import ast
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOT_PATH = os.path.join(ROOT, "bot.py")


def patch_01_imports(src: str):
    old = (
        "import asyncio\n"
        "from typing import Dict, List, Any, Optional\n"
    )
    new = (
        "import asyncio\n"
        "import hashlib\n"
        "from urllib.parse import unquote\n"
        "from typing import Dict, List, Any, Optional\n"
    )
    return old, new


def patch_02_config(src: str):
    old = 'PUBLIC_BASE_URL: str = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")\n'
    new = (
        'PUBLIC_BASE_URL: str = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")\n'
        "# Optional override: root URL of a (self-hosted) Telegram Bot API server.\n"
        "# Empty string means the official https://api.telegram.org endpoint.\n"
        'TELEGRAM_API_BASE_URL: str = os.getenv("TELEGRAM_API_BASE_URL", "").strip().rstrip("/")\n'
    )
    return old, new


def patch_03_state(src: str):
    old = "telegram_session_lock = asyncio.Lock()\n"
    new = (
        "telegram_session_lock = asyncio.Lock()\n"
        "# Per-user tokens that run in dynamic webhook mode (instead of polling mode)\n"
        "webhook_sessions: set = set()\n"
        "# Derived, URL-safe webhook session id -> bot token routing table\n"
        "webhook_routes: Dict[str, str] = {}\n"
    )
    return old, new


def patch_04_builder_base_url(src: str):
    old = "    app = Application.builder().token(normalized_token).build()\n"
    new = (
        "    builder = Application.builder().token(normalized_token)\n"
        "    if TELEGRAM_API_BASE_URL:\n"
        '        builder = builder.base_url(f"{TELEGRAM_API_BASE_URL}/bot")\n'
        "    app = builder.build()\n"
    )
    return old, new


def patch_05_helpers(src: str):
    old = "async def start_telegram_session(token: str) -> Application:\n"
    new = (
        "def _session_webhook_id(token: str) -> str:\n"
        '    """Deterministic, URL-safe webhook session id derived from a bot token."""\n'
        '    return hashlib.sha256(("automotion-webhook:" + token).encode("utf-8")).hexdigest()[:24]\n'
        "\n"
        "\n"
        "def _session_webhook_secret(token: str) -> str:\n"
        '    """Deterministic per-session webhook secret (Telegram echoes it back verbatim)."""\n'
        '    material = f"{WEBHOOK_SECRET}|automotion|{token}" if WEBHOOK_SECRET else f"automotion|{token}"\n'
        '    return hashlib.sha256(material.encode("utf-8")).hexdigest()\n'
        "\n"
        "\n"
        "async def start_telegram_session(token: str) -> Application:\n"
    )
    return old, new


def patch_06_webhook_session(src: str):
    old = (
        "        telegram_sessions[normalized_token] = app\n"
        '        logger.info("Telegram polling session started for token ending in ...%s", normalized_token[-6:])\n'
        "        return app\n"
        "\n"
        "\n"
        "async def stop_telegram_session(token: str) -> bool:\n"
    )
    new = (
        "        telegram_sessions[normalized_token] = app\n"
        '        logger.info("Telegram polling session started for token ending in ...%s", normalized_token[-6:])\n'
        "        return app\n"
        "\n"
        "\n"
        "async def start_telegram_webhook_session(token: str, base_url: str) -> Application:\n"
        '    """Initialize an isolated per-user bot session and register its dynamic HTTPS webhook."""\n'
        "    normalized_token = token.strip()\n"
        "    if not _is_valid_bot_token(normalized_token):\n"
        '        raise ValueError("A valid Telegram bot token is required.")\n'
        '    base = (base_url or PUBLIC_BASE_URL).rstrip("/")\n'
        '    if not base.startswith("https://"):\n'
        '        raise ValueError("An HTTPS PUBLIC_BASE_URL is required to register dynamic Telegram webhooks.")\n'
        "\n"
        "    async with telegram_session_lock:\n"
        "        existing = telegram_sessions.get(normalized_token)\n"
        "        if existing and normalized_token in webhook_sessions:\n"
        "            return existing\n"
        "\n"
        "        app = build_telegram_application(normalized_token)\n"
        "        webhook_id = _session_webhook_id(normalized_token)\n"
        '        webhook_url = f"{base}/webhook/{webhook_id}"\n'
        "        try:\n"
        "            if existing:\n"
        "                # Upgrade an existing polling session to webhook mode.\n"
        "                if existing.updater and existing.updater.running:\n"
        "                    await existing.updater.stop()\n"
        "                await existing.stop()\n"
        "                await existing.shutdown()\n"
        "                telegram_sessions.pop(normalized_token, None)\n"
        "            await app.initialize()\n"
        "            await app.bot.get_me()\n"
        "            await app.start()\n"
        "            await app.bot.set_webhook(\n"
        "                url=webhook_url,\n"
        "                secret_token=_session_webhook_secret(normalized_token),\n"
        "                allowed_updates=list(Update.ALL_TYPES),\n"
        "                drop_pending_updates=True,\n"
        "            )\n"
        "        except Exception:\n"
        "            if app.updater and app.updater.running:\n"
        "                await app.updater.stop()\n"
        "            await app.stop()\n"
        "            await app.shutdown()\n"
        "            raise\n"
        "\n"
        "        telegram_sessions[normalized_token] = app\n"
        "        webhook_sessions.add(normalized_token)\n"
        "        webhook_routes[webhook_id] = normalized_token\n"
        '        logger.info("Telegram webhook session registered for token ...%s -> %s", normalized_token[-6:], webhook_url)\n'
        "        return app\n"
        "\n"
        "\n"
        "async def stop_telegram_session(token: str) -> bool:\n"
    )
    return old, new


def patch_07_stop_cleanup(src: str):
    old = (
        "        if app.updater and app.updater.running:\n"
        "            await app.updater.stop()\n"
        "        await app.stop()\n"
        "        await app.shutdown()\n"
        '        logger.info("Telegram polling session stopped for token ending in ...%s", normalized_token[-6:])\n'
    )
    new = (
        "        was_webhook = normalized_token in webhook_sessions\n"
        "        webhook_sessions.discard(normalized_token)\n"
        "        webhook_routes.pop(_session_webhook_id(normalized_token), None)\n"
        "        if app.updater and app.updater.running:\n"
        "            await app.updater.stop()\n"
        "        if was_webhook:\n"
        "            try:\n"
        "                await app.bot.delete_webhook(drop_pending_updates=False)\n"
        "            except Exception as err:\n"
        '                logger.warning("Dynamic webhook deregistration failed for ...%s: %s", normalized_token[-6:], err)\n'
        "        await app.stop()\n"
        "        await app.shutdown()\n"
        '        logger.info("Telegram session stopped for token ending in ...%s (webhook=%s)", normalized_token[-6:], was_webhook)\n'
    )
    return old, new


def patch_08_connect_mode(src: str):
    old = (
        "        try:\n"
        "            app = await start_telegram_session(token)\n"
        "            bot = await app.bot.get_me()\n"
        "            return web.json_response({\n"
        '                "ok": True,\n'
        '                "running": True,\n'
        '                "mode": "polling",\n'
        '                "bot": {"id": bot.id, "username": bot.username, "name": bot.first_name},\n'
        "            })\n"
    )
    new = (
        "        try:\n"
        '            if RUN_MODE == "webhook" and PUBLIC_BASE_URL:\n'
        "                app = await start_telegram_webhook_session(token, PUBLIC_BASE_URL)\n"
        "                bot = await app.bot.get_me()\n"
        "                return web.json_response({\n"
        '                    "ok": True,\n'
        '                    "running": True,\n'
        '                    "mode": "webhook",\n'
        '                    "webhookUrl": f"{PUBLIC_BASE_URL}/webhook/{_session_webhook_id(token.strip())}",\n'
        '                    "bot": {"id": bot.id, "username": bot.username, "name": bot.first_name},\n'
        "                })\n"
        "            app = await start_telegram_session(token)\n"
        "            bot = await app.bot.get_me()\n"
        "            return web.json_response({\n"
        '                "ok": True,\n'
        '                "running": True,\n'
        '                "mode": "polling",\n'
        '                "bot": {"id": bot.id, "username": bot.username, "name": bot.first_name},\n'
        "            })\n"
    )
    return old, new


def patch_09_dynamic_handler(src: str):
    old = "    # Register both standard and prefixed routes for compatibility\n"
    new = (
        "    async def dynamic_webhook_handler(request: web.Request) -> web.Response:\n"
        '        """Handle incoming Telegram webhook updates for a dynamic per-user bot session."""\n'
        '        webhook_id = unquote(request.match_info.get("token", "")).strip().strip("/")\n'
        "        token = webhook_routes.get(webhook_id)\n"
        "        if not token or not _is_valid_bot_token(token):\n"
        '            return web.json_response({"ok": False, "error": "Unknown webhook session."}, status=404)\n'
        "\n"
        "        app = telegram_sessions.get(token)\n"
        "        if not app:\n"
        '            return web.json_response({"ok": False, "error": "Telegram session is not active."}, status=404)\n'
        "\n"
        '        if request.headers.get("X-Telegram-Bot-Api-Secret-Token", "") != _session_webhook_secret(token):\n'
        '            logger.warning("⛔ Dynamic webhook rejected: secret mismatch for token ...%s", token[-6:])\n'
        '            return web.json_response({"ok": False, "error": "Unauthorized secret token"}, status=403)\n'
        "\n"
        "        try:\n"
        "            body = await request.json()\n"
        "            if not body:\n"
        '                return web.json_response({"ok": True, "notice": "Empty payload"})\n'
        "\n"
        "            update = Update.de_json(data=body, bot=app.bot)\n"
        "            if update:\n"
        "                task = asyncio.create_task(app.process_update(update))\n"
        "                task.add_done_callback(\n"
        "                    lambda completed_task: logger.error(\n"
        '                        "❌ Dynamic webhook update processing error: %s",\n'
        "                        completed_task.exception(),\n"
        "                    )\n"
        "                    if not completed_task.cancelled() and completed_task.exception()\n"
        "                    else None\n"
        "                )\n"
        '            return web.json_response({"ok": True}, status=200)\n'
        "        except Exception as err:\n"
        '            logger.error(f"❌ Dynamic webhook update processing error: {err}")\n'
        '            return web.json_response({"ok": False, "error": str(err)}, status=200)\n'
        "\n"
        "    # Register both standard and prefixed routes for compatibility\n"
    )
    return old, new


def patch_10_dynamic_routes(src: str):
    old = (
        '    web_app.router.add_post("/webhook", webhook_handler)\n'
        '    web_app.router.add_post("/api/webhook", webhook_handler)\n'
    )
    new = (
        '    web_app.router.add_post("/webhook", webhook_handler)\n'
        '    web_app.router.add_post("/api/webhook", webhook_handler)\n'
        '    web_app.router.add_post("/webhook/{token}", dynamic_webhook_handler)\n'
        '    web_app.router.add_post("/api/webhook/{token}", dynamic_webhook_handler)\n'
    )
    return old, new


def patch_11_health_stats(src: str):
    old = (
        '                "activeChatBuffers": len(chat_memories),\n'
        '                "activeSessions": len(telegram_sessions),\n'
    )
    new = (
        '                "activeChatBuffers": len(chat_memories),\n'
        '                "activeSessions": len(telegram_sessions),\n'
        '                "activeWebhookSessions": len(webhook_sessions),\n'
    )
    return old, new


PATCHES = [
    ("01_stdlib_imports", patch_01_imports),
    ("02_env_base_url_config", patch_02_config),
    ("03_webhook_state_registries", patch_03_state),
    ("04_builder_base_url_hook", patch_04_builder_base_url),
    ("05_webhook_helper_functions", patch_05_helpers),
    ("06_start_webhook_session", patch_06_webhook_session),
    ("07_stop_session_webhook_cleanup", patch_07_stop_cleanup),
    ("08_connect_webhook_mode", patch_08_connect_mode),
    ("09_dynamic_webhook_handler", patch_09_dynamic_handler),
    ("10_dynamic_webhook_routes", patch_10_dynamic_routes),
    ("11_health_webhook_stats", patch_11_health_stats),
]


def apply_patches() -> int:
    # Make emoji/unicode prints safe on Windows cp1252 consoles.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    with open(BOT_PATH, "r", encoding="utf-8") as handle:
        src = handle.read()

    # Sanity: the original must be valid Python before we start.
    ast.parse(src)

    patched = src
    applied, skipped = [], []

    for name, factory in PATCHES:
        old, new = factory(patched)
        # NOTE: check `new` FIRST. Several replacement texts embed their original
        # anchor as a prefix, so `old in patched` stays true after application.
        # The full new text being present is the only reliable "already applied" signal.
        if new in patched:
            skipped.append(name)
        elif old in patched and patched.count(old) == 1:
            patched = patched.replace(old, new, 1)
            applied.append(name)
        else:
            occurrences = patched.count(old) if old else 0
            print(f"❌ [{name}] anchor matches {occurrences} times (expected exactly 1). ABORTING — no changes written.")
            return 1

    if not applied:
        print(f"✅ No changes needed: {len(skipped)} patch(es) already applied to {BOT_PATH}")
        for name in skipped:
            print(f"   • = {name} (already applied)")
        return 0

    # Validate the merged result before touching disk.
    try:
        ast.parse(patched)
    except SyntaxError as err:
        print(f"❌ Patched file failed syntax validation: {err}. ABORTING — no changes written.")
        return 1

    # Atomic write: temp file in the same directory, fsync, then os.replace.
    tmp_fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(BOT_PATH), suffix=".py.tmp")
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8") as handle:
            handle.write(patched)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, BOT_PATH)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise

    print(f"✅ Applied {len(applied)} patch(es) atomically to {BOT_PATH}")
    for name in applied:
        print(f"   • + {name}")
    for name in skipped:
        print(f"   • = {name} (already applied)")
    return 0


if __name__ == "__main__":
    sys.exit(apply_patches())
