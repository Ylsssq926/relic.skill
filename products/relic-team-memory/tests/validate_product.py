"""Standard-library checks for relic-team-memory."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    "SKILL.md",
    "README.md",
    "workflows/decision-log.md",
    "workflows/onboarding.md",
    "templates/decision-log.yaml",
    "templates/onboarding-checklist.md",
    "examples/sample-memory.md",
    "tools/validate_memory.py",
    "examples/decision-approved.json",
)


def main() -> int:
    failures = [relative for relative in REQUIRED if not (ROOT / relative).is_file()]
    example = ROOT / "examples/sample-memory.md"
    if example.is_file():
        text = example.read_text(encoding="utf-8")
        for marker in ("完全脱敏", "needs-verification", "DEC-001"):
            if marker not in text:
                failures.append(f"example missing marker: {marker}")
    if failures:
        for failure in failures:
            print(f"FAIL {failure}")
        return 1
    print(f"PASS relic-team-memory ({len(REQUIRED)} required files checked)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
