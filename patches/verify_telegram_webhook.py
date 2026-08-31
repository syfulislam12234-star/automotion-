#!/usr/bin/env python3
"""
End-to-end verification for the dynamic per-user Telegram webhook patch.

What this harness proves (no real Telegram credentials or internet needed):
  1. /health responds and exposes the activeWebhookSessions counter.
  2. POST /api/telegram/connect (RUN_MODE=webhook + HTTPS PUBLIC_BASE_URL)
     registers a DYNAMIC HTTPS webhook with Telegram:
        set_webhook(url=https://<PUBLIC_BASE_URL>/webhook/<session_id>,
                    secret_token=<per-session secret>)
  3. A Telegram update delivered to /webhook/<session_id> with the correct
     X-Telegram-Bot-Api-Secret-Token header is routed to the RIGHT bot and the
     bot replies through its OWN token (per-user token replies).
  4. Security: wrong/missing secret -> 403, unknown session -> 404.
  5. Multi-user isolation: two user bots get independent webhook ids/secrets
     and replies are attributed to the correct token.
  6. POST /api/telegram/disconnect deletes the Telegram webhook and removes
     the dynamic route (subsequent deliveries -> 404).

bot.py is launched as a subprocess and pointed at a local MOCK Telegram Bot
API via TELEGRAM_API_BASE_URL; the mock records every Bot API call.

Run:  python patches/verify_telegram_webhook.py
"""

import asyncio
import hashlib
import json
import os
import re
import sys
import tempfile

import aiohttp
from aiohttp import web

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOT_PATH = os.path.join(ROOT, "bot.py")

PUBLIC_BASE = "https://automotion-harness.test"
WEBHOOK_SECRET_ENV = "harness_shared_secret_123"

TOKEN_A = "111000111:AAHharness_tokenA_xxxxxxxxxxx"
TOKEN_B = "222000222:AAHharness_tokenB_yyyyyyyyyyy"

results = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    results.append((name, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail and not ok else ""))
    return ok


def session_webhook_id(token: str) -> str:
    return hashlib.sha256(("automotion-webhook:" + token).encode("utf-8")).hexdigest()[:24]


def session_webhook_secret(token: str) -> str:
    material = f"{WEBHOOK_SECRET_ENV}|automotion|{token}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


class MockTelegramAPI:
    """Local simulation of api.telegram.org that records every Bot API call."""

    def __init__(self) -> None:
        self.calls = []          # list of (token, method, payload)
        self.webhooks = {}       # token -> {"url":..., "secret_token":...}
        self.messages = []       # list of (token, chat_id, text)
        self._msg_id = 100
        self.runner = None
        self.port = 0

    async def start(self) -> None:
        app = web.Application()
        app.router.add_route("*", "/bot{token}/{method}", self.handle)
        self.runner = web.AppRunner(app)
        await self.runner.setup()
        site = web.TCPSite(self.runner, "127.0.0.1", 0)
        await site.start()
        self.port = site._server.sockets[0].getsockname()[1]

    async def stop(self) -> None:
        if self.runner:
            await self.runner.cleanup()

    def calls_for(self, token: str, method: str):
        return [c for c in self.calls if c[0] == token and c[1] == method]

    async def handle(self, request: web.Request) -> web.Response:
        token = request.match_info["token"]
        method = request.match_info["method"]
        payload = await self._parse_payload(request)
        self.calls.append((token, method, payload))

        if method == "getMe":
            return web.json_response({"ok": True, "result": {
                "id": abs(hash(token)) % 900000000 + 1,
                "is_bot": True,
                "first_name": "MockBot",
                "username": "mock_" + token.split(":")[0],
                "can_join_groups": True, "can_read_all_group_messages": False,
                "supports_inline_queries": False,
            }})
        if method == "setWebhook":
            self.webhooks[token] = {
                "url": payload.get("url", ""),
                "secret_token": payload.get("secret_token", ""),
            }
            return web.json_response({"ok": True, "result": True, "description": "Webhook was set"})
        if method == "getWebhookInfo":
            info = self.webhooks.get(token, {})
            return web.json_response({"ok": True, "result": {"url": info.get("url", "")}})
        if method == "deleteWebhook":
            self.webhooks.pop(token, None)
            return web.json_response({"ok": True, "result": True, "description": "Webhook was deleted"})
        if method == "sendMessage":
            chat_id = payload.get("chat_id")
            try:
                chat_id = int(chat_id)
            except (TypeError, ValueError):
                pass
            text = payload.get("text", "")
            self.messages.append((token, chat_id, text))
            self._msg_id += 1
            return web.json_response({"ok": True, "result": {
                "message_id": self._msg_id,
                "from": {"id": 42, "is_bot": True, "first_name": "MockBot", "username": "mock_bot"},
                "date": 1700000000,
                "chat": {"id": chat_id, "type": "private", "first_name": "Tester"},
                "text": text,
            }})
        if method == "getUpdates":
            return web.json_response({"ok": True, "result": []})
        return web.json_response({"ok": True, "result": True})

    @staticmethod
    async def _parse_payload(request: web.Request) -> dict:
        """PTB sends form-encoded bodies; be liberal and accept JSON too."""
        try:
            data = await request.json()
            if isinstance(data, dict):
                return data
        except Exception:
            pass
        try:
            form = await request.post()
            return {k: v for k, v in form.items()}
        except Exception:
            return {}


