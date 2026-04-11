# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- 📚 **README fence repair**: fixed malformed closing code fences across all root multilingual READMEs so installation and usage sections render correctly
- 🧭 **Invocation consistency**: aligned `SKILL.md` and `FOR_AI.md` with the real Relic loading chain (`SKILL.md` + `personality.md` + `interaction.md` + `memory.md`)
- ⚡ **Slash command parity**: made `relic-forge`, `relic-talk`, and `relic-shield` directly invocable to match README promises
- ⏰ **proactive_scheduler.py**: `--dry-run` now returns the preview message instead of `message: null`
- 📊 **quality_checker.py**: now understands both handwritten example Relics and `relic_writer.py` generated output
- 🪟 **Windows CLI output**: improved UTF-8 stdout/stderr handling in `quality_checker.py` and `relic_writer.py`
- 🧹 **Runtime hygiene**: `.proactive_state.json` is now ignored by git
- 🗺️ **Roadmap status**: fixed the current-stage marker in `ROADMAP.md`

## [1.1.0] - 2026-04-09

### Added

- 🎯 **Experience Mode**: say "let me chat with grandma" to load example Relics instantly
- 🖥️ **9 IDE/Agent Compatibility**: Claude Code, Kiro, Cursor, Windsurf, Cline, OpenCode, Codex, Augment, GitHub Copilot
- 💬 **Conversational Forging**: 4-question startup guide, AI asks and you answer
- 🎯 **Template-Specific Prompts**: each dimension adapts extraction questions by template type
- 🔄 **Iterative Distillation**: auto-assess weak dimensions and proactively ask for more material
- 📊 **quality_checker.py**: automated Relic quality scoring (4D coverage, evidence, specificity)
- ⏰ **proactive_scheduler.py**: holiday greetings, anniversary reminders, random miss triggers
- 🔧 **docs/TOOLS.md**: recommended tools guide (chat export, STT, photo, multimodal)
- 📋 **templates/README.md**: template selection guide
- 📖 **examples/README.md**: example Relic experience guide
- 📍 **ROADMAP.md**: full product roadmap through v3.x

### Changed

- ✨ Polished dialogue examples in soul-engine/interaction.md (less literary, more casual)
- 📐 Aligned soul-forge output structure with actual example Relic format

## [1.0.0] - 2026-04-09

### Added

- 🔥 **Soul Forge**: 4D soul distillation framework with cognition, expression, behavior, emotion dimensions
- ⚡ **Soul Engine**: Interactive soul system with 6 interaction modes, 3-layer memory, proactive behavior, and evolution
- 🛡️ **Soul Shield**: Protection framework with soul fingerprints, 6-question consent protocol, and ethics red lines
- 📋 **7 Universal Templates**: human, pet, relationship, team-culture, place, moment, public-figure
- 🎯 **3 Example Relics**: Grandma Wang Xiulan, Cat Mimi (orange tabby), Spark Studio (startup team)
- 🔧 **Python Toolkit**: WeChat/QQ/Telegram parsers, photo analyzer, relic writer, version manager
- 🌍 **10 Languages**: zh-CN, en, ja, ko, es, fr, de, pt, ru, zh-TW
- 📚 **Deep Docs**: Philosophy, Architecture, Platform Guide, FAQ, Research
- 🎨 **Visual Assets**: Banner, architecture diagram, soul dimensions chart, logo
- 🤖 **CI/CD**: GitHub Actions for markdown lint and Python syntax check
- 👋 **Community**: Contributing guide, Code of Conduct, issue/PR templates, security policy
