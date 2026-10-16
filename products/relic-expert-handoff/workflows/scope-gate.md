# Scope Gate · 范围门

## 目标

在任何资料进入分析前，确认这项交接合法、必要、可撤回。

## 必填记录

```yaml
project:
  name: ""
  expert_role: ""
  purpose: ""
  audience: ""
consent:
  expert_approved: false
  data_owner_approved: false
  consent_date: ""
  withdrawal_route: ""
scope:
  included_sources: []
  date_range: ""
  excluded_sources: []
  excluded_topics: []
retention:
  review_owner: ""
  review_date: ""
  deletion_trigger: ""
```

## 阻塞条件

- `expert_approved` 或 `data_owner_approved` 不是 `true`；
- 目的、受众或来源范围为空；
- 没有撤回路径；
- 资料包含凭据、客户个人信息或与职责无关的私人内容；
- 使用者要求把推测写成专家原话。

## 通过后的下一步

建立 `source-inventory.md`，为每个来源分配稳定 `source_id`，并先标记敏感度，再开始提取。