async def start_bot(mock: MockTelegramAPI, server_port: int, log_path: str):
    env = os.environ.copy()
    env.update({
        "TELEGRAM_BOT_TOKEN": "",
        "RUN_MODE": "webhook",
        "PUBLIC_BASE_URL": PUBLIC_BASE,
        "TELEGRAM_API_BASE_URL": f"http://127.0.0.1:{mock.port}",
        "PORT": str(server_port),
        "SERVER_PORT": str(server_port),
        "WEBHOOK_SECRET": WEBHOOK_SECRET_ENV,
        "PYTHONIOENCODING": "utf-8",
    })
    log_file = open(log_path, "w", encoding="utf-8")
    proc = await asyncio.create_subprocess_exec(
        sys.executable, BOT_PATH,
        cwd=ROOT, env=env,
        stdout=log_file, stderr=asyncio.subprocess.STDOUT,
    )
    return proc, log_file


async def wait_for_health(base: str, timeout: float = 40.0) -> dict:
    async with aiohttp.ClientSession() as http:
        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            try:
                async with http.get(f"{base}/health", timeout=aiohttp.ClientTimeout(total=3)) as resp:
                    if resp.status == 200:
                        return await resp.json()
            except Exception:
                pass
            await asyncio.sleep(0.5)
    raise TimeoutError("bot.py /health did not come up in time")


async def post_json(base: str, path: str, payload: dict, headers: dict = None):
    async with aiohttp.ClientSession() as http:
        async with http.post(f"{base}{path}", json=payload, headers=headers or {},
                             timeout=aiohttp.ClientTimeout(total=15)) as resp:
            try:
                body = await resp.json()
            except Exception:
                body = {"raw": await resp.text()}
            return resp.status, body


def find_key(obj, key):
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            found = find_key(v, key)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = find_key(v, key)
            if found is not None:
                return found
    return None


async def wait_for_message(mock: MockTelegramAPI, token: str, chat_id: int, timeout: float = 90.0):
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        hits = [m for m in mock.messages if m[0] == token and m[1] == chat_id]
        if hits:
            return hits[-1]
        await asyncio.sleep(0.4)
    return None


def user_update(update_id: int, chat_id: int, text: str) -> dict:
    return {
        "update_id": update_id,
        "message": {
            "message_id": update_id,
            "from": {"id": chat_id, "is_bot": False, "first_name": "Tester", "username": "tester"},
            "chat": {"id": chat_id, "type": "private", "first_name": "Tester"},
            "date": 1700000000,
            "text": text,
        },
    }


