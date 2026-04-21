# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
