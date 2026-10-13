# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.10.1] - 2026-10-13

### 两版分发：公开框架版 vs 商业版

把「公开仓库」与「付费版」的差异做成机制，而不是靠自觉。

**背景**：此前 GitHub 仓库与 Agensi 分发的 zip 内容完全相同——买家付 $29 拿到的东西和免费 clone 的一样。授权条款区分了商用/非商用，但**产品内容**没有区分。

**现在的分发结构**：

| | 公开框架版 `relic.zip` | 商业版 `relic-commercial.zip` |
|---|---|---|
| 框架（四维 / 证据分级 / 保护层 / 10 解析器 / 10 模板 / 8 示例） | ✅ | ✅ |
| `COMMERCIAL-PACK/`（3 份场景配方 + 部署治理指南 + 支持承诺） | ❌ | ✅ |
| 商用授权 | ❌ | ✅ |
| 体积 | 606 KB / 144 文件 | 622 KB / 150 文件 |

**商业增值包内容**（`COMMERCIAL-PACK/`，已加入 `.gitignore`，不进公开仓库）：

- `recipes/enterprise-knowledge-transfer.md` — 企业知识传承：素材门槛（300 条留痕 / 20 处判断痕迹 / 3 个复盘）、四维填写要点、验收阈值、4 类常见失败模式
- `recipes/family-legacy.md` — 家族记忆工程：同意地图（多对象 × 多提供者）、素材三层分级、代际语气差异处理、跨档案一致性验收
- `recipes/creator-persona.md` — 创作者人格资产：三种用途选型、公开内容蒸馏纪律、三条商业红线、读者验收法
- `deploy/production-notes.md` — 交付前脱敏清单（含扫描脚本）、访问控制四档、部署三形态、常见生产事故、撤回机制
- `support.md` — 更新通道、四步排查顺序、环境问题速查、支持边界、撤回处理承诺

**打包脚本升级**：`tools/package_release.py` 新增 `--edition public|commercial`；两版输出不同文件名，且**互相断言**——商业版必须有 `COMMERCIAL-PACK/`，公开版必须没有，防止两者静默趋同。

**文档**：README 中英新增「两个版本」对照表，明确公开版给工具、商业版给打法与许可，并说明两版产出的 Relic 文件格式完全一致、可自由迁移。

## [1.10.0] - 2026-10-13

### CI/CD 重构 + 第 10 个平台 + 跨平台兼容性修复

三个子代理并行审计（CI 配置 / 打包封装 / 跨平台兼容），发现的问题按主题修复。

#### 一、新增飞书原生解析器（`scripts/lark_parser.py`）

上架物料宣称"10 个平台原生摄入"并列了 Feishu/Lark，但实际只有 9 个解析器 —— 飞书走的是 `lark_expert_forge.py` 的全链路（不产出标准 JSON）。现补齐真正的解析器，支持三种真实导出形态：

- lark-cli JSON：`create_time` 是毫秒字符串，`body.content` 是**再包一层的 JSON 字符串**（双层解析）
- 管理后台 CSV：中文列名（时间/发送者/内容）
- 文本导出：`说话人: 内容` 与 `说话人 日期 时间` 两种写法

富媒体消息（图片/文件/语音/贴纸/卡片）转为可读占位而非丢弃；可选读取 `users.json` 把 open_id 还原成真名。**10 个平台全部纯标准库。**

#### 二、跨平台兼容性（Windows 用户此前会直接报错）