async def run_verification() -> int:
    print("=" * 70)
    print("Telegram dynamic per-user webhook verification")
    print("=" * 70)

    if not os.path.exists(BOT_PATH):
        print(f"FAIL  bot.py not found at {BOT_PATH}")
        return 1

    mock = MockTelegramAPI()
    await mock.start()

    # Probe a free TCP port so parallel/previous harness runs cannot collide.
    import socket
    probe = socket.socket()
    probe.bind(("127.0.0.1", 0))
    server_port = probe.getsockname()[1]
    probe.close()

    log_path = os.path.join(tempfile.gettempdir(), "automotion_bot_harness.log")
    proc = log_file = None
    base = f"http://127.0.0.1:{server_port}"
    secret_header = "X-Telegram-Bot-Api-Secret-Token"

    try:
        proc, log_file = await start_bot(mock, server_port, log_path)
        health = await wait_for_health(base)
        check("bot.py boots and /health responds", isinstance(health, dict))
        check("health reports webhook session counter", find_key(health, "activeWebhookSessions") is not None)

        # -- Connect user bot A in webhook mode --------------------------------
        status, body = await post_json(base, "/api/telegram/connect", {"token": TOKEN_A})
        ok = check("connect(tokenA) -> 200 mode=webhook", status == 200 and body.get("mode") == "webhook", str(body))
        if not ok:
            print("--- bot log tail ---")
            print(open(log_path, encoding="utf-8", errors="replace").read()[-3000:])
            return summarize()

        wh_url = body.get("webhookUrl", "")
        expected_url = f"{PUBLIC_BASE}/webhook/{session_webhook_id(TOKEN_A)}"
        check("webhookUrl is dynamic HTTPS path", wh_url == expected_url, wh_url)

        registered = mock.webhooks.get(TOKEN_A, {})
        check("set_webhook registered with Telegram", registered.get("url") == expected_url, str(registered))
        check("per-session secret equals derived secret",
              registered.get("secret_token") == session_webhook_secret(TOKEN_A))

        # -- Deliver an update as Telegram would -------------------------------
        hdr = {secret_header: session_webhook_secret(TOKEN_A)}
        status, body = await post_json(base, f"/webhook/{session_webhook_id(TOKEN_A)}",
                                       user_update(1001, 4242, "Hello from user A"), hdr)
        check("update delivery accepted (200 ok)", status == 200 and body.get("ok") is True, str(body))

        msg = await wait_for_message(mock, TOKEN_A, 4242)
        check("bot A replied via its OWN token", msg is not None,
              "no sendMessage recorded for tokenA" if msg is None else str(msg[2])[:80])

        # -- Security checks ---------------------------------------------------
        status, _ = await post_json(base, f"/webhook/{session_webhook_id(TOKEN_A)}",
                                    user_update(1002, 4242, "no header"))
        check("missing secret header -> 403", status == 403, f"got {status}")
        status, _ = await post_json(base, f"/webhook/{session_webhook_id(TOKEN_A)}",
                                    user_update(1003, 4242, "bad header"),
                                    {secret_header: "wrong_secret"})
        check("wrong secret header -> 403", status == 403, f"got {status}")
        status, _ = await post_json(base, "/webhook/deadbeefdeadbeefdeadbeef",
                                    user_update(1004, 4242, "unknown route"), hdr)
        check("unknown session id -> 404", status == 404, f"got {status}")

        # -- Second user bot for isolation -------------------------------------
        status, body_b = await post_json(base, "/api/telegram/connect", {"token": TOKEN_B})
        check("connect(tokenB) -> 200 mode=webhook",
              status == 200 and body_b.get("mode") == "webhook", str(body_b))
        id_a, id_b = session_webhook_id(TOKEN_A), session_webhook_id(TOKEN_B)
        check("webhook ids differ per user", id_a != id_b)
        check("per-session secrets differ per user",
              session_webhook_secret(TOKEN_A) != session_webhook_secret(TOKEN_B))

        hdr_b = {secret_header: session_webhook_secret(TOKEN_B)}
        status, _ = await post_json(base, f"/webhook/{id_b}", user_update(2001, 5151, "Hello from user B"), hdr_b)
        check("update for bot B accepted", status == 200)
        msg_b = await wait_for_message(mock, TOKEN_B, 5151)
        check("bot B replied via its OWN token", msg_b is not None,
              "no sendMessage recorded for tokenB" if msg_b is None else str(msg_b[2])[:80])
        check("reply attribution isolated per user",
              msg_b is not None and not any(m[0] == TOKEN_A and m[1] == 5151 for m in mock.messages))

        # -- Idempotent reconnect ----------------------------------------------
        before = len(mock.calls_for(TOKEN_A, "setWebhook"))
        status, body = await post_json(base, "/api/telegram/connect", {"token": TOKEN_A})
        after = len(mock.calls_for(TOKEN_A, "setWebhook"))
        check("reconnect is idempotent (no duplicate set_webhook)",
              status == 200 and before == after == 1, f"{before}->{after}")

        # -- Disconnect cleanup -------------------------------------------------
        status, body = await post_json(base, "/api/telegram/disconnect", {"token": TOKEN_A})
        check("disconnect(tokenA) -> 200", status == 200, str(body))
        check("delete_webhook called on Telegram",
              len(mock.calls_for(TOKEN_A, "deleteWebhook")) >= 1)
        status, _ = await post_json(base, f"/webhook/{id_a}", user_update(1005, 4242, "after disconnect"), hdr)
        check("dynamic route removed after disconnect", status == 404, f"got {status}")
        status, _ = await post_json(base, f"/webhook/{id_b}", user_update(2002, 5151, "B still alive"), hdr_b)
        check("other user's webhook unaffected", status == 200)
    except Exception as err:
        check(f"harness error: {type(err).__name__}", False, str(err))
    finally:
        if proc and proc.returncode is None:
            try:
                proc.terminate()
                await asyncio.wait_for(proc.wait(), timeout=10)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
        if log_file:
            log_file.close()
        await mock.stop()
        if any(not ok for _, ok, _ in results):
            try:
                print("--- bot log tail ---")
                print(open(log_path, encoding="utf-8", errors="replace").read()[-3000:])
            except Exception:
                pass
    return summarize()


def summarize() -> int:
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print("-" * 70)
    print(f"RESULT: {passed}/{total} checks passed")
    for name, ok, detail in results:
        if not ok:
            print(f"  FAILED: {name} {detail}")
    print("=" * 70)
    return 0 if passed == total else 1


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(asyncio.run(run_verification()))
