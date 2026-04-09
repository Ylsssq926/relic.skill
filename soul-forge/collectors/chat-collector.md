# 聊天记录采集器

> “聊天记录像一条会自己长草的小路，走多了，谁爱拐弯谁爱直走都藏不住。”

## 支持的数据格式

| 平台 | 支持形式 | 常见文件或来源 | 说明 |
| --- | --- | --- | --- |
| 微信 | SQLite / CSV / JSON 导出、截图、语音消息登记 | `SQLite` `.csv` `.json`（通过 PyWxDump / MemoTrace 等工具导出） 图片 OCR | 聊天里的语音消息先登记，再转交 `voice-collector.md` |
| QQ | 导出文本、截图、聊天备份 | `.txt` `.mht` `.mhtml` 图片 OCR | 注意区分群聊昵称与真实身份 |
| Telegram | 导出聊天包、JSON、HTML | `.json` `.html` | 可保留频道、群组、私聊结构 |
| Slack | 工作区导出、频道归档 | `.json`（ZIP 包内） | 线程回复与表情反应要单独保留 |
| Discord | 导出文本、截图、频道记录 | `.json` `.txt` 图片 OCR | 需标记频道与服务器上下文 |
| iMessage | 备份解析结果、截图、结构化导出 | `chat.db`（SQLite） `.csv` `.pdf` 图片 OCR | 要保留蓝绿气泡之外的时间与附件信息 |

额外支持：

- 转发记录、聊天摘要、手工整理的对话摘录。
- 图片型聊天截图，但必须标记 OCR 置信度。
- 表情包与贴纸的文字说明，例如“笑哭猫猫贴纸”“双手合十”。

## 采集流程

1. **确认范围**
   - 明确目标对象、时间范围、平台范围、需要排除的人或群。
   - 先判断是单聊、群聊，还是跨平台汇总。

2. **接收原始材料**
   - 保留原始导出文件名、导出时间、平台名称。
   - 如果材料来自截图，记录截图来源和拍摄顺序。

3. **结构化整理**
   - 为每条消息补齐时间、说话人、媒介类型、线程关系。
   - 将 `text / emoji / sticker / voice-note / image-caption / link / forwarded` 分开标记。

4. **上下文切片**
   - 以主题、事件、时间段或线程为单位切片，避免单句脱离语境。
   - 对关键结论，至少保留前后 2 到 5 条关联消息。

5. **交叉指路**
   - 聊天里的语音消息指向 `collectors/voice-collector.md`。
   - 聊天里的图片、相册、表情截图可指向 `collectors/photo-collector.md`。

6. **导出采集结果**
   - 形成结构化消息清单、质量说明、隐私处理记录。
   - 准备交给四维提取模块继续蒸馏。

## 数据清洗规则

- 去除系统提示、撤回通知、红包提醒、进群提示等纯系统噪音。
- 保留时间戳，无法精确到秒时至少保留日期与时段。
- 合并完全重复的转发消息，但记录“重复出现次数”。
- 回复链、引用消息、线程关系不得丢失。
- OCR 文本要保留“识别不确定”标记，避免把识别错误当成原话。
- emoji、贴纸、GIF 需要转为简短文字描述，不直接忽略。
- 链接消息保留标题与对象为何发送该链接的上下文；只存链接不做结论。
- 跨平台汇总时，用统一说话人 ID 标记同一对象，但原平台字段不能删。

## 隐私保护

- 只采集与目标画像有关的对话窗口，不把无关群聊整包纳入。
- 对手机号、住址、证件号、订单号、孩子学校等敏感信息做脱敏处理。
- 无关第三方姓名可用关系标签代替，如“同事 A”“亲戚 B”。
- 群聊中若目标对象不是核心发言者，应缩小截取范围，减少旁人暴露。
- 原始文件与清洗后文件分开保存，后者作为后续蒸馏输入。
- 若用户要求仅做当次分析，可在产出后删除结构化中间文件。

## 输出格式

```yaml
collector: chat
platforms:
  - 微信
  - Telegram
scope:
  target: 目标对象名称
  time_range:
    start: 采集起始时间
    end: 采集结束时间
  conversation_types:
    - 单聊
    - 群聊
participants:
  primary:
    - 目标对象
  related:
    - 与目标高频互动者
items:
  - message_id: 平台内消息标识或顺序编号
    timestamp: 原始时间戳
    speaker: 说话人
    modality: text | emoji | sticker | voice-note | image-caption | link | forwarded
    content: 清洗后的消息文本或说明
    context:
      thread: 所在线程或主题
      reply_to: 被回复对象
      neighbors: 关键上下文范围说明
    privacy:
      redactions:
        - 已隐藏的敏感字段说明
quality_notes:
  - OCR 结果是否存在不确定片段
  - 是否存在缺失时间、缺失附件或说话人别名冲突
handoff:
  voice_messages:
    - 需要继续送入 `collectors/voice-collector.md` 的片段
  images:
    - 需要继续送入 `collectors/photo-collector.md` 的片段
```
