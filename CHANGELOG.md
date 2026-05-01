# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.1] - 2026-05-01

### 飞书这边，先稳住了

上一版把 RelicEngine 抽出来，飞书终于不再背着一整颗灵魂跑。

这一版没有急着堆新平台，而是回头把飞书这条路铺平一点：消息进来能验，重复消息能挡，媒体 dry-run 能跑完，多 Relic 切换有测试守着。以后再往飞书里加主动推送、状态命令、暂停恢复，就不是摸黑改了。

### Added

- 🧪 **飞书适配测试** — 新增 `tests/test_feishu_bot.py`，覆盖签名、challenge、富文本解析、群聊 @、重复消息、dry-run、媒体降级、HTTP 错误、token 缓存、多 Relic 切换和 Flask Webhook route
- 🛠️ **飞书实用命令** — 新增 `/status`、`/reset`、`/pause`、`/resume`，方便在真实聊天里查看状态、清空上下文、临时让机器人安静下来
- 🧩 **Flask 依赖声明** — `requirements.txt` 补上 Flask，避免飞书 Webhook 服务部署时才发现少依赖

### Changed

- 🔧 **飞书发送计划拆分** — `_execute_response_plan()` 拆成文本/卡片/语音/图片几个小分支，后续改媒体消息不用再碰一大坨逻辑
- 📦 **飞书 dry-run 更像真链路** — dry-run 上传图片/音频时不再要求本地文件真实存在，可以完整验证“生成路径 → 上传 → 发送”的计划
- 🧭 **版本号推进到 1.4.1** — `relic_writer.py` 新生成的 Relic 会标记为当前项目版本

### Fixed

- 飞书 v2 事件的 `header.token` 现在也会参与 Verification Token 校验，不再只看顶层 `token`
- 飞书 API 返回非 0 code 或非 JSON 响应时，会给出明确错误，不再让问题藏在后面
- Git Bash 会把 `/status` 这类测试参数改成 Windows 路径；本地 `--test-message` 现在会把它认回来
- 多 Relic 模式下 `/relics` 和 `/relic slug` 已有回归测试保护，避免群里切错人格

## [1.4.0] - 2026-04-25

### 灵魂引擎，独立了

你想让奶奶住在微信里，也想让她住在 Telegram 里。现在可以了。

Relic 不再只住在飞书里。这一版把对话的核心——人格加载、记忆筛选、模式感知、AI 生成——从飞书机器人里抽了出来，变成一个平台无关的引擎。

现在飞书和 Telegram 用的是同一颗心脏。下一个平台，接起来会更快。

### Added

- 🧠 **RelicEngine** — 平台无关的对话核心。五层动态提示词，每轮根据当前模式、当前记忆、当前关系重新构建，不再是一成不变的长文本
- 🤖 **Telegram Bot** — Relic 现在也能住在 Telegram 里，支持 Webhook 和 Long Polling 两种模式
- 🔊 **MiniMax TTS** — 中文声音克隆新选项，10 秒样本就能开始，情绪表达比之前的方案更自然
- 🎨 **图像生成服务** — 支持 Seedream（中式插画最佳）、OpenAI GPT Image、Google Imagen 4
- 📦 **统一媒体层** — `media_service.py`，一个接口搞定语音/图像，配置写在 manifest 里，不用改代码
- 📋 **manifest.json v1.4.0** — 正式的配置 schema，身份/关系/对话风格/媒体/主动行为/合规，各归其位

### Changed

- 🧬 **提示词重构** — 从"你必须/你不能"变成"ta 最先关心什么"。奶奶的提示词不再是规则手册，而是她的本能顺序
- 🔌 **feishu_bot.py 瘦身** — 飞书机器人现在只负责飞书的事：签名验证、消息收发、卡片格式。对话逻辑全部交给 RelicEngine

### Fixed

