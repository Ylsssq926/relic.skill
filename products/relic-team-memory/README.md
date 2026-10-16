# relic-team-memory

把经批准的团队聊天、会议记录和项目文档整理成可追溯的决策记忆，服务于复盘、交接和新人 onboarding。

## 产品边界

它不是全量聊天摘要器，不默认读取整个工作区，也不替团队做未经授权的绩效判断。每条重要结论都应带来源、时间、状态和审核人。

## 当前状态

产品骨架阶段。连接器、示例和自动化输出将在 `relic-expert-handoff` MVP 验收后实现，避免先做大量平台适配却没有稳定的质量门。

`TODO(image): add a redacted decision-log visual when approved sample material is available.`

## 可执行验收

将单条决策保存为 JSON 后运行 `python tools/validate_memory.py decision.json`。工具会检查 owner、status、evidence、reviewer；`unknown` 或 `needs-verification` 必须同时提供 `follow_up_question`，否则返回 `REVIEW_REQUIRED`。
