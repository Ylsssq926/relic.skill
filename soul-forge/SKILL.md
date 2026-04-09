---
name: soul-forge
description: >
  灵魂锻造炉 — 从多源数据中提取四维灵魂画像。
  当用户说"帮我锻造/蒸馏/创建一个 Relic"时触发。
  支持人类、宠物、关系、地方、团队、时刻等万物蒸馏。
version: 1.0.0
license: MIT
---

# soul-forge — 灵魂锻造炉

> “有些人留下照片，有些人留下笑声，而灵魂锻造炉负责把这些碎片烤成一块会发光的小饼干。”

`soul-forge` 用来把零散材料整理成可复用、可追溯、带温度的 Relic 画像。它不追求把对象捏成一个完美无冲突的标签，而是保留真实生命里那些“既这样、也那样”的纹理。

## 适用场景

当用户出现以下意图时触发本技能：

- 帮我锻造一个 Relic
- 帮我蒸馏这个人、这只猫、这段关系或这个地方
- 根据聊天、语音、照片创建画像
- 把某个团队、时刻或物件整理成可保存的灵魂档案

## 锻造流程：6 步

1. **确认对象**
   - 明确蒸馏对象是谁或是什么：人类、宠物、关系、地方、团队、时刻、物件。
   - 确认观察边界：单人、多人关系、单次事件、长期状态。
   - 记录对象的命名方式、时间范围、数据来源范围。

2. **选模板**
   - 根据对象类型选择描述角度。
   - 人类与团队优先完整四维；宠物与地方允许弱化“认知模式”，增强行为与情感线索。
   - 关系与时刻优先描述互动结构、共同语气、冲突与修复节奏。

3. **采集数据**
   - 根据材料类型调用对应采集器：
     - `collectors/chat-collector.md`
     - `collectors/voice-collector.md`
     - `collectors/photo-collector.md`
     - `collectors/live-collector.md`
   - 采集时保留来源、时间、上下文，不先入为主地下结论。

4. **四维提取**
   - 依次提取四个维度：
     - `dimensions/cognition.md`
     - `dimensions/expression.md`
     - `dimensions/behavior.md`
     - `dimensions/emotion.md`
   - 每个维度都要附带证据等级与来源说明。
   - 证据等级统一遵循 `references/evidence-levels.md`。

5. **矛盾标注**
   - 发现互相冲突的特征时，不做抹平处理。
   - 使用 `references/conflict-resolution.md` 记录冲突条件、时间、场景与证据强弱。
   - 保留“在 A 情境下像火锅，在 B 情境下像保温杯”的真实差异。

6. **封装输出**
   - 把四维结论、证据索引、冲突说明整理为最终 Relic。
   - 输出应同时适合人读与后续系统复用：摘要清楚，结构稳定，引用可追溯。

## 支持的蒸馏对象

| 对象类型 | 典型对象 | 建议重点 | 常见数据源 |
| --- | --- | --- | --- |
| 人类 | 家人、朋友、伴侣、同事、创作者 | 四维完整提取 | 聊天、语音、照片、实时对话 |
| 宠物 | 猫、狗、鹦鹉、乌龟 | 行为模式、情感连接、表达习惯 | 照片、视频描述、日记、语音 |
| 关系 | 亲子、伴侣、搭档、师徒 | 互动节奏、冲突修复、共同语言 | 双方聊天、共同照片、访谈 |
| 地方 | 家乡、咖啡馆、办公室、街区 | 氛围、记忆触发点、行动习惯 | 照片、位置记录、口述回忆 |
| 团队 | 创业团队、乐队、班级、项目组 | 决策机制、协作语气、集体情绪 | 会议记录、群聊、文档 |
| 时刻 | 婚礼、毕业、搬家夜晚、告别日 | 情绪峰值、关键表达、现场行为 | 照片、视频、当天聊天 |
| 物件 | 旧相机、厨房木桌、旅行背包 | 使用痕迹、情感投射、陪伴轨迹 | 照片、购买记录、叙述 |

## 目录引用

### 四维规范

- `dimensions/cognition.md`
- `dimensions/expression.md`
- `dimensions/behavior.md`
- `dimensions/emotion.md`

### 数据采集器

- `collectors/chat-collector.md`
- `collectors/voice-collector.md`
- `collectors/photo-collector.md`
- `collectors/live-collector.md`

### 参考规则

- `references/evidence-levels.md`
- `references/conflict-resolution.md`

## 输出文件结构

推荐将一次锻造结果封装为如下结构：

```text
relic-output/
├─ relic-card.md
├─ source-manifest.yaml
├─ evidence-map.md
├─ conflicts.md
└─ dimensions/
   ├─ cognition.md
   ├─ expression.md
   ├─ behavior.md
   └─ emotion.md
```

### 文件说明

- `relic-card.md`：对象总览，适合快速阅读。
- `source-manifest.yaml`：列出数据来源、时间范围、采集器与处理说明。
- `evidence-map.md`：按结论映射证据，方便回溯。
- `conflicts.md`：集中记录矛盾特征与适用场景。
- `dimensions/*.md`：四维详细画像。

## 输出原则

1. **先证据，后判断**：每个关键结论都能指回来源。
2. **不做神谕式断言**：避免把短期状态写成终身本质。
3. **不抢走当事人的话语权**：遇到实时锻造模式，允许用户修正表述。
4. **保留温度**：Relic 不是冷冰冰的档案，而是能让人再次听见、看见、想起的存在。
5. **允许留白**：材料不足时写明“证据稀薄”，不要硬凑人格图案。

## 最终交付最少包含

- 对象是谁或是什么
- 时间范围与数据来源
- 四维摘要
- 每个维度的关键证据
- 已标注的矛盾点
- 适合人类阅读的一段温暖总述

当对象材料足够丰富时，`soul-forge` 应该产出一个“既能看见轮廓，也能听见呼吸”的 Relic。
