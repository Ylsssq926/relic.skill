# Relic 产品 Skill 目录

本目录包含三个面向知识治理和交付质量的独立 Skill。它们不是通用摘要器，也不绕过组织权限；每个产品都要求来源范围、人工复核和敏感内容处理。

| 产品 | 适合场景 | 主要输入 | 主要输出 | 成熟度 |
|---|---|---|---|---|
| `relic-expert-handoff` | 关键人员离职、转岗、专家经验交接 | 同意记录、限定来源、角色范围 | 来源清单、判断规则、复核队列、manifest | MVP，可执行范围门 |
| `relic-skill-launch-audit` | Skill 发布或售卖前的质量审计 | Skill 目录、版本、交付目标 | PASS/REVISE/BLOCKED 报告 | MVP，可执行静态审计 |
| `relic-team-memory` | 团队决策记忆和新人 onboarding | 经批准的会议/聊天/项目资料 | 决策日志、未决问题、上手包 | 骨架，可执行条目校验 |

## 选择方式

- 交接对象是一个人或一个岗位：选择 `relic-expert-handoff`。
- 交付对象是一个 AI Skill 产品：选择 `relic-skill-launch-audit`。
- 需要维护项目级决策和团队上下文：选择 `relic-team-memory`。

## 共同边界

三个产品都不提供法律意见、隐私合规认证、安全认证、平台上架保证或真实人物模拟。商业使用须遵循仓库许可证及单独授权条款；示例均应保持脱敏，不应把真实凭据、客户秘密或私人对话放入包内。

## 标准库验证

每个产品都提供独立验证器，可在不安装 pytest 的环境中运行：

```bash
python products/relic-expert-handoff/tests/validate_product.py
python products/relic-skill-launch-audit/tests/validate_product.py
python products/relic-team-memory/tests/validate_product.py
```

产品工具的运行命令和退出码写在各自 README 中。`TODO(image): add approved product visuals only after authorized assets are supplied.`
