# Example · Northstar Project Memory

> 完全脱敏、虚构示例，仅用于展示输出结构。

## Decision

```yaml
id: DEC-001
title: Keep the migration reversible
decision: Ship the adapter behind a feature flag before changing the storage contract.
status: accepted
context: The team needed a rollback path during a staged migration.
alternatives:
  - option: Rewrite storage and clients together
    reason_not_chosen: Larger blast radius and harder rollback.
owners: ["current-platform-owner"]
due_date: "2026-05-20"
evidence:
  - source_id: S-003
    level: artifact
    link_or_excerpt: "Redacted architecture review record."
review:
  reviewer: "project-owner"
  reviewed_at: "2026-05-12"
```

Machine-check fields:

```json
{"id":"DEC-001","title":"Keep the migration reversible","decision":"Ship the adapter behind a feature flag.","status":"accepted","owners":["current-platform-owner"],"evidence":[{"source_id":"S-003","level":"artifact"}],"review":{"reviewer":"project-owner","reviewed_at":"2026-05-12"}}
```

## Open question

Which compatibility window should be supported? This remains `needs-verification`; the memory layer must not invent an answer.
