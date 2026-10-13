"""回归测试：Relic 骨架语言跟随素材语言。

背景：英文买家跑 relic_writer.py 时，此前会拿到「中文结构标签 + 英文素材」的
混合骨架（基本画像 / 四维画像 / 认知框架 等约 80 个标签串 + 25 个引导句模板），
直接使用（不走 agent 精修）的人看到的就是半成品。

现在骨架语言由 detect_output_language 推断（素材以拉丁文为主 → en），
也可用 --lang 显式覆盖。这组测试钉死两端行为，并确保中文路径没有回归。
"""

import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WRITER = ROOT / "scripts" / "relic_writer.py"

EN_DATA = {
    "subject_name": "Grandma Wang",
    "relationship": "grandmother",
    "summary": "the family member who reminds you to eat",
    "messages": [
        {"sender_name": "Me", "timestamp": 1700000000,
         "content": "Grandma, I worked until 11pm tonight again"},
        {"sender_name": "Grandma", "timestamp": 1700000060,
         "content": "Oh you child, so late again"},
        {"sender_name": "Grandma", "timestamp": 1700000120,
         "content": "Have you eaten? Eat something warm"},
        {"sender_name": "Grandma", "timestamp": 1700000200,
         "content": "Slow down, tell me when you get home"},
    ],
    "facts": ["always asks if you have eaten"],
    "memories": [
        {"title": "Making dumplings", "time": "every Spring Festival",
         "content": "She would make dumplings and nag me not to be picky."}
    ],
}

ZH_DATA = {
    "subject_name": "奶奶",
    "relationship": "奶奶",
    "summary": "会提醒你吃饭的家人",
    "messages": [
        {"sender_name": "我", "timestamp": 1700000000, "content": "奶奶，我今天加班到十一点"},
        {"sender_name": "奶奶", "timestamp": 1700000060, "content": "哎呀你这孩子，怎么又恁晚"},
        {"sender_name": "奶奶", "timestamp": 1700000120, "content": "吃饭了没有"},
    ],
    "facts": ["总会问你吃了没"],
}

GENERATED_FILES = ["SKILL.md", "personality.md", "interaction.md", "memory.md", "manifest.json"]


def cjk_count(text: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", text))


class WriterLanguageTest(unittest.TestCase):
    def _build(self, data, template="human", extra=None, slug="t"):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        data_path = Path(tmp.name) / "data.json"
        data_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        cmd = [sys.executable, str(WRITER), "--data", str(data_path),
               "--template", template, "--slug", slug,
               "--output-dir", str(Path(tmp.name) / "out")]
        if extra:
            cmd.extend(extra)
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        return proc, Path(tmp.name) / "out" / slug

    def test_english_material_produces_english_skeleton(self):
        proc, relic = self._build(EN_DATA)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        for name in GENERATED_FILES:
            text = (relic / name).read_text(encoding="utf-8")
            self.assertEqual(cjk_count(text), 0, f"{name} still contains Chinese in EN mode")

    def test_english_skeleton_uses_english_labels(self):
        proc, relic = self._build(EN_DATA)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        skill = (relic / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("## Role", skill)
        self.assertIn("not the real person", skill)
        personality = (relic / "personality.md").read_text(encoding="utf-8")
        self.assertIn("## Basic Profile", personality)
        self.assertIn("## Four Dimensions", personality)
        self.assertIn("[verbatim] quote:", personality)

    def test_chinese_material_still_produces_chinese_skeleton(self):
        proc, relic = self._build(ZH_DATA, slug="zh")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        personality = (relic / "personality.md").read_text(encoding="utf-8")
        self.assertIn("## 基本画像", personality)
        self.assertIn("## 四维画像", personality)
        self.assertIn("[verbatim] 原话：", personality)

    def test_explicit_lang_overrides_detection(self):
        # 英文素材 + 强制中文
        proc, relic = self._build(EN_DATA, extra=["--lang", "zh"], slug="forced-zh")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("## 基本画像", (relic / "personality.md").read_text(encoding="utf-8"))

        # 中文素材 + 强制英文
        proc, relic = self._build(ZH_DATA, extra=["--lang", "en"], slug="forced-en")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("## Basic Profile", (relic / "personality.md").read_text(encoding="utf-8"))

    def test_all_templates_generate_in_both_languages(self):
        templates = ["human", "pet", "relationship", "team-culture", "place",
                     "moment", "public-figure", "expert", "feishu-cli", "object"]
        for template in templates:
            with self.subTest(template=template, lang="en"):
                proc, relic = self._build(EN_DATA, template=template, slug=f"en-{template}")
                self.assertEqual(proc.returncode, 0, f"{template}/en: {proc.stderr}")
                self.assertTrue((relic / "personality.md").exists())
            with self.subTest(template=template, lang="zh"):
                proc, relic = self._build(ZH_DATA, template=template, slug=f"zh-{template}")
                self.assertEqual(proc.returncode, 0, f"{template}/zh: {proc.stderr}")
                self.assertTrue((relic / "personality.md").exists())

    def test_english_manifest_has_no_chinese(self):
        proc, relic = self._build(EN_DATA)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(cjk_count((relic / "manifest.json").read_text(encoding="utf-8")), 0)


class LanguageDetectionTest(unittest.TestCase):
    """检测逻辑本身：素材以拉丁文为主 → en。"""

    def _detect(self, data, override=None):
        sys.path.insert(0, str(ROOT / "scripts"))
        import importlib
        writer = importlib.import_module("relic_writer")
        return writer.detect_output_language(data, override)

    def test_detects_by_material_language(self):
        self.assertEqual(self._detect(EN_DATA), "en")
        self.assertEqual(self._detect(ZH_DATA), "zh")

    def test_override_wins(self):
        self.assertEqual(self._detect(ZH_DATA, "en"), "en")
        self.assertEqual(self._detect(EN_DATA, "zh"), "zh")

    def test_empty_material_defaults_to_chinese(self):
        self.assertEqual(self._detect({}), "zh")


if __name__ == "__main__":
    unittest.main()
