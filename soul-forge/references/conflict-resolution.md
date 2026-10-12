# Conflict Resolution Strategy

> “人不是数学题，不必把每个‘可是’都解掉；有时矛盾本身就是答案。”
> *People are not math problems — you don't have to solve every "but." Sometimes the contradiction IS the answer.*

## Core Principle

In `soul-forge`, contradiction is not noise — it's the real trajectory of a subject switching across time, relationships, pressure, and roles. The handling principle is simple: **do not eliminate contradictions; label and preserve them.**

The goal is not to grind a person into one smooth conclusion, but to let the Relic honestly present: when this subject is like wind, and when like a lamp.

## Common Conflict Types

| Type | Example | Handling Focus |
|---|---|---|
| Temporal | adventurous when young, stability-seeking lately | mark the time range; don't force old traits onto now |
| Scene | lively with familiars, quiet with strangers | mark relationship and environmental conditions |
| Role | decisive at work, hesitant at home | mark role switching and responsibility structure |
| Emotional | says "I'm fine," repeatedly checks in action | keep both surface expression and deep behavior |
| Source | self-account vs. others' observation disagree | keep both perspectives, note evidence levels |
| Data quality | OCR disagrees with the original image | quality-mark first; lower that evidence's weight when necessary |

## Handling Flow

1. **First confirm it's a "real conflict"**
   - Some clashes are just data-quality issues — transcription errors, screenshots missing context.
   - Clear the errors first, then handle genuine personality, emotional, or behavioral contrast.

2. **Write both conclusions side by side**
   - Don't rush to pick a side.
   - Write out both trait A and trait B fully, each with its evidence source.

3. **Add the trigger conditions**
   - State the time range, relationship, pressure level, and setting where the contradiction appears.
   - Many contrasts, once conditioned, turn from "self-contradiction" into "situational switching."

4. **Note evidence strength**
   - Tag both conclusions with `verbatim / artifact / impression` respectively.
   - Strong evidence doesn't invalidate weak evidence — it just means the writing tone should be steadier.

5. **Preserve the unresolved state**
   - If you can't yet judge which side is more stable, write explicitly "not converged for now."
   - A Relic can honestly keep its wobble; no need to fake a final answer.

## Recommended Annotation Template

```yaml
conflict:
  trait_a: 第一条看似冲突的特征 / first apparently-conflicting trait
  trait_b: 第二条看似冲突的特征 / second apparently-conflicting trait
  conditions:
    trait_a: 更容易出现的时间、关系或场景 / time, relationship, or scene where it appears more
    trait_b: 更容易出现的时间、关系或场景 / time, relationship, or scene where it appears more
  evidence:
    trait_a:
      - level: verbatim | artifact | impression
        source: 对应来源 / corresponding source
        excerpt: 对应片段 / corresponding excerpt
    trait_b:
      - level: verbatim | artifact | impression
        source: 对应来源 / corresponding source
        excerpt: 对应片段 / corresponding excerpt
  resolution_note: 不做合并结论时，说明为什么保留双态 / when not merging, explain why both states are kept
```

## Examples

### Example 1: lively and quiet coexisting

- `trait_a`: very talkative and detail-rich with family.
- `trait_b`: visibly restrained at strangers' dinners, never opens topics.
- `conditions`: different relationship familiarity.
- `resolution_note`: this is not a contradiction — it's social switching between "open with the intimate, closed with the unfamiliar."

### Example 2: casual in words, deeply invested in action

- `trait_a`: often says "I'm fine, you all keep busy."
- `trait_b`: leaves the light on, waits for messages, repeatedly confirms you're home.
- `conditions`: the expression layer avoids burdening others; the behavior layer keeps watching over.
- `resolution_note`: surface language and deep care hold simultaneously — never keep only one side.

## Writing Guidelines

- No erasing sentence patterns like "actually he's not at all..."
- Prefer "in ... more like ..., in ... more like ..."
- Explanations of contradiction must rest on evidence, not the author's imaginative fill-in.
- If the conflict isn't yet explained by the material, write directly "needs more evidence to observe."

## Final Principle

矛盾不是瑕疵，而是生命的折痕。`soul-forge` 的任务不是把折痕熨平，而是把它标清楚，让后来者知道：这个人、这段关系、这个地方，为什么会同时拥有两种看起来相反、却都真实存在的光。

*Contradiction is not a flaw — it is the crease of a life. `soul-forge`'s job is not to iron the crease flat, but to mark it clearly, so those who come after know: why this person, this relationship, this place can hold two seemingly opposite — yet both real — lights at once.*
