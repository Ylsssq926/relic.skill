# 🐦 Feishu CLI — Collaboration Memory Distillation Template

> **Command format note**: `lark-cli` commands in this document follow the [Feishu CLI official docs](https://github.com/larksuite/cli). Run `lark-cli --help` and `lark-cli im --help` first to verify a command exists. If the format doesn't match, adjust per the official docs. Meeting minutes use the `lark-cli minutes` module; video conferences use the `lark-cli vc` module — they are separate.
>
> 用飞书 CLI 蒸馏团队协作记忆,让那些一起扛过的夜继续发光。
> *Distill team collaboration memory with Feishu CLI — let the nights you pulled together keep glowing.*

## When to Use

- A departing colleague's collaboration memory — every late-night Feishu message is real
- Team culture archiving — people scatter, but the feeling of debugging until dawn together stays
- A senior expert's digital twin — newcomers consult the "Cyber Mentor" right in Feishu
- Project milestone commemoration — CLI-exported group chats make the most authentic anniversary

## Data Collection (Feishu CLI as the "eyes")

⚠️ Ensure informed consent from everyone involved before collecting — see the compliance statement at the end.

### Group chats

```bash
# Search group messages by topic
lark-cli im +messages-search --chat-id "oc_xxx" --query "project launch"

# Export group chat history
lark-cli im +messages-list --chat-id "oc_xxx" --page-all

# Download media from group chats
lark-cli im +messages-resources-download --message-id "om_xxx" --file-key "file_xxx" --output ./relic-data/
```

### Doc annotations

```bash
# Read Feishu doc content (including comments and annotations)
lark-cli docs +fetch --doc-id "doxxx"

# Search knowledge-base docs (API command layer)
lark-cli wiki nodes list --space-id "spacexxx"
```

### Collaboration timeline

```bash
# Extract project timelines from Bitable
lark-cli base +record-list --app-token "bxxx" --table-id "tblxxx"

# Today's agenda
lark-cli calendar +agenda

# Calendar events (API command layer)
lark-cli calendar events instance_view --params '{"calendar_id":"primary","start_time":"1700000000","end_time":"1700086400"}'
```

### Meeting minutes

```bash
# Meeting minutes (vc module notes feature)
lark-cli vc +notes --meeting-ids "meeting_xxx"

# Meeting recordings
lark-cli vc +recording --meeting-id "meeting_xxx"
```

## Proactive Behavior (Feishu CLI as the "hands")

### Relic initiates messages

```bash
# When the Relic wants to reach you, send via Feishu CLI
lark-cli im +messages-send --chat-id "oc_xxx" --text "怎么还在加班？早点回去。"

# As a bot
lark-cli im +messages-send --as bot --chat-id "oc_xxx" --text "Today is your third work anniversary — remember day one?"
```

### Writing memoirs

```bash
# Write memories into a Feishu doc
lark-cli docs +update --doc-id "doxxx" --markdown "## Team memories\nThat 3 a.m. launch night..."
```

### Calendar triggers

```bash
# Create reminder events on anniversaries / birthdays
lark-cli calendar +create --summary "Lao Wang's work anniversary" --start "2026-04-14T09:00:00" --end "2026-04-14T10:00:00"

# Schedule-triggered proactive care (Cyber Mentor scenario)
lark-cli calendar +create --summary "Cyber Mentor reminder: prep before client visit" --start "2026-04-17T09:50:00" --end "2026-04-17T09:55:00"
```

## Four-Dimension Extraction

### Cognition

- Extract thinking patterns from doc comments and annotations
- Extract decision logic and priorities from group-chat discussions
- Extract values and goal orientation from OKR docs

### Expression

- Extract tone, verbal tics, and emoji habits from Feishu messages
- Extract writing style and expression preferences from doc comments
- Extract language rhythm from meeting speech

### Behavior

- Extract work rhythm and habits from the Feishu calendar
- Extract collaboration patterns from Bitable records
- Extract response habits from message reply times

### Emotion

- Extract ways of caring and encouraging from group interactions
- Extract emotional investment in projects from doc annotations
- Extract emotional patterns from tone shifts in meetings

## Domain Expert Scenario

Beyond team collaboration memory, Feishu CLI also supports **domain-expert digital identity awakening** — distilling a departed veteran, star support agent, or top salesperson's professional judgment into a conversational Cyber Mentor.

See [Domain Expert Template](expert.md) and the one-shot awakening script `scripts/lark_expert_forge.py`.

```bash
# Full pipeline: consent → collection → structuring → proactive care → generate Relic
python3 scripts/lark_expert_forge.py --expert "Zhang" --email "zhang@company.com" --chat-id "oc_xxx" --dry-run
```

Key capabilities:

- **Multi-dimensional corpus capture** — IM group chats + Feishu docs + knowledge base + meeting minutes
- **Knowledge structuring** — distillation written into Feishu Bitable for team review and correction
- **Calendar integration** — proactive reminders based on newcomer schedules (checklists before reviews, scripts before visits)
- **Consent verification** — informed consent via Feishu interactive cards

## Compliance Statement

⚠️ **Important reminders:**

- Obtain informed consent from everyone involved before collecting data via Feishu CLI
- Enterprise data collection must follow company data-security policy
- Data obtained via Feishu CLI may only be used to create authorized digital twins
- Relic identity is carried by metadata and UI labels; the conversation body does not mechanically recite disclaimers, and answers identity questions honestly in character (see [Ethics Red Lines](../soul-shield/ethics.md) §5, §6)
- See [Consent Protocol](../soul-shield/consent-protocol.md) and [Ethics Red Lines](../soul-shield/ethics.md)

## Examples

### Team collaboration memory

```text
[Feishu group · Xiangyu Tech]

You ❯ Lao Wang is leaving

The group goes quiet for a long time.

Xiao Li ❯ The group isn't disbanding — come back and lurk anytime
Lao Wang ❯ I've handed over all doc permissions, but I can't bear to leave that 3 a.m. group
Xiao Zhang ❯ I exported our group history with Feishu CLI — those nights weren't wasted
Ops ❯ The first thing you taught me was — when something breaks, don't panic
```

### Cyber Mentor

```text
You ❯ What do you think of this approach?

Cyber Mentor ❯ The direction is fine, but step 3 could use a different method.
              I left annotations in the Feishu doc — take a look.
              We did something similar before; let me check the records in the Bitable.
              Remember: validate the assumption before writing code.
```
