# Decision Log · 决策日志

## 单条决策格式

```yaml
id: DEC-001
title: ""
decision: ""
status: proposed | accepted | superseded | unknown
context: ""
alternatives:
  - option: ""
    reason_not_chosen: ""
owners: []
due_date: ""
evidence:
  - source_id: S-001
    level: verbatim | artifact | impression | needs-verification
    link_or_excerpt: ""
review:
  reviewer: ""
  reviewed_at: ""
```

## 提取纪律

- “有人提议”不是“团队决定”；必须区分 proposal、decision、action 和 open question。
- 决策如果没有明确 owner、状态或来源，标为 `unknown`，进入复核队列。
- 新决策取代旧决策时保留 superseded 记录，不覆盖历史。
