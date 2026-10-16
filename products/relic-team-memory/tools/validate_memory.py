"""Validate a decision-log JSON file without third-party dependencies."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

REQUIRED = ("id", "title", "decision", "status", "owners", "evidence", "review")
VALID_STATUS = {"proposed", "accepted", "superseded", "unknown", "needs-verification"}


def validate(entry):
    errors = [f"missing {key}" for key in REQUIRED if not entry.get(key)]
    if entry.get("status") not in VALID_STATUS:
        errors.append("status must be a supported workflow state")
    if not entry.get("owners"):
        errors.append("at least one owner is required")
    if not entry.get("evidence"):
        errors.append("at least one evidence item is required")
    review = entry.get("review") or {}
    if not review.get("reviewer"):
        errors.append("review.reviewer is required")
    if entry.get("status") in {"unknown", "needs-verification"} and not entry.get("follow_up_question"):
        errors.append("unresolved entries require follow_up_question")
    return errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("entry", type=Path)
    args = parser.parse_args()
    data = json.loads(args.entry.read_text(encoding="utf-8"))
    errors = validate(data)
    if errors:
        print("REVIEW_REQUIRED")
        for error in errors:
            print("- " + error)
        return 1
    print("PASS decision entry: " + data["id"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