- 模式解析：深夜脆弱表达不再被"沉默模式"误判
- 模式解析：普通的"我今天好烦"不再触发冲突模式
- 会话隔离：同一用户在不同群里切换 Relic，不再互相干扰
- MiniMax TTS：修复 hex 解码错误，声音克隆流程对齐官方协议
- manifest 校验：缺少必填字段不再被默认值"洗白"

## [1.3.0] - 2026-04-22

### Added

- 🤖 **飞书机器人** — `scripts/feishu_bot.py`，让 Relic 住在飞书里，随时可以聊
- 🔊 **TTS 声音合成** — `scripts/tts_service.py`，支持豆包语音/ElevenLabs/OpenAI TTS，让 Relic 开口说话
- 🎙️ **声音克隆 POC** — 用声音样本克隆 Relic 的声音，让奶奶的声音在节日里响起
- 📢 **主动语音消息** — proactive_scheduler.py 扩展，节日/纪念日可发送语音消息

### Changed

- 🗺️ **ROADMAP 更新** — v1.3.0 调整为飞书机器人 + 声音合成，社区模板扩展顺延至 v1.4.0

## [1.2.0] - 2026-04-21

### Added

- 🐦 **飞书 CLI 深度集成** — 新增 `templates/feishu-cli.md` 和 `templates/expert.md`，支持通过飞书 CLI 蒸馏团队协作记忆和业务专家数字身份
- 🔧 **lark_expert_forge.py** — 全链路飞书 CLI 锻造脚本（授权 → 采集 → 结构化 → 主动关怀 → 生成 Relic）
- 🏆 **飞书 CLI 创作者大赛参赛作品** — 参赛场景为团队协作记忆蒸馏和业务专家数字身份锻造
- 📋 **9 种万物永生模板** — 新增业务专家（expert）和飞书 CLI（feishu-cli）两种模板
- 🌍 **10 语言 README 全量同步** — 所有语言版本补充飞书 CLI badge、模板行、参赛声明
- 🎨 **演示站全面升级** — 新图片素材（Gemini 生成，中式插画风格）、飞书 CLI 示例 Relic、OG 图配置
- 🛡️ **伦理框架增强** — 授权协议补充"已离世对象"分支、过度依赖量化标准、政治人物定义明确化
- 📊 **质量评估量化标准** — soul-forge 补充四维覆盖度、证据质量、具体性的量化标准
- 🔄 **启动决策树** — soul-forge 补充根据素材量自动选择采集模式的决策树
- 💬 **交互体验优化** — soul-engine 补充模式切换回日常的条件、记忆系统容量限制、专属规则优先级
- 📦 **示例 Relic 完善** — cat-mimi-demo 和 team-startup-demo 补充 manifest.json 和证据等级标注

### Changed

- 🔧 **飞书 CLI 命令修复** — `lark-cli vc +minutes` → `lark-cli minutes +get`（vc 和 minutes 是独立模块）
- 📝 **文案优化** — consent-protocol 六问改为对话式，soul-engine 身份标识表述更明确
- 🎯 **演示站文案** — zh.ts 和 en.ts 关键文案去 GPT 味，语气更自然
- 🗺️ **ROADMAP 更新** — v1.2.0 标记为已完成，更新当前阶段标记

### Fixed

- 🐛 **emoji 乱码** — 修复 scenarioRandom 字段的 emoji 显示问题
- 🖼️ **图片路径** — 所有图片路径统一为 .jpg 格式
- 📋 **SKILL.md 模板表格** — 补充缺失的 expert 和 feishu-cli 两个模板行

## [1.1.2] - 2026-04-11

### Added

- ⚙️ 新生成的 Relic 现在会默认带上 `proactive_config.json`
- 🧪 补了一条 smoke test，把 `writer -> scheduler` 这条第一次体验链路钉住了

### Changed

