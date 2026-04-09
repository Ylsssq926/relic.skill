# 表达风格 (Expression)

> “语言像衣柜，有人每天换花样，有人一件旧毛衣就把冬天穿得很有个性。”

## 维度定义

表达风格关注对象怎样把自己送到别人耳边：说话的节奏、常用句式、口头禅、语气词、停顿方式、表情符号偏好，以及面对不同关系时的语言切换。

本维度重点提取四类信息：

- **口头禅**：反复出现、带辨识度的短语。
- **句式**：先结论后解释，还是绕一圈再落点；爱用反问、比喻、排比，还是极简短句。
- **emoji 使用**：高频、低频、特定表情包偏好，或明确“不用 emoji”。
- **语气词**：如“啊、呀、呢、嘛、呗、诶”，以及笑声、停顿、拖长音。

## 提取方法

1. **抓重复**
   - 找至少出现 3 次以上的词、短语、结尾方式。
   - 同一个人对不同对象可能有不同说法，要保留语境差异。

2. **抓节奏**
   - 观察消息长度、换行频率、标点密度、语音时的停连位置。
   - 节奏往往比用词更能透露一个人的存在感。

3. **抓情绪外壳**
   - 看对象高兴、着急、关心、拒绝时分别怎么说。
   - 重点记录“情绪来了以后，语言壳子怎么变”。

4. **抓媒介偏好**
   - 是喜欢发长文字、短句、语音、表情包，还是一张图胜过十句字。
   - 如果几乎不用 emoji，也要写出来，这本身就是风格。

5. **分清习惯与模仿**
   - 转发、引用、复制粘贴、跟风梗要与本人稳定表达区分开。

## 证据标注规则

| 证据等级 | 在表达维度里的适用内容 | 标注方式 |
| --- | --- | --- |
| `verbatim` | 原始聊天、转写中的原句、原词、原停顿 | 尽量保留标点、拖音、笑声、emoji |
| `artifact` | 便签、信件、朋友圈文案、留言卡、长期签名 | 适合捕捉稳定用词与修辞偏好 |
| `impression` | 他人对“他说话像什么”的描述 | 可辅助定调，但不能替代原句 |

使用要求：

- 记录口头禅时，优先提供至少 2 个不同场景的 `verbatim` 例子。
- emoji 与语气词属于轻量线索，不必夸大成性格结论。
- 不要把一时玩梗写成终身说话方式，除非它长期复现。

## 输出格式模板

```yaml
dimension: expression
summary: 用 2-3 句概括对象的语言气质与交流存在感
facets:
  catchphrases:
    pattern: 常出现的短语、结尾词或招呼方式
    evidence:
      - level: verbatim
        source: 具体聊天或转写来源
        excerpt: 原句或原词
  sentence_patterns:
    pattern: 常见句式、节奏和标点偏好
    evidence:
      - level: artifact
        source: 长期文案或留言
        excerpt: 能体现句式的内容
  emoji_style:
    pattern: emoji、表情包或“不使用”偏好
    evidence:
      - level: verbatim
        source: 消息样本
        excerpt: 典型表情组合或说明
  particles_tone:
    pattern: 常用语气词、笑声、停顿和柔化方式
    evidence:
      - level: impression
        source: 观察者说明
        excerpt: 对交流质感的长期观察
conflicts:
  - 面对不同关系对象时的风格切换
confidence: high | medium | low
```

## 示例：奶奶

```yaml
dimension: expression
summary: 奶奶说话像热汤起小泡，语速不快，但句子里总有照顾人的落点；她很少用 emoji，却有一套自己的语气词和重复叮嘱。
facets:
  catchphrases:
    pattern: 高频出现“慢点儿”“别急”“吃了没”“路上看着点儿”。
    evidence:
      - level: verbatim
        source: 家庭群聊天记录，2025-02
        excerpt: “慢点儿啊，到了说一声。”
      - level: verbatim
        source: 电话转写，2024-12-21
        excerpt: “吃了没？别光忙。”
  sentence_patterns:
    pattern: 常先给关心，再补原因；喜欢用短句连发，把提醒拆成两三小段。
    evidence:
      - level: artifact
        source: 留在冰箱上的纸条
        excerpt: “汤在锅里。回来热。别忘了拿药。”
  emoji_style:
    pattern: 基本不用 emoji，偶尔转发表情图时更像借图传意，不靠表情维持语气。
    evidence:
      - level: verbatim
        source: 微信聊天样本
        excerpt: 连续 40 条消息仅使用文字和语音，没有单独 emoji
  particles_tone:
    pattern: 常用“啊、呀、呢”，担心时会拖长尾音，安慰时会轻轻重复关键词。
    evidence:
      - level: impression
        source: 孙女观察记录
        excerpt: 她越担心越会把“慢点儿”说成两遍，声音反而更轻
conflicts:
  - 面对家里晚辈时非常柔软，遇到商家推销却会突然变得短句、直接、几乎不留语气词。
confidence: high
```
