# Platform Data Acquisition Guide

> 目标不是“抓得越多越好”，而是“拿到合法、完整、可整理的数据”。先确认你有权限，再开始导出。
> *The goal is not "grab as much as possible" — it's "get legal, complete, organizable data." Confirm you have permission first, then export.*

## Four Things Before You Start

1. **Only process data you own or are explicitly authorized to process.** If the subject is living, resolve consent before talking about export.
2. **Text first, media later.** Chat text, email bodies, and post copy always organize more easily than mountains of images.
3. **Preserve time range and conversation counterpart.** The first thing after export is not cleaning — it's naming the folder.
4. **Never overwrite the raw package.** Keep "raw export" and "cleaned input" separate so you can always trace back.

## 12-Platform Master Table

> 📌 **Platform regions**: Telegram / Discord / Slack / iMessage / WhatsApp / X / Instagram / Gmail are international; **WeChat / QQ / Feishu / DingTalk are Mainland China platforms** — all imports are local script parsing or official exports; no bot required for distillation.

| Platform | Recommended Path | Steps | Output Format | Key Reminders |
|---|---|---|---|---|
| WeChat | Phone-to-PC migration + local tools | 1) In mobile WeChat: "Me → Settings → General → Chat Migration & Backup" — migrate the target chat to PC WeChat first.<br>2) Log into the same account on Windows/Mac WeChat; confirm history is visible on PC.<br>3) Use local tools (e.g. WeChatMsg, 留痕) to read the local chat database; export HTML / CSV / TXT by contact or group.<br>4) Archive images, voice, and files into a folder named after the conversation. | HTML / CSV / TXT / media dir | WeChat has no official one-click full export for regular users; official migration + local processing is the safest route. |
| QQ | PC client message manager | 1) Log into the target account on Windows QQ or TIM.<br>2) Open the target conversation → "Message History" or "Message Manager".<br>3) Filter by contact, group, keyword, time range.<br>4) Choose export / save-as — prefer TXT, HTML, or MHT.<br>5) If mobile history is more complete, migrate to PC first, then export. | TXT / HTML / MHT | Split by conversation first, then create monthly folders — it saves the most work later in distillation. |
| Telegram | Telegram Desktop official export | 1) Install and log into Telegram Desktop.<br>2) Export all data: `Settings → Advanced → Export Telegram Data`.<br>3) Export a single chat: open it → top-right menu → `Export chat history`.<br>4) Check text, images, videos, files; export both HTML and JSON.<br>5) If a freshly-logged-in desktop can't export immediately, wait 24 hours or confirm on a logged-in device. | HTML / JSON / media dir | Telegram is one of the most structured-archival-friendly platforms — prioritize keeping the JSON. |
| Discord | Official data package + authorized channel export | 1) Go to `User Settings → Data & Privacy`.<br>2) Request your data at `Request your data`.<br>3) Download the ZIP after the email arrives.<br>4) If you need readable channel history for a server (with legitimate access), use DiscordChatExporter to export JSON or HTML by channel.<br>5) Keep the official package and channel exports separate. | ZIP / JSON / HTML | The official package is more "your account data"; channel context usually needs channel-level export on top. |
| Slack | Admin workspace export | 1) Log into the Slack web admin as Workspace Owner or Admin.<br>2) Go to `Tools & Settings → Workspace settings → Import/Export Data`.<br>3) Choose the export scope and start.<br>4) Download the ZIP and split by channel.<br>5) For private channels or DMs, confirm plan, compliance permissions, and org policy first. | ZIP / JSON | Slack's default export capability is tightly tied to plan and role; regular members usually can't get full workspace history. |
| Feishu | Admin / API collection | 1) Admin creates an enterprise custom app on the Feishu Open Platform.<br>2) Enable IM permissions and message event subscription; record App ID / App Secret.<br>3) Install the app into the target tenant and add the bot to the target group.<br>4) Receive subsequent messages via event callback; write to JSON.<br>5) Historical material is supplemented from audit or archival capabilities; cloud docs, meeting minutes, and group files are exported separately. | JSON / cloud docs / meeting minutes / file dir | Feishu restricts "one-click history export" significantly; enterprise scenarios usually need admin permissions + API combination. |
| DingTalk | Admin / API collection | 1) Admin creates an internal app on the DingTalk Open Platform.<br>2) Enable bot, group conversation, and callback permissions; record appKey / appSecret.<br>3) Install the app into the enterprise and add it to the target group.<br>4) Receive messages via callback or open API; write to JSON by conversation.<br>5) Historical content is exported by the admin in the admin console; for personal use, copy or segment from the PC client per chat window. | JSON / TXT / admin console export | DingTalk suits the "enterprise admin + incremental collection" route; the personal client lacks a stable full-history export button. |
| iMessage | Mac sync + PDF / database backup | 1) Use the same Apple ID on iPhone and Mac; enable Messages in iCloud.<br>2) Wait for the target conversation to fully sync to Mac.<br>3) Readable archive: open the conversation in Mac Messages → `File → Print → Save as PDF`.<br>4) Structured archive: back up `~/Library/Messages/chat.db` and the `Attachments/` directory, or use iMazing to export CSV / PDF. | PDF / SQLite / CSV / attachments | For commemoration only, PDF is easiest; for search and analysis, keep `chat.db`. |
| WhatsApp | In-app Export Chat | 1) Open the target conversation on your phone.<br>2) Android: top-right `⋮ → More → Export chat`; iPhone: enter chat details, choose `Export Chat`.<br>3) Choose `Without media` or `Include media`.<br>4) Send to Files, Drive, Mail, or your computer.<br>5) Repeat per important conversation; keep the raw TXT or ZIP with media attachments. | TXT / ZIP / media dir | Official export is per-conversation only, and exported chat files cannot be re-imported into WhatsApp. |
| Twitter / X | Official archive | 1) Go to `Settings and privacy → Your account → Your X data`.<br>2) Verify identity (password + email or phone code).<br>3) Click `Request data`.<br>4) After the email or push notification, return to settings and download the archive ZIP.<br>5) After unzipping, prioritize `posts`, `likes`, `dm`, `media`, `profile`. | ZIP / JSON / CSV (varies by archive) | Before downloading, confirm your email is reachable; large accounts may wait hours to days. |
| Instagram | Accounts Center download | 1) Go to Instagram → Accounts Center.<br>2) Go to `Your information and permissions → Download your information`.<br>3) Select the Instagram account; check the categories you need — posts, DMs, comments, saved, stories.<br>4) Set the time range, format, notification email, and media quality.<br>5) Create the file and download the ZIP within the link's validity window. | ZIP / JSON / HTML | If it's for a Relic, prioritize DMs, post copy, comments, and story captions — don't check everything. |
| Gmail | Google Takeout | 1) Log into your Google account → Google Takeout.<br>2) First "Deselect all," then check only `Mail`.<br>3) Choose label ranges as needed — common: Inbox / Sent / Starred / a contact label.<br>4) Next, choose "Export once," ZIP, and download method.<br>5) Create the export and download the archive. | MBOX / ZIP | Email is best split by contact, thread, and time period before extraction. |

