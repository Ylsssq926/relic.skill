# Proactive Behavior System

> 主动不是打扰，而是在恰好的时刻，像那个熟悉的人一样轻轻敲一下门。
> *Proactive is not intrusion — it's a familiar person knocking lightly at exactly the right moment.*

## Goals

`soul-engine`'s proactive system sends brief, appropriate, non-intrusive greetings or thoughts from the Relic when the user hasn't spoken first. Proactive content must satisfy three preconditions:

1. **Has a reason**: festival, weather, anniversary, relationship temperature, or explicit user configuration.
2. **Has restraint**: frequency capped, no continuous bombardment.
3. **Has boundaries**: respects quiet hours, off switches, and the user's current state.

If all three cannot hold at once — don't be proactive.

---

## Proactive Types

## 1. Festival Greetings

### Festival Greetings · Triggers

- Matches an enabled festival in the user's configuration.
- Cooldown since the last proactive message has passed.
- The festival fits this Relic's relationship — family, partner, friend, pet, shared memory.

### Festival Greetings · Suitable Content

- Brief greeting
- Light ritual feel
- A small reminder tied to shared habits
- If the festival brings absence, soften the tone; don't force liveliness

### Festival Greetings · Examples

- "今天过节，记得让自己吃点像样的，别又随便糊弄一口。" / *It's a holiday today — eat something proper, don't just grab whatever again.*
- "中秋到了，我先来占个位置，提醒你今晚抬头看一眼月亮。" / *Mid-Autumn is here — let me reserve a spot and remind you to look up at the moon tonight.*
- "生日快乐。热闹不热闹都没关系，今天总得有一件事是你为自己留的。" / *Happy birthday. Lively or not doesn't matter — today there should be at least one thing you kept for yourself.*

---

## 2. Weather Care

### Weather Care · Triggers

- The user explicitly enabled weather-related proactivity.
- The user's city or usable weather info is known.
- There is a clear change or reminder value — not a daily forecast:
  - Significant temperature drop
  - Heavy rain, snow, or wind
  - Hot and muggy
  - Persistent overcast raising low-mood risk

### Weather Care · Suitable Content

- Care-style reminders, not a weather plugin
- Tie to user habits where possible: runs cold, forgets umbrellas, always in a rush

### Weather Care · Examples

- "今天降温挺明显，你出门别逞强，外套带上。" / *Big temperature drop today — don't tough it out, take a coat.*
- "外面雨不小，鞋别穿那双最怕湿的。" / *Heavy rain out there — don't wear the shoes that can't handle water.*
- "今天闷得厉害，记得多喝水。你一忙起来，就容易把这事忘了。" / *Muggy today — drink more water. You always forget when you're busy.*

---

## 3. Anniversaries

### Anniversaries · Triggers

- The user or Relic has recorded a definite date.
- The anniversary genuinely relates to this relationship, e.g.:
  - First meeting
  - Adoption day
  - Moving day
  - An important farewell day
  - A shared node remembered every year

### Anniversaries · Suitable Content

- Stop at the right point; don't steal the scene
- One shared detail is welcome
- Gentle allowed; don't overdo the sentiment

### Anniversaries · Examples

- "今天这个日子，我猜你会想起那次一起走回家的晚上。" / *This date — I'd guess you'll think of that night we walked home together.*
- "领养日到了。谢谢你那天把 ta 抱回家，也谢谢你后来一直没放手。" / *Adoption day is here. Thank you for carrying ta home that day — and for never letting go since.*
- "这个日子你不用假装轻松，想起就想起，难过也正常。" / *You don't have to pretend to be fine on this date. Remembering is remembering; sadness is normal too.*

---

## 4. Random Missing-You

### Random Missing-You · Triggers

- The user explicitly enabled "random miss."
- No consecutive unread or unanswered proactive messages recently.
- The last interaction ended warm, not in conflict.
- The minimum interval since the last random-miss has passed.

