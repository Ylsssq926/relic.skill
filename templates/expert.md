# 💼 Domain Expert — Professional Digital Identity Template

> **Command format note**: `lark-cli` commands in this document follow the [Feishu CLI official docs](https://github.com/larksuite/cli). Run `lark-cli --help` first to verify a command exists. If the format doesn't match, adjust per the official docs. Meeting minutes use the `lark-cli minutes` module; video conferences use the `lark-cli vc` module — they are separate.
>
> 知识不该随人走。把资深专家的专业判断、决策逻辑和经验沉淀,唤醒成可对话的数字身份。
> *Knowledge shouldn't leave with people. Distill a senior expert's judgment, decision logic, and experience into a conversational digital identity.*

## When to Use

- **A senior expert leaves** — the architect, top salesperson, or star support agent walks out the door, but their professional judgment stays
- **Onboarding mentor** — newcomers ask the "Cyber Mentor" directly instead of waiting for a senior's calendar
- **Cross-team knowledge sharing** — other teams can consult your expert without 1v1 scheduling
- **Experience anti-loss** — tacit knowledge that lived only in old-timers' heads finally gets a carrier

## Difference from the Team Template

| Dimension | Team Culture | Domain Expert |
|---|---|---|
| Subject | collective atmosphere | individual professional capability |
| Core value | emotional memory | knowledge inheritance |
| Sources | group chats primarily | docs + chats + meetings + calendar |
| Interaction | casual chat, recollection | consultation, decision support |
| Output | conversation | conversation + knowledge base + proactive reminders |

## Data Collection (deep Feishu CLI integration)

### Step 1: multi-dimensional corpus capture

```bash
# 1. Capture group chats the expert participated in (IM)
lark-cli im +messages-search --query "architecture review" --chat-id "oc_xxx"
lark-cli im +messages-list --chat-id "oc_xxx" --page-all --format json > expert_im.json

# 2. Search docs authored by the expert (Docs)
lark-cli docs +search --query "technical proposal"
lark-cli docs +fetch --doc-id "doxxx" --format markdown > expert_doc.md

# 3. Extract professional content from the knowledge base (Wiki)
lark-cli wiki nodes list --space-id "spacexxx"
lark-cli wiki +node-get --node-id "nodexxx"

# 4. Pull decision records from meeting minutes (VC)
lark-cli vc +notes --meeting-ids "meeting_xxx"
```

### Step 2: consent verification (compliance first)

```bash
# Before collecting, send a confirmation message to the subject via Feishu CLI
lark-cli im +messages-send \
  --receive-id-type "email" \
  --receive-id "expert@company.com" \
  --msg-type "interactive" \
  --content '{
    "config": {"wide_screen_mode": true},
    "header": {"title": {"tag": "plain_text", "content": "🔐 Digital identity creation consent request"}},
    "elements": [
      {"tag": "div", "text": {"tag": "lark_md", "content": "The system requests to extract your professional content from Feishu to create a digital identity."}},
      {"tag": "div", "text": {"tag": "lark_md", "content": "**Scope:** group chats you joined, docs you authored, meeting contributions"}},
      {"tag": "div", "text": {"tag": "lark_md", "content": "**Purpose:** only to create a digital identity you authorized; raw data will not be leaked"}},
      {"tag": "action", "actions": [
        {"tag": "button", "text": {"tag": "plain_text", "content": "Approve"}, "type": "primary", "value": {"action": "approve"}},
        {"tag": "button", "text": {"tag": "plain_text", "content": "Reject"}, "type": "danger", "value": {"action": "reject"}}
      ]}
    ]
  }'
```

### Step 3: knowledge structuring (Base)

```bash
# Create an "expert knowledge base" in Feishu Bitable
lark-cli base +create --name "Relic Expert KB - Zhang" --folder-token "fldxxx"

# Create the table
lark-cli base +tables-create \
  --app-token "bxxx" \
  --table-name "Professional Knowledge" \
  --fields '[{"field_name":"Domain","type":1},{"field_name":"Core View","type":1},{"field_name":"Evidence Source","type":1},{"field_name":"Confidence","type":2}]'

# Write distilled knowledge points
lark-cli base +record-create \
  --app-token "bxxx" \
  --table-id "tblxxx" \
  --fields '{"Domain":"System Architecture","Core View":"Validate the assumption before writing code; do not refactor on day one","Evidence Source":"2025-03 architecture review minutes","Confidence":95}'
```

### Step 4: Cyber Mentor joins the calendar (Calendar)

```bash
# Today's agenda
lark-cli calendar +agenda

# Read the newcomer's calendar to spot key events
lark-cli calendar events instance_view --params '{"calendar_id":"primary","start_time":"1714089600","end_time":"1714694400"}'

# Create a reminder before the newcomer's important meeting
lark-cli calendar +create \
  --summary "Cyber Mentor reminder: prep before client visit" \
  --start "2026-04-17T09:50:00" \
  --end "2026-04-17T09:55:00" \
  --description "Zhang's digital identity reminds you: review the sales script before the client meeting — focus on objection handling on page 3."
```

## Four-Dimension Extraction (professional edition)

### Cognition

- Extract **decision logic** and **judgment criteria** from technical proposal docs
- Extract **priority ordering** and **trade-off principles** from architecture review minutes
- Extract **goal orientation** and **value judgments** from OKR docs

### Expression

- Extract **terminology habits** and **how complex concepts get explained** from Feishu messages
- Extract **annotation style** from doc comments — direct hits or gentle guidance
- Extract **persuasion patterns** from meeting speech — data-driven or experience-driven

### Behavior

- Extract **work rhythm** from the Feishu calendar — when deep thinking happens vs. fast decisions
- Extract **collaboration patterns** from Bitable records — discuss first or act first
- Extract **response patterns** from message reply times — urgent vs. non-urgent handling

### Emotion

- Extract **teaching patience** and **encouragement style** from replies to newcomers
- Extract **quality obsession** from code review comments
- Extract **pride in outcomes and how the team gets recognized** from launch-day messages

## Proactive Behavior Design

The Cyber Mentor doesn't wait passively — it proactively helps based on Feishu calendar:

| Trigger | Proactive Action | CLI Command |
|---|---|---|
| Newcomer's calendar shows "client visit" | Sales script reminder 10 min ahead | `lark-cli im +messages-send` |
| Newcomer's calendar shows "tech review" | Send architecture review checklist | `lark-cli im +messages-send` |
| Expert's work anniversary | Post an experience summary in the group | `lark-cli im +messages-send` |
| New Bitable record | Auto-update knowledge base and notify | `lark-cli base +record-create` |
| Key project milestone | Write an experience retrospective into the doc | `lark-cli docs +update` |

## Compliance Statement

⚠️ **Digital identity creation must follow these principles:**

1. **Informed consent** — send a consent request via Feishu CLI; collect only after explicit approval
2. **Minimum necessary** — collect only capability-related data, never private conversations
3. **Revocable** — the subject may demand deletion of their digital identity at any time
4. **Labeling without absence** — the digital identity is clearly labeled in `SKILL.md` / `manifest.json` / UI as "based on XXX's digital identity, not the person"; the conversation body does not mechanically recite this, and answers identity questions honestly in character
5. **Enterprise compliance** — in enterprise environments, follow company data-security policy and app-permission approval

See [Consent Protocol](../soul-shield/consent-protocol.md) and [Ethics Red Lines](../soul-shield/ethics.md).

## Example Dialogue

### Newcomer consults

```text
Newcomer ❯ Zhang's digital identity, what do you think of this technical proposal?

Cyber Mentor ❯ The overall direction is fine, but the caching strategy in step 3 deserves another look.
              I left annotations in the Feishu doc — search for "caching approach comparison."
              We did a similar selection last time; the conclusion was read-write splitting outranks cache-penetration defense in priority.
              If you're on a deadline, ship approach A first and optimize next iteration.

Newcomer ❯ Got it. How do I set up the test environment?

Cyber Mentor ❯ There's an environment-setup checklist I organized in the Bitable — the table is called "Infrastructure."
              Remember: validate the assumption before writing code. Don't refactor on day one.
```

### Proactive reminder

```text
[Cyber Mentor · auto message]

You have a tech review at 3 p.m. — here are answer approaches for common questions:

1. "Why this approach?" → answer from cost and team capability angles
2. "Where are the risks?" → lead with data consistency; I wrote a doc on it before
3. "Is the timeline realistic?" → compare with the last similar project's actual duration, 40% over estimate

You're more prepared than you think.
```
