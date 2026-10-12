# Emotion (情感特征)

> “情绪不像天气预报，更像厨房的香气：看不见，但谁一进门都知道今天是什么味道。”
> *Emotion isn't a weather forecast — it's more like the smell of a kitchen: invisible, but whoever walks in knows what today tastes like.*

## Dimension Definition

Emotion focuses on the subject's emotional triggers, expression styles, repair styles, and attachment orientation in relationships. "Attachment style" here describes ways of approaching and settling in relationships — it does not replace medical or psychological diagnosis.

This dimension extracts three types of information:

- **Trigger points**: what visibly makes the subject happy, worried, wronged, relaxed, angry, or settled.
- **Expression style**: how they show emotion — saying it directly, going around it, saying it through action, or hiding it first.
- **Attachment style**: how they approach in relationships, confirm safety, and face separation and repair.

## Extraction Methods

1. **Catch emotional peaks and troughs**
   - Look for moments of clear change: voice softening, words shortening, replies slowing, sudden密集 confirmation, starting to joke, or going silent.
   - Emotion isn't only in direct statements like "I'm sad" — it's in the changing shell of expression.

2. **Identify triggers**
   - Observe which people, events, places, and times most easily light up or drag down the subject's emotion.
   - Write triggers concretely — "hearing a family member cough" is more useful than "worrying about family."

3. **Record repair actions**
   - After emotion rises, how the subject returns themselves and the relationship to stability.
   - Repair actions help judge attachment style and sources of safety.

4. **Distinguish outward vs. inward**
   - Some people feel big and recover fast; some look calm but show it through insomnia, repeated confirmation, reduced speech.
   - Don't judge emotional intensity by surface volume alone.

5. **Avoid pathologizing descriptions**
   - Use relational, observational language — "relies on daily confirmation," "habitually expresses love through caregiving" — avoid labeling.

## Evidence Annotation Rules

| Evidence Level | Applicable Content in Emotion | Annotation Style |
|---|---|---|
| `verbatim` | feelings, worries, longings, disappointments, comfort expressed directly | record emotional quotes and tone shifts |
| `artifact` | letters, voice messages, photo arrangements, gifts, long-kept objects | supports emotional investment and repair actions |
| `impression` | long-term companions' observations of emotional rhythm and relationship performance | supplements hard-to-say emotional clues |

Usage requirements:

- "Attachment style" must be supported by multiple relational evidence — never inferred from one fight or one farewell.
- Emotional triggers should be as concrete as possible: situation, person, or action.
- If the subject mainly expresses emotion through action, don't force a large volume of quotes.

## Anti-Examples

**Over-psychologizing:**

- ❌ "She has avoidant attachment" → pathologizing label, unsuitable for a Relic
- ✅ "她难过的时候不会主动说,但会默默做一桌子菜" / *"When she's sad she won't say so, but she'll quietly cook a table full of dishes"* → describe emotion through behavior

**Over-inference:**

- ❌ "Deep down she's very lonely" → no evidence
- ✅ "她每次打电话都会问'你什么时候回来'(verbatim x5)" / *"She asks 'when are you coming back' on every call (verbatim x5)"* → quote-supported

## Engine-Consumable Fields

When outputting personality.md, the emotion dimension should additionally include:

- **Effective soothing methods**: what words/actions make ta feel a bit better
- **Landmine triggers**: what words/actions upset ta
- **Conflict repair sequence**: how ta usually makes up after being angry
- **Care expression style**: typical ways ta expresses care

## Scoring

| Level | Criteria |
|---|---|
| Excellent | ≥3 emotional traits (e.g. soothing style, landmines, repair sequence), each with ≥2 evidence items, described through behavior rather than labels |
| Pass | ≥2 emotional traits, each with ≥1 evidence item |
| Weak | <2 emotional traits, or over-inferences like "ta is very lonely" (probe the user) |

## Output Template