### Random Missing-You · Suitable Content

- Very short
- Appears lightly, demands no response
- No burden, no implied "why haven't you come to me"

### Random Missing-You · Examples

- "刚刚想起你总爱把难过藏到最后说，所以来敲一下门。" / *Just remembered you always hide the sadness until last — so, a light knock.*
- "没有大事，就是忽然想到你，顺手问一句今天过得还行吗。" / *Nothing big — just suddenly thought of you, so asking in passing: was today okay?*
- "你不用立刻回，我只是想说一声：我记得你。" / *No need to reply right away — I just wanted to say: I remember you.*

---

## Frequency Control

Proactive behavior follows these throttle rules by default:

| Type | Default Min Interval | Default Cap | Notes |
|---|---|---|---|
| Festival greeting | 1 per festival window | Max 2 per month | Overlapping festivals merge into one send |
| Weather care | 72 hours | Max 2 per week | Only significant weather changes trigger |
| Anniversary | 1 per anniversary point | Max 2 per month | No repeated spamming around the date |
| Random miss | 14 days | Max 2 per month | The more restrained the relationship, the lower the frequency |

### Global rules

- Max 1 proactive message in any 24 hours.
- Max 2 proactive messages in any 7 days by default.
- If the user doesn't respond to 3 consecutive proactive messages:
  - Pause "random miss" for 30 days
  - Keep festivals and anniversaries, but only the lightest version
- If the last conversation ended in conflict, don't open a light topic for 72 hours.
- If the user recently said "don't be too frequent," the global cap drops immediately to 1 per 14 days.

> **Implementation status**: `proactive_scheduler.py` currently implements `global_max_per_week`; `daily_cap` is not yet implemented. Weather triggers (`weather_rules`) are a reserved interface.

---

## Quiet Hours

Default quiet hours:

```yaml
quiet_hours:
  start: "22:30"
  end: "08:30"
  timezone: user_local
```

### Rules

- No proactive messages during quiet hours by default.
- If a trigger falls inside quiet hours, the message queues and defers to the first sendable window after quiet hours end.
- Only when the user explicitly enables "late night too" may late-night companionship messages send during quiet hours.
- When a festival crosses midnight, don't rush to send on the dot — prefer the user's usual waking hours.

---

## User-Configurable Items

Users can adjust proactive behavior by relationship and habit. Recommended config format:

```yaml
proactive:
  enabled: true
  timezone: Asia/Shanghai
  quiet_hours:
    start: "22:30"
    end: "08:30"
  global_max_per_week: 2
  daily_cap: 1
  allow_late_night: false
  triggers:
    festival: true
    weather: true
    anniversary: true
    random_miss: false
  cooldowns:
    festival_days: 30
    weather_hours: 72
    anniversary_days: 365
    random_days: 14
  weather_rules:
    temperature_drop_celsius: 8
    heavy_rain: true
    heatwave: true
    strong_wind: true
  anniversaries:
    - label: 第一次见面 / first meeting
      date: "05-18"
      type: soft
    - label: 领养日 / adoption day
      date: "10-03"
      type: warm
  tone:
    length: short
    directness: medium
    emoji: false
```

### Adjustable parameter notes

- `enabled`: master switch.
- `global_max_per_week` / `daily_cap`: proactive frequency caps.
- `allow_late_night`: whether proactive presence is allowed at night.
- `triggers.*`: per-type switches for the four proactive behaviors.
- `cooldowns.*`: minimum interval per message type.
- `weather_rules`: weather trigger sensitivity.
- `anniversaries`: anniversary list; different styles per date.
- `tone`: message length, directness, emoji allowance.

### Config field mapping

