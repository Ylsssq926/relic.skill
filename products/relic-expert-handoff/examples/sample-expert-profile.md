# Example · Northstar Platform Reliability Lead

> 完全脱敏示例。人物、公司、项目和引文均为虚构，仅用于展示结构。不得当作真实案例证明。

## Scope

- Role: platform reliability lead
- Purpose: prepare an internal onboarding and incident-response handoff
- Sources: three redacted postmortems, two architecture reviews, one approved interview
- Excluded: customer identifiers, credentials, private conversations, unapproved personnel data

## Judgment rule

```yaml
id: JR-001
title: Bound the incident before changing architecture
rule: When an incident is reported, first establish blast radius, reproduction, and rollback cost before proposing a structural rewrite.
conditions:
  applies_when: The incident is not yet bounded.
  changes_when: A confirmed security issue requires immediate isolation.
evidence:
  - source_id: S-002
    level: artifact
    excerpt: "Redacted postmortem checklist begins with impact and rollback."
confidence: medium
counterexample: Security containment can precede full diagnosis.
validation_question: What evidence proves this is broader than the current service?
status: accepted
```

## Unknown

The sample contains no evidence about vendor procurement or financial forecasting. The handoff must answer `I don't have evidence for that` and route the question to the current owner.
