import hashlib
import io
import json
import time
import unittest
import urllib.request
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from scripts.feishu_bot import BotConfig, FeishuAPIError, RelicBot, RequestValidationError, create_app, run_test_message
from scripts.relic_engine import OutgoingMessage, ResponsePlan


REPO_ROOT = Path(__file__).resolve().parents[1]
GRANDMA_RELIC = REPO_ROOT / "examples" / "grandma-demo"


class NoMediaService:
    tts = None
    image = None
    has_tts = False
    has_image = False


class DummyHTTPResponse:
    def __init__(self, payload: str):
        self.payload = payload.encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:
        return None

    def read(self) -> bytes:
        return self.payload


class FeishuBotAdapterTest(unittest.TestCase):
    def make_bot(self, **config_overrides) -> RelicBot:
        config_kwargs = {
            "feishu_app_id": "app-id",
            "feishu_app_secret": "app-secret",
            "feishu_verification_token": "verify-token",
            "feishu_signing_secret": "signing-secret",
            "dry_run": True,
            "relic_dir": str(GRANDMA_RELIC),
        }
        config_kwargs.update(config_overrides)
        config = BotConfig(**config_kwargs)
        return RelicBot(config.relic_dir or str(GRANDMA_RELIC), config)

    def make_signature(self, *, body: bytes, timestamp: str = "1700000000", nonce: str = "nonce") -> str:
        content = timestamp + nonce + "signing-secret" + body.decode("utf-8")
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def make_message_event(
        self,
        *,
        message_id: str,
        text: str,
        chat_id: str = "chat-id",
        user_id: str = "user-open-id",
        chat_type: str = "p2p",
    ) -> dict:
        return {
            "header": {"event_type": "im.message.receive_v1"},
            "event": {
                "sender": {"sender_type": "user", "sender_id": {"open_id": user_id}},
                "message": {
                    "message_id": message_id,
                    "chat_id": chat_id,
                    "chat_type": chat_type,
                    "message_type": "text",
                    "content": json.dumps({"text": text}, ensure_ascii=False),
                },
            },
        }

    def test_validate_request_accepts_valid_token_and_signature(self) -> None:
        bot = self.make_bot()
        body = json.dumps({"token": "verify-token", "event": {}}, ensure_ascii=False).encode("utf-8")
        timestamp = str(int(time.time()))
        signature = self.make_signature(body=body, timestamp=timestamp)

        bot.validate_request(
            raw_body=body,
            payload={"token": "verify-token", "event": {}},
            timestamp=timestamp,
            nonce="nonce",
            signature=signature,
        )

    def test_validate_request_rejects_invalid_signature(self) -> None:
        bot = self.make_bot()
        body = b'{"token":"verify-token"}'

        with self.assertRaises(RequestValidationError):
            bot.validate_request(
                raw_body=body,
                payload={"token": "verify-token"},
                timestamp=str(int(time.time())),
                nonce="nonce",
                signature="bad-signature",
            )

    def test_validate_request_rejects_mismatched_header_token(self) -> None:
        bot = self.make_bot()
        payload = {"header": {"token": "wrong-token"}, "event": {}}
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        timestamp = str(int(time.time()))
        signature = self.make_signature(body=body, timestamp=timestamp)

        with self.assertRaises(RequestValidationError):
            bot.validate_request(
                raw_body=body,
                payload=payload,
                timestamp=timestamp,
                nonce="nonce",
                signature=signature,
            )

    def test_handle_webhook_returns_url_verification_challenge(self) -> None:
        bot = self.make_bot()

        result = bot.handle_webhook({"type": "url_verification", "challenge": "challenge-token"})

        self.assertEqual(result, {"challenge": "challenge-token"})

    def test_extract_plain_text_from_post_message(self) -> None:
        bot = self.make_bot()
        content = {
            "post": {
                "zh_cn": {
                    "title": "周报",
                    "content": [
                        [{"tag": "text", "text": "第一行"}],
                        [{"tag": "a", "text": "链接", "href": "https://example.com"}],
                        [{"tag": "text", "text": "第二行"}],
                    ],
                }
            }
        }

        text = bot._extract_plain_text("post", content)

        self.assertEqual(text, "周报\n第一行\n第二行")

    def test_group_chat_without_mention_is_ignored_and_marked_processed(self) -> None:
        bot = self.make_bot(bot_open_id="bot-open-id")
        event = {
            "header": {"event_type": "im.message.receive_v1"},
            "event": {
                "sender": {"sender_type": "user", "sender_id": {"open_id": "user-open-id"}},
                "message": {
                    "message_id": "msg-ignored",
                    "chat_id": "chat-id",
                    "chat_type": "group",
                    "message_type": "text",
                    "content": json.dumps({"text": "普通群聊消息"}, ensure_ascii=False),
                    "mentions": [],
                },
            },
        }

        with patch.object(bot.engine, "handle_message") as handle_message:
            result = bot.handle_webhook(event)

        self.assertEqual(result["reason"], "not_mentioned_in_group")
        self.assertTrue(bot._is_duplicate_message("msg-ignored"))
        handle_message.assert_not_called()

    def test_duplicate_message_is_ignored_before_engine_call(self) -> None:
        bot = self.make_bot()
        bot._mark_message_processed("msg-dup")
        event = {
            "header": {"event_type": "im.message.receive_v1"},
            "event": {
                "sender": {"sender_type": "user", "sender_id": {"open_id": "user-open-id"}},
                "message": {
                    "message_id": "msg-dup",
                    "chat_id": "chat-id",
                    "chat_type": "p2p",
                    "message_type": "text",
                    "content": json.dumps({"text": "你好"}, ensure_ascii=False),
                },
            },
        }

        with patch.object(bot.engine, "handle_message") as handle_message:
            result = bot.handle_webhook(event)

        self.assertEqual(result["reason"], "duplicate_message")
        handle_message.assert_not_called()

    def test_multi_relic_list_command_sends_available_relics(self) -> None:
        bot = self.make_bot(multi_relic=True, relic_dir=str(REPO_ROOT / "examples"))
        event = {
            "header": {"event_type": "im.message.receive_v1"},
            "event": {
                "sender": {"sender_type": "user", "sender_id": {"open_id": "user-open-id"}},
                "message": {
                    "message_id": "msg-list",
                    "chat_id": "chat-id",
                    "chat_type": "p2p",
                    "message_type": "text",
                    "content": json.dumps({"text": "/relics"}, ensure_ascii=False),
                },
            },
        }

        with patch.object(bot.engine, "handle_message") as handle_message:
            result = bot.handle_webhook(event)

        self.assertEqual(result["intent"], "list_relics")
        handle_message.assert_not_called()
        self.assertTrue(bot._is_duplicate_message("msg-list"))

    def test_multi_relic_switch_command_updates_chat_scoped_active_relic(self) -> None:
        bot = self.make_bot(multi_relic=True, relic_dir=str(REPO_ROOT / "examples"))
        event = {
            "header": {"event_type": "im.message.receive_v1"},
            "event": {
                "sender": {"sender_type": "user", "sender_id": {"open_id": "user-open-id"}},
                "message": {
                    "message_id": "msg-switch",
                    "chat_id": "chat-id",
                    "chat_type": "p2p",
                    "message_type": "text",
                    "content": json.dumps({"text": "/relic cat-mimi"}, ensure_ascii=False),
                },
            },
        }

        result = bot.handle_webhook(event)

        self.assertTrue(result["handled"])
        self.assertEqual(result["relic_slug"], "cat-mimi")
        self.assertEqual(bot.get_active_relic_slug("user-open-id", chat_id="chat-id"), "cat-mimi")

    def test_detect_intent_restores_msys_converted_slash_command(self) -> None:
        bot = self.make_bot()

        intent = bot.detect_intent("C:/Program Files/Git/status")

        self.assertEqual(intent["type"], "status")
        self.assertEqual(intent["clean_text"], "/status")

    def test_detect_intent_restores_msys_converted_relic_switch_command(self) -> None:
        bot = self.make_bot(multi_relic=True, relic_dir=str(REPO_ROOT / "examples"))

        intent = bot.detect_intent("C:/Program Files/Git/relic cat-mimi")

        self.assertEqual(intent["type"], "switch_relic")
        self.assertEqual(intent["relic_slug"], "cat-mimi")

    def test_status_command_reports_current_relic(self) -> None:
        bot = self.make_bot()
        event = self.make_message_event(message_id="msg-status", text="/status")

        result = bot.handle_webhook(event)

        self.assertEqual(result["intent"], "status")
        self.assertTrue(result["handled"])

    def test_reset_command_clears_current_session(self) -> None:
        bot = self.make_bot()
        active_slug = bot.default_relic_slug or "grandma-wang"
        session = bot.get_session("user-open-id", "chat-id", active_slug)
        session.messages.append({"role": "user", "content": "之前的上下文"})
        event = self.make_message_event(message_id="msg-reset", text="/reset")

        result = bot.handle_webhook(event)
        reset_session = bot.get_session("user-open-id", "chat-id", active_slug)

        self.assertEqual(result["intent"], "reset")
        self.assertTrue(result["handled"])
        self.assertEqual(reset_session.messages, [])
        self.assertTrue(reset_session.is_first_turn)

    def test_pause_command_pauses_normal_chat_until_resume(self) -> None:
        bot = self.make_bot()

        pause_result = bot.handle_webhook(self.make_message_event(message_id="msg-pause", text="/pause"))
        with patch.object(bot.engine, "handle_message") as handle_message:
            paused_chat_result = bot.handle_webhook(self.make_message_event(message_id="msg-paused-chat", text="你好"))
        resume_result = bot.handle_webhook(self.make_message_event(message_id="msg-resume", text="/resume"))

        self.assertEqual(pause_result["intent"], "pause")
        self.assertEqual(paused_chat_result["reason"], "paused")
        handle_message.assert_not_called()
        self.assertEqual(resume_result["intent"], "resume")

    def test_run_test_message_handles_status_command_without_engine_call(self) -> None:
        bot = self.make_bot()
        output = io.StringIO()

        with patch.object(bot.engine, "handle_message") as handle_message, redirect_stdout(output):
            exit_code = run_test_message(bot, "C:/Program Files/Git/status")

        payload = json.loads(output.getvalue())
        self.assertEqual(exit_code, 0)
        self.assertEqual(payload["input"], "/status")
        self.assertEqual(payload["intent"], "status")
        self.assertIn("当前 Relic", payload["reply"])
        handle_message.assert_not_called()

    def test_dry_run_send_text_message_returns_feishu_payload(self) -> None:
        bot = self.make_bot()

        result = bot.send_text_message(chat_id="chat-id", text="你好")

        self.assertTrue(result["dry_run"])
        self.assertEqual(result["payload"]["receive_id"], "chat-id")
        self.assertEqual(result["payload"]["msg_type"], "text")
        self.assertEqual(json.loads(result["payload"]["content"]), {"text": "你好"})

    def test_get_tenant_access_token_uses_cached_token(self) -> None:
        bot = self.make_bot(dry_run=False)

        with patch.object(
            bot,
            "_execute_json_request",
            return_value={"code": 0, "tenant_access_token": "tenant-token", "expire": 7200},
        ) as execute_json:
            first = bot._get_tenant_access_token()
            second = bot._get_tenant_access_token()

        self.assertEqual(first, "tenant-token")
        self.assertEqual(second, "tenant-token")
        self.assertEqual(execute_json.call_count, 1)

    def test_execute_json_request_rejects_feishu_api_error_code(self) -> None:
        bot = self.make_bot(dry_run=False)
        request_obj = urllib.request.Request(url="https://open.feishu.test/api", method="POST")

        with patch("scripts.feishu_bot.urllib.request.urlopen", return_value=DummyHTTPResponse('{"code": 999, "msg": "bad"}')):
            with self.assertRaises(FeishuAPIError) as ctx:
                bot._execute_json_request(request_obj, error_prefix="测试接口失败")

        self.assertIn("测试接口失败", str(ctx.exception))
        self.assertIn("999", str(ctx.exception))

    def test_execute_json_request_rejects_non_json_response(self) -> None:
        bot = self.make_bot(dry_run=False)
        request_obj = urllib.request.Request(url="https://open.feishu.test/api", method="POST")

        with patch("scripts.feishu_bot.urllib.request.urlopen", return_value=DummyHTTPResponse("not-json")):
            with self.assertRaises(FeishuAPIError) as ctx:
                bot._execute_json_request(request_obj, error_prefix="测试接口失败")

        self.assertIn("非 JSON", str(ctx.exception))

    def test_encode_multipart_formdata_contains_fields_and_file(self) -> None:
        bot = self.make_bot()

        body, content_type = bot._encode_multipart_formdata(
            fields={"file_type": "mp3", "file_name": "voice.mp3"},
            files=[("file", "voice.mp3", b"audio-bytes", "audio/mpeg")],
        )

        self.assertIn("multipart/form-data; boundary=", content_type)
        self.assertIn(b'name="file_type"', body)
        self.assertIn(b"mp3", body)
        self.assertIn(b'name="file"; filename="voice.mp3"', body)
        self.assertIn(b"Content-Type: audio/mpeg", body)
        self.assertIn(b"audio-bytes", body)

    def test_create_app_healthz_returns_bot_status(self) -> None:
        bot = self.make_bot()
        app = create_app(bot)

        response = app.test_client().get("/healthz")

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["ok"])
        self.assertEqual(data["default_relic"], bot.default_relic_slug)

    def test_create_app_webhook_rejects_invalid_json(self) -> None:
        bot = self.make_bot()
        app = create_app(bot)

        response = app.test_client().post("/webhook", data=b"not-json", content_type="application/json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["msg"], "invalid json")

    def test_create_app_webhook_returns_bot_response(self) -> None:
        bot = self.make_bot()
        app = create_app(bot)

        with patch.object(bot, "validate_request") as validate_request, patch.object(
            bot, "handle_webhook", return_value={"status": "success", "handled": True}
        ) as handle_webhook:
            response = app.test_client().post(
                "/webhook",
                data=json.dumps({"header": {"event_type": "im.message.receive_v1"}}).encode("utf-8"),
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"handled": True, "status": "success"})
        validate_request.assert_called_once()
        handle_webhook.assert_called_once()

    def test_dry_run_upload_audio_does_not_require_existing_file(self) -> None:
        bot = self.make_bot()

        file_key = bot.upload_audio(str(REPO_ROOT / "missing-output" / "voice.mp3"))

        self.assertEqual(file_key, "dry-run-file-voice")

    def test_dry_run_upload_image_does_not_require_existing_file(self) -> None:
        bot = self.make_bot()

        image_key = bot.upload_image(str(REPO_ROOT / "missing-output" / "cover.jpg"))

        self.assertEqual(image_key, "dry-run-image-cover")

    def test_audio_plan_without_media_falls_back_to_text(self) -> None:
        bot = self.make_bot()
        plan = ResponsePlan(
            messages=[OutgoingMessage(kind="audio", text="这段语音先用文字发")],
            mode="daily",
            relic_slug=bot.default_relic_slug or "grandma-wang",
        )

        with patch("scripts.feishu_bot.MediaService.from_relic", return_value=NoMediaService()):
            results = bot._execute_response_plan(plan=plan, chat_id="chat-id", relic_dir=str(GRANDMA_RELIC))

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["payload"]["msg_type"], "text")
        self.assertEqual(json.loads(results[0]["payload"]["content"]), {"text": "这段语音先用文字发"})

    def test_image_plan_with_image_key_sends_image_message(self) -> None:
        bot = self.make_bot()
        plan = ResponsePlan(
            messages=[OutgoingMessage(kind="image", metadata={"image_key": "img-key"})],
            mode="daily",
            relic_slug=bot.default_relic_slug or "grandma-wang",
        )

        results = bot._execute_response_plan(plan=plan, chat_id="chat-id", relic_dir=str(GRANDMA_RELIC))

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["payload"]["msg_type"], "image")
        self.assertEqual(json.loads(results[0]["payload"]["content"]), {"image_key": "img-key"})


if __name__ == "__main__":
    unittest.main()
