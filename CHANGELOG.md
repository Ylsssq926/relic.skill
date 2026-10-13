# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.1] - 2026-10-13

### 工具链适配与存量缺陷修复

上架适配的第三轮：从"文档英文化"下沉到**工具链实际可用性**，并用回归测试挖出三个此前从未被发现的缺陷。

**工具链适配（面向非中文环境的 agent 调用）**

- 🐍 **命令一致性** — 全部文档与 17 个脚本的调用示例改用 `python3`（macOS/Linux 惯例），SETUP 新增「Environment Setup」节与依赖分层表（core / bot / TTS 三档，核心流程零依赖）
- 🌐 **区域增强降级** — `lark_expert_forge.py` 在 `lark-cli` 缺失时输出中英双语错误 + 通用路径指引（不再只指引 npm 安装）；子脚本调用改用 `sys.executable`，不再硬编码 `python`

**存量缺陷修复（回归测试发现）**

- 🚨 **expert / feishu-cli 模板从未可用** — 两个模板的 6 个维度 builder（judgment/intuition/knowledge/mentoring/collaboration/chemistry）从未注册进 `build_dimension_lines`，选择这两个模板会直接 `KeyError` 崩溃。现已补齐并通过端到端验证
- 🚨 **英文 Relic 的主动消息带中文标点** — `proactive_scheduler.py` 的 `profile.language == "en" is False` 是 Python 链式比较陷阱，条件恒为 False，导致英文人格前缀永远用全角逗号。改为 `!= "en"`，已加行为断言
- 📦 **打包不可复现** — 新增 `tools/package_release.py`：显式白名单 + 卫生清理 + 必备/禁入断言 + 体积报告；assets 改为逐文件白名单（只发文档真正引用的 4 个 SVG），zip 从 2.8MB 降到 431KB（-85%）

**万物立意补全**

- 🪑 **新增 object 模板（物件）** — soul-forge 一直承诺"物件"可蒸馏，但 `templates/` 无对应模板，agent 按对象表选型会落空。现已贯通三层：`templates/object.md` + `relic_writer.py` TEMPLATE_CONFIG + `manifest_schema.py` VALID_KINDS，四维重定义为「使用痕迹 / 情感投射 / 陪伴轨迹 / 空间锚点」

**验证**

- 10/10 模板生成回归通过；39/39 单测通过；59 项模拟 agent 调用断言通过；零依赖环境（bare venv）下 17/17 脚本 `--help` 与 object 模板端到端生成通过

## [1.6.0] - 2026-10-12

### Agensi 上架适配

- 🌍 **触发词国际化** — `SKILL.md` 与三个子系统的 frontmatter 改为英文触发词主导（中/英/日三语并列），`argument-hint` 双语化
- 🔒 **网络访问透明声明** — `SKILL.md` frontmatter 新增 `external_urls`（9 个可选 endpoint：飞书 / 火山引擎 / MiniMax / ElevenLabs / OpenAI / Anthropic / Telegram / Gemini），正文新增「网络访问与环境变量」说明段；核心流程保持 100% 本地零请求
- ⚖️ **伦理口径统一** — README / ethics.md / templates 的标识表述统一为「标识不缺席，但不打断对话」：由元数据与 UI 承载，对话正文不机械复读免责声明，被问及身份时以角色口吻诚实回应
- 🧭 **文档区域分层** — SETUP.md 新增路径选择表（本地优先 → 国际通道 → 国内增强）；飞书 CLI 章节标注「区域增强」；PLATFORM-GUIDE 标注国内/国际平台分区；TTS 推荐口吻中性化

## [1.5.2] - 2026-07-18

### 把三个子系统从 1.1.2 拉回主线

几个月过去，模型和工具都升级了，但 `soul-forge` / `soul-engine` / `soul-shield` 还停在 1.1.2，而包级已经 1.5.1。这版不做架构重写（四维框架、三层记忆、授权/伦理、对话示例都是真东西，模型无关），只做"对齐 + 去脚手架 + 接新能力"：

### Changed

- 🔢 **版本对齐** — 三个子系统 `SKILL.md` 的 `version` 从 1.1.2 提到 1.5.2，和包级主线一致，不再出现"包是 1.5、子 Agent 还是 1.1"的割裂
- 🧹 **去死板脚手架** — `soul-forge` 删掉硬编码"启动决策树"四分支，改为"跟着用户走"的引导原则；聊天条数硬阈值（<50 / 50-200 / >200）降级为经验起点而非硬规则
- 🧠 **记忆不再强制格式** — `memory-system.md` 的满屏 YAML schema 从"强制结构"软化为"建议结构"，明确现代运行环境的原生记忆层可接管存取，Agent 只负责"记什么、放什么"的判断
- 🔌 **接多模态直读** — `chat-collector` 与 `soul-forge` 采集步骤补上"图像/音频可直接理解，不必强制先 OCR/STT"的说明，只在批量或低质量时回退
- 🔊 **补语音/多模态交互** — `soul-engine` 新增"多模态与语音"小节，呼应已落地的 TTS/声音克隆与 manifest media 配置
- 🔗 **补齐三件套衔接** — `soul-forge` 封装后必须过 `soul-shield` 生成指纹并落 `manifest.json`；`soul-shield` 明确指纹/授权写入 `relic_writer.py` 的 v1.5.1 schema，保证版本与格式一致

### 为什么没重写

框架本身经得起模型升级，重写风险大于收益。这次是"减负 + 现代化"，让 Agent 把精力花在判断和边界上，而不是格式搬运。

## [1.5.1] - 2026-06-09

### 第一阶段，漂亮收尾

拿到 **飞书 CLI 创作者大赛 · 人气赛道第一名** 之后，relic.skill 没继续乱加功能，而是把项目收拾得更稳一点：演示站、CI、依赖、仓库卫生和发布文案都对齐了。

### Changed

- 🏆 README 和品牌文档保留获奖成绩：飞书 CLI 创作者大赛 · 人气赛道第一名
- 🌐 演示站入口统一回到当前稳定域名 `https://relic.luelan.online`
- ✅ CI 增加 demo-site 检查：`npm ci`、typecheck、lint、build
- 🔒 demo-site 升级 Next.js 安全补丁，并修正 lucide-react 版本锁定
- 🧹 移除 Star History 曲线和误提交的生成产物，仓库更轻一点

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
