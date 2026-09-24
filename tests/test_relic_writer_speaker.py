"""回归测试：relic_writer 必须分清"谁是被蒸馏对象"。

背景（2026-09-24 修复的 P0-2）：旧版 `infer_subject_name` 只按发言频率取人，
当整理者（"我"）说的话比被蒸馏对象更多时，会把"我"当成 Relic 主体，
于是整理者自己的话被写进被蒸馏对象的人格画像里。

这组测试把该行为钉死，防止以后再退化。
"""

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WRITER = ROOT / "scripts" / "relic_writer.py"

# 整理者（"我"）说的事，属于用户自己，绝不能被当成奶奶的特征
USER_ONLY_MARKERS = ("加班", "deadline", "开会", "出差", "报表", "周报")
USER_ONLY_MESSAGES = [
    "我今天要加班到很晚",
    "这个项目 deadline 快到了",
    "刚开完一个特别长的会",
    "下周要出差去上海",
    "这周的报表还没做完",
]
# 被蒸馏对象（奶奶）的原话，应该被抓出来
SUBJECT_MESSAGES = [
    "吃饭了没有",
    "别老在外面瞎对付",
]


def build_chat_log() -> dict:
    """构造一段"用户话更多"的聊天记录。

    故意不提供 subject_name / chat_name，强制走参与者推断路径。
    """
    messages = []
    for index, content in enumerate(USER_ONLY_MESSAGES):
        messages.append(
            {
                "sender_name": "我",
                "timestamp": 1700000000 + index * 60,
                "content": content,
            }
        )
    for index, content in enumerate(SUBJECT_MESSAGES):
        messages.append(
            {
                "sender_name": "奶奶",
                "timestamp": 1700000000 + 300 + index * 60,
                "content": content,
            }
        )
    return {"relationship": "奶奶", "messages": messages}


class SubjectSpeakerDetectionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmpdir = Path(tempfile.mkdtemp(prefix="relic-speaker-"))
        self.input_path = self.tmpdir / "chat.json"
        self.output_root = self.tmpdir / "out"
        self.input_path.write_text(
            json.dumps(build_chat_log(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def run_cmd(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, *args],
            cwd=ROOT,
            text=True,
            capture_output=True,
            encoding="utf-8",
        )

    def generate(self, slug: str, *extra: str) -> dict:
        result = self.run_cmd(
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
            *extra,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        manifest_path = self.output_root / slug / "manifest.json"
        self.assertTrue(manifest_path.is_file(), "writer 应生成 manifest.json")
        return json.loads(manifest_path.read_text(encoding="utf-8"))

    def test_user_speaking_more_does_not_hijack_subject(self) -> None:
        manifest = self.generate("speaker-grandma")

        # 1) 主体不能是"我"
        self.assertEqual(manifest["display_name"], "奶奶")
        self.assertEqual(manifest["subject"]["name"], "奶奶")

        # 2) 用户自己的话题不能进核心特征
        traits = [str(item) for item in manifest["identity"]["core_drives"]]
        self.assertTrue(traits, "core_drives 不应为空")
        for trait in traits:
            for marker in USER_ONLY_MARKERS:
                self.assertNotIn(
                    marker,
                    trait,
                    f"用户自己的话题 {marker!r} 泄漏进了 core_drives：{trait!r}",
                )

        # 3) 奶奶的原话应该被采纳
        joined = " ".join(traits)
        self.assertTrue(
            any(fragment in joined for fragment in ("吃饭了没有", "别老在外面瞎对付", "吃饭", "对付")),
            f"没有抓到被蒸馏对象的原话，core_drives={traits}",
        )

    def test_explicit_name_flag_still_wins(self) -> None:
        manifest = self.generate("speaker-override", "--name", "外婆")
        self.assertEqual(manifest["display_name"], "外婆")

    def test_self_only_chat_log_does_not_crash(self) -> None:
        """极端情况：整段记录只有"我"一个人说话，不能崩，也不能把"我"当主体。"""
        solo = {
            "relationship": "奶奶",
            "messages": [
                {"sender_name": "我", "timestamp": 1700000000 + i, "content": content}
                for i, content in enumerate(USER_ONLY_MESSAGES)
            ],
        }
        self.input_path.write_text(json.dumps(solo, ensure_ascii=False), encoding="utf-8")
        manifest = self.generate("speaker-solo")
        self.assertNotEqual(str(manifest["display_name"]).strip().lower(), "我")


if __name__ == "__main__":
    unittest.main()
