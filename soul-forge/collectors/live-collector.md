# Live Conversation Collector

> “有些画像不是从旧盒子里翻出来的，而是在一句‘其实我刚刚有点难过’里当场长出来的。”
> *Some profiles aren't dug out of old boxes — they grow on the spot, inside a single sentence like "actually, I was a little sad just now."*

## Supported Inputs

Live-awakening mode collects in real time during conversation with the AI. Supported inputs:

- Text dialogue turns
- Transcribed real-time voice fragments
- Photos, chat excerpts, and voice notes the user supplies mid-conversation
- The user's corrections, negations, and additions to AI summaries
- Session-level metadata: who the subject is, what the relationship is, how much to preserve

## Collection Flow

1. **Confirm subject and boundaries**
   - At the start, clarify this awakening's subject, time range, and data boundaries.
   - Ask whether the current conversation may be used as Relic evidence.

2. **Open live recording**
   - Timestamp the session; record user quotes and key context turn by turn.
   - Strictly layer: the subject's own words, the narrator's commentary, AI paraphrase.

3. **Extract clues in real time**
   - After each turn, mark clues that may enter the four dimensions — catchphrases, conflicts, long-term habits, emotional triggers.
   - Only content the user directly provided or explicitly approved is promoted to strong evidence.

4. **Small-step echo and correction**
   - The AI may offer a short summary for confirmation, e.g. "我先记下：她担心时会先做饭，对吗？" / *"Let me note this down: when she's worried, she cooks first — right?"*
   - After the user confirms, corrects, or negates, update evidence status immediately.

5. **Preserve the change process**
   - If the user first says "he's very cold" and later adds "actually only cold to strangers," record both, labeled with the correction relation.
   - Live mode especially preserves the recognition process "from blurry to clear."

6. **Seal the session result**
   - At session end, output: new evidence added, confirmed conclusions, contradictions and uncertainties still to preserve.
   - Can go straight into four-dimension extraction, or be saved as a temporary snapshot first.

## Cleaning Rules

- User quotes and AI paraphrase must never be blended; AI restatement is not `verbatim` evidence.
- If the user corrects within the same turn, the "latest explicit expression" governs — but keep the earlier statement as process record.
- Emotionally intense real-time sentences keep their context; avoid quoting out of context.
- If the user says "don't record this," that turn's content does not enter the final evidence pool.
- Hypotheticals, jokes, and role-play in conversation are marked as non-fact-layer content.
- External attachments merely mentioned but not provided are not written as `artifact`.

## Privacy Protection

- State up front: this mode records only content relevant to the current awakening by default.
- Three session-level controls supported: "pause collection," "delete last turn," "keep nothing this session."
- Minimize recording of third-party identity info; use relationship terms instead of real names.
- Highly sensitive content — health, finances, family disputes — enters the final result only when the user explicitly wants it kept.
- If the user requests companion-style organization only, keep just the final summary after the session, not the turn-by-turn log.

## Output Format

```yaml
collector: live
mode: 活体唤醒 / live awakening
session:
  target: 本次唤醒对象 / this session's subject
  started_at: 会话开始时间 / session start
  consent: 用户是否允许将当次对话作为证据 / whether the user allows this conversation as evidence
turns:
  - turn_id: 回合编号 / turn number
    speaker: 用户 | AI / user | AI
    content: 该回合文本 / turn text
    evidence_status: raw | confirmed | corrected | excluded
    notes:
      - 是否涉及情绪高峰、修正或外部附件 / whether it involves emotional peaks, corrections, or external attachments
extracted_clues:
  - dimension: cognition | expression | behavior | emotion
    clue: 实时抽取到的线索描述 / extracted clue description
    source_turns:
      - 对应回合编号 / corresponding turn numbers
    evidence_level: verbatim | artifact | impression
    confirmation: 用户已确认 | 用户已修正 | 待保留观察 / user-confirmed | user-corrected | pending observation
conflicts:
  - 在实时对话中暴露出的反差与适用场景 / contrasts exposed in live conversation, with applicable scenes
privacy:
  retained_scope: 最终保留哪些内容 / what is ultimately retained
  redactions:
    - 已做的脱敏说明 / sanitization notes
```
