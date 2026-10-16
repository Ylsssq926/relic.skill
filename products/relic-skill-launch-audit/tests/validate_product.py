"""Standard-library checks for relic-skill-launch-audit."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    "SKILL.md",
    "README.md",
    "checklists/release-readiness.md",
    "templates/audit-report.md",
    "examples/sample-audit.md",
    "tools/audit_skill.py",
    "examples/team-memory-audit.md",
)


def main() -> int:
    failures = [relative for relative in REQUIRED if not (ROOT / relative).is_file()]
    for relative in REQUIRED:
        if (ROOT / relative).is_file():
            text = (ROOT / relative).read_text(encoding="utf-8")
            if "TODO(image):" not in text and relative in {"SKILL.md", "README.md"}:
                failures.append(f"missing image placeholder: {relative}")
    if failures:
        for failure in failures:
            print(f"FAIL {failure}")
        return 1
    print(f"PASS relic-skill-launch-audit ({len(REQUIRED)} required files checked)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
