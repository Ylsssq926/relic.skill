import io
import json
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from scripts.telegram_bot import TelegramBot, TelegramBotConfig, run_test_message


REPO_ROOT = Path(__file__).resolve().parents[1]
GRANDMA_RELIC = REPO_ROOT / "examples" / "grandma-demo"


class TelegramBotAdapterTest(unittest.TestCase):
    def make_bot(self, **config_overrides) -> TelegramBot:
        config_kwargs = {
            "dry_run": True,
            "relic_dir": str(GRANDMA_RELIC),
        }
        config_kwargs.update(config_overrides)
        return TelegramBot(TelegramBotConfig(**config_kwargs))

    def test_run_test_message_restores_msys_converted_help_command(self) -> None:
        bot = self.make_bot()
        output = io.StringIO()

        with patch.object(bot.engine, "handle_message") as handle_message, redirect_stdout(output):
            exit_code = run_test_message(bot, "C:/Program Files/Git/help")

        payload = json.loads(output.getvalue())
        self.assertEqual(exit_code, 0)
        self.assertEqual(payload["input"]["text"], "/help")
        self.assertIn("/start", payload["response_plan"]["messages"][0]["text"])
        handle_message.assert_not_called()

    def test_plan_command_restores_msys_converted_relic_command(self) -> None:
        bot = self.make_bot(multi_relic=True, relic_dir=str(REPO_ROOT / "examples"))
        incoming = bot._parse_message(
            {
                "message_id": 1,
                "date": 1700000000,
                "chat": {"id": 100, "type": "private"},
                "from": {"id": 200, "is_bot": False},
                "text": "C:/Program Files/Git/relic cat-mimi",
            }
        )
        self.assertIsNotNone(incoming)

        plan = bot._plan_command(incoming)  # type: ignore[arg-type]

        self.assertIsNotNone(plan)
        self.assertEqual(plan.relic_slug, "cat-mimi")
        self.assertEqual(bot._get_active_relic_slug("200", "100"), "cat-mimi")


if __name__ == "__main__":
    unittest.main()