- **编码**：11 个脚本缺 stdout 守护，在 cp936 控制台打印中文会 `UnicodeEncodeError` 直接崩（rc=1）——现统一注入 `_ensure_utf8_output()`，并修正 `feishu_bot.py` 缺失的 `import sys`
- **依赖**：qq / telegram / wechat 三个解析器硬依赖 `python-dateutil`，缺依赖时直接抛错 —— 与"解析器零依赖"的承诺矛盾。现改为**可选加速**：有 dateutil 走原路径（零回归），没有则退回标准库解析（覆盖 ISO / 多种日期格式 / 中文年月日）
- **子进程**：`lark_expert_forge.py` 的两处 `subprocess.run(text=True)` 补 `encoding="utf-8"`；`relic_writer.py` 调用改用脚本自身目录的绝对路径（原为 cwd 相对路径）
- **参数一致性**：`wechat_parser.py` 补 `--self-name`（此前只有它没有，文档却宣称所有解析器都支持）

#### 三、CI/CD 重构

- **markdownlint 一直在扫 node_modules**：忽略写法 `!node_modules` 不递归，实测带入 14000+ 误报（依赖包的 CHANGELOG）——修正为 `!**/node_modules/**` 并补齐其余忽略项
- **core-tests（新）**：3 个操作系统 × 2 个 Python 版本矩阵，**不安装任何依赖** —— 把"零依赖可用"这条对买家的承诺变成 CI 门禁
- **full-tests**：装可选依赖跑全套（含 bot 测试）
- **package-gate（新）**：打包断言进 CI（买家拿到的就是这一个 zip，必须由 CI 把关）
- **py-compile 降到 3.9**：故意用声明支持的最低版本，让 3.10+ 语法在此直接暴露
- **integration-smoke（新）**：让 `scripts/test_integration.py` 真正跑起来（此前不在 discovery 路径内，等于死代码）
- **demo-site 降级**：营销站与交付物无关，改为只在 PR 时跑

#### 四、打包封装加固

- **补 8 个语言版 README 进包**：README 顶部的语言切换器链接了它们，不进包就是 8 条死链
- **内容级禁入扫描（新）**：此前只检查条目名，现扫描文件内容中的本机路径（`C://Users//...`）、密钥形态（`sk-` / `ghp_`）、内网地址、内部目录引用
- **目录计数断言（新）**：模板=10 / 示例=8 / 解析器=10，数量对不上直接失败（防止"加了文件忘更新断言"）
- **REQUIRED 补齐**：docs 从 5 → 7，示例从 3 → 8，解析器从 9 → 10

#### 五、markdownlint 归零（135 → 0）

根因不是文档手误，而是**生成器产出违规格式**：`relic_writer.py` 的四个 builder 在"标题 + 列表"之间不留空行，每个买家生成的 Relic 都会继承 → 治本（改生成器），再治标（批量修现有文档）。

- 修 `relic_writer.py` 的 9 处拼接格式
- 批量修 71 个文档文件的结构性问题（列表空行、连续空行、结尾换行、裸 URL、列表标记统一）
- 删除 README 中早先编辑留下的表格残骸（孤立表格行 + 重复引用行）
- 修复过程中发现并修正了一个自伤：自动修复脚本把 HTML 属性的 `src="<url>"` 写坏（63 处 badge），以及给列表续行注入空行打断有序列表（121 处）——均已还原

#### 六、文档与实际对齐

- 9 个 README（EN + 8 语言）引用了 3 个**不存在的脚本**（`feishu_collector.py` / `feishu_forge.py` / `proactive_feishu.py`），命令参数也是虚构的 —— 全部改为真实脚本与真实参数
- 文件计数同步：FOR_AI 的 `templates x9 / examples x3`、README 的 `scripts x17` → 实际值

**验证**：71 项单元测试全过（新增飞书 3 项）· 24/24 脚本零依赖可加载 · markdownlint 101 文件 0 错误 · 打包断言全过（144 entries）· 8 个示例质检分数未受影响。

## [1.9.1] - 2026-10-13

### 用户视角补完：零技术用户路径 + 撤回同意说明

继续多视角审计，补上两个此前没有正面回答的用户问题。

#### 「我不会用命令行，还能用吗？」

FAQ 有 23 个问题，但没有一个回答这个 —— 而它恰恰是最大客群的第一个疑问。现新增 FAQ #24，明确两层结构：

