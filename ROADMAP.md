# Roadmap

> 万物皆可 Relic — 但得一步一步来。

---

## 阶段一：好用的 Skill（v1.x）

> 目标：在 AI 编程助手里，唤醒和交互 Relic 的体验足够顺畅。

### v1.0.1 — 体验优化 ✅

- [x] 体验模式：说"让我跟奶奶聊天"直接加载示例 Relic，零门槛
- [x] 主 SKILL.md 流程优化：区分"体验"和"唤醒"两条路径
- [x] examples/README.md：示例目录说明
- [x] README 补充完整的 IDE / Agent 兼容列表（10+ 平台）

### v1.0.2 — 唤醒引导优化 ✅

- [x] soul-forge 唤醒流程改为对话式引导（4 问启动 + 6 步流程）
- [x] 按模板类型分别优化提取 prompt（蒸馏猫和蒸馏人的提问方式不同）
- [x] templates/README.md：模板选择指南
- [x] 迭代蒸馏：第一轮完成后自动评估四维覆盖度，薄弱维度主动追问

### v1.0.3 — 质量保障 ✅

- [x] scripts/quality_checker.py：自动评估四维覆盖度、证据分布、内容具体性
- [x] 对话示例质量打磨

### v1.1.0 — 主动行为实装 ✅

让 Relic 真的"活"起来——会主动找你说话。

- [x] scripts/proactive_scheduler.py：节日/纪念日/随机想念触发
- [x] 示例配置文件（grandma-demo/proactive_config.json）
- [x] docs/TOOLS.md：推荐工具清单（数据导出/语音转写/照片处理/IDE）
- [ ] 与 Claude Cowork scheduled tasks 集成文档（待社区反馈后补充）

### v1.1.2 — 主动行为默认体验 ✅

- [x] `relic_writer.py` 生成的新 Relic 自动附带 `proactive_config.json`
- [x] `proactive_scheduler.py` 在不显式传 `--config` 时优先读取默认配置
- [x] 缺少配置文件时会按 Relic 类型临时推断一份保守默认配置
- [x] 增加 smoke 测试，固定 `writer -> scheduler` 开箱链路
- [x] README / CHANGELOG 同步到新的默认体验

### v1.2.0 — 飞书 CLI 深度集成 ✅

- [x] 飞书 CLI 深度集成:feishu-cli 和 expert 两种新模板
- [x] lark_expert_forge.py:全链路唤醒脚本
- [x] 🏆 飞书 CLI 创作者大赛参赛作品
- [x] 9 种万物永生模板(新增业务专家和飞书协作记忆)
- [x] 10 语言 README 全量同步
- [x] 演示站全面升级(新图片、新示例、OG 图)
- [x] 伦理框架增强(已离世对象分支、依赖检测)
- [x] 质量评估量化标准
- [x] 启动决策树和采集模式选择

### v1.3.0 — 飞书机器人 + 声音合成 ✅

让 Relic 住在飞书里,让 Relic 开口说话。

- [x] `scripts/feishu_bot.py`：飞书机器人服务（接收消息 → 加载 Relic → AI 回复）
- [x] `scripts/tts_service.py`：TTS 抽象层（豆包语音/ElevenLabs/OpenAI TTS）
- [x] 声音克隆 POC：用声音样本克隆 Relic 的声音
- [x] proactive_scheduler.py 扩展：支持发送语音消息
- [x] 飞书机器人部署文档

### v1.4.0 — 灵魂引擎独立 + 多平台 ✅

Relic 不再只住在一个地方。

- [x] RelicEngine：平台无关的对话核心，五层动态提示词
- [x] Telegram Bot：第二个平台适配，支持 Webhook 和 Long Polling
- [x] 媒体服务统一层：MiniMax TTS + Seedream 图像 + OpenAI GPT Image
- [x] manifest.json v1.4.0：正式 schema，身份/关系/媒体/主动行为各归其位
- [x] 提示词重构：从规则手册变成人格驱动

### v1.4.1 — 飞书适配加固 ✅

飞书这条线先不急着炫技，先把能踩坑的地方钉住。

