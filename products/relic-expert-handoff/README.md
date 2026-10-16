# relic-expert-handoff

把资深专家的判断逻辑、决策条件和边界变成可审查的知识交接包，而不是一份无人维护的离职文档。

## 适合谁

- 即将离职或转岗的技术负责人、销售负责人、客服负责人、顾问；
- 需要降低关键人员离职风险的企业团队；
- 为客户交付知识整理、培训和 onboarding 的咨询师。

## MVP 交付物

- 同意与范围确认清单；
- 来源清单和敏感度标注；
- 决策规则、权衡条件、拒绝规则和升级规则；
- 冲突与未知项记录；
- 新人第一周 onboarding 指南；
- 四场景人工验收；
- 可更新的 `manifest.json`。

## 目录

- `SKILL.md`：独立 Skill 入口和运行规则；
- `workflows/`：范围门、素材盘点、规则提取与复核流程；
- `templates/`：判断规则、来源清单、验收记录模板；
- `examples/`：完全脱敏的示例；
- `tests/`：静态结构检查。

## 不承诺什么

它不会复活真实的人，不会替专家做当前授权之外的决定，不会把会议纪要自动变成事实，也不会绕过公司权限和隐私政策。

## 图片占位

`TODO(image): add an authorized workflow diagram after the product identity and visual assets are finalized.`

## 使用前准备

必须明确：专家本人同意、数据所有者批准、采集范围、保留期限、审核人和撤回路径。缺少任何一项时，Skill 应停在 `BLOCKED` 状态。

## 可执行验收

使用标准库 Python 运行 `python tools/run_handoff.py scope.json --output handoff-output`。缺少同意、范围、撤回路径、审核日期或出现敏感资料标记时返回非零状态并保持 `BLOCKED`；通过后只生成来源清单、复核队列和 `manifest.json` 骨架，仍须人工审核后发布。
