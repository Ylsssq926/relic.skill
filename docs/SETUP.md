# 配置指南

> 从零开始,让 Relic 真的活起来。

这不是技术文档。这是一份"怎么让奶奶住进飞书"的实操手册。

---

## 第一步:唤醒你的第一个 Relic

在开始之前,你得先有个 Relic。就像盖房子得先有地基。

### 方式一:用脚本生成(推荐)

如果你有聊天记录、照片、录音这些素材:

```bash
# 先解析数据(以微信为例)
python scripts/wechat_parser.py --input ~/wechat_export/ --output data.json

# 然后唤醒 Relic
python scripts/relic_writer.py --data data.json --template human --slug grandma
```

这会在 `exes/grandma/` 下生成一个完整的 Relic 文件夹,包括:

- `SKILL.md` — 入口文件
- `personality.md` — 四维人格画像
- `interaction.md` — 对话示例
- `memory.md` — 记忆片段
- `manifest.json` — 配置文件
- `proactive_config.json` — 主动行为配置

**为什么要这么做?** 因为手写这些文件太累了,而且容易漏东西。脚本会帮你把数据整理成 Relic 能理解的格式。

### 方式二:手动创建

如果你没有数据,或者想从零开始:

```bash
mkdir -p exes/grandma
cd exes/grandma
```

然后参考 `examples/grandma-demo/` 里的文件,手动创建上面列出的那些文件。

**什么时候用这个?** 当你想蒸馏的对象没有数字痕迹(比如很久以前的人),或者你想完全自己控制每个细节。

---

## 第二步:让 Relic 住进飞书

奶奶不只在聊天记录里。现在让她住在飞书群里,@一下就来。

### 2.1 在飞书开放平台创建应用

