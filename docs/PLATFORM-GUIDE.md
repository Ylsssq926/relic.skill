# 平台数据获取指南

> 目标不是“抓得越多越好”，而是“拿到合法、完整、可整理的数据”。先确认你有权限，再开始导出。

## 使用前先做 4 件事

1. **只处理你本人拥有或明确获准处理的数据**。如果对象还在世，先解决同意问题，再谈导出。
2. **先导文本，再补媒体**。聊天文本、邮件正文、帖子文案永远比海量图片更容易整理。
3. **保留时间范围和会话对象**。导出后第一件事不是清洗，而是给文件夹命名。
4. **原始包永不覆盖**。把“原始导出”和“清洗后输入”分开放，后续回溯才不会乱。

## 12 平台获取总表

| 平台 | 推荐路径 | 具体操作步骤 | 输出格式 | 关键提醒 |
| --- | --- | --- | --- | --- |
| 微信 | 手机迁移到电脑 + 本地整理工具 | 1）手机微信打开“我 → 设置 → 通用 → 聊天记录迁移与备份”，先把目标聊天迁到电脑微信。<br>2）Windows 或 Mac 微信登录同一账号，确认历史消息已能在电脑端查看。<br>3）使用本地整理工具（如 WeChatMsg、留痕 等）读取当前电脑上的聊天数据库，按联系人或群导出 HTML、CSV 或 TXT。<br>4）把图片、语音、文件单独归档到与会话同名的目录。 | HTML / CSV / TXT / 媒体目录 | 微信没有面向普通用户的“官方一键全量导出”；最稳妥的做法是先完成官方迁移，再做本地整理。 |
| QQ | PC 客户端消息管理器 | 1）在 Windows QQ 或 TIM 登录目标账号。<br>2）打开目标会话，进入“消息记录”或“消息管理器”。<br>3）按联系人、群聊、关键词、时间范围筛选。<br>4）选择导出或另存为，优先导成 TXT、HTML 或 MHT。<br>5）如果手机端历史更全，先把聊天迁到电脑，再导出。 | TXT / HTML / MHT | 先按会话拆分，再按月份建目录，后面做人物蒸馏时最省事。 |
| Telegram | Telegram Desktop 官方导出 | 1）在电脑上安装并登录 Telegram Desktop。<br>2）导出全部数据：`Settings → Advanced → Export Telegram Data`。<br>3）导出单个聊天：打开目标会话，点击右上角菜单，选择 `Export chat history`。<br>4）勾选文本、图片、视频、文件，格式建议同时导出 HTML 和 JSON。<br>5）如果新登录的桌面端不能立刻导出，等待 24 小时或在已登录设备上确认。 | HTML / JSON / 媒体目录 | Telegram 是做结构化归档最友好的平台之一，优先保留 JSON。 |
| Discord | 官方数据包 + 授权频道导出 | 1）进入 `User Settings → Data & Privacy`。<br>2）在 `Request your data` 处申请数据包。<br>3）收到邮件后下载 ZIP。<br>4）如果你需要某个服务器或频道的可读聊天记录，在你有合法访问权限的前提下，再用 DiscordChatExporter 按频道导出 JSON 或 HTML。<br>5）把官方包和频道导出分开放。 | ZIP / JSON / HTML | 官方数据包更偏“你的账户数据”；想保留频道上下文，通常还要补频道级导出。 |
| Slack | 管理员工作区导出 | 1）由 Workspace Owner 或 Admin 登录 Slack 网页后台。<br>2）进入 `Tools & Settings → Workspace settings → Import/Export Data`。<br>3）选择导出范围并发起导出。<br>4）下载 ZIP 后按频道拆分整理。<br>5）如果需要私有频道或私信，先确认当前套餐、合规权限和组织政策。 | ZIP / JSON | Slack 默认导出能力和套餐、角色强相关；普通成员通常拿不到完整工作区历史。 |
| 飞书 | 管理员/API 采集 | 1）管理员到飞书开放平台创建企业自建应用。<br>2）开通 IM 相关权限与消息事件订阅，记录 App ID / App Secret。<br>3）把应用安装到目标租户，并将机器人加入目标群聊。<br>4）用事件回调持续接收后续消息，落成 JSON。<br>5）历史材料由管理员从审计或归档能力补出；云文档、会议纪要、群文件单独导出。 | JSON / 云文档 / 会议纪要 / 文件目录 | 飞书对“历史聊天一键导出”限制较多，企业场景通常要走管理员权限和 API 组合。 |
| 钉钉 | 管理员/API 采集 | 1）管理员在钉钉开放平台创建内部应用。<br>2）开通机器人、群会话、回调相关权限，记录 appKey / appSecret。<br>3）把应用安装到企业并加入目标群。<br>4）用回调或开放接口接收后续消息，按会话写入 JSON。<br>5）历史内容由管理员在管理后台导出；个人整理时，可在 PC 端按聊天窗口复制或分段整理。 | JSON / TXT / 管理后台导出文件 | 钉钉更适合“企业管理员 + 增量采集”路线；个人端缺少稳定的完整历史导出按钮。 |
| iMessage | Mac 同步 + PDF / 数据库备份 | 1）让 iPhone 和 Mac 使用同一个 Apple ID，并开启 Messages in iCloud。<br>2）等待目标会话完整同步到 Mac。<br>3）做可读归档：在 Mac 的 Messages 中打开会话，选择 `File → Print → Save as PDF`。<br>4）做结构化归档：备份 `~/Library/Messages/chat.db` 与 `Attachments/` 目录，或用 iMazing 导出 CSV / PDF。 | PDF / SQLite / CSV / 附件目录 | 只做纪念用途时，PDF 最省心；需要检索和分析时，再保留 `chat.db`。 |
| WhatsApp | 手机内建 Export Chat | 1）在手机上打开目标会话。<br>2）Android：右上角 `⋮ → More → Export chat`；iPhone：进入聊天详情后选 `Export Chat`。<br>3）选择 `Without media` 或 `Include media`。<br>4）发送到 Files、Drive、Mail 或电脑。<br>5）对重要会话逐个重复，并把原始 TXT 或 ZIP 与媒体附件一起保存。 | TXT / ZIP / 媒体目录 | 官方只支持逐个会话导出，且导出的聊天文件不能再导回 WhatsApp。 |
| Twitter / X | 官方归档 | 1）进入 `Settings and privacy → Your account → Your X data`。<br>2）验证身份（密码 + 邮箱或手机验证码）。<br>3）点击 `Request data`。<br>4）收到邮件或推送后，回到设置页下载归档 ZIP。<br>5）解压后重点保留 posts、likes、dm、media、profile 等目录。 | ZIP / JSON / CSV（视归档内容而定） | 下载前先确认邮箱可用；大号归档可能要等待数小时到数天。 |
| Instagram | Accounts Center 下载信息 | 1）打开 Instagram，进入 `Accounts Center`。<br>2）进入 `Your information and permissions → Download your information`。<br>3）选择 Instagram 账号，勾选需要的类别，比如帖子、私信、评论、收藏。<br>4）设置时间范围、格式、通知邮箱和媒体质量。<br>5）创建文件并在链接有效期内下载 ZIP。 | ZIP / JSON / HTML / 媒体目录 | 如果只想做 Relic，优先导出私信、帖子文案、评论、故事说明，不必什么都勾。 |
| Gmail | Google Takeout | 1）登录 Google 账号，打开 Google Takeout。<br>2）先“全部取消”，再只勾选 `Mail`。<br>3）按需选择标签范围，常见做法是只导出“收件箱 / 已发送 / 星标 / 某个联系人标签”。<br>4）下一步选择“导出一次”、ZIP 和下载方式。<br>5）创建导出并下载归档。 | MBOX / ZIP | 邮件最适合先按联系人、主题线、时间段切分，再做后续抽取。 |

