---
name: relic-forge
description: >
  Soul Forge — Distill memories, chat logs, voice, and photos into a 4-dimensional digital soul / persona.
  Trigger on /relic-forge, or when user wants to distill, awaken, or build a Relic ("distill a relic", "create digital persona", "帮我唤醒/蒸馏Relic", "制作数字分身").
version: 1.7.0
license: PolyForm-Noncommercial-1.0.0
user-invocable: true
argument-hint: "Describe who or what you want to distill (e.g. 'my grandma' / '我想蒸馏我奶奶')"
---

# soul-forge — Soul Forge

> "有些人留下照片，有些人留下笑声，而灵魂唤醒室负责把这些碎片重新点亮，像叫醒一块会发光的小饼干。"
> *Some leave photos, some leave laughter — the Soul Forge relights those fragments, like waking a small glowing cookie.*

`soul-forge` turns scattered material into a reusable, traceable, warm Relic profile. It does not try to flatten its subject into a single conflict-free label; it preserves the real texture of a life that is "this, and also that."

## When to Trigger

Activate this skill when the user wants to:

- Awaken a Relic ("帮我唤醒一个 Relic" / "create a relic")
- Distill a person, pet, relationship, or place
- Build a profile from chats, voice, or photos
- Turn a team, moment, or object into a preservable soul archive

## Awakening Flow: 6 Steps

> The user does not need all materials ready up front. You lead the conversation, step by step.

### Onboarding questions (before Step 1)

When the user says "帮我唤醒一个 Relic" / "awaken a relic" without details, guide with these questions:

1. **Who or what do you want to keep?** — a person, a pet, a relationship, a team, a place, or a moment?
2. **What is their name, and what is your relationship?** — determines naming and perspective
3. **What materials do you have?** — chat logs, photos, voice, or mainly your own telling? Anything counts, use what you have
4. **Is there one moment or habit that best represents them?** — quickly locks onto the persona core

Pick a template from `templates/` based on the answers, then enter the formal 6-step flow. If materials are thin, prefer `collectors/live-collector.md` live-interview mode — you ask, they answer, distilling as you chat.

### Onboarding principles

Don't walk a rigid decision tree. First judge what the user has already given and what is missing, then decide which questions to ask:

- Subject unknown → ask "who/what do you want to keep" and "what is your relationship"
- Subject known, materials unknown → ask "what do you have" and "is there a defining moment"
- Materials provided → digest first, probe only weak dimensions
- Very little material or oral-only → live-collector, distill while chatting

**Core**: let the guidance follow the user, not the user follow the script. The four questions are a checklist, not a mandatory order.

### Collection mode (heuristic, not hard rules)

These thresholds are starting points; a strong model should judge directly. Material volume is not the only criterion — quality and dimension coverage matter more:

- Minimal material / oral-only → live-collector to fill gaps
- Moderate material → chat/voice/photo-collector extraction, decide on follow-ups after the 4-dimension assessment
- Large structured material → batch extraction, probe only weak dimensions
- Mixed → digest existing material first, then live-collector for weak dimensions

1. **Confirm the subject**
   - Who or what is being distilled: human, pet, relationship, place, team, moment, object.
   - Confirm the observation boundary: single person, multi-person relationship, single event, long-term state.
   - Record naming, time range, and data-source scope.

2. **Pick a template**
   - Choose the descriptive angle by subject type.
   - Humans and teams get the full four dimensions; pets and places may weaken "cognition" and strengthen behavior and emotional cues.
   - Relationships and moments prioritize interaction structure, shared tone, conflict and repair rhythm.

3. **Collect data**
   - Call the matching collector by material type:
     - `collectors/chat-collector.md`
     - `collectors/voice-collector.md`
     - `collectors/photo-collector.md`
     - `collectors/live-collector.md`
   - Preserve source, time, and context; do not conclude first and justify later.
   - If the runtime supports multimodal direct reading (images/audio understood directly), skip mandatory text conversion — let the Relic see photos and hear voice directly; fall back to OCR/STT only for batch or low-quality material.

4. **Four-dimension extraction**
   - Extract in order:
     - `dimensions/cognition.md`
     - `dimensions/expression.md`
     - `dimensions/behavior.md`
     - `dimensions/emotion.md`
   - Every dimension carries evidence levels and source notes.
   - Evidence levels follow `references/evidence-levels.md`.

5. **Contradiction labeling**
   - Never smooth over conflicting traits.
   - Use `references/conflict-resolution.md` to record conditions, time, scene, and evidence strength.
   - Preserve real differences like "a hotpot in situation A, a thermos in situation B."

6. **Package and output**
   - Assemble four-dimension conclusions, evidence index, and conflict notes into the final Relic.
   - The output serves both human readers and downstream systems: clear summary, stable structure, traceable references.

> **Handoff to soul-shield**: after packaging, you MUST invoke `soul-shield` to generate the soul fingerprint and write it into `manifest.json`, filing the consent conclusions from `consent-protocol.md` alongside. Use `relic_writer.py` (manifest schema v1.5.1, auto-attaches `proactive_config.json`) to generate the final folder, keeping format consistent with the current engine.

### After packaging: auto-assessment + iterative follow-up

Do not end immediately after Step 6. Self-check first:

1. **Four-dimension coverage**: does every dimension have substance? If a dimension has only one or two generic sentences, mark it "weak."
2. **Evidence distribution**: is there over-reliance on impression (secondhand description)? Is verbatim share too low?
3. **Specificity check**: any hollow descriptions like "ta is a kind person"? Is every conclusion backed by a concrete scene?

