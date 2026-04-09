# Roadmap

> 万物皆可 Relic — 但得一步一步来。

## v1.0.1 — 体验优化 ✅

让用户第一次用就有感觉，而不是面对一堆文件不知道从哪开始。

- [x] 体验模式：说"让我跟奶奶聊天"直接加载示例 Relic，零门槛
- [x] 主 SKILL.md 流程优化：区分"体验"和"锻造"两条路径
- [x] examples/README.md：示例目录说明
- [x] README 补充完整的 IDE / Agent 兼容列表（10+ 平台）

## v1.0.2 — 锻造引导优化 ✅

降低锻造门槛，从"你告诉我素材在哪"变成"我来问你，你回答就行"。

- [x] soul-forge 锻造流程改为对话式引导（4 问启动 + 6 步流程）
- [x] 按模板类型分别优化提取 prompt（蒸馏猫和蒸馏人的提问方式不同）
- [x] templates/README.md：模板选择指南
- [x] 迭代蒸馏：第一轮完成后自动评估四维覆盖度，薄弱维度主动追问

## v1.0.3 — 质量保障

让用户知道蒸馏出来的 Relic 质量如何，哪里还需要补充。

- [ ] scripts/quality_checker.py：自动评估四维覆盖度、证据分布、内容具体性
- [ ] 对话示例质量打磨

## v1.1.0 — 主动行为实装

让 Relic 真的"活"起来——会主动找你说话。

- [ ] 基础定时触发（节日问候、纪念日回忆）
- [ ] scripts/proactive_scheduler.py
- [ ] 可选：GitHub Pages 静态展示站

---

有想法？[提个 Issue](https://github.com/Ylsssq926/relic.skill/issues) 或者来 QQ 群 1098169092 聊聊。