- [x] 飞书 Webhook / 签名 / token / route 层测试
- [x] 飞书 dry-run 媒体上传不再依赖真实文件
- [x] `/status`、`/reset`、`/pause`、`/resume` 实用命令
- [x] 多 Relic 列表与切换回归测试
- [x] `_execute_response_plan()` 拆小，后续媒体消息更好改

### v1.5.0 — 社区模板扩展

- [ ] 接受社区 PR 的第一批新模板（前任、父母、室友等）
- [ ] 模板质量审核标准文档
- [ ] 示例 Relic 扩展到 5-7 个

### v1.6.0 — 多轮进化

- [ ] Relic 使用过程中持续学习：新对话自动补充记忆
- [ ] 版本对比：两个版本的 Relic 之间 diff 了什么
- [ ] 漂移检测：Relic 行为偏离原始人格时发出警告

---

## 阶段二：独立产品（v2.x）

> 目标：不依赖 AI 编程助手，普通人也能创建和使用 Relic。

### v2.0.0 — Web 界面

- [ ] GitHub Pages 静态展示站（项目介绍 + 示例体验）
- [ ] 基于 Web 的 Relic 唤醒向导（纯前端，调用用户自己的 API Key）
- [ ] Relic 在线预览：上传 Relic 文件夹即可交互

### v2.1.0 — 数据导入简化

- [ ] 微信聊天记录一键导入向导（集成 PyWxDump 流程）
- [ ] 拖拽上传：照片、语音、文本文件直接拖进去
- [ ] 多源数据自动合并

### v2.2.0 — 跨平台客户端

- [ ] 桌面端（Electron 或 Tauri）
- [ ] 移动端适配（PWA）
- [ ] 本地运行，数据不离开设备

---

## 阶段三：生态（v3.x）

> 目标：Relic 成为一种通用格式，社区共建，可分享，有商业价值。

### v3.0.0 — Relic 分享与发现

- [ ] Relic Gallery：公开的 Relic 展示广场（经授权的公众人物、虚构角色等）
- [ ] Relic 导入/导出标准格式（.relic 压缩包）
- [ ] 隐私分级：哪些内容可公开、哪些仅限本地

### v3.1.0 — API 与集成

- [ ] Relic API：第三方应用可以调用 Relic 进行交互
- [ ] 聊天平台集成：微信机器人、Telegram Bot、Discord Bot
- [ ] 语音合成集成：让 Relic 能"说话"

### v3.2.0 — 商业化探索

- [ ] Relic 托管服务（付费云端存储 + 定时触发）
- [ ] 企业版：团队知识蒸馏 + 离职交接 + 文化传承
- [ ] 创作者经济：公众人物授权自己的 Relic 供粉丝互动

---

## 版本链路总览

```text
当前
 ↓
v1.0.3  质量保障
v1.1.0  主动行为实装
v1.1.2  主动行为默认体验
v1.2.0  飞书 CLI 深度集成 ✅
v1.3.0  飞书机器人 + 声音合成 ✅
v1.4.0  灵魂引擎独立 + 多平台 ✅
v1.4.1  飞书适配加固 ✅      ← 当前已完成
v1.5.0  社区模板扩展
v1.6.0  多轮进化
 ↓
v2.0.0  Web 界面
v2.1.0  数据导入简化
v2.2.0  跨平台客户端
 ↓
v3.0.0  Relic 分享与发现
v3.1.0  API 与集成
v3.2.0  商业化探索
```

从现在到终局，大约 **10 个版本**。

阶段一（v1.x）专注把 skill 做好，预计 2-3 个月。
阶段二（v2.x）需要前端开发能力，是一个产品形态的跃迁。
阶段三（v3.x）需要服务端、运营、商业化，是一个团队规模的跃迁。

每个阶段的启动条件：

- 阶段二的前提：阶段一有 1000+ star 和真实用户反馈
- 阶段三的前提：阶段二有稳定的日活用户

---

有想法？[提个 Issue](https://github.com/Ylsssq926/relic.skill/issues) 或者来 QQ 群 1098169092 聊聊。