1. **skill 本身不需要终端**：把 `relic/` 放进 agent 能读的位置，然后直接说话（"帮我唤醒一个奶奶的 Relic"），助手读 `SKILL.md` 走完同意流程、四维蒸馏、文件生成 —— 全程对话
2. **CLI 脚本是可选加速器**：只在素材是几十万条聊天记录、Gmail 归档这类"手贴不进去"的量级时才需要

README（中英）同步新增「怎么用（两种方式，任选其一）」章节，把这条路径放在版本说明之前 —— 买家不必先读脚本列表才知道自己可以不碰命令行。

#### 「怎么删除 Relic / 撤回同意？」

新增 FAQ #25，给出四档处置而非单一"删掉"：暂停（不再加载）／收窄（改 `manifest.json` 的披露策略与授权范围）／撤回（重跑六问同意协议，撤回永远优于先前的授权）／换指纹（让旧副本可与当前版本区分）。并明确：若素材来自他人，对方的撤回具有约束力，无论技术工作是谁做的。

**README 版本章节**更新为 v1.9.0（此前停在 v1.7.0）。

## [1.9.0] - 2026-10-13

### 多视角审计：环境适配 + 示例 5→8 + 质检器架构修复

代入 agent / Windows 用户 / WorkBuddy 用户 / 非人类模板用户四种视角做了一轮系统审查，发现的问题分四类修复。

#### 一、agent 路由缺失（最严重）

新增的示例目录没进 agent 的路由表，agent 永远找不到它们：

- `SKILL.md` 与 `FOR_AI.md` 的 demo 路由此前只列 3 个示例（实际 5 个），新增的 old-camera / dad-and-me 无人可达 —— 现补齐 8 个，并注明 public-figure / feishu-cli 走唤醒流程
- 触发词表补入物件与关系场景（"让我跟这台相机聊聊" / "讲讲我和我爸的关系"）
- **新增 `DemoRoutingTest`（3 项断言）**：示例目录必须同时出现在 SKILL.md、FOR_AI.md、examples/README.md 中，且文件齐全、manifest 通过 schema —— 这类"加了文件忘了接路由"的问题从此由 CI 拦住

#### 二、Windows / 多环境适配

- 全部文档按 macOS/Linux 惯例写 `python3`，但 **Windows 上只有 `python` / `py`** —— README（中英）平台表与安装章节均补充命令约定说明；PLATFORM-GUIDE 同步
- 8 个语言版 README 的安装片段含 `mkdir -p .claude/skills`（Windows 不认，且单一环境假设）—— 改为跨平台写法并补 WorkBuddy 路径
- 安装路径补 **WorkBuddy**（`~/.workbuddy/skills/relic`）；此前只覆盖 Claude Code / Cursor / Windsurf / Cline

#### 三、示例覆盖 5 → 8（8/10 模板）

新增三个英文示例，覆盖此前空白的三类对象：

| 示例 | 模板 | 看点 |
|---|---|---|
| `kitchen-demo` | place | 祖母的厨房：感官先于事件；演示"绝不可输出可用于定位的地址"这条最严边界 |
| `proposal-demo` | moment | 那个下午：先慢放现场再谈意义；**故意保留一处双方记忆不一致的锚点** |
| `tech-lead-demo` | expert | 退休技术主管：B 端知识传承；"我是 Relic，不是在职顾问"写进身份而非附加条款 |

#### 四、质检器架构修复（影响全部非 human 模板）

`quality_checker.py` 的四槽（认知/表达/行为/情感）是为 human 设计的，其他模板的四维被各自重定义（place = 感官/事件/联结/氛围，expert = 判断/直觉/知识/传承），关键词表不可能穷尽 —— 导致这些模板被误判"维度缺失"（object 示例曾只得 48.6，expert 的行为槽恒为 0）。

