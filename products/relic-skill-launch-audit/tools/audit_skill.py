"""Portable release audit for an Agent Skill; standard library only."""
from __future__ import annotations

import argparse
import re
from pathlib import Path

FORBIDDEN = ("BEGIN PRIVATE KEY", ".env", "node_modules", "C:\\Users\\", "127.0.0.1")
REQUIRED = ("SKILL.md", "README.md")


def line_hits(path, needles):
    hits = []
    for number, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
        if any(needle.lower() in line.lower() for needle in needles):
            hits.append((number, line.strip()))
    return hits


def audit(root):
    findings = []
    for relative in REQUIRED:
        path = root / relative
        if not path.is_file():
            findings.append(("BLOCKED", "blocker", relative, 1, "required file is missing"))
    skill = root / "SKILL.md"
    if skill.is_file():
        text = skill.read_text(encoding="utf-8", errors="replace")
        if not re.search(r"^---\s*$[\s\S]*?^name:\s*\S+", text, re.MULTILINE):
            findings.append(("BLOCKED", "blocker", "SKILL.md", 1, "frontmatter/name is missing"))
        if not re.search(r"^version:\s*\d+\.\d+\.\d+", text, re.MULTILINE):
            findings.append(("REVISE", "high", "SKILL.md", 1, "semantic version is missing"))
        if "TODO(image):" not in text:
            findings.append(("REVISE", "low", "SKILL.md", 1, "image placeholder is missing"))
    for path in root.rglob("*"):
        if not path.is_file() or path.name == Path(__file__).name or ".zip" in path.suffix:
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            for marker in FORBIDDEN:
                if marker.lower() in line.lower():
                    findings.append(("BLOCKED", "blocker", str(path.relative_to(root)), number, f"sensitive marker: {marker}"))
    return findings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    findings = audit(args.root)
    status = "BLOCKED" if any(item[0] == "BLOCKED" for item in findings) else ("REVISE" if findings else "PASS")
    lines = [f"# Release Audit: {status}", "", "This report is not legal, security, or platform certification.", ""]
    if findings:
        lines += ["| status | severity | file:line | finding |", "|---|---|---|---|"]
        lines += [f"| {s} | {sev} | `{file}:{line}` | {message} |" for s, sev, file, line, message in findings]
    else:
        lines.append("No blocking or revision findings.")
    report = "\n".join(lines) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(report, encoding="utf-8")
    print(report, end="")
    return 2 if status == "BLOCKED" else (1 if status == "REVISE" else 0)


if __name__ == "__main__":
    raise SystemExit(main())
