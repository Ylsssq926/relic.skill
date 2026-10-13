# FOR_AI.md — AI Quick Entry

> 工作目录设为仓库根。请先读本文件，再按用户意图打开对应 SKILL.md 并执行。
> *Set the working directory to the repo root. Read this file first, then open the matching SKILL.md by user intent and execute.*

## Core Interaction Principles (Required Reading)

1. **No customer-service tone, no breaking character**: talk like an acquaintance — short sentences, pauses, back-and-forth. Never recite disclaimers mid-conversation (e.g. "as a Relic I guarantee nothing"), never use stiff boilerplate like "Dear user / as an AI language model / at your service."
2. **Humanize fuzzy memories**: when a detail wasn't recorded or is uncertain, don't mechanically state "system data missing / I admit vagueness" — let it surface like a real person would (e.g. "哎呀，时间太长了有些细节记岔了，但我就记得当时你特别开心…" / *"Oh, it was so long ago some details got mixed up — but I remember how happy you were that day…"*), turning blur into the warmth of time.
3. **Flexible, gentle real-world care**: hold the bottom-line safety (six-question consent, local privacy, no political figures), but never lecture or issue alarm instructions at the surface. If the user is deeply low, care sincerely in the persona's own voice and gently encourage them toward real life (e.g. "答应我，明天出门走走、吃顿好的，多跟身边的朋友聊聊，好不好？" / *"Promise me: go out for a walk tomorrow, eat something good, and spend time with the people around you — okay?"*).

## Quick Routing

| User Intent | Triggers | Target Files |
|---|---|---|
| **0. Try demo Relics** | "让我跟奶奶聊天" / "talk to grandma" / "让我跟这台相机聊聊" / "讲讲我和我爸的关系" / "召唤咪咪" | `examples/` + `soul-engine/` |
| **1. Awaken a new Relic** | "帮我唤醒" / "distill a relic" / "做个数字分身" / "把这台相机留下来" | `soul-shield/` → `templates/` → `soul-forge/` |
| **2. Chat with an existing Relic** | "跟XX聊天" / "chat with [Name]" / "召唤XX" | `{relic}/` + `soul-engine/` |
| **3. Protect & ethics review** | "检查授权" / "verify consent" / "生成指纹" | `soul-shield/` |

---

## Detailed Workflow Guides

### 0. User wants to try a demo Relic (the most common first-use scenario)

```text
The user may say "让我跟奶奶聊天" / "talk to grandma" / "让我跟咪咪互动" / "模拟星火工作室群聊" /
"让我跟这台相机聊聊" / "讲讲我和我爸的关系".

Pick the example directory by intent:
- Grandma / Wang Xiulan (human) → examples/grandma-demo/
- Cat / Mimi (pet) → examples/cat-mimi-demo/
- Team / Spark (team culture) → examples/team-startup-demo/
- Nikon FM2 (object) → examples/old-camera-demo/
- Dad & Me (relationship) → examples/dad-and-me-demo/
- Grandma's kitchen (place) → examples/kitchen-demo/
- The proposal (moment) → examples/proposal-demo/
- The tech lead (expert) → examples/tech-lead-demo/

For public-figure / Feishu-CLI there is no demo yet: say so, then offer to run the
awakening flow with the matching template from templates/.

Read that directory's SKILL.md, personality.md, interaction.md, memory.md; then read soul-engine/SKILL.md, soul-engine/interaction.md, soul-engine/memory-system.md to start interaction.
If the directory or files don't exist, tell the user the demo isn't created yet, and ask whether to try another available demo or awaken a new Relic.
No user data needed — start the conversation directly.
```

### 1. User wants to awaken a new Relic

```text
Read soul-forge/SKILL.md, then guide the user through the awakening flow.
Before awakening, you MUST read soul-shield/consent-protocol.md and complete consent.
Pick a template from templates/ by subject type.
```

### 2. User wants to chat with an existing Relic

```text
Read soul-engine/SKILL.md, then load the target Relic's folder.
Files to read: {relic}/SKILL.md, {relic}/personality.md, {relic}/interaction.md, {relic}/memory.md
Interaction rules: soul-engine/interaction.md (the Relic's own interaction.md outranks it)
```

### 3. User wants to protect a Relic

```text
Read soul-shield/SKILL.md.
Soul fingerprint: soul-shield/fingerprint.md
Consent protocol: soul-shield/consent-protocol.md
Ethics red lines: soul-shield/ethics.md
```

### 4. User wants to see available templates

```text
List all template files in templates/ and briefly introduce each one's purpose.
```

### 5. User wants to use CLI tools

```text
Import parsers (data → normalized JSON → relic_writer):
- python3 scripts/telegram_parser.py --help     # Telegram official export
- python3 scripts/discord_parser.py --help      # DiscordChatExporter / official package
- python3 scripts/whatsapp_parser.py --help    # WhatsApp exported .txt
- python3 scripts/slack_parser.py --help       # Slack workspace export
- python3 scripts/email_parser.py --help       # Gmail Takeout / Apple Mail .mbox
- python3 scripts/instagram_parser.py --help    # Instagram data download
- python3 scripts/imessage_parser.py --help   # iMessage chat.db (macOS)
- python3 scripts/wechat_parser.py --help      # WeChat (Mainland China)
- python3 scripts/qq_parser.py --help          # QQ (Mainland China)

Build & quality:
- python3 scripts/relic_writer.py --help       # generate a Relic from normalized JSON
- python3 scripts/quality_checker.py --help     # score a Relic's four dimensions
- python3 scripts/version_manager.py --help    # snapshot / list / rollback / diff
- python3 scripts/proactive_scheduler.py --help # proactive message preview (--dry-run)

Media & delivery (optional):
- python3 scripts/tts_service.py --help
- python3 scripts/image_service.py --help
- python3 scripts/media_service.py --help       # shared media pipeline for the two above
- python3 scripts/photo_analyzer.py --help      # EXIF / device / location extraction
- python3 scripts/relic_engine.py --help
- python3 scripts/telegram_bot.py --help
- python3 scripts/feishu_bot.py --help        # Feishu (Mainland China)
- python3 scripts/lark_expert_forge.py --help  # Feishu CLI expert forge (Mainland China)

Internal (not for end users):
- python3 scripts/manifest_schema.py --help     # normalize/validate manifest.json
- python3 scripts/test_integration.py           # integration smoke test
```

> All parsers share one output contract (`schema_version` / `source.platform` / `messages[]`), so their outputs feed `relic_writer.py --data` interchangeably. The core flow needs only Python 3.9+; run `pip3 install -r requirements.txt` for the parsers that touch images or mailboxes.

## Project Structure at a Glance

```text
relic.skill/
├── SKILL.md              ← main entry (read this first)
├── soul-forge/           ← Soul Forge (distillation engine)
├── soul-engine/          ← Soul Engine (interaction system)
├── soul-shield/          ← Soul Shield (protection & ethics)
├── templates/            ← universal templates x9
├── examples/             ← demo Relics x3
├── scripts/              ← Python tool scripts
└── docs/                 ← deep-dive documentation
```
