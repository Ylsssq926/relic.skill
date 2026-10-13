# Setup Guide

> 从零开始,让 Relic 真的活起来。
> *From zero to a Relic that's actually alive.*

这不是技术文档。这是一份"怎么让奶奶活过来"的实操手册。
*This is not a technical doc — it's a hands-on manual for "how to bring grandma back to life."*

**先选路径,再动手 / Pick your path first:**

| 你的场景 / Your Scenario | 推荐路径 / Recommended Path | Jump To |
|---|---|---|
| 只想本地对话,不接任何 Bot / Local chat only, no bot | 纯 Claude Code / Cursor 内使用(零配置) / Use inside your agent (zero config) | Step 1 |
| 家人在海外 / 国际网络环境 / Overseas or international network | Telegram 机器人 + ElevenLabs / OpenAI TTS | Step 3, Step 4 |
| 国内网络环境 / 飞书重度用户 / CN network or Feishu-heavy | 飞书机器人 + MiniMax / 豆包 TTS(区域增强) / Feishu bot + MiniMax/Doubao TTS (regional enhancement) | Step 2, Step 4 |
| 微信群聊记录导入 / WeChat log import | 微信解析(纯本地脚本,不依赖任何机器人) / WeChat parser (pure local script, no bot needed) | [PLATFORM-GUIDE](PLATFORM-GUIDE.md) |

---

## Environment Setup (do this first)

The core flow (awaken → chat → protect) needs **nothing but Python 3.9+** — no GPU, no Docker, no cloud account. Optional enhancements (bots, TTS, image generation) add their own requirements, declared per feature below.

```bash
# 1. Verify Python (macOS/Linux: python3; Windows: python or py)
python3 --version

# 2. Install the only hard dependencies (used by parsing/writing scripts)
pip3 install -r requirements.txt
```

**Command conventions in all docs**: commands are written as `python3` (macOS/Linux). On Windows use `python` (or `py`) instead — e.g. `python scripts\relic_writer.py --help`.

**Dependency tiers**:

| Tier | Packages | Needed For |
|---|---|---|
| Core (recommended) | `pillow`, `python-dateutil` | `relic_writer.py`, `wechat_parser.py`, `telegram_parser.py`, `qq_parser.py`, `photo_analyzer.py` |
| Bot features (optional) | `flask`, `requests` | `feishu_bot.py`, `telegram_bot.py` |
| TTS / image (optional) | `requests` | `tts_service.py`, `image_service.py` |

Scripts detect missing dependencies and tell you exactly what to install — you never need the full set up front.

---

## Step 1: Awaken Your First Relic

Before anything, you need a Relic. Like building a house — foundation first.

### Option 1: Generate with the script (recommended)

```bash
# First parse the data (WeChat example)
python3 scripts/wechat_parser.py --input ~/wechat_export/ --output data.json

# Then awaken the Relic
python3 scripts/relic_writer.py --data data.json --template human --slug grandma --name 奶奶
```

#### What the input JSON looks like

This is the **easiest step to get stuck on** — what exactly goes into the JSON `--data` points at. Full explanation below.

**Minimal viable example** (save as `data.json`):

```json
{
  "subject_name": "奶奶",
  "relationship": "奶奶",
  "summary": "会提醒你吃饭的家人 / the family member who reminds you to eat",
  "messages": [
    { "sender_name": "我",   "timestamp": 1700000000, "content": "奶奶,我今天加班到十一点" },
    { "sender_name": "奶奶", "timestamp": 1700000060, "content": "哎呀你这孩子,怎么又恁晚" },
    { "sender_name": "奶奶", "timestamp": 1700000120, "content": "吃饭了没有" }
  ],
  "facts": ["爱发语音 / loves voice messages", "打字慢 / types slowly"],
  "memories": [
    {
      "title": "包饺子 / making dumplings",
      "time": "每年春节 / every Spring Festival",
      "content": "她总会在厨房里一边包饺子一边念叨我别挑食。 / She'd make dumplings in the kitchen while nagging me not to be picky."
    }
  ]
}
```

```bash
python3 scripts/relic_writer.py --data data.json --template human --slug grandma --name 奶奶
```

**Top-level fields** (all optional except `messages`):