- **按顺序兜底**：关键词匹配不到的槽，按 personality.md 的章节顺序补位（顺序即维度顺序，正是 writer 生成骨架的排列方式）。修复后 10/10 模板均能正确评分（73-78）
- **英文证据判定**：记忆锚点的"有证据"判定只认中文 `来源：`，英文 Relic 的 `Source:` 恒判为无证据 —— 现同时接受 `Source:` / `Evidence:`

#### 五、示例质量对齐

- 5 个新示例的 manifest 用 `manifest_schema` 基线 + 自定义字段合并补全（此前缺 identity / relationship / safety / compliance 等 18 个字段，schema 校验不通过）
- 记忆锚点补证据等级标注（新示例 0 → 100% 覆盖；存量 cat-mimi-demo 8 段全部补齐）
- 全部 8 个示例质检分落到 65-84 区间，记忆质量均有证据支撑

**测试**：65 → 68 项全过。

## [1.8.1] - 2026-10-13

### 示例覆盖 3 → 5 + 质检器多模板误判修复

#### 新增两个示例（英文人格，海外买家可直接体验）

- 📷 `examples/old-camera-demo/` — 物件模板：一台 1978 年的尼康 FM2，父亲用了三十年、2009 年传给儿子；四角磨出黄铜色，留下来不是因为值钱，而是它拍下了三十年里所有普通的周日
- 👨‍👦 `examples/dad-and-me-demo/` — 关系模板：蒸馏的不是人，而是两人之间的模式（九十个字的电话、靠递扳手结束的争吵）；刻意保留一处双方记忆不一致的锚点，演示「矛盾并存」原则

两个示例都是英文骨架，同时验证了 v1.8.0 的语言自适应路径。

#### 修复：质检器对非人类模板的误判

`quality_checker.py` 的四维映射表只收录了 human/pet/team 的维度名，导致 object / expert / relationship 等模板的四维（使用痕迹 / 专业判断 / 沟通模式 …）被当成缺失——object 示例原本只得 48.6 分（四维覆盖 19）。现已收录全部模板的中英双语维度名：

| 对象 | 修复前 | 修复后 |
|---|---|---|
| object 示例 | 48.6（四维 19） | 63.8（四维 57） |
| 英文骨架 | 低分误判 | 74.2（四维 83） |
| grandma 示例 | 80.0 | 80.0（无回归） |

**索引同步**：`examples/README.md`（3 → 5 个示例 + 体验口令）、README 中英示例计数。

## [1.8.0] - 2026-10-13

### 骨架语言自适应 + iMessage 解析器 + 完整性检查纳入 CI

验收报告里列出的三项短板，本轮全部落地。

#### 生成内容语言自适应（最大缺口）

英文买家跑 `relic_writer.py` 时，此前会拿到「中文结构标签 + 英文素材」的混合骨架——约 80 个标签串（基本画像 / 四维画像 / 认知框架 …）+ 30 个维度引导句模板。直接使用（不走 agent 精修）的人看到的就是半成品。

- 新增 `detect_output_language()`：按素材语言推断骨架语言（拉丁字符占中文两倍以上判为 en）
- 全部 30 个维度 builder、4 个生成函数（SKILL/personality/interaction/memory）、10 个模板元数据（label / identity / tone / summary_goal / dimensions / interactions / boundaries）、记忆条目与 manifest 策略文本完成双语化
- 新增 `--lang auto|zh|en`（默认 auto 跟随素材），可显式覆盖
- 英文骨架零中文残留（含标点规范化：顿号 → 逗号、全角引号 → 半角）
- 中文路径逐条回归，无行为变化

#### iMessage 解析器（第 9 个平台）

macOS 的 `chat.db` 是现成的数据库，不需要导出对话框。`scripts/imessage_parser.py` 处理 Apple epoch（纳秒/秒两种精度）、`attributedBody` 二进制兜底（现代 macOS 常把 `text` 置空）、tapback 表情过滤、附件占位符还原。

