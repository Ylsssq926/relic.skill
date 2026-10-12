# Behavior (行为模式)

> “习惯像一串小脚印，白天看不见，回头一照才发现它们一直排得整整齐齐。”
> *Habits are like a trail of small footprints — invisible by day; look back and they've been in neat rows all along.*

## Dimension Definition

Behavior focuses on the subject's recurring ways of doing things: daily habits, stress responses, social patterns, and the life rhythm of "does the body move first or the mouth." It records observable behavior — it does not write one bad day as a permanent label.

This dimension extracts three things:

- **Daily habits**: recurring action rhythms across a day, a week, a season.
- **Stress response**: what happens first in body and action when pressure, conflict, busyness, or shock arrives.
- **Social patterns**: how they approach others, keep distance, and where they sit in a group.

## Extraction Methods

1. **Build a timeline**
   - Put behavior back in time: mornings, mealtimes, nights, weekends, festivals, travel, post-conflict.
   - Timelines distinguish one-off behavior from stable habit.

2. **Prioritize "repeated actions"**
   - Watch for recurring small actions: washing hands on getting home, pouring water while talking, tidying the desk when nervous, sending photos when happy.
   - Small actions are often more honest than big events.

3. **Break out the pressure switch point**
   - See what the subject does first under pressure: silence, action, asking for help, or making a joke.
   - Record trigger conditions and duration; don't write a short-term protection mechanism as the whole persona.

4. **Observe interaction distance**
   - Actively organizing gatherings, or quietly preparing food; quick to reply, or better at showing up offline.
   - Social patterns include both the liveliness and the way of stepping back.

5. **Cross-validate with multiple sources**
   - Behavior is best supported simultaneously by chats, photos, others' observations, or time records.
   - With a single source, lower the conclusion strength.

## Evidence Annotation Rules

| Evidence Level | Applicable Content in Behavior | Annotation Style |
|---|---|---|
| `verbatim` | the subject describing their own habits or current actions | record "I always..." / "when I'm anxious I..." |
| `artifact` | schedules, lists, photo timelines, location records, visible traces | supports repeated behavior and life rhythm |
| `impression` | interaction and response patterns observed by others over time | supplements social atmosphere and stress performance |

Usage requirements:

- Behavioral conclusions should be supported by at least one timeline evidence.
- Don't write one high-pressure loss of control as "this is just how this person is."
- Be concrete to the action where possible; no abstract adjectives alone.

## Anti-Examples

**Empty description without action:**

- ❌ "She's very diligent" → no concrete action
- ✅ "每天早上五点起床,先烧水,再扫院子,然后去菜市场" / *"Gets up at five every morning: boils water first, sweeps the yard, then goes to the market"* → has time, has action sequence

**Habit without frequency:**

- ❌ "She likes walking" → how often?
- ✅ "每天晚饭后在小区里走三圈,雷打不动" / *"Walks three laps around the complex after dinner every day, no exceptions"* → has frequency, has scene

## Behavioral Event Structure

Each behavioral trait should include: trigger → action → frequency → duration → recovery mode

## Scoring

| Level | Criteria |
|---|---|
| Excellent | ≥3 behavioral traits, each with trigger + action + frequency, with ≥2 evidence items |
| Pass | ≥2 behavioral traits, each with ≥1 evidence item |
| Weak | <2 behavioral traits, or only action-less descriptions like "ta is very diligent" (probe the user) |

## Output Template

```yaml
dimension: behavior
summary: 用 2-3 句概括对象平时怎么做事、遇事怎么反应、如何与人来往 / 2-3 sentences on how they work, react, and relate
facets:
  daily_routines:
    pattern: 描述稳定重复的生活动作与节奏 / stable, repeated life actions and rhythm
    evidence:
      - level: artifact
        source: 时间线、照片或记录 / timeline, photos, or records
        excerpt: 能体现重复行为的片段 / fragment showing repeated behavior
  stress_response:
    pattern: 描述压力来时的首要动作与变化 / first action and change under pressure
    evidence:
      - level: verbatim
        source: 对象原话或事后复盘 / the subject's own words or retrospective
        excerpt: 能体现应激反应的句子 / sentence showing stress response
  social_pattern:
    pattern: 描述对象靠近、照顾、拒绝或退出社交的方式 / how they approach, care for, refuse, or exit socializing
    evidence:
      - level: impression
        source: 长期相处者观察 / long-term companion observation
        excerpt: 对社交方式的归纳 / synthesis of social style
  engine_hints:
    daily_routine:
      - trigger: "[触发器 / trigger]"
        action: "[具体动作 / concrete action]"
        frequency: "[每天/每周/特定场景 / daily/weekly/specific scene]"
    stress_response: "[压力下的典型反应 / typical response under pressure]"
    social_pattern: "[社交模式：主动/被动/选择性 / social pattern: active/passive/selective]"
conflicts:
  - 在不同场景下出现反差行为的说明 / contrasting behaviors across scenes
confidence: high | medium | low
```

## Example: Grandma

```yaml
dimension: behavior
summary: 奶奶的日常像一台轻声运转的小钟表，很多关心都藏在提前准备里；一有压力，她先动手，不先慌张，在社交上更擅长用照料而不是热闹来靠近别人。
facets:
  daily_routines:
    pattern: 早起先开窗，再烧水；做饭时习惯多做一点，默认“有人回家就能吃上”。
    evidence:
      - level: artifact
        source: 厨房照片时间线，2024-10 至 2025-02
        excerpt: 多张清晨照片显示窗户已开、热水壶启动、备菜提前完成
      - level: verbatim
        source: 语音转写，2025-01-09
        excerpt: “饭多煮一口，谁回来都不至于空着。”
  stress_response:
    pattern: 紧张时不会高声表达，通常先收拾、先确认、先把能做的事做掉。
    evidence:
      - level: verbatim
        source: 电话转写，2024-12-02
        excerpt: “你先告诉我到哪了，我把东西给你备上。”
      - level: impression
        source: 家人观察记录
        excerpt: 她越着急越会去擦桌子、装袋子、检查门窗
  social_pattern:
    pattern: 不爱抢话题中心，但很会通过送水果、留饭、记住节气来维持关系温度。
    evidence:
      - level: impression
        source: 家庭回忆访谈
        excerpt: 大家都说她不是最会聊天的人，却总是最先把需要的东西准备好
conflicts:
  - 平时不爱麻烦别人，但在家人有需要时会立刻变得非常主动，甚至一口气安排好三四件事。
confidence: high
```

## Adjustments by Template Type

| Template | Behavior Focus | Probe Directions |
|---|---|---|
| **Human** | daily habits, stress response, social patterns, time regularity | "What's the first thing ta does each morning?" "How is ta under pressure?" |
| **Pet** | switch to "life rhythm": daily timeline, feeding regularity, territory patrols, seasonal changes | "What's its daily schedule?" "What fixed little rituals does it have?" |
| **Relationship** | extract interaction behavior: who initiates contact, how often you meet, how you celebrate, how you go cold | "How do you two usually stay in touch? How often do you meet? Who softens first after a fight?" |
| **Team** | extract collaboration behavior: division of labor, meeting style, pre-deadline state | "What does a crunch time look like? Who arrives first, leaves last?" |
| **Place** | switch to "usage behavior": movement lines in that space, favorite spots, seasonal changes | "How do you spend a day there? Which seat do you sit in most?" |
| **Moment** | extract behavioral details of that time: who did what, in what order, what actions | "What exactly happened that day? What came first, what after?" |