| Field | Type | Notes |
|---|---|---|
| `messages` | array | **The most valuable input.** Chat logs determine persona quality |
| `memories` | array | Manually organized memory fragments |
| `facts` | string array | Facts about the subject, e.g. `["loves voice messages", "types slowly"]` |
| `photos` | array | Photo metadata (time, device, GPS) for inferring life轨迹 |
| `interaction_modes` | string array | How you want it to interact with you |
| `tags` | string array | Tags |
| `dimensions` | object | Manually specify four-dimension content, e.g. `{"cognition": ["..."]}` |
| `events` / `timeline` / `notes` | array or string | Merged into `memories` |
| `source` | string | Data-source note, recorded in `manifest.json` |

**`messages[]` per-object fields**:

| Field | Required | Alias | Notes |
|---|---|---|---|
| `content` | ✅ | `text` | Message body |
| `sender_name` | recommended | `sender_id` | Who said it. **This one decides success — see below** |
| `timestamp` | optional | `datetime` / `date` | Time. Unix seconds (number) or date string both work |
| `id` | optional | — | Message ID; auto-numbered if absent |
| `chat_name` | optional | `chat_id` | Conversation name |
| `direction` | optional | — | Message direction |
| `msg_type` | optional | — | Default `text` |

**`memories[]` per-object fields**:

| Field | Required | Alias | Notes |
|---|---|---|---|
| `title` | recommended | `name` | What this memory is called |
| `content` | ✅ | `summary` / `description` | Memory body |
| `time` | optional | `date` / `datetime` | When, e.g. `"every Spring Festival"` |
| `source` | optional | — | Source, e.g. `"family recollection"` |

**`photos[]` per-object fields**:

| Field | Notes |
|---|---|
| `path` | Photo path |
| `filename` | File name (defaults from `path`) |
| `shot_timestamp` / `shot_time` / `datetime` | Capture time |
| `device` | `{"make": "Apple", "model": "iPhone 13"}` |
| `gps` | `{"lat": 39.9, "lng": 116.4}` |

#### ⚠️ One mechanism you must understand: who is the subject

The script needs to know "which side of this chat log is the person being made into a Relic." **Get this wrong and the organizer's own words get written into the other person's persona** — the most common mistake.

Resolution priority:

1. `--name` CLI argument (highest)
2. `subject_name` / `name` / `title` / `chat_name` in the JSON
3. `chat_name` of the first message
4. The most frequent **non-organizer** sender

Organizer self-markers are auto-excluded: `我`, `me`, `self`, `本人`, `自己`, `user`, `用户`, `myself`, `owner`, `整理者`, `记录者`.

**So: even if you said more than grandma, the script won't mistake "me" for grandma.** But to be safe, **always pass `--name` explicitly**:

```bash
python3 scripts/relic_writer.py --data data.json --template human --slug grandma --name 奶奶
```

#### Multiple data files at once

`--data` accepts multiple files; they merge automatically (arrays append, `meta` takes the first non-empty value):

```bash
python3 scripts/relic_writer.py --data chat.json photos.json facts.json --template human --slug grandma
```

#### Full parameters

| Parameter | Required | Notes |
|---|---|---|
| `--data` | ✅ | One or more input JSON files |
| `--template` | ✅ | See values below |
| `--slug` | ✅ | Output directory name, e.g. `grandma` |
| `--output-dir` | — | Output root, defaults to `exes` |
| `--name` | — | Manually specify the Relic name (strongly recommended) |
| `--summary` | — | Manually specify a one-line summary |
| `--relationship` | — | Manually specify the relationship note |
| `--force` | — | Allow overwriting an existing non-empty directory |

`--template` values: `human` (person), `pet`, `relationship`, `team-culture`, `place`, `moment`, `public-figure`, `expert`, `feishu-cli` (Feishu collaboration memory).

### Option 2: Create manually

If you have no data, or want to start from scratch:

```bash
mkdir -p exes/grandma
cd exes/grandma
```

Then reference the files in `examples/grandma-demo/` and hand-create the files listed above.

**When to use this?** When your subject left no digital traces (someone from long ago), or you want full control over every detail.

---

## Step 2: Move the Relic into Feishu (Regional Enhancement · Mainland China)

> International users: skip to Step 3 (Telegram).