#### 引用完整性检查纳入 CI

此前 59 项引用断言只是本地临时脚本（位于 gitignore 目录），CI 覆盖不到。现移植为 `tests/test_repo_integrity.py`（7 个测试）：四条工作流文件存在性、模板引用、frontmatter 可解析、文档相对路径引用零死链、买家关键路径语言覆盖、9 个解析器随包发布。

**测试**：47 → 65 项（新增仓库完整性 7、语言自适应 9、iMessage 2），全部通过。

## [1.7.1] - 2026-10-13

### 验收修复：测试纳入 CI + 文档同步

独立验收复检时发现三处遗漏，均为"改了代码但相关配套没跟上"：

- 🧪 **新解析器接入 CI** — v1.7.0 的 5 个解析器此前只有本地临时验证脚本（在 gitignore 目录里），CI 完全覆盖不到。现新增 `tests/test_platform_parsers.py`（8 个测试用例、跨 5 个解析器），覆盖各平台导出格式识别、三种时间戳精度换算、附件与多行消息保留、`--self-name` 方向判定、以及"解析器输出能直接喂 writer"的端到端契约。测试总数 39 → 47
- 📖 **PLATFORM-GUIDE 补齐脚本对照** — 该文档是"平台数据获取指南"，但 v1.7.0 加了 5 个解析器后它完全没提，用户读完导出步骤仍不知道该跑哪个脚本。现新增「Which Parser to Use」对照表（10 行，含可直接复制的命令）
- 📅 **门面与时序修正** — README 首屏版本章节停留在 v1.5.1（买家常看的第一屏）；README_EN 缺少 What's New 章节；ROADMAP 的版本进度表停在 v1.5.1 且 v1.6.0/v1.7.0 号段与实际发布内容错位（原计划的「社区模板扩展」顺延为 v1.8.0）
- 🌐 **8 个语言版 README** 补上国际解析器说明

验证：47 项测试全绿、模拟 agent 引用完整性全过、国际解析器样本验证全过、打包断言全过。

## [1.7.0] - 2026-10-13

### 补齐国际平台导入工具（海外用户的实际入口）

此前文档承诺 12 个平台，但可用的导入脚本只有微信 / QQ / Telegram 三个 —— 其中两个是国内平台，海外用户真正能用的只有 Telegram。本版补齐主力缺口。

**新增解析器（统一输出契约：`schema_version` / `source.platform` / `messages[]`，可直接喂 `relic_writer.py --data`）**

| 脚本 | 平台 | 支持的导出形态 |
|---|---|---|
| `scripts/discord_parser.py` | Discord | DiscordChatExporter JSON、官方数据包 `messages/` 与 `DM_Chats/`（附件、embed、贴纸、表情反应均保留） |
| `scripts/slack_parser.py` | Slack | 工作区导出目录；自动读取 `users.json` 把 Uxxxx ID 还原成真人名；线程回复、文件、表情独立标注 |
| `scripts/whatsapp_parser.py` | WhatsApp | 手机端 Export Chat 的每会话 `.txt`（iOS 方括号 / Android 短横格式 / EU 区域格式，含 AM-PM）；多行消息正确折叠 |
| `scripts/instagram_parser.py` | Instagram | Download Your Information 解压目录；私信（新旧两种结构）+ 公开评论（评论同样是人格素材） |
| `scripts/email_parser.py` | Gmail / Apple Mail | `.mbox` / `.eml`；自动裁掉引用的历史回复只保留本次新写的内容，附件单独标注 |

**验证**：新增 `verify_international_parsers.py`，用各平台真实导出格式的样本覆盖 5 个脚本共 32 项断言（字段映射、ISO/毫秒/秒级时间戳换算、附件与表情保留、多行折叠、users.json 人名还原、引号裁剪、方向判定、去重）—— 全部通过。过程中修正了 WhatsApp 秒级时间戳被丢弃的实现缺陷。