- ⏰ `proactive_scheduler.py` 现在不传 `--config` 也能直接跑
- 🪄 老版本 Relic 如果还没有配置文件，也不会先把你挡在门外，而是会按类型临时补一份保守默认配置
- 📚 README 和路线图都同步到了这套新的默认体验
- 🧭 `relic_writer.py` 生成的 manifest 补了更现代的兼容字段（`display_name` / `relic_type` / `version` / `subject`）

## [1.1.1] - 2026-04-11

### Fixed

- 📚 **README fence repair**: fixed broken code fences in all root multilingual READMEs — installation and usage sections now render properly
- 🧭 **Invocation consistency**: synced `SKILL.md` and `FOR_AI.md` with the actual Relic loading chain (`SKILL.md` + `personality.md` + `interaction.md` + `memory.md`)
- ⚡ **Slash command parity**: `relic-forge`, `relic-talk`, and `relic-shield` are now directly invocable as promised in README
- ⏰ **proactive_scheduler.py**: `--dry-run` now actually returns the preview message instead of `message: null`
- 📊 **quality_checker.py**: now handles both handwritten example Relics and `relic_writer.py` generated output
- 🪟 **Windows CLI output**: better UTF-8 stdout/stderr handling in `quality_checker.py` and `relic_writer.py`
- 🧹 **Runtime hygiene**: `.proactive_state.json` is now git-ignored
- 🗺️ **Roadmap status**: fixed the current-stage marker in `ROADMAP.md`

## [1.1.0] - 2026-04-09

### Added

- 🎯 **Experience Mode**: say "let me chat with grandma" to load example Relics instantly
- 🖥️ **9 IDE/Agent Compatibility**: works in Claude Code, Kiro, Cursor, Windsurf, Cline, OpenCode, Codex, Augment, GitHub Copilot
- 💬 **Conversational Forging**: 4-question startup guide where AI asks and you answer
- 🎯 **Template-Specific Prompts**: each dimension adapts its extraction questions based on template type
- 🔄 **Iterative Distillation**: auto-detects weak dimensions and proactively asks for more material
- 📊 **quality_checker.py**: automated Relic quality scoring (4D coverage, evidence quality, specificity)
- ⏰ **proactive_scheduler.py**: holiday greetings, anniversary reminders, random miss triggers
- 🔧 **docs/TOOLS.md**: recommended tools guide (chat export, STT, photo, multimodal)
- 📋 **templates/README.md**: template selection guide
- 📖 **examples/README.md**: example Relic experience guide
- 📍 **ROADMAP.md**: full product roadmap through v3.x

### Changed

- ✨ Polished dialogue examples in soul-engine/interaction.md — less literary, more casual
- 📐 Aligned soul-forge output structure with actual example Relic format

## [1.0.0] - 2026-04-09

### Added

- 🔥 **Soul Forge**: 4D soul distillation framework — cognition, expression, behavior, emotion
- ⚡ **Soul Engine**: interactive soul system with 6 interaction modes, 3-layer memory, proactive behavior, and evolution
- 🛡️ **Soul Shield**: protection framework with soul fingerprints, 6-question consent protocol, and ethics red lines
- 📋 **7 Universal Templates**: human, pet, relationship, team-culture, place, moment, public-figure
- 🎯 **3 Example Relics**: Grandma Wang Xiulan, Cat Mimi (orange tabby), Spark Studio (startup team)
- 🔧 **Python Toolkit**: WeChat/QQ/Telegram parsers, photo analyzer, relic writer, version manager
- 🌍 **10 Languages**: zh-CN, en, ja, ko, es, fr, de, pt, ru, zh-TW
- 📚 **Deep Docs**: philosophy, architecture, platform guide, FAQ, research
- 🎨 **Visual Assets**: banner, architecture diagram, soul dimensions chart, logo
- 🤖 **CI/CD**: GitHub Actions for markdown lint and Python syntax check
- 👋 **Community**: contributing guide, code of conduct, issue/PR templates, security policy