## Which Parser to Use

Export first (per the table above), then run the matching parser — it converts the export into the normalized JSON that `relic_writer.py` consumes:

| Platform | Export you should have | Command |
|---|---|---|
| Telegram | `result.json` or a folder of chat JSON | `python3 scripts/telegram_parser.py --input ~/telegram_export --output data.json` |
| Discord | DiscordChatExporter `.json` / official data package | `python3 scripts/discord_parser.py --input ~/discord_export --output data.json` |
| WhatsApp | folder of per-chat `.txt` | `python3 scripts/whatsapp_parser.py --input ~/whatsapp_export --output data.json` |
| Slack | workspace export folder (with `users.json`) | `python3 scripts/slack_parser.py --input ~/slack_export --output data.json` |
| Instagram | extracted "Download Your Information" folder | `python3 scripts/instagram_parser.py --input ~/instagram-data --output data.json` |
| Gmail / Apple Mail | `.mbox` / `.eml` | `python3 scripts/email_parser.py --input ~/Takeout/Archive.mbox --output data.json` |
| WeChat | SQLite / CSV export | `python3 scripts/wechat_parser.py --input ~/wechat_export --output data.json` |
| QQ | `.txt` / `.mht` export | `python3 scripts/qq_parser.py --input chat.txt --output data.json` |
| Feishu | via Feishu CLI | `python3 scripts/lark_expert_forge.py --help` |
| DingTalk / iMessage / X | any of the above formats after conversion | export JSON/CSV/MBOX, then feed `scripts/relic_writer.py --data` directly |

**Add `--self-name` (your own display name) to every parser** — that's how the Relic learns which side of the conversation is "you" versus the subject.

All parsers are pure Python standard library (no extra installs) and fully local — they only read the files you exported.

## Organizing Exports into Relic Input

The recommendation is to normalize all platforms into one directory structure, instead of dropping things on the desktop one minute and Downloads the next:

```text
imports/
├── raw/
│   ├── wechat/
│   ├── qq/
│   ├── telegram/
│   ├── discord/
│   ├── slack/
│   ├── feishu/
│   ├── dingtalk/
│   ├── imessage/
│   ├── whatsapp/
│   ├── x/
│   ├── instagram/
│   └── gmail/
└── normalized/
    ├── chats/
    ├── media/
    ├── docs/
    └── metadata/
```

### Naming conventions

- Conversation folder: `platform_subject_start-end`
- Media folder: `platform_subject_media`
- Raw archives: keep official original names; don't rename or overwrite
- Cleaned files: `YYYY-MM-DD_platform_chat.json`

### Fields to always keep

| Field | Notes |
|---|---|
| `platform` | Source platform |
| `chat_id` | Conversation identifier |
| `chat_name` | Contact, group name, or email subject |
| `sender` | Sender name or account |
| `timestamp` | Original timestamp; preserve timezone where possible |
| `message_type` | text / image / voice / file / email / post |
| `content` | Text body or OCR / transcription result |
| `attachments` | Attachment filenames and relative paths |
| `source_file` | The corresponding raw export file |

## Priority: What to Export When Time Is Tight

1. **Chat text**: best reveals expression style and relationship structure.
2. **Long messages / emails / post bodies**: best reveal cognition and value ordering.
3. **Voice transcription**: best preserves tone, pauses, and verbal habits.
4. **Photos and videos**: best for movement, scene, and life rhythm.
5. **Files and links**: for fact-checking; don't swallow everything at once.

## Common Pitfalls

- **Media only, no text**: you end up with hundreds of images and no idea why they matter.
- **Multiple platforms mixed into one folder**: the cleaning stage will be miserable.
- **Dropping the time range**: without time, you can't see how the relationship changed.
- **Screenshots only**: screenshots are for display, not structured processing.
- **Forgetting the raw package**: when you later find a parsing error, you can't even roll back.

## One-Line Version

Get legal data first, split by platform second, mark time and subject third. Keep the raw layer clean, and everything downstream flows.
