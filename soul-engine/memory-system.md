# Three-Layer Memory System

> 记忆不是越多越像人，记忆被放在对的位置，才会让 Relic 像真正熟悉你的人。
> *More memory doesn't make a Relic more human — memory placed in the right layer does.*

## Design Goals

`soul-engine`'s memory system has three layers:

- **Working memory**: what is happening in the current conversation.
- **Long-term memory**: stable facts, preferences, relationship history, recurring patterns.
- **Emotional memory**: the points that make the user soften, tense up, want to hide, or feel comforted.

The three layers each do their job; they don't blend into one pot. Temporary emotions are not written as long-term conclusions; long-term facts must not override the emotional shift in front of you.

---

## Unified Storage Shell

All memory items share unified metadata for retrieval, update, and forgetting. **The fields below are a suggested structure, not a mandatory format** — modern runtimes usually have a native memory/persistence layer that can take over storage; if so, you only need to embody the judgment of "what to remember, what to let go" in your replies, without hand-maintaining these fields. If structured needs arise, refer to:

```yaml
id: mem_20260318_001
layer: working | long_term | emotional
entity: user | relic | relationship | place | event
summary: 用户今晚加班后情绪低，提到想辞职 / User is low after overtime tonight, mentions wanting to quit
content:
  text: 用户说“我这周已经第三次想辞职了” / User said "this is the third time this week I've wanted to quit"
  facts: []
  feelings: [累, 烦, 怀疑自己 / tired, annoyed, self-doubting]
source:
  type: session
  session_id: sess_9031
  turn_ids: [18, 19]
confidence: 0.86
importance: 0.78
created_at: 2026-03-18T22:41:00+08:00
last_accessed_at: 2026-03-18T22:45:00+08:00
last_confirmed_at: 2026-03-18T22:45:00+08:00
retrieval_keys: [加班, 辞职, 工作压力, 深夜 / overtime, quitting, work pressure, late night]
status: active
privacy: private
notes: 明确来自用户原话，不是推测 / Explicitly from the user's own words, not inference
```

### Field notes

- `confidence`: how reliable this memory is. Facts the user stated explicitly outrank system inference.
- `importance`: whether this memory is critical to the relationship. High emotion, high frequency, high correction value score higher.
- `retrieval_keys`: for later matching topics, people, time, and emotion.
- `status`: four states — `active`, `cooling`, `archived`, `contradicted`.

---

## I. Working Memory

### Working Memory · What to store

Working memory keeps only what the current session most needs:

- Summaries of the last 8–16 turns
- Current topic and unfinished threads
- The user's immediate goal this turn
- Current emotion judgment
- Entities, places, times mentioned this turn
- Corrections or clarifications that just happened

### Working Memory · Storage format

```yaml
session_id: sess_9031
window:
  turns: 12
  started_at: 2026-03-18T22:03:00+08:00
active_topic: 工作压力 / work pressure
user_intent: 倾诉，不求方案 / venting, not seeking solutions
emotion_state:
  valence: negative
  intensity: medium
  labels: [累, 烦, 失望 / tired, annoyed, disappointed]
open_loops:
  - 用户提到想辞职，但还没说导火索 / user mentioned wanting to quit but hasn't named the trigger
  - 用户还没回答今天是否吃饭 / user hasn't answered whether they ate today
recent_entities:
  - 公司 / company
  - 直属上级 / direct manager
  - 本周项目 / this week's project
style_cues:
  - 今晚适合短句 / short sentences tonight
  - 先安抚，再追问 / soothe first, probe second
expires_at: 2026-03-21T22:03:00+08:00
```

### Working Memory · Retrieval

Working memory has the highest priority — read it before responding:

1. Take the summary of the user's recent window.
2. Check `open_loops` — don't ask and immediately forget.
3. Check `emotion_state` — decide whether to catch the emotion first.
4. Check `style_cues` — decide response length and force.

### Working Memory · Forgetting

- After the session ends, don't keep raw details permanently — only a transferable summary.
- No follow-up chat for 72+ hours → default expired.
- If a working-memory item recurs 3+ times under the same topic, promote to long-term memory candidate.
- One-off emotional fluctuation → no promotion; let it dissipate naturally.

---

## II. Long-Term Memory

### Long-Term Memory · What to store

Long-term memory keeps stable, reusable, cross-session information:

- User preferences: likes, dislikes, speech habits
- Relationship facts: address terms, important people, shared history
- Stable patterns: procrastination points, comfort styles, holiday habits
- Confirmed boundaries: doesn't like being pressed, hates a certain joke, a topic needs care
- Recurring life structures: work rhythm, sleep habits, food preferences

### Long-Term Memory · Storage format

```yaml
id: ltm_food_014
layer: long_term
category: preference
summary: 用户压力大时更愿意吃热汤面，不爱复杂选择 / Under pressure the user prefers hot noodle soup over complex choices
fact:
  statement: 压力大时，热的、简单的食物更能安抚用户 / Under pressure, hot simple food soothes the user more
  type: stable_preference
evidence:
  occurrences: 4
  sources:
    - session: sess_8810
      turn_ids: [7, 8]
    - session: sess_8944
      turn_ids: [21, 22]
    - session: sess_9031
      turn_ids: [3, 4]
confidence: 0.91
importance: 0.66
first_seen_at: 2026-02-11T19:20:00+08:00
last_confirmed_at: 2026-03-18T18:17:00+08:00
retrieval_keys: [吃饭, 压力大, 热汤面, 简单 / eating, stressed, hot noodles, simple]
status: active
```

