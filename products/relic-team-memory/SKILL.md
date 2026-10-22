---
name: relic-team-memory
description: >
  Evidence-first team memory operator for turning consented Feishu, Slack, email,
  meeting notes, and project documents into decision logs, ownership maps,
  unresolved-question queues, retrospectives, and onboarding packets.
  Use when a team says decisions are lost in chat, onboarding is slow, or a project
  needs a searchable memory layer.
version: 0.1.0
license: MIT
user-invocable: true
argument-hint: "Describe the team, project, approved sources, and desired memory output"
---

# Relic Team Memory

Turn approved team traces into source-linked operational memory. Do not summarize everything: extract decisions, context, owners, unresolved questions, and reusable lessons.

## Safety gate

Before reading material, confirm data-owner permission, participating channels, date range, audience, retention period, redaction rules, and a withdrawal route. Never ingest private conversations, credentials, customer secrets, or an entire workspace by default.

## Core outputs

- decision log with alternatives, rationale, source ids, owner, and status;
- action register with accountable person, due date, and evidence;
- unresolved questions and assumptions;
- project retrospective with what changed and why;
- onboarding packet for a new teammate;
- manifest describing source scope and review date.

## Operating loop

1. inventory sources and classify sensitivity;
2. normalize dates, speakers, channels, and document links;
3. separate fact, decision, opinion, action, and open question;
4. preserve disagreement and record conditions;
5. ask the team owner to review before publication; unresolved items must enter a follow-up queue;
6. remove or update entries when a source is withdrawn or superseded.

Every decision entry must contain `id`, `title`, `decision`, `status`, `owners`, `evidence`, and `review.reviewer`. Allowed states are `proposed`, `accepted`, `superseded`, `unknown`, and `needs-verification`. `unknown` and `needs-verification` entries must include a concrete `follow_up_question` and cannot be presented as settled team policy.

## Image placeholder

`TODO(image): add an authorized decision-flow diagram after the product visual system is approved.`
