# Chat Log Collector

> “聊天记录像一条会自己长草的小路，走多了，谁爱拐弯谁爱直走都藏不住。”
> *Chat logs are like a path that grows its own weeds — walk it enough, and who takes the turns and who goes straight stops being a secret.*

## Supported Formats

| Platform | Supported Forms | Common Files / Sources | Notes |
|---|---|---|---|
| WeChat | SQLite / CSV / JSON exports, screenshots, voice-message registry | `SQLite` `.csv` `.json` (via tools like PyWxDump / MemoTrace), image OCR | Voice messages are registered first, then handed to `voice-collector.md` |
| QQ | exported text, screenshots, chat backups | `.txt` `.mht` `.mhtml`, image OCR | Distinguish group nicknames from real identities |
| Telegram | exported chat packages, JSON, HTML | `.json` `.html` | Preserves channel, group, and DM structure |
| Slack | workspace export, channel archive | `.json` (inside ZIP) | Thread replies and emoji reactions must be preserved separately |
| Discord | exported text, screenshots, channel records | `.json` `.txt`, image OCR | Mark channel and server context |
| Feishu | [Feishu CLI](https://github.com/larksuite/cli) / API / official export | `lark-cli im +messages-search` `lark-cli im +messages-list` `.json` | Supports group search, message history, media download; links with doc annotations and meeting minutes |
| iMessage | backup parse results, screenshots, structured export | `chat.db` (SQLite) `.csv` `.pdf`, image OCR | Preserve time and attachment info beyond blue/green bubbles |

Additional support:

- Forwarded records, chat summaries, hand-organized dialogue excerpts.
- Image-type chat screenshots — but OCR confidence must be marked.
- Text descriptions of stickers and memes, e.g. "laughing-cat sticker," "hands-together."
- **Multimodal direct reading (recommended)**: if the runtime understands images/audio directly, chat screenshots, stickers, and voice messages can be read directly — no forced text conversion first; fall back to OCR/STT only for batch or low-confidence material.

## Collection Flow

1. **Confirm scope**
   - Clarify the target subject, time range, platform range, people or groups to exclude.
   - First judge whether it's DM, group, or cross-platform aggregation.

2. **Receive raw material**
   - Preserve the raw export filename, export time, platform name.
   - If material comes from screenshots, record screenshot source and shooting order.

3. **Structure it**
   - Complete time, speaker, modality, and thread relation for every message.
   - Mark `text / emoji / sticker / voice-note / image-caption / link / forwarded` separately.

4. **Context slicing**
   - Slice by topic, event, time range, or thread — avoid single sentences stripped of context.
   - For key conclusions, keep at least 2–5 surrounding messages.

5. **Cross-referencing**
   - Voice messages in chats point to `collectors/voice-collector.md`.
   - Images, albums, sticker screenshots point to `collectors/photo-collector.md`.

6. **Export collection results**
   - Produce a structured message inventory, quality notes, and privacy-handling record.
   - Ready to hand to the four-dimension extraction module for continued distillation.

## Cleaning Rules

- Remove pure system noise: system prompts, recall notices, red-packet reminders, group-join notices.
- Preserve timestamps; when exact-to-the-second is impossible, keep at least date and time-of-day.
- Merge fully duplicated forwarded messages, but record "duplicate count."
- Reply chains, quoted messages, and thread relations must not be lost.
- OCR text keeps its "recognition uncertain" mark — don't treat recognition errors as original quotes.
- Emoji, stickers, and GIFs convert to brief text descriptions; never silently ignore.
- Link messages keep their title and the context of why the sender shared them; storing the link alone is not a conclusion.
- For cross-platform aggregation, use a unified speaker ID for the same subject — but never delete the original platform fields.

## Privacy Protection

- Collect only conversation windows relevant to the target profile; don't sweep in unrelated groups wholesale.
- Sanitize phone numbers, addresses, ID numbers, order numbers, children's schools, and similar sensitive info.
- Unrelated third-party names can be replaced with relationship labels like "Colleague A," "Relative B."
- If the target is not the core speaker in a group chat, narrow the截取 range to reduce others' exposure.
- Keep raw files and cleaned files separate; the latter is the distillation input.
- If the user requests one-time analysis only, the structured intermediate files may be deleted after output.

## Output Format

```yaml
collector: chat
platforms:
  - 微信 / WeChat
  - Telegram
scope:
  target: 目标对象名称 / target subject name
  time_range:
    start: 采集起始时间 / collection start
    end: 采集结束时间 / collection end
  conversation_types:
    - 单聊 / DM
    - 群聊 / group
participants:
  primary:
    - 目标对象 / target subject
  related:
    - 与目标高频互动者 / high-frequency interactors
items:
  - message_id: 平台内消息标识或顺序编号 / in-platform ID or sequence number
    timestamp: 原始时间戳 / original timestamp
    speaker: 说话人 / speaker
    modality: text | emoji | sticker | voice-note | image-caption | link | forwarded
    content: 清洗后的消息文本或说明 / cleaned text or description
    context:
      thread: 所在线程或主题 / thread or topic
      reply_to: 被回复对象 / replied-to
      neighbors: 关键上下文范围说明 / key context range note
    privacy:
      redactions:
        - 已隐藏的敏感字段说明 / redacted-field notes
quality_notes:
  - OCR 结果是否存在不确定片段 / whether OCR has uncertain segments
  - 是否存在缺失时间、缺失附件或说话人别名冲突 / missing time, missing attachments, or speaker-alias conflicts
handoff:
  voice_messages:
    - 需要继续送入 `collectors/voice-collector.md` 的片段 / fragments for voice-collector
  images:
    - 需要继续送入 `collectors/photo-collector.md` 的片段 / fragments for photo-collector
```
