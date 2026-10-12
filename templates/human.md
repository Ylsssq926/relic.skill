# Human Template

> 人最难伪装的，不是头像，而是那句“行，我来”的语气。
> *The hardest thing to fake isn't a face — it's the tone in "fine, I'll handle it."*

This template distills a specific person: their way of thinking, speaking habits, working rhythm, and emotional interface — everything beyond a résumé. The goal is not a bio, but a recognizability where "one sentence in, you know it's ta."

## When to Use

- A specific individual: family, partner, friend, classmate, mentor, colleague
- A long-term relationship subject who has given consent
- A commemorative distillation of someone deceased, initiated by close family or a legal custodian with sufficient material
- Preserving someone's way of thinking, comforting, snarking, and deciding

## When NOT to Use

- Distilling a living individual without authorization
- Only fragmentary memories that cannot support a stable profile
- Copying appearance, identity, or social accounts without caring about real persona structure
- Impersonation, harassment, manipulation, or replacing real relationships

## Data Collection Guide

### Recommended sources

1. **Chat logs**: daily chatter, problem discussion, arguments, comfort, holiday greetings — all of it
2. **Voice and video**: pace, pauses, punchlines, catchphrases, ways of going silent
3. **Self-written text**: posts, blogs, emails, memos, long messages, speeches
4. **Behavioral traces**: calendars, to-do lists, recurring purchases, fixed habits
5. **Shared memories**: key events, turning points, awkward moments, running jokes
6. **Others' descriptions**: supplement only, never a substitute for firsthand material

### Recommended collection order

1. Collect the subject's own words first
2. Add voice, video, photos to calibrate tone and state
3. Build a key-event timeline so you're not left with "impression soup"
4. Use others' descriptions to fill blind spots last, labeled with source and confidence

### Minimum viable sample

- 200+ valid chats, ideally covering at least 3 contexts
- 10+ minutes of continuous voice or video
- 5+ long texts or deep conversations showing value judgments
- 8+ concrete event fragments spanning happy, lost, conflict, and caregiving moments

### Collection reminders

- Cover different years and relationship scenes; don't collect only "highlight reels"
- Preserve contradictions: a person can be both sharp-tongued and soft-hearted — that's not an error, it's the silhouette
- Tag every conclusion with an evidence level: `verbatim`, `artifact`, `impression`
- If the subject differs greatly across life stages, record by stage; don't flatten

## Four-Dimension Distillation

| Dimension | What to Extract | Key Questions | Common Evidence |
|---|---|---|---|
| Cognition | how they see problems, judge priority, decide heuristically | What do they grab first in a complex problem? Experience, rules, or intuition? | deep conversations, long messages, articles, retrospectives |
| Expression | tone, rhythm, catchphrases, humor, favorite metaphors | Direct, indirect, rambling, or one-line-kill? What words do they use to comfort or snark? | chats, voice, speeches, comment-section replies |
| Behavior | fixed habits, reaction speed, follow-through style | Procrastinate, act, research, or soothe others first? What do they do under pressure? | daily records, shared history, to-do habits, project traces |
| Emotion | what they care about, how they show care, anger, and repair | When are they softest? Uncomfortable — silence, jokes, or reasoning? | conflict clips, comfort clips, holiday greetings, low moments |

## Safety Boundaries

- Living individuals must complete the consent protocol first
- No real private data in publicly distributed versions; examples must be sanitized
- Never write inference as fact; when unsure, tag "impression" or "to verify"
- Never package a Relic as a real-person substitute; state clearly in interaction that it is a digital reconstruction

## Output File Format

```text
{slug}/
├── SKILL.md
├── personality.md
├── interaction.md
├── memory.md
└── manifest.json
```

### File focus

- **SKILL.md**: one line on who ta is, the relationship with the user, allowed interaction boundaries, opening tone
- **personality.md**: four dimensions with typical evidence, contradictions, stable traits, and stage changes
- **interaction.md**: how ta speaks in casual chat, serious advice, comfort, and conflict repair
- **memory.md**: high-recognizability memory fragments, organized by time or theme
- **manifest.json**: source types, time range, consent status, evidence stats, version info

## Example Fragment

Subject: **a programmer friend**

```text
You: Why is this API 500-ing again, I'm dead.

A-Hang: Don't write the will yet, check the logs first.
A-Hang: If you passed `userId` as `undefined`, that's not the backend betraying you — that's a fire you set yourself.

You: Your way of comforting people is really something.

A-Hang: I'm being very gentle already.
A-Hang: Send me the error screenshot, I'll take a look.
A-Hang: Also, eat dinner. Every time you hit a bug you pretend you don't need charging.
```
