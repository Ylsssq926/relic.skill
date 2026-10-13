"""仓库完整性测试：确保 SKILL 作为"指令集"可被 agent 正确导航。

背景：relic.skill 的可执行性依赖 agent 按 SKILL.md 的指令去读对应文件。
一旦引用的文件被改名或删除，agent 会在运行时撞空——这类问题单测（针对脚本）
抓不到，必须有一层"把仓库当产物来验证"的测试。

覆盖五类：
  1. 四条工作流路径（体验示例 / 唤醒 / 聊天 / 保护）引用的文件都存在
  2. SKILL.md 模板表引用的模板都存在
  3. 所有 SKILL.md 的 frontmatter 可解析且含 name + description
  4. 文档里的相对路径引用（backtick 包裹的 .md/.py）全部可解析
  5. 买家关键路径文件的语言覆盖（英文主导，中文仅作人格语气示例保留）
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# 本地产物目录：不进发布包，也不参与引用完整性判断
SKIP_DIRS = {
    "node_modules", ".git", ".reference", ".versions", ".workbuddy",
    ".workbuddy-ai", "demo-site", "demo-api", ".claude", ".agent", "__pycache__",
}

# 四条工作流（对应 FOR_AI.md 的 Quick Routing）
WORKFLOW_FILES = {
    "demo": [
        "examples/grandma-demo/SKILL.md", "examples/grandma-demo/personality.md",
        "examples/grandma-demo/interaction.md", "examples/grandma-demo/memory.md",
        "soul-engine/SKILL.md", "soul-engine/interaction.md",
        "soul-engine/memory-system.md",
    ],
    "awaken": [
        "soul-shield/consent-protocol.md", "templates/human.md", "soul-forge/SKILL.md",
        "soul-forge/dimensions/cognition.md", "soul-forge/dimensions/expression.md",
        "soul-forge/dimensions/behavior.md", "soul-forge/dimensions/emotion.md",
        "soul-forge/collectors/chat-collector.md", "soul-forge/collectors/voice-collector.md",
        "soul-forge/collectors/photo-collector.md", "soul-forge/collectors/live-collector.md",
        "soul-forge/references/evidence-levels.md",
        "soul-forge/references/conflict-resolution.md",
    ],
    "chat": [
        "soul-engine/SKILL.md", "soul-engine/interaction.md",
        "soul-engine/memory-system.md", "soul-engine/proactive.md", "soul-engine/evolution.md",
    ],
    "shield": [
        "soul-shield/SKILL.md", "soul-shield/fingerprint.md",
        "soul-shield/consent-protocol.md", "soul-shield/ethics.md",
    ],
}

# 买家关键路径：这些文件必须以英文为主（中文作为人格语气示例是允许的）
BUYER_CRITICAL = [
    "SKILL.md", "FOR_AI.md",
    "soul-forge/SKILL.md", "soul-engine/SKILL.md", "soul-shield/SKILL.md",
    "templates/human.md", "templates/pet.md", "templates/relationship.md",
    "templates/team-culture.md", "templates/place.md", "templates/moment.md",
    "templates/public-figure.md", "templates/expert.md", "templates/object.md",
    "templates/feishu-cli.md", "templates/README.md",
    "docs/SETUP.md", "docs/PLATFORM-GUIDE.md", "docs/FAQ.md",
    "docs/PHILOSOPHY.md", "docs/ARCHITECTURE.md",
    "soul-shield/consent-protocol.md", "soul-shield/ethics.md",
    "soul-shield/fingerprint.md",
    "soul-engine/interaction.md", "soul-engine/memory-system.md",
    "soul-engine/proactive.md", "soul-engine/evolution.md",
    "soul-forge/dimensions/cognition.md", "soul-forge/dimensions/expression.md",
    "soul-forge/dimensions/behavior.md", "soul-forge/dimensions/emotion.md",
    "soul-forge/collectors/chat-collector.md", "soul-forge/collectors/voice-collector.md",
    "soul-forge/collectors/photo-collector.md", "soul-forge/collectors/live-collector.md",
    "soul-forge/references/evidence-levels.md",
    "soul-forge/references/conflict-resolution.md",
]

# 平台解析器（8 个）——必须随包发布
REQUIRED_PARSERS = [
    "scripts/telegram_parser.py", "scripts/discord_parser.py",
    "scripts/whatsapp_parser.py", "scripts/slack_parser.py",
    "scripts/instagram_parser.py", "scripts/email_parser.py",
    "scripts/imessage_parser.py",
    "scripts/wechat_parser.py", "scripts/qq_parser.py",
]


def iter_markdown():
    for path in ROOT.rglob("*.md"):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        yield path


class WorkflowNavigabilityTest(unittest.TestCase):
    """agent 按 SKILL.md 导航时，每一步读到的文件都必须存在。"""

    def test_all_four_workflows_resolve(self):
        missing = []
        for workflow, files in WORKFLOW_FILES.items():
            for rel in files:
                if not (ROOT / rel).exists():
                    missing.append(f"{workflow}: {rel}")
        self.assertEqual(missing, [], f"workflow files missing: {missing}")

    def test_platform_parsers_ship(self):
        missing = [p for p in REQUIRED_PARSERS if not (ROOT / p).exists()]
        self.assertEqual(missing, [], f"parsers missing: {missing}")


class TemplateReferenceTest(unittest.TestCase):
    """SKILL.md 模板表里写的每个模板都必须真实存在。"""

    def test_templates_referenced_by_skill_exist(self):
        skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        refs = sorted(set(re.findall(r"templates/([a-z-]+\.md)", skill)))
        self.assertTrue(refs, "SKILL.md references no templates — table broken?")
        missing = [r for r in refs if not (ROOT / "templates" / r).exists()]
        self.assertEqual(missing, [], f"referenced but missing: {missing}")

    def test_every_subject_type_has_a_template(self):
        """soul-forge 的对象表承诺的类型，都要有同名模板落地。"""
        expected = {"human", "pet", "relationship", "team-culture", "place",
                    "moment", "public-figure", "expert", "object"}
        present = {p.stem for p in (ROOT / "templates").glob("*.md")}
        missing = expected - present
        self.assertEqual(missing, set(), f"subject types without a template: {missing}")


class FrontmatterTest(unittest.TestCase):
    """每个 SKILL.md 都要有可解析的 frontmatter（agent 依赖它做路由）。"""

    def test_skill_frontmatter_has_name_and_description(self):
        broken = []
        for path in ROOT.rglob("SKILL.md"):
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            head = path.read_text(encoding="utf-8")[:4000]
            match = re.match(r"^---\n(.*?)\n---\n", head, re.S)
            rel = path.relative_to(ROOT).as_posix()
            if not match:
                broken.append(f"{rel}: no frontmatter")
            elif "name:" not in match.group(1) or "description:" not in match.group(1):
                broken.append(f"{rel}: missing name/description")
        self.assertEqual(broken, [], f"frontmatter problems: {broken}")


class DocReferenceTest(unittest.TestCase):
    """文档中 backtick 包裹的相对路径引用都必须可解析（防止改名后留下死引用）。"""

    PATTERN = re.compile(
        r"`((?:soul-forge|soul-engine|soul-shield|templates|examples|docs|scripts|tests)/"
        r"[A-Za-z0-9_./-]+\.(?:md|py))`"
    )

    def test_no_dangling_path_references(self):
        broken = []
        for path in iter_markdown():
            text = path.read_text(encoding="utf-8", errors="replace")
            for ref in self.PATTERN.findall(text):
                if not (ROOT / ref).exists():
                    broken.append(f"{path.relative_to(ROOT).as_posix()} -> {ref}")
        self.assertEqual(broken, [], f"dangling references: {broken[:10]}")


class LanguageCoverageTest(unittest.TestCase):
    """买家关键路径必须英文主导；中文人格语气示例作为内容资产保留。"""

    MIN_EN_RATIO = 0.45

    def test_buyer_critical_files_are_english_dominant(self):
        weak = []
        for rel in BUYER_CRITICAL:
            path = ROOT / rel
            self.assertTrue(path.exists(), f"buyer-critical file missing: {rel}")
            body = re.sub(r"^---.*?---\n", "", path.read_text(encoding="utf-8"), flags=re.S)
            cjk = len(re.findall(r"[\u4e00-\u9fff]", body))
            latin = len(re.findall(r"[A-Za-z]", body))
            ratio = latin / (latin + cjk) if (latin + cjk) else 0
            if ratio < self.MIN_EN_RATIO:
                weak.append(f"{rel} (en ratio {ratio:.2f})")
        self.assertEqual(weak, [], f"not English-dominant: {weak}")


if __name__ == "__main__":
    unittest.main()
