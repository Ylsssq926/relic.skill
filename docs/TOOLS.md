# 推荐工具清单

> 这份文档只回答一个问题：**蒸馏前，数据从哪来**。
>
> `relic.skill` 擅长的是整理、抽取和蒸馏，不负责替你从各个平台把数据“挖”出来。真正可用的流程通常是：**先导出原始数据，再做转写 / 元数据提取，最后送进 relic.skill。**

## 先看结论

- **聊天记录**：优先用平台官方导出；官方不给的，再考虑本地整理工具。
- **语音**：先转成文字，再交给 `voice-collector`；不要直接把原始音频丢进去等奇迹发生。
- **照片**：先拿到原图或相册导出，再提取 EXIF；时间线和 GPS 往往比“图里有什么”更稳定。
- **视频**：先拆成关键帧和音轨，再分别走照片和语音流程。
- **运行宿主**：要找一个能读 `SKILL.md` 的 AI 编程助手，`relic.skill` 才能跑起来。

---

## 1. 聊天记录导出工具

> 原则：**先官方导出，后本地提取。** 这样更稳，也更容易保留时间戳、附件和会话结构。

| 平台 | 工具名 | 链接 | 免费/付费 | 难度 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 微信 | PyWxDump | [GitHub](https://github.com/xaoyaoo/PyWxDump) | 免费 | 需要技术基础 | 从本机微信数据库提取聊天记录，适合愿意自己清洗数据的用户。 |
| 微信 | MemoTrace（留痕） | [官网文档](https://memotrace.cn/doc/posts/deploy/parser-db.html) | 免费/付费 | 中等 | 偏本地整理和留痕分析，适合把微信聊天做成更可读的导出结果。 |
| QQ | 官方导出功能 | [QQ 官网](https://im.qq.com/index/) | 免费 | 简单 | 直接用 Windows QQ 或 TIM 的消息管理器导出，普通用户最省心。 |
| Telegram | 内置导出 | [Telegram Desktop](https://desktop.telegram.org/) | 免费 | 简单 | 桌面端自带导出功能，可直接导出 HTML、JSON 和媒体附件。 |
| Discord | DiscordChatExporter | [GitHub](https://github.com/Tyrrrz/DiscordChatExporter) | 免费 | 中等 | 按服务器或频道导出聊天记录，适合补足官方数据包不够直观的问题。 |
| iMessage | iMazing | [官网](https://imazing.com/) | 付费 | 简单 | 从 iPhone 备份里导出 iMessage 和短信，适合不想直接碰数据库的用户。 |

### 使用建议

- **微信 / QQ**：如果你主要拿“私人聊天”，优先保留时间、说话人、附件路径，不要只导截图。
- **Telegram / Discord**：尽量保留 **JSON**，后续结构化最省力。
- **iMessage**：只做纪念展示可以导 PDF；要做蒸馏，还是 CSV / 结构化导出更实用。

---

## 2. 语音处理工具

> `relic.skill` 的 `voice-collector` **需要的是转写后的文本**，最好还能带时间戳和说话人切分。

| 工具名 | 链接 | 免费/付费 | 难度 | 说明 |
| --- | --- | --- | --- | --- |
| Whisper（OpenAI） | [GitHub](https://github.com/openai/whisper) | 免费 | 中等 | 通用语音转文字工具，英文稳定，中文也能用，适合离线批量转写。 |
| FunASR（阿里） | [GitHub](https://github.com/modelscope/FunASR) | 免费 | 中等 | 更偏中文语音识别，适合中文普通话、会议音频和口语内容转写。 |

### 对 relic.skill 的意义

- `voice-collector` 吃的是**文本、时间戳、说话人信息**，不是原始音频本身。
- 语音里有笑声、停顿、叹气、拖长音时，建议在转写后额外补标注，不要全部抹平成书面语。
- 多人音频最好先做说话人切分，至少分出“目标对象 / 其他人 / 无法确认”。

---

## 3. 照片整理工具

> `relic.skill` 的 `photo-collector` 当前最稳的输入，不是“高深视觉理解”，而是**EXIF 时间线和 GPS**。

| 工具名 | 链接 | 免费/付费 | 难度 | 说明 |
| --- | --- | --- | --- | --- |
| ExifTool | [官网](https://exiftool.org/) | 免费 | 中等 | 提取照片的拍摄时间、设备、镜头和 GPS 等 EXIF 元数据。 |
| Google Photos 导出 | [Google Takeout](https://takeout.google.com/) | 免费 | 简单 | 从 Google Photos 批量导出原图和相册数据，适合先把素材完整拿出来。 |
| Apple Photos 导出 | [Apple 官方帮助](https://support.apple.com/guide/photos/export-photos-pht6e157c5f/mac) | 免费 | 简单 | 从 Apple Photos 导出原图、编辑版本或视频，适合保留苹果生态里的时间线。 |

### 对 relic.skill 的意义

- `photo-collector` 目前主要看 **拍摄时间、设备信息、GPS、照片分组**。
- 仓库里的 [`scripts/photo_analyzer.py`](../scripts/photo_analyzer.py) 已经能把 EXIF 统一抽成结构化 JSON。
- 如果你想做“照片里的人在干什么、场景像什么、情绪怎样”这类理解，**需要额外视觉模型**，这不是当前版本的内置能力。

---

## 4. AI 编程助手（运行 relic.skill 的宿主）

> 这里说的“支持 `SKILL.md`”，意思是这些 IDE / Agent 能读取技能目录或项目里的 `SKILL.md`，从而把 `relic.skill` 当成一套可执行工作流来跑。

| 工具名 | 链接 | 免费/付费 | 难度 | 说明 |
| --- | --- | --- | --- | --- |
| Claude Code | [官网](https://www.anthropic.com/claude-code) | 付费为主 | 简单 | 对 `relic.skill` 来说最原生，技能加载路径清楚，整体体验最好。 |
| Kiro | [官网](https://kiro.dev/) | 免费/付费 | 简单 | 亚马逊出品，支持 skills，适合把采集、清洗、蒸馏拆成流程化步骤。 |
| Cursor | [官网](https://cursor.com/) | 免费/付费 | 简单 | 最常见的 AI IDE 之一，生态成熟，适合已经习惯 AI 编辑器的人。 |
| Windsurf | [官网](https://windsurf.com/) | 免费/付费 | 简单 | 常被当作成本更好控制的选择，适合预算敏感但仍想要完整 AI IDE 体验的用户。 |
| Cline | [GitHub](https://github.com/cline/cline) | 免费/开源（模型另付） | 中等 | VS Code 插件，灵活度高，但你需要自己管理模型和费用。 |
| OpenCode | [官网](https://opencode.ai/) | 免费/开源（模型可自带） | 中等 | 开源终端工具，CLI 味最重，适合喜欢命令行和多代理工作流的人。 |
| GitHub Copilot | [官网](https://github.com/features/copilot) | 免费/付费 | 简单 | 用户基础最广，团队里最容易找到现成工作流和共同语言。 |

### 怎么选

- **想少折腾，直接开跑**：Claude Code。
- **已经在 AI IDE 里工作**：Cursor / Windsurf / Kiro。
- **想开源可控、自己配模型**：Cline / OpenCode。
- **团队默认都在用 GitHub 生态**：GitHub Copilot。

---

## 5. 多模态处理（进阶）

> 这一部分不是 `relic.skill` 的内置魔法，而是你在蒸馏前常用的**外部工具链**。

| 模态 | 当前支持状态 | 推荐工具链 | 免费/付费 | 难度 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 照片 | 内置到 EXIF 层 | `photo_analyzer.py` + ExifTool（可选） | 免费 | 中等 | 当前主要提取拍摄时间、设备和 GPS；场景识别需要额外模型。 |
| 语音 | 需要先转写成文字 | Whisper / FunASR | 免费 | 中等 | `voice-collector` 依赖转写文本，最好附带时间戳和说话人切分。 |
| 视频 | 需要先拆成关键帧和音轨 | [ffmpeg](https://ffmpeg.org/) + Whisper / FunASR + `photo-collector` | 免费 | 需要技术基础 | 先抽关键帧，再转写音轨，最后分别走图片和文本流程。 |

### 当前状态说明

- **照片**：当前通过 [`scripts/photo_analyzer.py`](../scripts/photo_analyzer.py) 提取 EXIF；场景识别、人物动作识别、环境理解等都需要额外模型。
- **语音**：需要先用 Whisper 或 FunASR 转写成文字，再送入 `voice-collector`。
- **视频**：建议先用 `ffmpeg` 提取关键帧和音轨，再把关键帧按照片处理、把音轨按语音处理。
- **重点**：这些都不是 `relic.skill` 内置的“自动全能多模态”，而是更实际的外部工具链组合。

---

## 推荐搭配

### 如果你主要蒸馏聊天记录

1. 官方导出 / PyWxDump / MemoTrace / Telegram Desktop
2. 清洗成按会话分组的文本或 JSON
3. 再送进 `chat-collector`

### 如果你主要蒸馏语音

1. 导出音频
2. Whisper / FunASR 转写
3. 补时间戳、说话人、笑声停顿等标注
4. 再送进 `voice-collector`

### 如果你主要蒸馏照片或相册

1. Google Photos / Apple Photos 导出原图
2. ExifTool 或 `photo_analyzer.py` 提取 EXIF
3. 按时间线和地点整理
4. 再送进 `photo-collector`

### 如果你手里主要是视频

1. 用 `ffmpeg` 抽关键帧和音轨
2. 关键帧走照片流程
3. 音轨走语音转写流程
4. 最后把两个结果一起作为证据输入

---

## 一句话版

`relic.skill` 不负责替你拿数据，它负责把你**已经拿到的数据**变成可蒸馏的材料。先把聊天、语音、照片、视频各自走通，再谈高质量蒸馏。
