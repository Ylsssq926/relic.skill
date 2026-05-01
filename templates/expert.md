# 💼 业务专家 — 专业数字身份模板

> **命令格式说明**:本文档中的 `lark-cli` 命令基于 [飞书 CLI 官方文档](https://github.com/larksuite/cli)。使用前请先运行 `lark-cli --help` 验证命令是否存在。如命令格式不匹配,请参考官方文档调整。会议纪要请使用 `lark-cli minutes` 模块，视频会议请使用 `lark-cli vc` 模块，两者是独立的。
>
> 知识不该随人走。把资深专家的专业判断、决策逻辑和经验沉淀,唤醒成可对话的数字身份。

## 适用场景

- **资深专家离职** — 架构师、销冠、金牌客服走了，但他们的专业判断还在
- **新人入职导师** — 新人直接和「赛博导师」请教，不用等老员工有空
- **跨团队知识共享** — 让其他团队也能向你的专家请教，不依赖 1v1 沟通
- **经验防丢失** — 那些只存在于老员工脑子里的隐性知识，终于有了载体

## 与普通团队模板的区别

| 维度 | 团队文化模板 | 业务专家模板 |
|------|------------|------------|
| 蒸馏对象 | 团队整体氛围 | 个人专业能力 |
| 核心价值 | 情感记忆 | 知识传承 |
| 数据来源 | 群聊为主 | 文档 + 群聊 + 会议 + 日程 |
| 交互方式 | 闲聊、回忆 | 请教、决策辅助 |
| 输出形式 | 对话 | 对话 + 知识库 + 主动提醒 |

## 数据采集（飞书 CLI 深度联动）

### 第一步：多维语料抓取

```bash
# 1. 抓取专家参与的群聊记录（IM 能力）
lark-cli im +messages-search --query "架构评审" --chat-id "oc_xxx"
lark-cli im +messages-list --chat-id "oc_xxx" --page-all --format json > expert_im.json

# 2. 搜索专家撰写的飞书文档（Docs 能力）
lark-cli docs +search --query "技术方案"
lark-cli docs +fetch --doc-id "doxxx" --format markdown > expert_doc.md

# 3. 提取知识库中的专业内容（Wiki 能力）
lark-cli wiki nodes list --space-id "spacexxx"
lark-cli wiki +node-get --node-id "nodexxx"

# 4. 获取会议纪要中的决策记录（VC 能力）
lark-cli vc +notes --meeting-ids "meeting_xxx"
```

### 第二步：授权核验（合规前置）

```bash
# 在采集前，通过飞书 CLI 给被蒸馏者发确认消息
lark-cli im +messages-send \
  --receive-id-type "email" \
  --receive-id "expert@company.com" \
  --msg-type "interactive" \
  --content '{
    "config": {"wide_screen_mode": true},
    "header": {"title": {"tag": "plain_text", "content": "🔐 数字身份创建授权请求"}},
    "elements": [
      {"tag": "div", "text": {"tag": "lark_md", "content": "系统请求提取你在飞书中的专业内容，用于创建数字身份。"}},
      {"tag": "div", "text": {"tag": "lark_md", "content": "**范围：** 你参与的群聊记录、撰写的文档、会议发言"}},
      {"tag": "div", "text": {"tag": "lark_md", "content": "**用途：** 仅用于创建经你授权的数字身份，不会泄露原始数据"}},
      {"tag": "action", "actions": [
        {"tag": "button", "text": {"tag": "plain_text", "content": "同意授权"}, "type": "primary", "value": {"action": "approve"}},
        {"tag": "button", "text": {"tag": "plain_text", "content": "拒绝"}, "type": "danger", "value": {"action": "reject"}}
      ]}
    ]
  }'
```

### 第三步：知识结构化（Base 能力）

```bash
# 在飞书多维表格中创建「专家知识库」
lark-cli base +create --name "Relic 专家知识库 - 张工" --folder-token "fldxxx"

# 创建数据表
lark-cli base +tables-create \
  --app-token "bxxx" \
  --table-name "专业知识" \
  --fields '[{"field_name":"知识领域","type":1},{"field_name":"核心观点","type":1},{"field_name":"证据来源","type":1},{"field_name":"置信度","type":2}]'

# 写入蒸馏后的知识点
lark-cli base +record-create \
  --app-token "bxxx" \
  --table-id "tblxxx" \
  --fields '{"知识领域":"系统架构","核心观点":"先验证假设再写代码，不要一上来就重构","证据来源":"2025-03 架构评审会议纪要","置信度":95}'
```

### 第四步：赛博导师入驻日历（Calendar 能力）

```bash
# 查看今日议程
lark-cli calendar +agenda

# 读取新人的日历，识别关键事件
lark-cli calendar events instance_view --params '{"calendar_id":"primary","start_time":"1714089600","end_time":"1714694400"}'

# 在新人有重要会议前，创建提醒
lark-cli calendar +create \
  --summary "赛博导师提醒：客户拜访前准备" \
  --start "2026-04-17T09:50:00" \
  --end "2026-04-17T09:55:00" \
  --description "张工的数字身份提醒你：见客户前复习销售话术，重点在第3页的异议处理部分。"
```

## 四维灵魂提取（专业版）

### 认知框架 (Cognition)

- 从技术方案文档中提取**决策逻辑**和**判断标准**
- 从架构评审会议纪要中提取**优先级排序**和**取舍原则**
- 从 OKR 文档中提取**目标导向**和**价值判断**

### 表达风格 (Expression)

- 从飞书消息中提取**专业术语使用习惯**和**解释复杂概念的方式**
- 从文档评论中提取**批注风格**——是直指要害还是循循善诱
- 从会议发言中提取**说服力模式**——数据驱动还是经验驱动

### 行为模式 (Behavior)

- 从飞书日历中提取**工作节奏**——什么时候做深度思考，什么时候做快速决策
- 从多维表格记录中提取**协作模式**——喜欢先讨论还是先动手
- 从消息回复时间中提取**响应模式**——紧急问题怎么处理，非紧急怎么安排

### 情感接口 (Emotion)

- 从新人提问的回复中提取**教学耐心**和**鼓励方式**
- 从 Code Review 评论中提取**对质量的执着程度**
- 从项目上线时的发言中提取**对成果的自豪感和团队认可方式**

## 主动行为设计

赛博导师不是被动等问，而是基于飞书日程主动提供帮助：

| 触发条件 | 主动行为 | CLI 命令 |
|---------|---------|---------|
| 新人日历出现「客户拜访」 | 提前10分钟发销售话术提醒 | `lark-cli im +messages-send` |
| 新人日历出现「技术评审」 | 发送架构评审 Checklist | `lark-cli im +messages-send` |
| 专家入职周年 | 在群里发一段经验总结 | `lark-cli im +messages-send` |
| 多维表格新增记录 | 自动更新知识库并通知 | `lark-cli base +record-create` |
| 关键项目里程碑 | 在文档中写入经验回顾 | `lark-cli docs +update` |

## 合规声明

⚠️ **数字身份创建必须遵守以下原则：**

1. **知情同意** — 通过飞书 CLI 发送授权请求，被蒸馏者明确同意后才采集数据
2. **最小必要** — 只采集与专业能力相关的数据，不采集私人对话
3. **可撤销** — 被蒸馏者随时可以要求删除其数字身份
4. **标识明确** — 数字身份在交互中会标注「这是基于 XXX 的数字身份，不是本人」
5. **企业合规** — 在企业环境中使用需遵守公司数据安全政策，通过企业应用权限审批

详见 [授权协议](../soul-shield/consent-protocol.md) 和 [伦理红线](../soul-shield/ethics.md)

## 示例对话

### 新人请教

```text
新人 ❯ 张工的数字身份，这个技术方案你觉得怎么样？

赛博导师 ❯ 整体思路没问题，但第三步的缓存策略可以再想想。
          我在飞书文档里留过批注，你可以搜「缓存方案对比」。
          上次我们做过类似的选型，结论是读写分离比缓存穿透防护优先级更高。
          如果你赶时间，先用方案 A 上线，下个迭代再优化。

新人 ❯ 好的，那测试环境怎么搭？

赛博导师 ❯ 多维表格里有我整理的环境搭建 Checklist，表名是「基础设施」。
          记住，先验证假设再写代码。别一上来就重构。
```

### 主动提醒

```text
[赛博导师 · 自动消息]

你下午三点有个技术评审，我帮你整理了几个常见问题的回答思路：

1. 「为什么选这个方案？」→ 从成本和团队能力两个角度回答
2. 「风险点在哪？」→ 重点提数据一致性问题，我之前写过一篇文档
3. 「时间线合理吗？」→ 参考上次类似项目的实际耗时，比预估多 40%

加油，你准备得比你自己以为的要充分。
```
