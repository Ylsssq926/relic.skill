#!/usr/bin/env python3
"""Release packager for relic.skill — builds the Agensi/GitHub zip from an
explicit whitelist, strips runtime state, and asserts the result.

Design goals:
  1. Explicit inclusion — nothing enters the zip unless it is listed.
  2. Hygiene — runtime state, caches, and dev-only assets are stripped.
  3. Verification — required files must exist; forbidden patterns must not.
  4. Reproducible — same repo state always yields the same file set.

Usage:
  python3 tools/package_release.py              # build + verify
  python3 tools/package_release.py --verify-only # verify existing relic.zip
  python3 tools/package_release.py --list        # print manifest, don't build
"""
from __future__ import annotations

import argparse
import fnmatch
import os
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# 默认产物就是**要上传到平台的包**（含商业增值），文件名保持 relic.zip ——
# 买家在平台下载时看到的就是这个名字，最不容易拿错。
OUT_ZIP = ROOT / "relic.zip"
# 公开框架版（不含 COMMERCIAL-PACK）：只在需要发布 GitHub Release 时生成。
OUT_ZIP_PUBLIC = ROOT / "relic-public.zip"

# 商业增值包：只在 commercial 版里出现（.gitignore 已排除，公开仓库不含）。
COMMERCIAL_DIR = "COMMERCIAL-PACK"
COMMERCIAL_FILES = [
    f"{COMMERCIAL_DIR}/README.md",
    f"{COMMERCIAL_DIR}/support.md",
    f"{COMMERCIAL_DIR}/recipes/enterprise-knowledge-transfer.md",
    f"{COMMERCIAL_DIR}/recipes/family-legacy.md",
    f"{COMMERCIAL_DIR}/recipes/creator-persona.md",
    f"{COMMERCIAL_DIR}/deploy/production-notes.md",
]
STAGE = Path(os.environ.get("TEMP", "/tmp")) / "relic-package-stage"

# ---------------------------------------------------------------- whitelist
FILES = [
    "SKILL.md", "FOR_AI.md", "README.md", "README_EN.md",
    # 语言切换器链接了这 8 个文件 —— 不打包进 zip 会让买家点到 404。
    "README_DE.md", "README_ES.md", "README_FR.md", "README_JA.md",
    "README_KO.md", "README_PT.md", "README_RU.md", "README_TW.md",
    "CHANGELOG.md", "LICENSE", "COMMERCIAL-LICENSE.md",
    "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "requirements.txt",
    # assets are whitelisted individually: only the SVGs are referenced by
    # shipped docs (README.md / README_EN.md use assets/banner.svg).
    # The repo also carries demo-site social cards (*.png) and Agensi listing
    # covers (relic-cover*.jpg, relic-banner.jpg) — those stay in git, they do
    # not ship inside the skill.
    "assets/banner.svg", "assets/logo.svg",
    "assets/architecture.svg", "assets/soul-dimensions.svg",
]
DIRS = ["soul-forge", "soul-engine", "soul-shield", "templates",
        "examples", "docs", "scripts", "tests"]

# ------------------------------------------------------------- exclusion
EXCLUDE_DIRS = {"__pycache__", "node_modules", ".git", ".venv", "venv",
                "exes", ".versions", "relic-data", "voice_samples",
                ".pytest_cache", ".claude", ".agent", ".reference"}
EXCLUDE_FILES = {
    ".proactive_state.json", ".DS_Store", "Thumbs.db", "desktop.ini",
    ".env", ".env.deploy", "relic.zip", "package.json", "package-lock.json",
}
# demo-site marketing assets: only light ones ship in the zip
EXCLUDE_GLOBS = [
    "**/*.pyc", "**/*.bak", "**/*.log",
]