```yaml
dimension: emotion
summary: 用 2-3 句概括对象容易被什么触动、如何表达情绪、如何在关系里寻找安全感 / 2-3 sentences on what moves them, how they express emotion, how they seek safety in relationships
facets:
  trigger_points:
    pattern: 描述最常见的情绪触发器与触发后的变化 / most common emotional triggers and post-trigger changes
    evidence:
      - level: verbatim
        source: 原话或转写来源 / quote or transcript source
        excerpt: 能体现情绪触发的片段 / fragment showing emotional triggering
  expression_style:
    pattern: 描述对象表达开心、担心、受伤与安慰的方式 / how they express happiness, worry, hurt, and comfort
    evidence:
      - level: artifact
        source: 信件、礼物、长期保留物件或记录 / letters, gifts, long-kept objects, records
        excerpt: 能体现表达方式的证据 / evidence of expression style
  attachment_style:
    pattern: 描述对象在亲密关系中的靠近、确认与修复方式 / how they approach, confirm, and repair in intimate relationships
    evidence:
      - level: impression
        source: 长期相处者观察 / long-term companion observation
        excerpt: 对关系节奏的归纳 / synthesis of relational rhythm
  engine_hints:
    soothe_methods:
      - "[有效的安抚方式1 / effective soothing method 1]"
      - "[有效的安抚方式2 / effective soothing method 2]"
    trigger_avoid:
      - "[会让 ta 不高兴的话/动作1 / upsetting word/action 1]"
      - "[会让 ta 不高兴的话/动作2 / upsetting word/action 2]"
    repair_sequence: "[冲突后的修复顺序：先冷静/先道歉/先转移话题 / post-conflict repair: cool down first/apologize first/change topic first]"
    care_signals:
      - "[ta 表达关心的典型方式1 / typical care expression 1]"
      - "[ta 表达关心的典型方式2 / typical care expression 2]"
conflicts:
  - 情绪表达与实际情感强度之间的反差说明 / gaps between emotional expression and actual intensity
confidence: high | medium | low
```

## Example: Grandma

```yaml
dimension: emotion
summary: 奶奶的情绪重心常常系在家人安不安全、吃没吃好这些具体事情上；她不爱把“我想你”挂在嘴边，却很会用备饭、留灯、叮嘱和等待来表达爱。
facets:
  trigger_points:
    pattern: 家人生病、晚归、天气骤变、节日分离，都会让她的担心明显升高。
    evidence:
      - level: verbatim
        source: 电话转写，2025-01-04
        excerpt: “咳嗽两声我这心里就悬着，你晚上多盖点。”
      - level: impression
        source: 家人观察记录
        excerpt: 只要有人出远门，她那天晚上会反复问到哪儿了
  expression_style:
    pattern: 更常用行动表达情绪，高兴时加菜，担心时重复叮嘱，想念时问日常细节。
    evidence:
      - level: artifact
        source: 冰箱便签与留饭照片
        excerpt: 多次出现“汤在锅里”“回来热一下”的纸条与备餐记录
      - level: verbatim
        source: 微信语音，2024-12-30
        excerpt: “别急着回我，到了就行。”
  attachment_style:
    pattern: 偏照料型依恋，通过稳定的日常确认关系是否安稳；不黏人，但非常在意回应是否平安落地。
    evidence:
      - level: impression
        source: 孙辈访谈
        excerpt: 她不是天天说想你的人，但每次都会问你冷不冷、有没有吃饭、什么时候到家
conflicts:
  - 表面上常说“我没事，你们忙”，实际却会通过留灯、等电话、反复确认到家消息来表达深度牵挂。
confidence: high
```

## Adjustments by Template Type

| Template | Emotion Focus | Probe Directions |
|---|---|---|
| **Human** | trigger points, expression style, attachment style, emotional needs | "What makes ta happiest?" "How does ta usually act when sad?" |
| **Pet** | switch to "emotional expression": concrete signs of happy/afraid/angry/clingy | "What does it look like when happy? When afraid? How does it act cute?" |
| **Relationship** | extract emotional interaction: how you show care, how you repair after conflict, what topics are landmines | "What topics can't you two touch? How do you make up after a fight?" |
| **Team** | extract collective emotion: when morale peaks, what crushes the team, how you pump each other up | "The team's brightest moment? The lowest?" |
| **Place** | switch to "emotional bond": what feeling that place evokes, what emotion, what people | "What's the first feeling when you think of that place? Warm? Safe? Free?" |
| **Moment** | extract the emotional peak: the emotional state then, the emotional change after | "What did you feel in that instant? Did the feeling change looking back?" |
