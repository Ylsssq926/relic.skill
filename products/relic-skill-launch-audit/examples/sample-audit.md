# Example · Sample Skill Audit

> 完全脱敏、虚构示例。不是任何真实产品的认证结果。

## Decision

### REVISE

## Findings

| ID | Pass | Severity | Evidence | Finding | Fix |
|---|---|---|---|---|---|
| F-001 | Data & permissions | blocker | `SKILL.md:42` | 网络访问没有声明目的和域名 | 添加网络清单与最小权限说明 |
| F-002 | Package hygiene | high | `release.zip` | 压缩包含开发缓存 | 更新白名单并重新构建 |
| F-003 | Buyer handoff | medium | `README.md:88` | 退款和更新策略缺失 | 补充商品页交付边界 |

## Caveat

这份审计只说明交付准备度，不代表安全、法律或平台审核通过。