**文档同步**：README（中英）平台表新增「导入脚本」列与可直接复制的命令块；FOR_AI.md 工具索引按「导入 / 生成 / 媒体投递」三类重组；SKILL.md 新增本地解析器声明（纯本地、不产生任何网络请求）；SETUP.md Step 1 给出七平台解析示例；打包断言把 5 个新脚本列入必备项。

## [1.6.2] - 2026-10-13

### 英文沉浸度修复（主动行为系统）

英文 Relic 的主动消息此前是「中文主体 + 英文收尾」的混合，且润色函数从未接线。回归验证发现并修复：

- 🌐 **节日/纪念日主体无英文路径** — `festival_body` / `anniversary_body` 只有中文实现，英文人格收到的是「Oh, 中秋到了…」这类混合消息。现补 `_holiday_message_en` / `_anniversary_message_en` / `EN_RANDOM_BY_KIND`，按 human/pet/team/place 四种关系分别给出英文语料
- 🔧 **`en_polish()` 是 dead code** — 定义了但从未被调用，英文消息的小写开头与句首大写从未生效。现接入 `build_message` 出口
- 🔠 **拼接缺分隔** — `compact_message` 用无分隔拼接，英文出现 `warm.just`。现按文本脚本分流：拉丁文用空格连接，CJK 保持无空格
- 🅰️ **代词与专有名词** — 独立 `i`/`i'm` 大写为 `I`/`I'm`；呼语前缀后的普通词小写（`Oh, no big news`）但专有名词保持（`Oh, Mid-Autumn Festival`）

中文消息路径逐条回归验证，无任何行为变化。

## [1.6.1] - 2026-10-13

### 工具链适配与存量缺陷修复

上架适配的第三轮：从"文档英文化"下沉到**工具链实际可用性**，并用回归测试挖出三个此前从未被发现的缺陷。

#### 工具链适配（面向非中文环境的 agent 调用）

- 🐍 **命令一致性** — 全部文档与 17 个脚本的调用示例改用 `python3`（macOS/Linux 惯例），SETUP 新增「Environment Setup」节与依赖分层表（core / bot / TTS 三档，核心流程零依赖）
- 🌐 **区域增强降级** — `lark_expert_forge.py` 在 `lark-cli` 缺失时输出中英双语错误 + 通用路径指引（不再只指引 npm 安装）；子脚本调用改用 `sys.executable`，不再硬编码 `python`

#### 存量缺陷修复（回归测试发现）

- 🚨 **expert / feishu-cli 模板从未可用** — 两个模板的 6 个维度 builder（judgment/intuition/knowledge/mentoring/collaboration/chemistry）从未注册进 `build_dimension_lines`，选择这两个模板会直接 `KeyError` 崩溃。现已补齐并通过端到端验证
- 🚨 **英文 Relic 的主动消息带中文标点** — `proactive_scheduler.py` 的 `profile.language == "en" is False` 是 Python 链式比较陷阱，条件恒为 False，导致英文人格前缀永远用全角逗号。改为 `!= "en"`，已加行为断言
- 📦 **打包不可复现** — 新增 `tools/package_release.py`：显式白名单 + 卫生清理 + 必备/禁入断言 + 体积报告；assets 改为逐文件白名单（只发文档真正引用的 4 个 SVG），zip 从 2.8MB 降到 431KB（-85%）

#### 万物立意补全

- 🪑 **新增 object 模板（物件）** — soul-forge 一直承诺"物件"可蒸馏，但 `templates/` 无对应模板，agent 按对象表选型会落空。现已贯通三层：`templates/object.md` + `relic_writer.py` TEMPLATE_CONFIG + `manifest_schema.py` VALID_KINDS，四维重定义为「使用痕迹 / 情感投射 / 陪伴轨迹 / 空间锚点」

#### 验证

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