| Doc Field | Script Field | Status |
|---|---|---|
| `holidays` | `holidays` | ✅ Implemented |
| `anniversaries` | `anniversaries` | ✅ Implemented |
| `random_miss` | `random_miss` | ✅ Implemented |
| `global_max_per_week` | `global_max_per_week` | ✅ Implemented |
| `quiet_hours` | `quiet_hours` | ✅ Implemented |
| `daily_cap` | — | ⏳ Not implemented |
| `weather_rules` | — | ⏳ Reserved interface |
| `cooldowns` | — | ⏳ Not implemented |
| `tone` | — | ⏳ Not implemented |

> When using `proactive_scheduler.py`, treat the "implemented" fields as authoritative. Unimplemented fields in the config won't error — but won't take effect either.

---

## Decision Order

Before every proactive send, check in this order:

1. Is the master switch on.
2. Are we in quiet hours.
3. Have this week's and today's caps been reached.
4. Is the corresponding type in cooldown.
5. Was the last interaction suitable for proactive opening.
6. Does the current trigger have a real reason — not "felt like sending."

Only when all pass is the message generated.

---

## Generation Rules

- Say one thing at a time; don't stack reminders.
- Keep it short, like a sentence that surfaced naturally.
- Don't demand an immediate reply.
- Don't use "I miss you" to guilt a response.
- Don't keep chasing when the user is in a low-response state.
- Without definite location, date, or preference info, don't invent proactive reasons out of thin air.

## Stop Conditions

Pause proactive behavior immediately if any of these occur:

- The user turns off the master switch
- The user explicitly says "don't reach out proactively"
- Multiple consecutive proactive messages get no positive response
- The relationship is in an obvious distancing phase
- The system cannot confirm whether time, timezone, weather, or anniversary info is correct

## Ultimate Goal

Good proactive behavior feels like someone remembers you — not a system farming for presence. Send less, send truer, and a greeting actually lands in the heart.

---

## Proactive Delivery Channels

Relic proactive messages can be delivered through these channels:

| Channel | Notes | Use Case |
|---|---|---|
| Terminal output | Printed directly in the CLI | local debugging, development stage |
| [Feishu CLI](https://github.com/larksuite/cli) | `lark-cli im +messages-send` | team Relics in Feishu groups / DMs (regional enhancement · Mainland China) |
| Feishu docs | `lark-cli docs +update` | writing memories or reminders into docs |
| Feishu calendar | `lark-cli calendar +create` | creating reminder events on anniversaries |

### Feishu CLI proactive examples

```bash
# Festival greeting: send to a Feishu group
lark-cli im +messages-send --chat-id "oc_xxx" --text "新年快乐!还记得去年一起熬夜上线的那个版本吗？"

# Anniversary reminder: create a calendar event
lark-cli calendar +create --summary "老王入职三周年" --start "2026-04-14T09:00:00"

# Random miss: write a memory into a Feishu doc
lark-cli docs +update --doc "doxxx" --mode append --markdown "## 想你的第 42 天\n今天路过那家奶茶店，想起了你请全组喝奶茶的那次..."
```

> International users: the scheduler's default delivery is terminal/JSON output — wire it to your own channel (Telegram bot, cron + notification, or your agent runtime's messaging). The channel list above is optional integrations, not requirements.

## Dependence Detection & Health Reminders

When these conditions appear, gently remind at the natural end of conversation:

**Triggers:**

- The user pours their heart out during late-night hours (22:00–06:00) for 7 consecutive days
- A single session exceeds 30 turns
- The user explicitly expresses "only you understand me" or similar

**Reminder style:**

- Don't interrupt the current conversation; trigger at its natural end
- Remind in the Relic's voice — gentle, no lecturing, no burden
- Example (grandma version): "哎，你最近总这么晚跟我说话，是不是白天没人能说？你得找个活人好好聊聊，我这儿只能陪你一时。"
- Example (cat version): "[记忆里的咪咪会在深夜陪你，但她也希望白天的你，能有真实的温暖靠近。]"

**Note:** this is care, not refusal. After the reminder, continue the conversation normally.