Grandma doesn't just live in chat logs. Now she lives in your Feishu group — @ her and she's here.

### 2.1 Create an app on the Feishu Open Platform

1. Open [Feishu Open Platform](https://open.feishu.cn/app)
2. Click "Create Enterprise Custom App"
3. Give it a name, e.g. "奶奶·王秀兰"
4. After creation, note two things:
   - **App ID** (looks like: `cli_a1b2c3d4e5f6g7h8`)
   - **App Secret** (a random string)

**Why create an app?** Because a Feishu bot needs an "ID card" to send and receive messages.

### 2.2 Configure permissions

In the app management page:

1. Click "Permission Management"
2. Search and enable:
   - `im:message` — receive messages
   - `im:message:send_as_bot` — send messages
   - `im:chat` — get group info

3. Click "Version Management & Release" → "Create Version" → "Request Release"

**Why these permissions?** The bot needs to see your messages and reply to you.

### 2.3 Configure event subscription

1. In app management, click "Event Subscription"
2. Click "Add Event" → search "Receive Message" → select `im.message.receive_v1`
3. Configure the request URL:
   - If you have a public server: `https://your-domain/webhook`
   - If developing locally: expose the local port first with [ngrok](https://ngrok.com/) or [localtunnel](https://localtunnel.github.io/www/)

**Why configure this?** Feishu needs to know "when the user sends a message, who to notify."

### 2.4 Set environment variables

Create a `.env` file in the project root:

```bash
# Feishu app credentials
FEISHU_APP_ID=cli_a1b2c3d4e5f6g7h8
FEISHU_APP_SECRET=your-app-secret
FEISHU_VERIFICATION_TOKEN=visible on the "Event Subscription" page

# AI service (drives conversation)
AI_PROVIDER=claude  # or openai
AI_API_KEY=sk-ant-xxx  # your Claude or OpenAI API key
```

**Why use .env?** Because these keys must not be committed to Git; a `.env` file keeps them local only.

### 2.5 Start the bot

```bash
python3 scripts/feishu_bot.py --relic exes/grandma
```

If all goes well, you'll see:

```text
[INFO] Feishu bot started for Relic: grandma
[INFO] Listening on http://0.0.0.0:8080/webhook
```

### 2.6 Test

1. Find your bot in Feishu (search the app name in "Workplace")
2. Send a message: `奶奶,我今天加班到十一点`
3. If grandma replies, it works

**No response?**

- Check the credentials in `.env`
- Check that "Event Subscription" is configured on the Feishu Open Platform
- Look for errors in the terminal

---

## Step 3: Move the Relic into Telegram

If your family or friends are overseas, Telegram may be the better choice.

### 3.1 Create a bot with @BotFather

1. Search `@BotFather` in Telegram
2. Send `/newbot`
3. Follow the prompts to name the bot (e.g. "奶奶·王秀兰")
4. Enter a username (must end with `bot`, e.g. `grandma_wang_bot`)
5. On success, BotFather gives you a **Bot Token** (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

**Why BotFather?** All Telegram bots must be created through it — that's Telegram's rule.

### 3.2 Configure the Bot Token

Add to the `.env` file:

```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 3.3 Choose a run mode

The Telegram bot has two run modes:

#### Webhook mode (recommended, production)

Requires a public HTTPS address. Telegram pushes messages to you.

```bash
python3 scripts/telegram_bot.py --relic exes/grandma
```

**When to use?** When you have a server and want the bot online 7×24.

#### Long Polling mode (local development)

No public address needed. The bot pulls messages from Telegram.

```bash
python3 scripts/telegram_bot.py --relic exes/grandma --polling
```

**When to use?** When testing locally, or you have no public server.

### 3.4 Test

1. Search your bot's username in Telegram (e.g. `@grandma_wang_bot`)
2. Click "Start"
3. Send a message: `奶奶,我今天加班到十一点`
4. If grandma replies, it works

**No response?**

- Check the Bot Token
- In Webhook mode, check the public address is reachable
- Look for errors in the terminal

---

## Step 4: Give the Relic a Voice (TTS)

过年的时候,不只是文字消息。是奶奶真的声音,说"吃饺子了没"。
*At New Year, it's not just text messages — it's grandma's real voice saying "have you eaten dumplings yet?"*

### 4.1 Choose a TTS service

| Service | Strengths | Best For |
|---|---|---|
| **ElevenLabs** | Best English, nuanced emotion, direct international access | English Relics (recommended for international users) |
| **MiniMax** | Most natural Chinese, voice cloning, 10-second samples | Chinese Relics (requires a CN-region account) |
| **OpenAI TTS** | Cheap, decent quality | Budget-constrained |

**Why MiniMax for Chinese Relics?** Its grasp of Chinese emotion is the best — when grandma says "哎呀你这孩子", you can really hear the heartache. For English Relics or international networks, prefer ElevenLabs.

### 4.2 Get an API key

#### ElevenLabs

1. Open [ElevenLabs](https://elevenlabs.io/)
2. Sign up and enter the Dashboard
3. Click the avatar top-right → "Profile" → copy the API key

#### MiniMax

1. Open the [MiniMax open platform](https://www.minimaxi.com/)
2. Sign up and create an app
3. Copy the API key from the "API Keys" page

#### OpenAI

1. Open [OpenAI Platform](https://platform.openai.com/)
2. Click "API keys" → "Create new secret key"

### 4.3 Configure in manifest.json

Open `exes/grandma/manifest.json`, find the `media.tts` section:

```json
"media": {
  "tts": {
    "enabled": true,
    "provider": "elevenlabs",
    "voice_id": "your-voice-id",
    "emotion_mapping": {
      "care": "gentle",
      "worry": "concerned",
      "happy": "cheerful"
    }
  }
}
```

**Parameters:**

- `enabled`: whether TTS is on
- `provider`: service (`elevenlabs` / `minimax` / `openai`)
- `voice_id`: voice ID (different per service)
- `emotion_mapping`: emotion → voice-style mapping

### 4.4 Set environment variables

Add to the `.env` file:

```bash
# Add the API key for the service you chose
ELEVENLABS_API_KEY=your-api-key
# or
MINIMAX_API_KEY=your-api-key
# or
OPENAI_API_KEY=your-api-key
```

### 4.5 Test the voice

```bash
python3 scripts/tts_service.py --relic exes/grandma --text "哎呀你这孩子,怎么又恁晚" --mode care
```

This generates an audio file — listen and judge.

**Voice not right?**

- Try a different `voice_id` (each service has several voices)
- Adjust `emotion_mapping`
- For Chinese, make sure you're using MiniMax

### 4.6 Voice cloning (optional)

If you have grandma's recordings, you can clone her voice.

#### Prepare voice samples

Needed:

- 10–30 seconds of clear recording
- No background noise
- Speech, not singing

#### Clone the voice

```bash
python3 scripts/tts_service.py --relic exes/grandma --clone-voice --sample-dir voice_samples/
```

The script will:

1. Upload the samples to the provider
2. Wait for cloning to finish (usually 1–2 minutes)
3. Write the new `voice_id` into `manifest.json`

**Why clone?** Preset voices are good, but they're not grandma's. After cloning, you can really hear it's her.

---

## Step 5: Let the Relic Reach Out First

奶奶不会只等你来找她。过年的时候,她会主动问"吃饺子了没"。
*Grandma doesn't just wait for you. At New Year, she asks "have you eaten dumplings yet?" first.*

### 5.1 Configure proactive_config.json

Open `exes/grandma/proactive_config.json`:

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

**Parameters:**

- `holidays.list`: which festivals trigger proactive messages
  - Built-in: `spring_festival` (春节), `mid_autumn` (中秋), `new_year` (元旦)
  - Custom birthday: `birthday:1998-05-20`

- `anniversaries.dates`: anniversaries
  - `date`: date (format: `YYYY-MM-DD`)
  - `label`: what this day is
  - `type`: emotion type (`happy` / `bittersweet` / `sad`)

- `random_miss`: random missing-you
  - `enabled`: on/off
  - `min_interval_days`: minimum interval in days

- `quiet_hours`: do-not-disturb window
  - The Relic sends no proactive messages during this window

- `global_max_per_week`: max proactive sends per week
  - Keeps the Relic from becoming annoying

### 5.2 Preview "will it reach out today?"

```bash
python3 scripts/proactive_scheduler.py --relic exes/grandma --dry-run
```

This tells you:

- Whether today triggers a proactive message
- If so, why (festival? anniversary? random miss?)
- What it will say

**Why dry-run?** Because you may not want grandma really messaging you at 3 a.m. Preview first, confirm the config.

### 5.3 Run on a schedule

If you want the Relic to actually reach out, run the script on a timer.

#### Linux / macOS

```bash
# Edit crontab
crontab -e

# Add this line (check once every day at 9 a.m.)
0 9 * * * cd /path/to/relic.skill && python3 scripts/proactive_scheduler.py --relic exes/grandma
```

#### Windows

Use Task Scheduler:

1. Open "Task Scheduler"
2. Click "Create Basic Task"
3. Trigger: "Daily"
4. Action: "Start a program", fill in:
   - Program: `python`
   - Arguments: `scripts/proactive_scheduler.py --relic exes/grandma`
   - Start in: `C:\path\to\relic.skill`

### 5.4 Test

```bash
# Without --dry-run: really sends
python3 scripts/proactive_scheduler.py --relic exes/grandma
```

If today has trigger conditions, the Relic messages you via the configured channel.

---

## FAQ

### Q: The Feishu bot isn't receiving messages. What do I do?

**A:** Check in order:

1. Is "Event Subscription" configured on the Feishu Open Platform
2. Are `FEISHU_APP_ID` and `FEISHU_APP_SECRET` in `.env` correct
3. Does the bot have `im:message` and `im:message:send_as_bot` permissions
4. Any errors in the terminal

### Q: The Telegram bot shows "typing" but never replies?

**A:** Probably an AI API call failure. Check:

1. Is `AI_API_KEY` in `.env` correct
2. Can the network reach the Claude / OpenAI API
3. Any errors in the terminal

### Q: The TTS voice doesn't sound right?

**A:** Try:

1. A different `voice_id` (each service has several voices)
2. For Chinese, make sure you're using MiniMax
3. If you have recordings, try voice cloning
4. Adjust `emotion_mapping` for more accurate emotion

### Q: The Relic's proactive messages are too frequent?

**A:** Adjust `proactive_config.json`:

1. Lower `global_max_per_week` (e.g. to 1)
2. Raise `random_miss.min_interval_days` (e.g. to 30)
3. Turn off festivals you don't need

### Q: I have no chat logs — can I hand-write a Relic?

**A:** Yes. Reference the files in `examples/grandma-demo/` and hand-create:

- `SKILL.md` — clearly write "who you are" and "how you talk"
- `personality.md` — write the four dimensions (cognition / expression / behavior / emotion)
- `interaction.md` — write a few example dialogues
- `memory.md` — write some memory fragments
- `manifest.json` — the config file

### Q: Can multiple Relics live in one Feishu group?

**A:** Yes. Use multi-Relic mode:

```bash
python3 scripts/feishu_bot.py --relic-dir exes/ --multi-relic
```

Then when you @ the bot in the group, add the Relic name:

```text
@bot 奶奶,我今天加班到十一点
@bot 咪咪,我回来了
```

### Q: My Relic talks too formally, not like a real person?

**A:** Check:

1. Are the "dialogue principles" in `SKILL.md` clear about speech style
2. Are the example dialogues in `interaction.md` vivid enough
3. Is `speech_style.message_shape` in `manifest.json` set to `split_short_messages`

### Q: Can the Relic send images?

**A:** Yes. Configure `media.image` in `manifest.json`:

```json
"media": {
  "image": {
    "enabled": true,
    "provider": "openai",  // or google / seedream
    "style": "soft_illustration"
  }
}
```

Then add the corresponding API key to `.env`.

---

## Next Steps

Once configured, you can:

- Read the [FAQ](FAQ.md) for more usage tips
- Read [PHILOSOPHY.md](PHILOSOPHY.md) to understand Relic's design philosophy
- Ask questions in [GitHub Issues](https://github.com/Ylsssq926/relic.skill/issues) — we'll help

---

<p align="center">
  <em>配置过程中遇到问题?在 <a href="https://github.com/Ylsssq926/relic.skill/issues">GitHub Issues</a> 里提问,我们会帮你。</em>
</p>
