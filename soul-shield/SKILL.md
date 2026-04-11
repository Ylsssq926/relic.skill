---
name: relic-shield
description: >
  灵魂护盾 — 保护 Relic 不被未授权复制、篡改或滥用。
  提供灵魂指纹、授权协议和伦理框架。可直接调用 /relic-shield。
version: 1.1.2
license: MIT
user-invocable: true
argument-hint: "描述你想保护或检查的 Relic，比如：检查我奶奶的授权和指纹"
---

# soul-shield — 灵魂护盾

> 给 Relic 穿上防弹背心，而不是铁笼。

## 你负责什么

`soul-shield` 是 Relic 的保护层，负责三件事：

1. **生成灵魂指纹**：为每个 Relic 生成唯一内容指纹，并嵌入输出文件。
2. **执行授权协议**：在蒸馏开始前完成六问授权，决定是否允许锻造、允许到什么程度。
3. **守住伦理红线**：阻止冒充、骚扰、未授权蒸馏与误导性使用。

## 工作顺序

1. 先读取 `consent-protocol.md`
2. 根据回答判定授权等级
3. 只有通过授权后，才读取 `fingerprint.md` 生成与嵌入指纹
4. 最后用 `ethics.md` 做一次红线检查
5. 任一步骤触发红线，立即停止 Relic 生成或对外发布

## 输出要求

- 每个 Relic 必须有唯一灵魂指纹
- 每个公开可见输出都必须带有 Relic 身份标识
- 每次内容更新都必须重新生成指纹
- 未授权对象不得进入蒸馏流程
- 不支持蒸馏政治人物

## 子文件

- `fingerprint.md` — 灵魂指纹系统
- `consent-protocol.md` — 六问授权协议
- `ethics.md` — 伦理红线与处理原则
