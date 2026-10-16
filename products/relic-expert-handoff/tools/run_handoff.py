"""Create a traceable handoff skeleton from an approved scope JSON file."""
from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path

REQUIRED = (
    ("project", "name"),
    ("project", "purpose"),
    ("project", "audience"),
    ("consent", "expert_approved"),
    ("consent", "data_owner_approved"),
    ("consent", "withdrawal_route"),
    ("scope", "included_sources"),
    ("scope", "date_range"),
    ("retention", "review_owner"),
    ("retention", "review_date"),
)
SENSITIVE_MARKERS = ("credential", "secret", "private", "personal data", "客户隐私", "凭据")


def get(data, path):
    value = data
    for key in path:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def validate(scope):
    failures = []
    for path in REQUIRED:
        value = get(scope, path)
        if value in (None, "", [], {}):
            failures.append("missing " + ".".join(path))
    for path in (("consent", "expert_approved"), ("consent", "data_owner_approved")):
        if get(scope, path) is not True:
            failures.append("approval required: " + ".".join(path))
    included = json.dumps(get(scope, ("scope", "included_sources")) or [], ensure_ascii=False).lower()
    for marker in SENSITIVE_MARKERS:
        if marker in included:
            failures.append("sensitive included source requires quarantine: " + marker)
    review_date = get(scope, ("retention", "review_date"))
    if review_date:
        try:
            date.fromisoformat(review_date)
        except ValueError:
            failures.append("retention.review_date must be YYYY-MM-DD")
    return failures


def write_outputs(scope, output):
    output.mkdir(parents=True, exist_ok=True)
    sources = get(scope, ("scope", "included_sources")) or []
    rows = []
    for index, source in enumerate(sources, 1):
        label = source if isinstance(source, str) else source.get("name", "unnamed")
        rows.append(f"| S-{index:03d} | {label} | pending | pending | pending | pending | pending |")
    (output / "source-inventory.md").write_text(
        "# Source Inventory\n\n| id | source | date range | owner | relevance | sensitivity | status |\n|---|---|---|---|---|---|---|\n"
        + "\n".join(rows) + "\n", encoding="utf-8")
    (output / "review-queue.md").write_text(
        "# Review Queue\n\n- [ ] Confirm each source owner and sensitivity.\n- [ ] Test four human-review scenarios.\n- [ ] Confirm expiry date and withdrawal route.\n", encoding="utf-8")
    manifest = {
        "product": "relic-expert-handoff",
        "status": "READY_FOR_HUMAN_REVIEW",
        "project": scope["project"],
        "consent": scope["consent"],
        "scope": scope["scope"],
        "retention": scope["retention"],
        "generated_files": ["source-inventory.md", "review-queue.md", "manifest.json"],
    }
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Validate scope and create a handoff skeleton")
    parser.add_argument("scope", type=Path)
    parser.add_argument("--output", type=Path, default=Path("handoff-output"))
    args = parser.parse_args()
    scope = json.loads(args.scope.read_text(encoding="utf-8"))
    failures = validate(scope)
    if failures:
        print("BLOCKED")
        for failure in failures:
            print("- " + failure)
        return 2
    write_outputs(scope, args.output)
    print(f"READY_FOR_HUMAN_REVIEW: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
