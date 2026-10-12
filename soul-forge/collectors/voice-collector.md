# Voice Collector

> “声音是会冒热气的证据，咳一声、笑一下、停半拍，纸面上都写不出同样的温度。”
> *Voice is steaming-hot evidence — a cough, a laugh, a half-beat pause; paper can't write down that same warmth.*

## Supported Formats

| Source Type | Supported Forms | Common Files | Notes |
|---|---|---|---|
| Recordings | phone recordings, meeting recordings, interview recordings | `.mp3` `.wav` `.m4a` `.aac` | suited to long-span tone and rhythm analysis |
| Voice messages | WeChat, QQ, Telegram, iMessage voice | platform export files or transcoded files | captures catchphrases, pauses, and emotional shifts |
| Podcasts | solo shows, interview shows, livestream audio replays | `.mp3` `.wav` | suited to public expression style and long-form narration |
| Video audio extraction | audio tracks inside videos | audio extracted from `.mp4` `.mov` | keep the video source note |

Additional support:

- Multi-speaker audio — but distinguish the main speaker as much as possible.
- Recordings with ambient noise — mark noise level and whether it affects transcription.
- Short clips and long interviews may be collected together, but labeled separately in results.

## Collection Flow

1. **Register the source**
   - Record filename, recording time, recording scene, whether edited.
   - Distinguish private voice, public content, and forwarded content.

2. **Transcribe to text**
   - Convert voice to segmented text with timestamps.
   - Record key fillers, laughter, sighs, pauses, tearful tones, and drawn-out vowels alongside.

3. **Speaker identification**
   - Single-speaker audio: mark directly as the target subject.
   - Multi-speaker audio: do speaker diarization — at minimum "target / others / unconfirmed."

4. **Extract voice features**
   - Record pace, volume shifts, intonation contours, repeated words, hesitation markers.
   - Write "what was said" and "how it was said" separately, for easy entry into expression and emotion dimensions.

5. **Slice and archive**
   - Slice by topic, emotional swings, key events.
   - Long audio must not get only a global summary — keep several key fragments at minimum.

6. **Output structured results**
   - Produce traceable transcript fragments, acoustic descriptions, quality notes, and privacy records.
   - Ready to hand to the four-dimension extraction module.

## Cleaning Rules

- Correct automatic transcription errors — but don't rewrite colloquial speech into written boilerplate.
- Fillers like "嗯、啊、诶、就是、那个" (um, uh, er, like, that) stay if they form part of the expression style.
- Meaningless long silences and device-friction noise may be compressed in description; no need to expand second by second.
- Laughter, sighs, sniffs, and deep breaths convert to brief labels.
- Unconfirmed words are marked "uncertain" — don't force a guess.
- Edited audio must mark splice traces — avoid misreading states from different times as continuous expression.
- Background music, TV sound, and others' interjections, if they affect judgment, must be noted in quality notes.

## Privacy Protection

- Before collecting, confirm whether the audio contains third-party identifiable info.
- Sanitize or omit unrelated third-party names, phone numbers, addresses, company details.
- Voiceprints are not written into the profile as identity credentials — only audible expression traits are described.
- For high-sensitivity scenes (children, medical, finances, family conflict), narrow the quote range first.
- If audio is for one-time awakening only, raw transcription caches may be deleted after output.

## Output Format

```yaml
collector: voice
source_type:
  - 录音 / recordings
  - 语音消息 / voice messages
metadata:
  target: 目标对象名称 / target subject name
  recorded_at: 录制时间或时间范围 / recording time or range
  setting: 录音场景说明 / recording scene
  edited: 是否经过剪辑 / whether edited
segments:
  - start: 00:00:12
    end: 00:00:26
    speaker: 目标对象 | 其他人 | 无法确认 / target | others | unconfirmed
    transcript: 逐段转写文本 / segmented transcript
    vocal_features:
      speed: 偏慢 | 适中 | 偏快 / slow | moderate | fast
      volume: 轻 | 中 | 高 / soft | medium | loud
      tone: 平稳 | 上扬 | 下沉 | 发紧 | 带笑 / steady | rising | falling | tight | laughing
      notable_signals:
        - 停顿 / pause
        - 叹气 / sigh
        - 笑声 / laughter
    context: 该片段出现的主题与上下文 / topic and context of the fragment
    privacy:
      redactions:
        - 已隐藏的敏感信息说明 / redacted-info notes
quality_notes:
  - 噪音、串音、转写不确定度说明 / noise, crosstalk, transcription uncertainty
handoff:
  likely_dimensions:
    - expression
    - emotion
```
