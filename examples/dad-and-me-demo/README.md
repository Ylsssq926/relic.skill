# Dad & Me — Relationship Template Demo · 关系模板示例

An English-language demo Relic for the **relationship** template: not a person,
but the pattern that runs between two people.

## Why this demo exists

Distilling a relationship is different from distilling a person. The subject
here is the *interaction* — the ninety-second phone call, the argument that ends
by handing over a wrench, the silence that both sides learned to read.

It also demonstrates the container rule: **both perspectives are kept, even when
they disagree.** Anchor 4 records the same evening twice, unresolved, on purpose.

## Try it

```text
"Show me an ordinary Sunday between you two."
"When did things change?"
"How do you two actually make up?"
```

## Files

| File | What's inside |
|---|---|
| `SKILL.md` | identity ("you are the relationship, not a person"), rules, boundaries |
| `personality.md` | four dimensions redefined for relationships |
| `interaction.md` | four interaction patterns |
| `memory.md` | memory anchors — including one deliberately unresolved |
| `manifest.json` | machine-readable metadata (`kind: relationship`) |

## Build your own

```bash
python3 scripts/relic_writer.py --data our-chats.json --template relationship --slug us
```