## 导出后怎么整理成 Relic 输入

推荐把所有平台先整理成统一目录，而不是一会儿丢桌面、一会儿丢下载文件夹：

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

### 命名规则建议

- 会话文件夹：`平台_对象_起止时间`
- 媒体文件夹：`平台_对象_media`
- 原始压缩包：保留官方原名，不要手改覆盖
- 清洗后文件：`YYYY-MM-DD_platform_chat.json`

### 至少保留这些字段

| 字段 | 说明 |
| --- | --- |
| `platform` | 来源平台 |
| `chat_id` | 会话标识 |
| `chat_name` | 联系人、群名或邮箱主题 |
| `sender` | 发送者名称或账号 |
| `timestamp` | 原始时间戳，尽量保留时区 |
| `message_type` | text / image / voice / file / email / post |
| `content` | 文本正文或 OCR / 转写结果 |
| `attachments` | 附件文件名和相对路径 |
| `source_file` | 对应的原始导出文件 |

## 优先级建议：如果时间有限，先导什么

1. **聊天文本**：最能看出表达方式和关系结构。
2. **长消息 / 邮件 / 帖子正文**：最能看出认知方式和价值排序。
3. **语音转写**：最能保留语气、停顿、口头禅。
4. **照片和视频**：最适合补动作、场景和生活节奏。
5. **文件与链接**：适合做事实校验，不要一上来就全部吞进去。

## 常见坑

- **只导媒体，不导文本**：最后只剩几百张图，却不知道它们为什么重要。
- **把多个平台混成一个文件夹**：清洗阶段会非常痛苦。
- **丢掉时间范围**：没有时间，关系的变化就看不见。
- **只保留截图**：截图适合展示，不适合结构化处理。
- **忘了保留原始包**：后面发现解析错了，连回滚都做不到。

## 一句话版

先拿到合法数据，再按平台拆开，再把时间和对象标清楚。只要原始层干净，后面的蒸馏流程就会顺很多。
