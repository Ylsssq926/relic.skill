"""Product-level validator for relic-expert-handoff.

Uses only the Python standard library so buyers can run it without installing pytest.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    "SKILL.md",
    "README.md",
    "COMMERCIAL-DELIVERY.md",
    "workflows/scope-gate.md",
    "workflows/judgment-extraction.md",
    "workflows/human-review.md",
    "templates/judgment-rule.yaml",
    "templates/source-inventory.md",
    "templates/review-record.md",
    "examples/sample-expert-profile.md",
    "tools/run_handoff.py",
    "examples/scope-approved.json",
)
FORBIDDEN = ("." + "env", "__" + "pycache__", "node_" + "modules", "BEGIN " + "PRIVATE KEY")
SELF = Path(__file__).name


def main() -> int:
    failures = []
    for relative in REQUIRED:
        if not (ROOT / relative).is_file():
            failures.append(f"missing required file: {relative}")

    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".md", ".yaml", ".yml", ".json", ".py"}:
            continue
        if path.name in {SELF, "build_release.py"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for pattern in FORBIDDEN:
            if pattern in text:
                failures.append(f"forbidden content {pattern!r}: {path.relative_to(ROOT)}")

    skill = (ROOT / "SKILL.md").read_text(encoding="utf-8") if (ROOT / "SKILL.md").exists() else ""
    for marker in ("consent", "Evidence labels", "withdrawal", "TODO(image):"):
        if marker.lower() not in skill.lower():
            failures.append(f"SKILL.md missing boundary marker: {marker}")

    if not re.search(r"version:\s+0\.1\.0", skill):
        failures.append("SKILL.md missing product version 0.1.0")

    if failures:
        for failure in failures:
            print(f"FAIL {failure}")
        return 1
    print(f"PASS relic-expert-handoff ({len(REQUIRED)} required files checked)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
