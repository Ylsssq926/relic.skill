import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WRITER = ROOT / "scripts" / "relic_writer.py"
SCHEDULER = ROOT / "scripts" / "proactive_scheduler.py"


class ProactiveDefaultsSmokeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmpdir = Path(tempfile.mkdtemp(prefix="relic-v112-"))
        self.input_path = self.tmpdir / "input.json"
        self.output_root = self.tmpdir / "out"
        self.input_path.write_text(
            json.dumps(
                {
                    "subject_name": "测试奶奶",
                    "summary": "会提醒你吃饭的家人",
                    "template": "human",
                    "relationship": "奶奶",
                    "participants": ["我", "奶奶"],
                    "keywords": ["吃饭", "加班", "饺子"],
                    "recurring_phrases": ["哎", "饭吃了没有", "别瞎对付"],
                    "facts": ["爱发语音", "打字慢"],
                    "memories": [
                        {
                            "title": "包饺子",
                            "when": "每年春节",
                            "source": "家庭回忆",
                            "body": "她总会在厨房里一边包饺子一边念叨我别挑食。"
                        }
                    ]
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def run_cmd(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, *args],
            cwd=ROOT,
            text=True,
            capture_output=True,
            encoding="utf-8",
        )

    def generate_smoke_relic(self, slug: str = "smoke-grandma") -> Path:
        write_result = self.run_cmd(
            str(WRITER),
            "--data",
            str(self.input_path),
            "--template",
            "human",
            "--slug",
            slug,
            "--output-dir",
            str(self.output_root),
            "--force",
        )
        self.assertEqual(write_result.returncode, 0, write_result.stderr or write_result.stdout)
        return self.output_root / slug

    def test_writer_generates_default_proactive_config_and_scheduler_can_use_it(self) -> None:
        relic_dir = self.generate_smoke_relic()
        proactive_config = relic_dir / "proactive_config.json"
        self.assertTrue(proactive_config.is_file(), "writer 应自动生成 proactive_config.json")

        manifest = json.loads((relic_dir / "manifest.json").read_text(encoding="utf-8"))
        self.assertIn("proactive_config.json", manifest.get("files", []))

        scheduler_result = self.run_cmd(
            str(SCHEDULER),
            "--relic",
            str(relic_dir),
            "--dry-run",
        )
        self.assertEqual(scheduler_result.returncode, 0, scheduler_result.stderr or scheduler_result.stdout)

        payload = json.loads(scheduler_result.stdout)
        self.assertIn("dry_run", payload)
        self.assertTrue(payload["dry_run"])
        self.assertIn("message", payload)

    def test_scheduler_falls_back_to_inferred_default_when_config_is_missing(self) -> None:
        relic_dir = self.generate_smoke_relic("legacy-grandma")
        (relic_dir / "proactive_config.json").unlink()

        scheduler_result = self.run_cmd(
            str(SCHEDULER),
            "--relic",
            str(relic_dir),
            "--dry-run",
        )
        self.assertEqual(scheduler_result.returncode, 0, scheduler_result.stderr or scheduler_result.stdout)

        payload = json.loads(scheduler_result.stdout)
        self.assertEqual(payload.get("details", {}).get("config_source"), "inferred-default")
        self.assertTrue(payload.get("warnings"))



if __name__ == "__main__":
    unittest.main()