1. 打开 [飞书开放平台](https://open.feishu.cn/app)
2. 点"创建企业自建应用"
3. 填个名字,比如"奶奶·王秀兰"
4. 创建完成后,记下这两个东西:
   - **App ID** (长这样:`cli_a1b2c3d4e5f6g7h8`)
   - **App Secret** (长这样:一串随机字符)

**为什么要创建应用?** 因为飞书机器人需要一个"身份证"才能发消息、接收消息。

### 2.2 配置权限

在应用管理页面:

1. 点"权限管理"
2. 搜索并开通这些权限:
   - `im:message` — 接收消息
   - `im:message:send_as_bot` — 发送消息
   - `im:chat` — 获取群信息

3. 点"版本管理与发布" → "创建版本" → "申请发布"

**为什么要这些权限?** 因为机器人需要能看到你发的消息,也需要能回复你。

### 2.3 配置事件订阅

1. 在应用管理页面,点"事件订阅"
2. 点"添加事件" → 搜索"接收消息" → 选择 `im.message.receive_v1`
3. 配置请求地址:
   - 如果你有公网服务器:`https://你的域名/webhook`
   - 如果在本地开发:先用 [ngrok](https://ngrok.com/) 或 [localtunnel](https://localtunnel.github.io/www/) 暴露本地端口

**为什么要配置这个?** 因为飞书需要知道"用户发消息时,应该通知谁"。

### 2.4 设置环境变量

在项目根目录创建 `.env` 文件:

```bash
# 飞书应用凭证
FEISHU_APP_ID=cli_a1b2c3d4e5f6g7h8
FEISHU_APP_SECRET=你的App Secret
FEISHU_VERIFICATION_TOKEN=在"事件订阅"页面能看到

# AI 服务(用于驱动对话)
AI_PROVIDER=claude  # 或 openai
AI_API_KEY=sk-ant-xxx  # 你的 Claude 或 OpenAI API Key
```

**为什么要用 .env?** 因为这些密钥不能提交到 Git,用 .env 文件可以让它们只存在你本地。

### 2.5 启动机器人

```bash
python scripts/feishu_bot.py --relic exes/grandma
```

如果一切正常,你会看到:

```text
[INFO] Feishu bot started for Relic: grandma
[INFO] Listening on http://0.0.0.0:8080/webhook
```

### 2.6 测试

1. 在飞书里找到你的机器人(在"工作台"里搜索应用名)
2. 发条消息:`奶奶,我今天加班到十一点`
3. 如果奶奶回复了,说明成功了

**如果没反应怎么办?**

- 检查 `.env` 里的凭证是否正确
- 检查飞书开放平台的"事件订阅"是否配置成功
- 看看终端有没有报错

---

## 第三步:让 Relic 住进 Telegram

如果你的家人朋友在海外,Telegram 可能是更好的选择。

### 3.1 用 @BotFather 创建机器人

1. 在 Telegram 里搜索 `@BotFather`
2. 发送 `/newbot`
3. 按提示输入机器人名字(比如"奶奶·王秀兰")
4. 输入用户名(必须以 `bot` 结尾,比如 `grandma_wang_bot`)
5. 创建成功后,BotFather 会给你一个 **Bot Token**(长这样:`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

**为什么要用 BotFather?** 因为所有 Telegram 机器人都必须通过它创建,这是 Telegram 的规定。

### 3.2 配置 Bot Token

在 `.env` 文件里加上:

```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 3.3 选择运行模式

Telegram 机器人有两种运行模式:

#### Webhook 模式(推荐,适合生产环境)

需要一个公网 HTTPS 地址。Telegram 会主动把消息推送给你。

```bash
python scripts/telegram_bot.py --relic exes/grandma
```

**什么时候用?** 当你有服务器,想让机器人 7×24 小时在线。

#### Long Polling 模式(适合本地开发)

不需要公网地址。机器人会主动去 Telegram 拉取消息。

```bash
python scripts/telegram_bot.py --relic exes/grandma --polling
```

**什么时候用?** 当你在本地测试,或者没有公网服务器。

### 3.4 测试

1. 在 Telegram 里搜索你的机器人用户名(比如 `@grandma_wang_bot`)
2. 点"Start"
3. 发条消息:`奶奶,我今天加班到十一点`
4. 如果奶奶回复了,说明成功了

**如果没反应怎么办?**

- 检查 Bot Token 是否正确
- 如果用 Webhook 模式,检查公网地址是否能访问
- 看看终端有没有报错

---

## 第四步:让 Relic 开口说话(TTS)

过年的时候,不只是文字消息。是奶奶真的声音,说"吃饺子了没"。

### 4.1 选择 TTS 服务

| 服务 | 优势 | 适合场景 |
|------|------|---------|
| **MiniMax** | 中文最自然,支持声音克隆,10 秒样本就能开始 | 中文 Relic(推荐) |
| **ElevenLabs** | 英文最好,情绪表达细腻 | 英文 Relic |
| **OpenAI TTS** | 便宜,质量还行 | 预算有限 |

**为什么推荐 MiniMax?** 因为它对中文的情绪把握最好。奶奶说"哎呀你这孩子"的时候,真的能听出心疼。

### 4.2 获取 API Key

#### MiniMax

1. 打开 [MiniMax 开放平台](https://www.minimaxi.com/)
2. 注册并创建应用
3. 在"API 密钥"页面复制 API Key

#### ElevenLabs

1. 打开 [ElevenLabs](https://elevenlabs.io/)
2. 注册并进入 Dashboard
3. 点右上角头像 → "Profile" → 复制 API Key

#### OpenAI

1. 打开 [OpenAI Platform](https://platform.openai.com/)
2. 点"API keys" → "Create new secret key"

### 4.3 在 manifest.json 里配置

打开 `exes/grandma/manifest.json`,找到 `media.tts` 部分:

```json
"media": {
  "tts": {
    "enabled": true,
    "provider": "minimax",
    "voice_id": "female-tianmei",
    "emotion_mapping": {
      "care": "gentle",
      "worry": "concerned",
      "happy": "cheerful"
    }
  }
}
```

**参数说明:**

- `enabled`: 是否启用 TTS
- `provider`: 服务商(`minimax` / `elevenlabs` / `openai`)
- `voice_id`: 声音 ID(每个服务商的 ID 不一样)
- `emotion_mapping`: 情绪到声音风格的映射

### 4.4 设置环境变量

在 `.env` 文件里加上:

```bash
# 根据你选的服务,加上对应的 API Key
MINIMAX_API_KEY=你的API密钥
# 或
ELEVENLABS_API_KEY=你的API密钥
# 或
OPENAI_API_KEY=你的API密钥
```

### 4.5 测试声音效果

```bash
python scripts/tts_service.py --relic exes/grandma --text "哎呀你这孩子,怎么又恁晚" --mode care
```

这会生成一个音频文件,听听效果如何。

**如果声音不对劲怎么办?**

- 试试换个 `voice_id`(每个服务商都有多个声音可选)
- 调整 `emotion_mapping`
- 如果是中文,确保用的是 MiniMax

### 4.6 声音克隆(可选)

如果你有奶奶的录音,可以克隆她的声音。

#### 准备声音样本

需要:

- 10-30 秒的清晰录音
- 没有背景噪音
- 最好是说话的录音,不是唱歌

#### 克隆声音

```bash
python scripts/tts_service.py --relic exes/grandma --clone-voice --sample-dir voice_samples/
```

脚本会:

1. 上传声音样本到 MiniMax
2. 等待克隆完成(通常 1-2 分钟)
3. 把新的 `voice_id` 写入 `manifest.json`

**为什么要克隆声音?** 因为预设的声音再好,也不是奶奶的声音。克隆之后,真的能听出是她。

---

## 第五步:让 Relic 主动找你说话

奶奶不会只等你来找她。过年的时候,她会主动问"吃饺子了没"。

### 5.1 配置 proactive_config.json

打开 `exes/grandma/proactive_config.json`:

```json
{
  "enabled": true,
  "user_city": "北京",
  "holidays": {
    "enabled": true,
    "list": ["spring_festival", "mid_autumn", "birthday:1998-05-20"]
  },
  "anniversaries": {
    "enabled": true,
    "dates": [
      {"date": "2023-03-15", "label": "最后一次视频通话", "type": "bittersweet"},
      {"date": "2010-01-01", "label": "第一次教我包饺子", "type": "happy"}
    ]
  },
  "weather": {
    "enabled": false
  },
  "random_miss": {
    "enabled": true,
    "min_interval_days": 14
  },
  "quiet_hours": {"start": "23:00", "end": "07:00"},
  "global_max_per_week": 2
}
```

**参数说明:**

- `holidays.list`: 哪些节日会触发主动消息
  - 内置节日:`spring_festival`(春节)、`mid_autumn`(中秋)、`new_year`(元旦)
  - 自定义生日:`birthday:1998-05-20`

- `anniversaries.dates`: 纪念日
  - `date`: 日期(格式:`YYYY-MM-DD`)
  - `label`: 这天是什么
  - `type`: 情绪类型(`happy` / `bittersweet` / `sad`)

- `random_miss`: 随机想念
  - `enabled`: 是否启用
  - `min_interval_days`: 最少间隔多少天

- `quiet_hours`: 免打扰时段
  - 在这个时间段内,Relic 不会主动发消息

- `global_max_per_week`: 每周最多主动几次
  - 防止 Relic 太烦人

### 5.2 预览"它会不会主动来找你"

```bash
python scripts/proactive_scheduler.py --relic exes/grandma --dry-run
```

这会告诉你:

- 今天会不会触发主动消息
- 如果会,是因为什么(节日?纪念日?随机想念?)
- 会说什么

**为什么要 dry-run?** 因为你可能不想让奶奶真的在凌晨三点给你发消息。先预览一下,确认配置没问题。

### 5.3 用 cron 定时运行

如果你想让 Relic 真的主动找你,需要定时运行这个脚本。

#### Linux / macOS

```bash
# 编辑 crontab
crontab -e

# 加上这一行(每天早上 9 点检查一次)
0 9 * * * cd /path/to/relic.skill && python scripts/proactive_scheduler.py --relic exes/grandma
```

#### Windows

用"任务计划程序":

1. 打开"任务计划程序"
2. 点"创建基本任务"
3. 触发器选"每天"
4. 操作选"启动程序",填上:
   - 程序:`python`
   - 参数:`scripts/proactive_scheduler.py --relic exes/grandma`
   - 起始于:`C:\path\to\relic.skill`

### 5.4 测试

```bash
# 不加 --dry-run,真的发送
python scripts/proactive_scheduler.py --relic exes/grandma
```

如果今天有触发条件,Relic 会通过飞书或 Telegram 给你发消息。

---

## 常见问题

### Q: 飞书机器人收不到消息怎么办?

**A:** 按顺序检查:

1. 飞书开放平台的"事件订阅"是否配置成功
2. `.env` 里的 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 是否正确
3. 机器人是否有 `im:message` 和 `im:message:send_as_bot` 权限
4. 终端有没有报错

### Q: Telegram 机器人一直显示"typing"但不回复?

**A:** 可能是 AI API 调用失败。检查:

1. `.env` 里的 `AI_API_KEY` 是否正确
2. 网络是否能访问 Claude / OpenAI API
3. 终端有没有报错

### Q: TTS 生成的声音不像怎么办?

**A:** 试试这些:

1. 换个 `voice_id`(每个服务商都有多个声音)
2. 如果是中文,确保用的是 MiniMax
3. 如果有录音,试试声音克隆
4. 调整 `emotion_mapping`,让情绪表达更准确

### Q: Relic 主动消息太频繁怎么办?

**A:** 调整 `proactive_config.json`:

1. 把 `global_max_per_week` 改小(比如改成 1)
2. 把 `random_miss.min_interval_days` 改大(比如改成 30)
3. 关掉一些不需要的节日

### Q: 我没有聊天记录,能不能直接手写 Relic?

**A:** 可以。参考 `examples/grandma-demo/` 里的文件,手动创建:

- `SKILL.md` — 写清楚"你是谁""怎么说话"
- `personality.md` — 写四维人格(认知/表达/行为/情感)
- `interaction.md` — 写几段示例对话
- `memory.md` — 写一些记忆片段
- `manifest.json` — 配置文件

### Q: 能不能让多个 Relic 住在同一个飞书群?

**A:** 可以。用多 Relic 模式:

```bash
python scripts/feishu_bot.py --relic-dir exes/ --multi-relic
```

然后在群里 @机器人 时,加上 Relic 名字:

```text
@机器人 奶奶,我今天加班到十一点
@机器人 咪咪,我回来了
```

### Q: 我的 Relic 说话太正式,不像真人怎么办?

**A:** 检查这些:

1. `SKILL.md` 里的"对话原则"是否写清楚了说话风格
2. `interaction.md` 里的示例对话是否够生动
3. `manifest.json` 里的 `speech_style.message_shape` 是否设置成 `split_short_messages`(拆成短消息)

### Q: 能不能让 Relic 发图片?

**A:** 可以。在 `manifest.json` 里配置 `media.image`:

```json
"media": {
  "image": {
    "enabled": true,
    "provider": "seedream",  // 或 openai / google
    "style": "soft_illustration"
  }
}
```

然后在 `.env` 里加上对应的 API Key。

---

## 下一步

配置完成后,你可以:

- 读读 [FAQ](FAQ.md),了解更多使用技巧
- 看看 [PHILOSOPHY.md](PHILOSOPHY.md),理解 Relic 的设计理念
- 加入 QQ 群(1098169092),和其他人聊聊你的 Relic

---

<p align="center">
  <em>配置过程中遇到问题?在 <a href="https://github.com/Ylsssq926/relic.skill/issues">GitHub Issues</a> 里提问,我们会帮你。</em>
</p>
