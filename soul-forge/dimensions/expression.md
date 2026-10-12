# Expression (表达风格)

> “语言像衣柜，有人每天换花样，有人一件旧毛衣就把冬天穿得很有个性。”
> *Language is like a wardrobe — some change daily; some wear one old sweater through winter with unmistakable character.*

## Dimension Definition

Expression focuses on how the subject delivers themselves to others' ears: speaking rhythm, habitual sentence patterns, catchphrases, modal particles, pause style, emoji preference, and language switching across relationships.

This dimension extracts four types of information:

- **Catchphrases**: recurring, recognizable phrases.
- **Sentence patterns**: conclusion-first or meander-then-landing; rhetorical questions, metaphors, parallelism, or very short sentences.
- **Emoji usage**: frequent, rare, specific sticker preferences, or an explicit "no emoji."
- **Modal particles**: like "啊、呀、呢、嘛、呗、诶," plus laughter, pauses, drawn-out vowels.

## Extraction Methods

1. **Catch repetition**
   - Find words, phrases, or closing patterns appearing at least 3 times.
   - The same person may speak differently to different people — preserve contextual differences.

2. **Catch rhythm**
   - Observe message length, line-break frequency, punctuation density, pause placement in voice.
   - Rhythm often reveals a person's presence more than word choice.

3. **Catch the emotional shell**
   - See how the subject speaks when happy, rushed, caring, or refusing.
   - Record "how the language shell changes once emotion arrives."

4. **Catch medium preference**
   - Long text, short sentences, voice, stickers — or one image worth ten sentences.
   - If they almost never use emoji, write that down too; that itself is style.

5. **Separate habit from imitation**
   - Forwards, quotes, copy-paste, and trend-riding memes must be distinguished from stable personal expression.

## Evidence Annotation Rules

| Evidence Level | Applicable Content in Expression | Annotation Style |
|---|---|---|
| `verbatim` | original sentences, words, pauses from chats or transcripts | preserve punctuation, drawn vowels, laughter, emoji as much as possible |
| `artifact` | notes, letters, social captions, message cards, long-term signatures | suited to capturing stable word choice and rhetorical preference |
| `impression` | others' descriptions of "what his speech is like" | can set the tone; cannot replace original sentences |

Usage requirements:

- For catchphrases, provide at least 2 `verbatim` examples from different scenes.
- Emoji and modal particles are lightweight clues; don't inflate them into personality conclusions.
- Don't write a one-off meme as a lifetime speech style unless it recurs long-term.

## Anti-Examples

**One-off meme ≠ stable catchphrase:**

- ❌ An expression appearing once cannot be labeled a catchphrase
- ✅ Recurring across 5+ messages counts

**Single quote ≠ long-term sentence pattern:**

- ❌ "She said 'life is short'" → one quote isn't a style
- ✅ "她的消息 80% 以'哎'开头,平均每条 <15 字" / *"80% of her messages start with 'ai' (hey), averaging <15 characters each"* → quantified style feature

## Engine-Consumable Fields

When outputting personality.md, the expression dimension should additionally include:

- **Common openings**: list the 3–5 most frequent message-opening patterns
- **Sentence length range**: ratio of short / medium / long messages
- **Message shape**: one long message or split into several short ones
- **Forbidden expressions**: things this person would never say
- **Address rules**: how they address people across relationships

## Scoring

| Level | Criteria |
|---|---|
| Excellent | ≥3 facets (e.g. catchphrases, sentence patterns, particles), each with ≥2 evidence items, with quantified features (e.g. "80% start with 'ai'") |
| Pass | ≥2 facets, each with ≥1 evidence item |
| Weak | <2 facets, or only empty descriptions like "ta speaks very gently" (probe the user) |

## Output Template

```yaml
dimension: expression
summary: 用 2-3 句概括对象的语言气质与交流存在感 / 2-3 sentences on linguistic temperament and communicative presence
facets:
  catchphrases:
    pattern: 常出现的短语、结尾词或招呼方式 / recurring phrases, closers, or greetings
    evidence:
      - level: verbatim
        source: 具体聊天或转写来源 / concrete chat or transcript source
        excerpt: 原句或原词 / original sentence or word
  sentence_patterns:
    pattern: 常见句式、节奏和标点偏好 / common sentence patterns, rhythm, punctuation preference
    evidence:
      - level: artifact
        source: 长期文案或留言 / long-term copy or messages
        excerpt: 能体现句式的内容 / content showing the pattern
  emoji_style:
    pattern: emoji、表情包或“不使用”偏好 / emoji, sticker, or "no use" preference
    evidence:
      - level: verbatim
        source: 消息样本 / message samples
        excerpt: 典型表情组合或说明 / typical emoji combination or note
  particles_tone:
    pattern: 常用语气词、笑声、停顿和柔化方式 / modal particles, laughter, pauses, softening style
    evidence:
      - level: impression
        source: 观察者说明 / observer account
        excerpt: 对交流质感的长期观察 / long-term observation of communicative texture
  engine_hints:
    openings:
      - "[最常用的开场方式1] / most common opening 1"
      - "[最常用的开场方式2] / most common opening 2"
      - "[最常用的开场方式3] / most common opening 3"
    message_shape: "[split_short / single_long / mixed]"
    sentence_length:
      short_ratio: "[0-1, 短消息占比 / short-message ratio]"
      medium_ratio: "[0-1]"
      long_ratio: "[0-1]"
    forbidden_phrases:
      - "[这个人绝对不会说的话1 / never-said phrase 1]"
      - "[这个人绝对不会说的话2 / never-said phrase 2]"
    address_rules:
      to_family: "[对家人的称呼方式 / address for family]"
      to_strangers: "[对陌生人的称呼方式 / address for strangers]"
      to_juniors: "[对晚辈的称呼方式 / address for juniors]"
conflicts:
  - 面对不同关系对象时的风格切换 / style switching across relationship types
confidence: high | medium | low
```

## Example: Grandma

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

## Adjustments by Template Type

| Template | Expression Focus | Probe Directions |
|---|---|---|
| **Human** | full extraction of catchphrases, sentence patterns, particles, humor style | "What's the sentence ta says most?" "How does ta talk when angry?" |
| **Pet** | switch to "interaction style": vocalization meanings, head-butting style, tail/ear language, eye contact | "How does it act when it wants something?" "What does it look like when happy?" |
| **Relationship** | extract both sides' communication patterns: who talks more, how you joke, how you fight | "What do you two say that only you understand?" |
| **Team** | extract group-chat texture: sticker culture, what "read but no reply" means, internal jargon | "What sticker appears most in the team group? Any inside jokes?" |
| **Place** | switch to "atmospheric expression": descriptions of sound, smell, light, temperature | "What's the first sound that comes to mind for that place? What smell?" |
| **Moment** | extract the dialogue and expression of that time: who said what, in what tone, with what face | "Who spoke first in that instant? What did they say?" |