# ------------------------------------------------------------ verification
REQUIRED = [
    "relic/SKILL.md", "relic/requirements.txt", "relic/LICENSE",
    "relic/README.md", "relic/README_EN.md", "relic/COMMERCIAL-LICENSE.md",
    "relic/FOR_AI.md", "relic/CHANGELOG.md",
    "relic/soul-forge/SKILL.md", "relic/soul-engine/SKILL.md",
    "relic/soul-shield/SKILL.md",
    "relic/templates/human.md", "relic/templates/pet.md",
    "relic/templates/object.md", "relic/templates/relationship.md",
    "relic/templates/team-culture.md", "relic/templates/place.md",
    "relic/templates/moment.md", "relic/templates/public-figure.md",
    "relic/templates/expert.md", "relic/templates/feishu-cli.md",
    "relic/scripts/relic_writer.py", "relic/scripts/wechat_parser.py",
    "relic/scripts/telegram_parser.py", "relic/scripts/qq_parser.py",
    "relic/scripts/discord_parser.py", "relic/scripts/slack_parser.py",
    "relic/scripts/whatsapp_parser.py", "relic/scripts/instagram_parser.py",
    "relic/scripts/email_parser.py", "relic/scripts/imessage_parser.py",
    "relic/scripts/lark_parser.py", "relic/scripts/photo_analyzer.py",
    "relic/scripts/quality_checker.py", "relic/scripts/version_manager.py",
    "relic/scripts/proactive_scheduler.py", "relic/scripts/tts_service.py",
    "relic/scripts/image_service.py", "relic/scripts/media_service.py",
    "relic/scripts/relic_engine.py",
    "relic/scripts/telegram_bot.py", "relic/scripts/feishu_bot.py",
    "relic/scripts/lark_expert_forge.py", "relic/scripts/manifest_schema.py",
    "relic/docs/SETUP.md", "relic/docs/PLATFORM-GUIDE.md",
    "relic/docs/FAQ.md", "relic/docs/PHILOSOPHY.md",
    "relic/docs/ARCHITECTURE.md", "relic/docs/RESEARCH.md",
    "relic/docs/TOOLS.md", "relic/docs/SALES-CHANNELS.md",
    "relic/examples/README.md",
    "relic/examples/grandma-demo/SKILL.md",
    "relic/examples/cat-mimi-demo/SKILL.md",
    "relic/examples/team-startup-demo/SKILL.md",
    "relic/examples/old-camera-demo/SKILL.md",
    "relic/examples/dad-and-me-demo/SKILL.md",
    "relic/examples/kitchen-demo/SKILL.md",
    "relic/examples/proposal-demo/SKILL.md",
    "relic/examples/tech-lead-demo/SKILL.md",
]

# 目录级计数断言：白名单是"递归全收"，光靠 REQUIRED 逐条列举容易漏。
# 数量对不上就说明有人加了文件却忘了更新断言（或反之）。
EXPECTED_COUNTS = {
    "relic/templates/": (10, ".md"),      # 10 个模板（不含 README）
    "relic/examples/": (8, "/SKILL.md"),  # 8 个示例目录
    "relic/scripts/": (10, "_parser.py"),  # 10 个平台解析器
}

# 内容级禁入：这些模式出现在**文件内容**里就意味着打包前卫生没做干净。
# 文件名检查挡不住它们——本机路径和 token 是写在正文里的。
FORBIDDEN_CONTENT_PATTERNS = [
    (r"C:\\+Users\\+[A-Za-z]", "本机 Windows 用户路径"),
    (r"[A-Z]:\\+Azure[ _]Glance", "本机工作区路径"),
    (r"\.workbuddy-ai/", "内部工具目录引用"),
    (r"\bsk-[A-Za-z0-9]{20,}", "疑似 OpenAI 风格密钥"),
    (r"\bgh[pousr]_[A-Za-z0-9]{20,}", "疑似 GitHub token"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "私钥"),
    (r"\b(?:10|172|192)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b", "内网地址"),
]

# 只扫描文本类文件，二进制跳过
TEXT_SUFFIXES = {".md", ".py", ".json", ".txt", ".yml", ".yaml", ".svg", ".csv", ""}
FORBIDDEN_SUBSTRINGS = [
    "proactive_state", "__pycache__", "demo-site", "demo-api",
    ".claude/", ".agent/", ".reference/", "node_modules",
    ".env", "relic-1024", "relic.zip", "deploy-demo",
]


def excluded(rel_posix: str, is_dir: bool) -> bool:
    if is_dir:
        return Path(rel_posix).name in EXCLUDE_DIRS
    if Path(rel_posix).name in EXCLUDE_FILES:
        return True
    return any(fnmatch.fnmatch(rel_posix, g) or fnmatch.fnmatch(rel_posix, "*/" + g)
               for g in EXCLUDE_GLOBS)


