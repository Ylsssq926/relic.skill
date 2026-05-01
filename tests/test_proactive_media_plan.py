import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.relic_engine import EngineConfig, IncomingMessage, RelicEngine, RelicProfile, Session


class ProactiveMediaPlanTest(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = RelicEngine(EngineConfig())
        self.profile = RelicProfile(
            slug="mock-grandma",
            display_name="测试奶奶",
            kind="human",
            relic_dir=Path(__file__).resolve().parents[1],
            manifest={},
            personality_text="",
            interaction_text="",
            memory_text="",
            skill_text="",
        )
        self.msg = IncomingMessage(
            platform="unit-test",
            user_id="user-1",
            chat_id="chat-1",
            text="/proactive",
            message_id="msg-1",
            is_direct_chat=True,
            is_mentioned=True,
        )

    def _make_session(self) -> Session:
        return Session(user_id=self.msg.user_id, chat_id=self.msg.chat_id, relic_slug=self.profile.slug)

    def _make_payload(self, *, message: str, tts: dict | None = None, image: dict | None = None) -> dict:
        return {
            "should_trigger": True,
            "type": "random",
            "trigger": "unit-test",
            "reason": "unit-test",
            "message": message,
            "details": {},
            "warnings": [],
            "tts": tts or {},
            "image": image or {},
        }

    def _handle_with_payload(self, payload: dict):
        session = self._make_session()
        with patch.object(self.engine, "_run_proactive_scheduler", return_value=payload):
            plan = self.engine._handle_proactive_intent(
                msg=self.msg,
                profile=self.profile,
                session=session,
                proactive_type=None,
            )
        return plan, session

    def test_proactive_tts_enabled_produces_audio(self) -> None:
        payload = self._make_payload(
            message="这是一条备用文案",
            tts={
                "enabled": True,
                "text": "奶奶想你了",
                "provider": "minimax",
                "voice_id": "xxx",
            },
            image={"enabled": False},
        )

        plan, _ = self._handle_with_payload(payload)

        self.assertEqual(len(plan.messages), 1)
        audio_messages = [message for message in plan.messages if message.kind == "audio"]
        self.assertEqual(len(audio_messages), 1)
        self.assertEqual(audio_messages[0].text, "奶奶想你了")

    def test_proactive_tts_disabled_produces_text(self) -> None:
        payload = self._make_payload(
            message="奶奶来看看你今天过得怎么样。",
            tts={"enabled": False},
            image={"enabled": False},
        )

        plan, _ = self._handle_with_payload(payload)

        self.assertEqual(len(plan.messages), 1)
        self.assertEqual(plan.messages[0].kind, "text")

    def test_proactive_image_enabled_appends_image(self) -> None:
        payload = self._make_payload(
            message="奶奶今天又想起你了。",
            tts={"enabled": False},
            image={
                "enabled": True,
                "prompt": "奶奶在厨房做饭",
                "type": "cover",
            },
        )

        plan, _ = self._handle_with_payload(payload)

        self.assertEqual(len(plan.messages), 2)
        text_messages = [message for message in plan.messages if message.kind == "text"]
        image_messages = [message for message in plan.messages if message.kind == "image"]
        self.assertEqual(len(text_messages), 1)
        self.assertEqual(len(image_messages), 1)
        self.assertEqual(image_messages[0].metadata.get("image_prompt"), "奶奶在厨房做饭")

    def test_proactive_tts_and_image_both_enabled(self) -> None:
        payload = self._make_payload(
            message="这是一条备用文案",
            tts={
                "enabled": True,
                "text": "来吃饭啦",
                "provider": "minimax",
                "voice_id": "xxx",
            },
            image={
                "enabled": True,
                "prompt": "饭桌上的菜",
                "type": "cover",
            },
        )

        plan, _ = self._handle_with_payload(payload)

        self.assertEqual(len(plan.messages), 2)
        kinds = [message.kind for message in plan.messages]
        self.assertEqual(kinds.count("audio"), 1)
        self.assertEqual(kinds.count("image"), 1)


if __name__ == "__main__":
    unittest.main()
