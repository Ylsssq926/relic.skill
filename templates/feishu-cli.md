# 🐦 飞书 CLI — 协作记忆蒸馏模板

> **命令格式说明**:本文档中的 `lark-cli` 命令基于 [飞书 CLI 官方文档](https://github.com/larksuite/cli)。使用前请先运行 `lark-cli --help` 和 `lark-cli im --help` 等验证命令是否存在。如命令格式不匹配,请参考官方文档调整。会议纪要请使用 `lark-cli minutes` 模块，视频会议请使用 `lark-cli vc` 模块，两者是独立的。
>
> 用飞书 CLI 蒸馏团队协作记忆,让那些一起扛过的夜继续发光。

## 适用场景

- 离职同事的协作记忆——那些深夜的飞书消息，每一条都是真的
- 团队文化存档——人散了，但那种一起熬夜改 bug 的感觉还在
- 资深专家的数字分身——新人入职时，直接在飞书里和「赛博导师」请教
- 项目里程碑纪念——用 CLI 导出的群聊记录，是最真实的周年纪念

## 数据采集（飞书 CLI 作为「眼」）

⚠️ 采集前请确保已获得相关人员的知情同意，详见文末合规声明。

### 群聊记录

```bash
# 搜索特定主题的群聊消息
lark-cli im +messages-search --chat-id "oc_xxx" --query "项目上线"

# 导出群聊历史记录
lark-cli im +messages-list --chat-id "oc_xxx" --page-all

# 下载群聊中的媒体文件
lark-cli im +messages-resources-download --message-id "om_xxx" --file-key "file_xxx" --output ./relic-data/
```

### 文档批注

```bash
# 读取飞书文档内容（含评论和批注）
lark-cli docs +read --doc-id "doxxx"

# 搜索知识库文档
lark-cli wiki +nodes-list --space-id "spacexxx"
```

### 协作时间线

```bash
# 从多维表格提取项目时间线
lark-cli base +records-list --app-token "bxxx" --table-id "tblxxx"

# 查看团队日历事件
lark-cli calendar +agenda --start "2025-01-01" --end "2025-12-31"
```

### 会议纪要

```bash
# 获取会议纪要和 AI 摘要
lark-cli minutes +get --meeting-id "meeting_xxx"

# 获取会议录音
lark-cli vc +recordings --meeting-id "meeting_xxx"
# 注：如需获取会议纪要，请使用 lark-cli minutes +get
```

## 主动行为（飞书 CLI 作为「手」）

### Relic 主动发消息

```bash
# Relic 想找你时，通过飞书 CLI 发消息
lark-cli im +messages-send --chat-id "oc_xxx" --text "怎么还在加班？早点回去。"

# 以机器人身份发消息
lark-cli im +messages-send --as bot --chat-id "oc_xxx" --text "今天是你入职三周年，还记得第一天吗？"
```

### 写入回忆录

```bash
# 在飞书文档里写入回忆
lark-cli docs +update --doc-id "doxxx" --markdown "## 团队回忆\n那个凌晨三点的上线夜..."
```

### 日历触发

```bash
# 在纪念日/生日创建提醒事件
lark-cli calendar +create --summary "老王入职纪念日" --start "2026-04-14T09:00:00" --end "2026-04-14T10:00:00"

# 基于日程触发主动关怀（赛博导师场景）
lark-cli calendar +create --summary "赛博导师提醒：客户拜访前准备" --start "2026-04-17T09:50:00" --end "2026-04-17T09:55:00"
```

## 四维灵魂提取

### 认知框架 (Cognition)

- 从飞书文档的评论和批注中提取思维模式
- 从群聊讨论中提取决策逻辑和优先级
- 从 OKR 文档中提取价值观和目标导向

### 表达风格 (Expression)

- 从飞书消息中提取语气、口癖、表情使用习惯
- 从文档评论中提取写作风格和表达偏好
- 从会议发言中提取语言节奏

### 行为模式 (Behavior)

- 从飞书日历中提取工作节奏和习惯
- 从多维表格记录中提取协作模式
- 从消息回复时间中提取响应习惯

### 情感接口 (Emotion)

- 从群聊互动中提取关心和鼓励的表达方式
- 从文档批注中提取对项目的情感投入
- 从会议中的语气变化中提取情绪模式

## 业务专家场景

除了团队协作记忆，飞书 CLI 还支持**业务专家数字身份锻造**——把离职大佬、金牌客服、顶级销售的专业判断蒸馏成可对话的赛博导师。

详细用法见 [业务专家模板](expert.md) 和一键锻造脚本 `scripts/lark_expert_forge.py`。

```bash
# 全链路锻造：授权 → 采集 → 结构化 → 主动关怀 → 生成 Relic
python scripts/lark_expert_forge.py --expert "张工" --email "zhang@company.com" --chat-id "oc_xxx" --dry-run
```

关键能力：

- **多维语料抓取** — IM 群聊 + 飞书文档 + 知识库 + 会议纪要
- **知识结构化** — 蒸馏结果写入飞书多维表格，团队可直观查看和修正
- **日历联动** — 基于新人日程主动提醒（评审前发 Checklist、拜访前发话术）
- **授权核验** — 通过飞书交互式卡片获取被蒸馏者知情同意

## 合规声明

⚠️ **重要提醒：**

- 使用飞书 CLI 采集数据前，必须获得相关人员的知情同意
- 企业内部数据采集需遵守公司数据安全政策
- 通过飞书 CLI 获取的数据仅用于创建经授权的数字分身
- Relic 在交互中会明确标识自己不是真人
- 详见 [授权协议](../soul-shield/consent-protocol.md) 和 [伦理红线](../soul-shield/ethics.md)

## 示例

### 团队协作记忆体

```text
[飞书群 · 翔宇科技]

你 ❯ 老王要离职了

群里安静了很久。

小李 ❯ 飞书群不散，你随时回来冒泡
老王 ❯ 文档权限我都交接好了，但那个凌晨三点的群我舍不得退
小张 ❯ 我用飞书 CLI 把咱们的群聊记录导出来了，那些夜没白熬
运营 ❯ 你教我的第一件事就是——遇到问题先别慌
```

### 赛博导师

```text
你 ❯ 这个方案你觉得怎么样？

赛博导师 ❯ 思路没问题，但第三步可以换个方式。
          我在飞书文档里留了批注，你看看。
          上次我们做过类似的，我翻一下多维表格里的记录。
          记住，先验证假设，再写代码。
```