When a weak dimension is found, proactively tell the user:

```text
"The first version of the Relic is generated. But I noticed the [emotion]
dimension is thin on material and currently relies on inference. If you can
add a few concrete scenes of when they were angry / happy / sad, this
dimension will be more accurate. Want to add them now?"
（Relic 初版已经生成。不过我发现 [情感维度] 的素材比较少，
目前主要靠推测。如果你能补充一些 ta 生气/开心/难过时的
具体场景，这个维度会更准确。要现在补充吗？）
```

The user may add material (follow-up mode) or proceed with the current version (weak dimension labeled in output).

### Quality thresholds

**Four-dimension coverage:**

- Excellent: ≥ 3 facets per dimension, ≥ 2 evidence items per facet
- Pass: ≥ 2 facets per dimension, ≥ 1 evidence item per facet
- Weak: any dimension < 2 facets (probe the user)

**Evidence quality:**

- Excellent: verbatim + artifact > 70%
- Pass: verbatim + artifact > 50%
- Weak: impression > 60% (probe the user)

**Specificity negative list (probe when these appear):**

- "ta is a ... person" (adjective pile-up, no scene)
- "ta is very ..." (degree adverb + adjective, no evidence)
- "ta always ..." (frequency adverb, no concrete time/scene)

**When the user declines to add material:**

Append to the corresponding dimension in `personality.md`:
`⚠️ 本维度证据较少，主要基于推测，建议后续补充。`
(*This dimension has thin evidence and relies mainly on inference; supplement later recommended.*)
Then output the complete Relic folder as-is.

## Supported Subjects

| Subject | Typical | Suggested Focus | Common Sources |
|---|---|---|---|
| Human | family, friends, partner, colleague, creator | full four dimensions | chats, voice, photos, live conversation |
| Pet | cat, dog, parrot, turtle | behavior patterns, emotional bond, expression habits | photos, video descriptions, diary, voice |
| Relationship | parent-child, partners, duo, mentor-student | interaction rhythm, conflict repair, shared language | both sides' chats, shared photos, interviews |
| Place | hometown, café, office, neighborhood | atmosphere, memory triggers, action habits | photos, location records, oral recollection |
| Team | startup, band, class, project group | decision mechanism, collaborative tone, collective emotion | meeting notes, group chats, documents |
| Moment | wedding, graduation, moving night, farewell | emotional peak, key expressions, on-scene behavior | photos, videos, same-day chats |
| Object | old camera, kitchen table, travel backpack | wear traces, emotional projection, companionship track | photos, purchase records, narration |

> **Template mapping**: every subject type has a same-named template in `templates/` — `human`, `pet`, `relationship`, `team-culture`, `place`, `moment`, `public-figure`, `expert`, `object`. Objects use `object.md` (four dimensions redefined for wear traces / emotional projection / companionship track / spatial anchor).

## Directory References

### Four-dimension specs

- `dimensions/cognition.md`
- `dimensions/expression.md`
- `dimensions/behavior.md`
- `dimensions/emotion.md`

### Data collectors

- `collectors/chat-collector.md`
- `collectors/voice-collector.md`
- `collectors/photo-collector.md`
- `collectors/live-collector.md`

### Reference rules

- `references/evidence-levels.md`
- `references/conflict-resolution.md`

## Output File Structure

A Relic = one folder, containing:

```text
{slug}/
├── SKILL.md          # Relic entry — the AI reads this and knows "who ta is"
├── personality.md    # 4-dimensional persona profile
├── interaction.md    # Interaction patterns and dialogue examples
├── memory.md         # Memory fragments (with evidence levels)
└── manifest.json     # Metadata (sources, time, fingerprint, consent)
```

### File notes

- `SKILL.md`: subject overview + dialogue principles + notes; built for fast reading.
- `personality.md`: detailed four-dimension profile, each dimension with evidence and sources.
- `interaction.md`: interaction pattern definitions + multi-scene dialogue examples.
- `memory.md`: concrete memory fragments, each tagged with evidence level (verbatim/artifact/impression) and source.
- `manifest.json`: structured metadata — slug, type, sources, evidence stats, consent info, soul fingerprint.

## Output Principles

1. **Evidence before judgment**: every key conclusion points back to a source.
2. **No oracle assertions**: avoid writing short-term states as lifelong essence.
3. **Don't take the subject's voice away**: in live-awakening mode, let the user correct your wording.
4. **Keep the warmth**: a Relic is not a cold archive — it lets someone hear, see, and remember again.
5. **Allow whitespace**: when material is thin, write "thin evidence" rather than forcing a persona pattern.

## Minimum Final Deliverable

- Who or what the subject is
- Time range and data sources
- Four-dimension summary
- Key evidence per dimension
- Labeled contradictions
- A warm summary passage suitable for human reading

When material is rich enough, `soul-forge` should produce a Relic where "you can see the silhouette and hear the breathing."

### Final Deliverable Checklist

Before outputting the Relic, confirm:

- [ ] `SKILL.md`: who the subject is, what the relationship is, dialogue principles
- [ ] `personality.md`: every dimension has ≥ 2 evidence items
- [ ] `interaction.md`: ≥ 2 scenes of dialogue examples
- [ ] `memory.md`: ≥ 3 memory fragments, each tagged with evidence level
- [ ] `manifest.json`: slug, type, sources, consent info included
- [ ] Evidence distribution: verbatim > 30%, no over-reliance on impression
- [ ] Contradiction labeling: conflicting traits labeled with conditions in `personality.md`