def collect(edition: str = "public") -> list[tuple[Path, str]]:
    """Return [(source_path, path_inside_zip)] honoring the whitelist.

    edition="commercial" additionally ships COMMERCIAL-PACK/ (paid extras).
    """
    items: list[tuple[Path, str]] = []
    for name in FILES:
        p = ROOT / name
        if not p.exists():
            sys.exit(f"[FAIL] required top-level file missing from repo: {name}")
        items.append((p, f"relic/{name}"))
    for d in DIRS:
        base = ROOT / d
        if not base.is_dir():
            sys.exit(f"[FAIL] required directory missing from repo: {d}/")
        for dirpath, dirnames, filenames in os.walk(base):
            rel_dir = Path(dirpath).relative_to(ROOT)
            dirnames[:] = [x for x in dirnames
                           if not excluded((rel_dir / x).as_posix(), True)]
            for fn in sorted(filenames):
                rel = (rel_dir / fn).as_posix()
                if not excluded(rel, False):
                    items.append((Path(dirpath) / fn, f"relic/{rel}"))
    if edition == "commercial":
        for rel in COMMERCIAL_FILES:
            src = ROOT / rel
            if not src.exists():
                sys.exit(f"[FAIL] commercial edition requires missing file: {rel}")
            items.append((src, f"relic/{rel}"))

    return items


def build(edition: str = "public") -> Path:
    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir(parents=True)
    items = collect(edition)
    for src, arc in items:
        dst = STAGE / arc
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    out_zip = OUT_ZIP if edition == "commercial" else OUT_ZIP_PUBLIC
    if out_zip.exists():
        out_zip.unlink()
    with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for _, arc in sorted(items, key=lambda x: x[1]):
            z.write(STAGE / arc, arc)
    shutil.rmtree(STAGE)
    return out_zip


def verify(zip_path: Path, edition: str = "public") -> int:
    failures = []
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        nameset = set(names)
        for req in REQUIRED:
            if req not in nameset:
                failures.append(f"missing required entry: {req}")

        # 目录级计数
        for prefix, (expected, marker) in EXPECTED_COUNTS.items():
            found = [n for n in names
                     if n.startswith(prefix) and n.endswith(marker) and n != prefix + "README.md"]
            if len(found) != expected:
                failures.append(
                    f"{prefix} expected {expected} entries matching {marker!r}, "
                    f"found {len(found)}")

        # 版本一致性：商业包必须在 commercial 版里、在 public 版里绝迹
        has_pack = any(COMMERCIAL_DIR + "/" in n for n in names)
        if edition == "commercial" and not has_pack:
            failures.append(f"commercial edition is missing {COMMERCIAL_DIR}/")
        if edition == "public" and has_pack:
            failures.append(f"public edition must not ship {COMMERCIAL_DIR}/")

        # 条目名禁入
        for n in names:
            for bad in FORBIDDEN_SUBSTRINGS:
                if bad in n:
                    failures.append(f"forbidden entry in zip: {n} ({bad})")

        # 内容级禁入（本机路径、密钥、内网地址）
        content_hits = []
        for info in z.infolist():
            suffix = Path(info.filename).suffix.lower()
            if suffix not in TEXT_SUFFIXES:
                continue
            try:
                text = z.read(info.filename).decode("utf-8", errors="ignore")
            except Exception:
                continue
            for pattern, label in FORBIDDEN_CONTENT_PATTERNS:
                if re.search(pattern, text):
                    content_hits.append(f"{info.filename}: {label}")
        for hit in sorted(set(content_hits)):
            failures.append(f"forbidden content: {hit}")

        sizes = sorted(((i.file_size, i.filename) for i in z.infolist()),
                       reverse=True)
        print(f"[verify] entries={len(names)}  "
              f"uncompressed={sum(s for s, _ in sizes)/1024:.0f}KB  "
              f"zip={zip_path.stat().st_size/1024:.0f}KB")
        print("[verify] 5 largest entries:")
        for s, n in sizes[:5]:
            print(f"         {s/1024:8.0f} KB  {n}")
    if failures:
        for f in failures:
            print(f"[FAIL] {f}")
        return 1
    print("[verify] OK — all required entries present, no forbidden entry or content")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Build/verify the relic.skill release zip")
    ap.add_argument("--verify-only", action="store_true")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--edition", choices=["commercial", "public"], default="commercial",
                    help="commercial（默认）= 上架用，含商业包，输出 relic.zip；"
                         "public = GitHub 开源分发用，不含商业包，输出 relic-public.zip")
    a = ap.parse_args()
    if a.list:
        for src, arc in collect(a.edition):
            print(arc)
        return 0
    if a.verify_only:
        target = OUT_ZIP if a.edition == "commercial" else OUT_ZIP_PUBLIC
        if not target.exists():
            sys.exit(f"[FAIL] {target.name} not found")
        return verify(target, a.edition)
    z = build(a.edition)
    print(f"[build] wrote {z} (edition={a.edition})")
    return verify(z, a.edition)


if __name__ == "__main__":
    raise SystemExit(main())