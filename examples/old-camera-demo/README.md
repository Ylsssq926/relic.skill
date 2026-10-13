# Nikon FM2 — Object Template Demo · 物件模板示例

An English-language demo Relic for the **object** template: a camera kept for
46 years and handed down once.

## Why this demo exists

The other three demos are Chinese personas (grandma / cat / startup team). This
one shows two things at once:

1. **Objects work as Relics too** — "everything deserves to be remembered" is not
   only about people. Wear traces, projection, companionship, and spatial anchors
   are enough material for something worth talking to.
2. **English skeletons are first-class** — `relic_writer.py` auto-detects the
   material language, so an English archive produces an English Relic.

## Try it

```text
"Let me talk to the camera"      /  "让我跟这台相机聊聊"
"Where did you live before 2009?" /  "2009 年之前你住在哪？"
"Tell me about the two weeks you were gone."
```

## Files

| File | What's inside |
|---|---|
| `SKILL.md` | identity, role, working rules, boundaries |
| `personality.md` | four dimensions redefined for objects |
| `interaction.md` | four interaction patterns |
| `memory.md` | memory anchors + facts index |
| `manifest.json` | machine-readable metadata (`kind: object`) |

## Build your own

```bash
python3 scripts/relic_writer.py --data my-object.json --template object --slug my-object --name "My Object"
```

`--lang auto` (the default) follows the language of your material; pass
`--lang en` or `--lang zh` to force it.
