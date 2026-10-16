"""Standard-library checks for the standalone expert handoff product."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_skill_entry_is_self_contained():
    text = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    assert "Non-negotiable boundaries" in text
    assert "Workflow" in text
    assert "TODO(image):" in text


def test_required_workflows_and_templates_exist():
    for relative in (
        "workflows/scope-gate.md",
        "workflows/judgment-extraction.md",
        "workflows/human-review.md",
        "templates/judgment-rule.yaml",
        "templates/source-inventory.md",
        "templates/review-record.md",
        "examples/sample-expert-profile.md",
        "COMMERCIAL-DELIVERY.md",
    ):
        assert (ROOT / relative).is_file(), relative


def test_example_is_explicitly_synthetic():
    text = (ROOT / "examples/sample-expert-profile.md").read_text(encoding="utf-8")
    assert "完全脱敏示例" in text
    assert "不得当作真实案例证明" in text


if __name__ == "__main__":
    tests = [
        test_skill_entry_is_self_contained,
        test_required_workflows_and_templates_exist,
        test_example_is_explicitly_synthetic,
    ]
    for test in tests:
        test()
        print(f"PASS {test.__name__}")