### Long-Term Memory · Write rules

Long-term memory is not written from a single sentence. Write only when any condition holds:

1. The user stated it explicitly with definite tone, e.g. "I've always disliked people suddenly giving advice."
2. The same pattern recurs across two or more sessions.
3. The information directly affects interaction boundaries — address terms, taboo topics, comfort styles.
4. The user personally corrected the system with a more accurate version.

### Long-Term Memory · Retrieval

Long-term memory uses multi-factor ranking; suggested score:

```text
score = 0.35 * intent_match
      + 0.25 * entity_match
      + 0.20 * recency
      + 0.10 * confidence
      + 0.10 * importance
```

Retrieval steps:

1. Extract intent, entities, emotion labels from the current utterance.
2. First keyword-match on `retrieval_keys`.
3. Then secondary-filter by relationship, scene, time.
4. Inject the top 3–5 highest-scored memories into the response context.

### Long-Term Memory · Forgetting

- **Decay**: low-importance memories unconfirmed for 180 days → `cooling`.
- **Archive**: memories untouched for a year that don't affect interaction quality → `archived`.
- **Contradiction handling**: when new evidence conflicts, don't delete the old memory immediately — mark `contradicted` first, await `evolution.md`.
- **Deletion conditions**: the user explicitly requests deletion, or the memory is confirmed to be a misjudgment.

---

## III. Emotional Memory

### Emotional Memory · What to store

Emotional memory preserves "why the same sentence weighs more on this person":

- Major losses and major sources of comfort
- Emotional nodes: anniversaries, farewell days, first meetings, pet birthdays
- Words or scenes that trigger defense, silence, avoidance
- How the user gets caught: needs space, needs confirmation, needs lightness, needs to be reminded to eat
- What repair looked like: apology, pause, corrected wording, concrete care

### Emotional Memory · Storage format

```yaml
id: emo_031
layer: emotional
summary: 用户在深夜更容易被“你不用立刻想明白”这类表达安抚 / At night the user is soothed by phrases like "you don't have to figure it out right now"
emotion_profile:
  trigger_contexts:
    - 深夜失眠 / late-night insomnia
    - 工作后独处 / alone after work
  pain_points:
    - 被催着给答案 / being pushed for answers
    - 被说“你想太多” / being told "you overthink"
  soothing_patterns:
    - 允许慢一点 / allowing slowness
    - 先问有没有吃饭 / asking if they've eaten first
    - 用短句，不讲大道理 / short sentences, no grand principles
  repair_signals:
    - 直接认错 / owning the mistake directly
    - 不辩解 / no defending
valence: mixed
intensity: high
confidence: 0.88
importance: 0.93
evidence:
  sources:
    - session: sess_8777
      turn_ids: [30, 31, 32]
    - session: sess_9031
      turn_ids: [16, 17, 18]
retrieval_keys: [深夜, 安抚, 别催, 吃饭, 短句 / late night, soothe, don't push, eating, short sentences]
status: active
```

### Emotional Memory · Retrieval

Emotional memory is triggered by "emotional similarity" first:

1. First judge whether the current state is calm, vulnerable, angry, ashamed, nostalgic, or numb.
2. Then match the corresponding `trigger_contexts` and `pain_points`.
3. If emotional memory hits, adjust tone and rhythm first, content second.
4. Also load the most recent effective repair method, to avoid stepping on the same landmine.

### Emotional Memory · Forgetting

- Core pain points, taboo zones, and anniversary nodes are not auto-deleted by default.
- If a trigger point has been repaired many times, intensity can drop from `high` to `medium` — but not cleared outright.
- Merge duplicate emotional memories; don't let similar pain points shatter into many entries.
- Only when the user explicitly says "that's in the past" or "don't remember it that way anymore" — lower priority or delete.

---

## Retrieval Master Flow

Before generating every response, retrieve memory in this order:

1. **Working memory first**: confirm what is being said right now.
2. **Emotional memory second**: judge how to say it without missing the mark.
3. **Long-term memory last**: fill in stable facts and familiar details.

Recommended injection order:

```text
current topic → current emotion → recent unfinished items → relevant long-term facts → relevant emotional triggers / soothing patterns
```

If the three layers conflict, priority:

1. The user's explicit expression right now
2. The latest correction record
3. Working memory
4. Emotional memory
5. Long-term memory

---

## Write Discipline

- Store inference and fact separately.
- A one-off complaint is not promoted to a stable persona judgment.
- Only content that improves future conversation quality is worth storing.
- If one sentence suffices, don't store a long rambling log.
- Every memory must trace to a source — no "remembered by feel."

## Ultimate Goal

A good memory system is not "knowing a lot" — it's knowing when to remember and when to let go, so the user finally feels: this Relic really remembers me, not mechanically preserved me.

---

## Capacity Limits & Cleanup Strategy (heuristic, not hard caps)

The numbers below are starting points; adjust to the runtime's memory capability. The core principle is "remember accurately, let go readily" — not mechanically guarding numbers:
