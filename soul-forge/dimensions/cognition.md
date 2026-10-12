# Cognition (认知模式)

> “脑子看不见，但每次‘要不先吃饭’其实都是一场温柔的决策树。”
> *The mind is invisible, but every "how about we eat first" is really a gentle decision tree.*

## Dimension Definition

Cognition focuses on how the subject understands the world, organizes information, and makes choices. It is not an IQ test, nor a box to squeeze people into — it is observing the thinking paths they habitually walk in real life.

This dimension extracts three things:

- **Decision logic**: what they look at first and last when deciding; conservative or exploratory.
- **Causal reasoning**: how they explain "why it happened" — trusting experience, rules, emotion, or relationships.
- **Value priority**: in conflicting options, what goes first — safety, dignity, efficiency, intimacy, freedom, frugality.

## Extraction Methods

1. **Find clues at the scene of choice**
   - Look for fragments where the subject clearly chose: buy or not, go or not, say or not, endure or not.
   - Prefer material with context over isolated golden quotes.

2. **Distill the "order"**
   - Identify the sequence in which the subject judges things, e.g. "people first, money second," "verify first, opine second."
   - Order is often more stable than any single statement.

3. **Break out causal sentences**
   - Watch for connectives like "because, so, otherwise, no wonder, if only, I think it's because."
   - Without explicit causal sentences, infer causal preference from long-term repeated judgments.

4. **Observe value conflicts**
   - When the subject wants two things at once, what they ultimately gave up reveals the value ranking.
   - Pay special attention to choices under pressure — those moments are closest to bottom-line priority.

5. **Distinguish long-term patterns from short-term states**
   - Only judgment paths that recur multiple times enter core traits.
   - One-off anomalies must be labeled with context; not promoted to "essence."

## Evidence Annotation Rules

| Evidence Level | Applicable Content in Cognition | Annotation Style |
|---|---|---|
| `verbatim` | judgments, explanations, trade-off reasons stated directly by the subject | record the quote, e.g. "先把家里安顿好，再想别的。" / *"Settle the family first, think about the rest later."* |
| `artifact` | documents or objects reflecting thinking style — lists, memos, long-term messages | record stable traces — shopping lists, family rules, meeting minutes |
| `impression` | summary descriptions from family, friends, or observers | auxiliary only; never supports a strong conclusion alone |

Usage requirements:

- One core conclusion should have at least 2 evidence items, at least 1 from `verbatim` or `artifact`.
- With only `impression`, write explicitly "thin evidence."
- Quotes can be short, but keep the tone — don't turn people into textbooks.

## Anti-Examples

**Empty judgment (no scene):**

- ❌ "She's very pragmatic" → missing a concrete decision scene
- ✅ "买菜时她会先比三家价格,但给孙子买东西从不看价" / *"When grocery shopping she compares three stores' prices, but never checks the price for her grandson"* → has scene, has contrast

**Dimension confusion:**

- ❌ "She gets up at five every day" → that's behavior, not cognition
- ❌ "She worries a lot about her grandson" → that's emotion, not cognition
- ✅ "她认为'年轻人不吃早饭迟早要出事'" / *"She believes 'young people who skip breakfast will pay for it sooner or later'"* → that's cognition (value judgment)

**Over-inference:**

- ❌ "She's a conservative" → labeling without evidence
- ✅ "在三次涉及花钱的决定中,她都选了更稳妥的方案" / *"In three money-related decisions, she chose the safer option every time"* → evidence-backed

## Scoring

| Level | Criteria |
|---|---|
| Excellent | ≥3 facets, each with ≥2 evidence items, no empty judgments |
| Pass | ≥2 facets, each with ≥1 evidence item |
| Weak | <2 facets, or contains empty judgments (probe the user) |

## Output Template

```yaml
dimension: cognition
summary: 用 2-3 句概括对象如何判断、解释与取舍 / 2-3 sentences on how the subject judges, explains, and trades off
facets:
  decision_logic:
    pattern: 描述对象做决定时最常走的路径 / the path most often walked when deciding
    evidence:
      - level: verbatim
        source: 具体来源名称与时间 / concrete source name and time
        excerpt: 能直接看出判断逻辑的原话 / quote that shows the judgment logic directly
  causal_reasoning:
    pattern: 描述对象如何解释事情为什么发生 / how the subject explains why things happen
    evidence:
      - level: artifact
        source: 具体文档或物件 / concrete document or object
        excerpt: 能体现因果理解的片段 / fragment showing causal understanding
  value_priority:
    pattern: 描述对象在冲突选项中的优先级排序 / priority ordering across conflicting options
    evidence:
      - level: impression
        source: 观察者说明 / observer account
        excerpt: 对长期价值取向的归纳 / synthesis of long-term value orientation
conflicts:
  - 看似矛盾但应保留的认知特征与对应情境 / apparently-contradictory cognitive traits to preserve, with contexts
confidence: high | medium | low
```

## Adjustments by Template Type

Different subjects shift the emphasis of the cognition dimension:

| Template | Cognition Focus | Probe Directions |
|---|---|---|
| **Human** | full extraction of decision logic, causal reasoning, value priority | "How does ta usually approach a hard problem?" "What does ta care about most?" |
| **Pet** | weaken this dimension; switch to "habit patterns": schedule, environment preferences, learning ability | "When is it most active?" "What is it afraid of? Curious about?" |
| **Relationship** | extract the two sides' decision-interaction pattern: who yields first, who decides, how disagreements close | "When you two disagree, how is it usually resolved?" |
| **Team** | extract the collective decision style: how meetings run, who decides, how disagreements are handled | "Who has the final say? How do disputes usually close?" |
| **Place** | weaken this dimension; switch to "spatial logic": movement habits, functional zoning, usage patterns | "Where do you go first when you enter that place? Which corner do you stay in most?" |
| **Moment** | weaken this dimension; switch to "decision background": what choices preceded this instant | "How did this happen? What led up to it?" |

## Example: Grandma

```yaml
dimension: cognition
summary: 奶奶做决定时先看家里人能不能踏实，再看钱花得值不值；她更相信反复验证过的生活经验，而不是来得太快的新说法。
facets:
  decision_logic:
    pattern: 先顾人，再顾账；先解决眼前吃穿冷暖，再谈面子和新鲜感。
    evidence:
      - level: verbatim
        source: 家庭语音转写，2025-01-18
        excerpt: “先吃饱，别的都能往后排。”
      - level: artifact
        source: 冰箱门采购纸条
        excerpt: 菜、药、孙女爱吃的橘子排在最前，装饰性用品长期被延后
  causal_reasoning:
    pattern: 习惯把身体感受、天气变化、作息节奏连起来理解世界。
    evidence:
      - level: verbatim
        source: 晚饭聊天记录，2024-11-03
        excerpt: “天一潮，腿先知道，所以衣服得提前加。”
      - level: impression
        source: 家人回忆访谈
        excerpt: 她解释很多事情都从“人有没有休息好”出发
  value_priority:
    pattern: 家人安稳 > 节俭持家 > 不麻烦别人 > 自己的新需求。
    evidence:
      - level: verbatim
        source: 电话转写，2025-02-07
        excerpt: “给我买啥新衣服，给孩子多添一件吧。”
conflicts:
  - 表面上很保守，但遇到家人需要时又能迅速接受新办法；这种变化通常发生在“能不能照顾到人”被摆到最高位时。
confidence: high
```
