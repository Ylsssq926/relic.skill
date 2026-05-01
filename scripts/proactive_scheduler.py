"""relic.skill 主动行为调度器。

这个脚本读取指定 Relic 目录中的 `manifest.json` / `personality.md`，
结合主动行为配置与本地 state 文件，判断当前时刻是否应该触发一条
Relic 主动消息；如果命中触发条件，则基于人格特征生成一条符合该
Relic 风格的消息模板，并以 JSON 输出。

功能范围：
- 节日问候（内置中国主要节日与生日判断）
- 纪念日提醒（按年重复触发）
- 天气接口预留（当前版本不实际调用外部 API）
- 随机想念（按最小间隔控制）
- 安静时段与每周上限控制
- 基于 `.proactive_state.json` 的冷却与发送记录

用法示例：
    python scripts/proactive_scheduler.py --relic examples/grandma-demo --config examples/grandma-demo/proactive_config.json
    python scripts/proactive_scheduler.py --relic examples/grandma-demo --dry-run
    python scripts/proactive_scheduler.py --relic examples/grandma-demo --type holiday
    python scripts/proactive_scheduler.py --relic examples/grandma-demo --execute

输出说明：
- 始终输出 JSON。
- 命中触发时，默认输出：`type / trigger / message / timestamp / tts`。
- `tts` 字段默认补充语音相关元数据；加上 `--execute` 后会额外写入 `audio_path` / `error`。
- `--dry-run` 时仅预览是否应触发以及会发送什么消息，不更新 state。

注意：
- 默认仅依赖 Python 标准库；当使用 `--execute` 并触发 TTS 时，会复用 `scripts/tts_service.py` 的依赖与配置。
- 天气能力当前仅保留接口；若启用但缺少 API key，会输出提示信息。
- 农历节日通过内置农历换算逻辑支持 1900-2099 年。
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence


STATE_FILENAME = ".proactive_state.json"
DEFAULT_CONFIG_FILENAME = "proactive_config.json"
MAX_STATE_HISTORY = 50

HOLIDAY_TYPE = "holiday"
ANNIVERSARY_TYPE = "anniversary"
WEATHER_TYPE = "weather"
RANDOM_TYPE = "random"

SUPPORTED_TYPES = (HOLIDAY_TYPE, ANNIVERSARY_TYPE, WEATHER_TYPE, RANDOM_TYPE)

FIXED_SOLAR_HOLIDAYS: Dict[str, tuple[int, int, str]] = {
    "new_year": (1, 1, "元旦"),
    "national_day": (10, 1, "国庆"),
}

LUNAR_HOLIDAYS: Dict[str, tuple[int, int, str]] = {
    "spring_festival": (1, 1, "春节"),
    "lantern_festival": (1, 15, "元宵节"),
    "dragon_boat": (5, 5, "端午节"),
    "mid_autumn": (8, 15, "中秋节"),
}

HOLIDAY_ALIASES: Dict[str, str] = {
    "spring_festival": "spring_festival",
    "chinese_new_year": "spring_festival",
    "春节": "spring_festival",
    "lantern_festival": "lantern_festival",
    "yuanxiao": "lantern_festival",
    "元宵": "lantern_festival",
    "元宵节": "lantern_festival",
    "qingming": "qingming",
    "清明": "qingming",
    "清明节": "qingming",
    "dragon_boat": "dragon_boat",
    "duanwu": "dragon_boat",
    "端午": "dragon_boat",
    "端午节": "dragon_boat",
    "mid_autumn": "mid_autumn",
    "moon_festival": "mid_autumn",
    "中秋": "mid_autumn",
    "中秋节": "mid_autumn",
    "national_day": "national_day",
    "国庆": "national_day",
    "国庆节": "national_day",
    "new_year": "new_year",
    "元旦": "new_year",
}

TOPIC_KEYWORDS: Dict[str, Sequence[str]] = {
    "吃饭": ("吃饭", "饭", "热乎", "饺子", "汤圆", "元宵", "粽子", "水果", "好好吃"),
    "睡觉": ("睡", "休息", "早点睡", "熬夜", "睡觉"),
    "穿衣": ("穿衣", "外套", "加衣", "秋裤", "降温", "冷", "保暖"),
    "身体": ("身体", "平安", "保重", "生病", "药", "医院", "难受"),
    "回家": ("回家", "到家", "路上", "出门", "回来"),
    "工作": ("工作", "上班", "加班", "项目", "开会", "KPI", "忙"),
    "情绪": ("难过", "想起", "抱抱", "慢慢来", "别怕", "心里", "惦记"),
}

ELDER_RELATIONS = ("奶奶", "爷爷", "姥姥", "姥爷", "外婆", "外公")
PARENT_RELATIONS = ("妈妈", "母亲", "爸爸", "父亲")
PARTNER_RELATIONS = ("老婆", "老公", "伴侣", "爱人", "前任", "女朋友", "男朋友")
FRIEND_RELATIONS = ("朋友", "闺蜜", "兄弟", "同学")
TEAM_HINTS = ("团队", "同事", "老板", "产品经理", "组长", "leader")

# 来自 Python lunardate 项目常用农历年编码，覆盖 1900-2099。
# 这里直接内置数据，避免第三方依赖。
LUNAR_YEAR_INFOS: List[int] = [
    0x04BD8,
    0x04AE0, 0x0A570, 0x054D5, 0x0D260, 0x0D950,
    0x16554, 0x056A0, 0x09AD0, 0x055D2, 0x04AE0,
    0x0A5B6, 0x0A4D0, 0x0D250, 0x1D255, 0x0B540,
    0x0D6A0, 0x0ADA2, 0x095B0, 0x14977, 0x04970,
    0x0A4B0, 0x0B4B5, 0x06A50, 0x06D40, 0x1AB54,
    0x02B60, 0x09570, 0x052F2, 0x04970, 0x06566,
    0x0D4A0, 0x0EA50, 0x06E95, 0x05AD0, 0x02B60,
    0x186E3, 0x092E0, 0x1C8D7, 0x0C950, 0x0D4A0,
    0x1D8A6, 0x0B550, 0x056A0, 0x1A5B4, 0x025D0,
    0x092D0, 0x0D2B2, 0x0A950, 0x0B557, 0x06CA0,
    0x0B550, 0x15355, 0x04DA0, 0x0A5D0, 0x14573,
    0x052B0, 0x0A9A8, 0x0E950, 0x06AA0, 0x0AEA6,
    0x0AB50, 0x04B60, 0x0AAE4, 0x0A570, 0x05260,
    0x0F263, 0x0D950, 0x05B57, 0x056A0, 0x096D0,
    0x04DD5, 0x04AD0, 0x0A4D0, 0x0D4D4, 0x0D250,
    0x0D558, 0x0B540, 0x0B5A0, 0x195A6, 0x095B0,
    0x049B0, 0x0A974, 0x0A4B0, 0x0B27A, 0x06A50,
    0x06D40, 0x0AF46, 0x0AB60, 0x09570, 0x04AF5,
    0x04970, 0x064B0, 0x074A3, 0x0EA50, 0x06B58,
    0x05AC0, 0x0AB60, 0x096D5, 0x092E0, 0x0C960,
    0x0D954, 0x0D4A0, 0x0DA50, 0x07552, 0x056A0,
    0x0ABB7, 0x025D0, 0x092D0, 0x0CAB5, 0x0A950,
    0x0B4A0, 0x0BAA4, 0x0AD50, 0x055D9, 0x04BA0,
    0x0A5B0, 0x15176, 0x052B0, 0x0A930, 0x07954,
    0x06AA0, 0x0AD50, 0x05B52, 0x04B60, 0x0A6E6,
    0x0A4E0, 0x0D260, 0x0EA65, 0x0D530, 0x05AA0,
    0x076A3, 0x096D0, 0x04AFB, 0x04AD0, 0x0A4D0,
    0x1D0B6, 0x0D250, 0x0D520, 0x0DD45, 0x0B5A0,
    0x056D0, 0x055B2, 0x049B0, 0x0A577, 0x0A4B0,
    0x0AA50, 0x1B255, 0x06D20, 0x0ADA0, 0x14B63,
    0x09370, 0x049F8, 0x04970, 0x064B0, 0x168A6,
    0x0EA50, 0x06AA0, 0x1A6C4, 0x0AAE0, 0x092E0,
    0x0D2E3, 0x0C960, 0x0D557, 0x0D4A0, 0x0DA50,
    0x05D55, 0x056A0, 0x0A6D0, 0x055D4, 0x052D0,
    0x0A9B8, 0x0A950, 0x0B4A0, 0x0B6A6, 0x0AD50,
    0x055A0, 0x0ABA4, 0x0A5B0, 0x052B0, 0x0B273,
    0x06930, 0x07337, 0x06AA0, 0x0AD50, 0x14B55,
    0x04B60, 0x0A570, 0x054E4, 0x0D160, 0x0E968,
    0x0D520, 0x0DAA0, 0x16AA6, 0x056D0, 0x04AE0,
    0x0A9D4, 0x0A2D0, 0x0D150, 0x0F252,
]

LUNAR_BASE_DATE = date(1900, 1, 31)


class ConfigError(ValueError):
    """配置格式错误。"""


@dataclass
class TriggerCheckResult:
    """单类触发器检查结果。"""

    matched: bool
    trigger_type: str
    trigger: Optional[str] = None
    label: Optional[str] = None
    reason: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)


@dataclass
class PersonalityProfile:
    """从 Relic 文件中抽取出的简化人格画像。"""

    display_name: str
    relation: str
    relic_type: str
    relation_kind: str
    memorial: bool
    voice_prefix: str
    quote: str
    traits: List[str]
    catchphrases: List[str]
    care_topics: List[str]
    concise: bool
    gentle: bool
    teasing: bool
    nostalgic: bool
    seed: str


@dataclass
class Decision:
    """最终调度结果。"""

    should_trigger: bool
    timestamp: str
    trigger_type: Optional[str] = None
    trigger: Optional[str] = None
    message: Optional[str] = None
    reason: Optional[str] = None
    warnings: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)

    def to_payload(self, dry_run: bool) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "should_trigger": self.should_trigger,
            "type": self.trigger_type,
            "trigger": self.trigger,
            "message": self.message,
            "timestamp": self.timestamp,
            "dry_run": dry_run,
        }
        if self.reason:
            payload["reason"] = self.reason
        if self.warnings:
            payload["warnings"] = self.warnings
        if self.details:
            payload["details"] = self.details
        return payload


def resolve_tts_emotion(decision: Decision, emotion_mapping: Dict[str, Any]) -> Optional[str]:
    """根据调度结果解析 TTS 情绪。"""
    candidates: List[str] = []
    trigger_type = str(decision.trigger_type or "").strip().lower()
    if trigger_type == HOLIDAY_TYPE:
        holiday_id = str(decision.details.get("holiday_id") or "").strip().lower()
        if holiday_id:
            candidates.append(holiday_id)
    if trigger_type == ANNIVERSARY_TYPE:
        anniversary_type = str(decision.details.get("anniversary_type") or "").strip().lower()
        if anniversary_type:
            candidates.append(anniversary_type)
    if trigger_type:
        candidates.append(trigger_type)
    if trigger_type == RANDOM_TYPE:
        candidates.append("daily")
    candidates.append("default")

    for key in candidates:
        value = emotion_mapping.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    defaults = {
        HOLIDAY_TYPE: "happy",
        ANNIVERSARY_TYPE: "gentle",
        WEATHER_TYPE: "calm",
        RANDOM_TYPE: "calm",
    }
    return defaults.get(trigger_type)


def build_tts_payload(manifest: Dict[str, Any], decision: Decision) -> Dict[str, Any]:
    """根据 manifest + 调度结果生成 TTS 输出字段。"""
    media_config = manifest.get("media") if isinstance(manifest.get("media"), dict) else {}
    raw_tts = media_config.get("tts")
    if raw_tts is None:
        raw_tts = manifest.get("tts_config")
    raw_tts = raw_tts if isinstance(raw_tts, dict) else {}

    provider = str(raw_tts.get("provider") or "").strip().lower() or None
    raw_mapping = raw_tts.get("emotion_mapping") if isinstance(raw_tts.get("emotion_mapping"), dict) else {}
    emotion_mapping = {str(key).strip().lower(): value for key, value in raw_mapping.items()}

    enabled_value = raw_tts.get("enabled")
    config_enabled = enabled_value if isinstance(enabled_value, bool) else True
    enabled = bool(config_enabled and provider and decision.should_trigger and decision.message)
    emotion = resolve_tts_emotion(decision, emotion_mapping) if decision.should_trigger and decision.message else None
    return {
        "enabled": enabled,
        "text": decision.message if decision.should_trigger else None,
        "emotion": emotion,
        "provider": provider,
    }


def resolve_image_scene_hint(decision: Decision) -> Optional[str]:
    """根据调度结果解析主动图片场景提示。"""
    explicit_scene_hint = str(decision.details.get("scene_hint") or "").strip()
    if explicit_scene_hint:
        return explicit_scene_hint

    trigger_type = str(decision.trigger_type or "").strip().lower()
    if trigger_type in {HOLIDAY_TYPE, ANNIVERSARY_TYPE}:
        label = str(decision.details.get("label") or "").strip()
        if label:
            return label
    return None


def build_image_payload(manifest: Dict[str, Any], decision: Decision) -> Dict[str, Any]:
    """根据 manifest + 调度结果生成图片输出字段。"""
    media_config = manifest.get("media") if isinstance(manifest.get("media"), dict) else {}
    raw_image = media_config.get("image")
    if raw_image is None:
        raw_image = manifest.get("image_config")
    raw_image = raw_image if isinstance(raw_image, dict) else {}

    provider = str(raw_image.get("provider") or "").strip().lower() or None
    enabled_value = raw_image.get("enabled")
    config_enabled = enabled_value if isinstance(enabled_value, bool) else True
    scene_hint = resolve_image_scene_hint(decision)

    prompt = ""
    image_type = "cover"
    for candidate_type, value in (
        ("cover", raw_image.get("cover_prompt")),
        ("cover", raw_image.get("prompt")),
        ("cover", raw_image.get("image_prompt")),
        ("avatar", raw_image.get("avatar_prompt")),
    ):
        candidate_prompt = str(value or "").strip()
        if candidate_prompt:
            image_type = candidate_type
            prompt = candidate_prompt
            break

    enabled = bool(config_enabled and provider and decision.should_trigger and decision.message and prompt)
    return {
        "enabled": enabled,
        "provider": provider,
        "type": image_type,
        "prompt": prompt or None,
        "image_prompt": prompt or None,
        "scene_hint": scene_hint,
    }


def maybe_execute_tts(relic_dir: Path, payload: Dict[str, Any], *, dry_run: bool = False) -> Dict[str, Any]:
    """当 payload 中声明启用 TTS 时，实际调用 tts_service 生成音频路径。"""
    tts_payload = payload.get("tts")
    if not isinstance(tts_payload, dict) or not tts_payload.get("enabled"):
        return payload

    text = str(tts_payload.get("text") or payload.get("message") or "").strip()
    if not text:
        tts_payload["error"] = "missing_tts_text"
        return payload

    try:
        try:  # pragma: no cover - 兼容包导入 / 脚本直跑
            from scripts.tts_service import TTSService
        except ImportError:  # pragma: no cover - direct script execution
            from tts_service import TTSService  # type: ignore[no-redef]

        tts = TTSService.from_relic(str(relic_dir))
        if tts is None:
            raise RuntimeError("manifest 未配置可用的 TTS 服务")
        tts.dry_run = bool(dry_run)
        emotion = str(tts_payload.get("emotion") or "").strip() or None
        audio_path = tts.synthesize(text=text, emotion=emotion)
        tts_payload["audio_path"] = audio_path
    except Exception as exc:  # pragma: no cover - 外部依赖与网络调用
        tts_payload["error"] = str(exc)
    return payload


def configure_utf8_stdout() -> None:
    """确保 Windows 下 stdout / stderr 以 UTF-8 输出。"""
    for name in ("stdout", "stderr"):
        stream = getattr(sys, name)
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
            continue
        except (AttributeError, ValueError):
            pass
        if hasattr(stream, "buffer"):
            setattr(sys, name, io.TextIOWrapper(stream.buffer, encoding="utf-8", errors="replace"))


def now_timestamp() -> str:
    """返回当前本地带时区 ISO 时间。"""
    return datetime.now().astimezone().replace(microsecond=0).isoformat()


def read_json_file(path: Path) -> Any:
    """读取 UTF-8 JSON 文件。"""
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json_file(path: Path, payload: Any) -> None:
    """以 UTF-8 JSON 写入文件。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def ensure_mapping(value: Any, field_name: str) -> Dict[str, Any]:
    """确保配置项是 object。"""
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise ConfigError(f"配置项 {field_name} 必须是 JSON object")
    return value


def ensure_string(value: Any, field_name: str, *, allow_empty: bool = True) -> str:
    """确保值为字符串。"""
    if not isinstance(value, str):
        raise ConfigError(f"配置项 {field_name} 必须是字符串")
    stripped = value.strip()
    if not allow_empty and not stripped:
        raise ConfigError(f"配置项 {field_name} 不能为空")
    return stripped


def ensure_optional_string(value: Any, field_name: str) -> str:
    """可选字符串。"""
    if value is None:
        return ""
    return ensure_string(value, field_name)


def ensure_bool(value: Any, field_name: str, default: bool = False) -> bool:
    """确保布尔值；缺省时返回默认值。"""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    raise ConfigError(f"配置项 {field_name} 必须是布尔值")


def ensure_int(value: Any, field_name: str, default: int, minimum: Optional[int] = None) -> int:
    """确保整数配置合法。"""
    if value is None:
        number = default
    elif isinstance(value, bool) or not isinstance(value, int):
        raise ConfigError(f"配置项 {field_name} 必须是整数")
    else:
        number = value
    if minimum is not None and number < minimum:
        raise ConfigError(f"配置项 {field_name} 必须大于等于 {minimum}")
    return number


def ensure_string_list(value: Any, field_name: str) -> List[str]:
    """确保字符串列表。"""
    if value is None:
        return []
    if not isinstance(value, list):
        raise ConfigError(f"配置项 {field_name} 必须是数组")
    results: List[str] = []
    for index, item in enumerate(value):
        results.append(ensure_string(item, f"{field_name}[{index}]", allow_empty=False))
    return results


def parse_iso_date(value: str, field_name: str) -> date:
    """解析 YYYY-MM-DD 日期。"""
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ConfigError(f"配置项 {field_name} 必须是 YYYY-MM-DD 格式") from exc


def parse_hhmm(value: str, field_name: str) -> time:
    """解析 HH:MM 时间。"""
    if not re.fullmatch(r"\d{2}:\d{2}", value):
        raise ConfigError(f"配置项 {field_name} 必须是 HH:MM 格式")
    hour, minute = value.split(":", 1)
    try:
        return time(hour=int(hour), minute=int(minute))
    except ValueError as exc:
        raise ConfigError(f"配置项 {field_name} 时间无效：{value}") from exc


def normalize_anniversaries(value: Any) -> List[Dict[str, Any]]:
    """标准化纪念日配置。"""
    if value is None:
        return []
    if not isinstance(value, list):
        raise ConfigError("配置项 anniversaries.dates 必须是数组")
    normalized: List[Dict[str, Any]] = []
    for index, item in enumerate(value):
        field_prefix = f"anniversaries.dates[{index}]"
        mapping = ensure_mapping(item, field_prefix)
        item_date = parse_iso_date(ensure_string(mapping.get("date"), f"{field_prefix}.date", allow_empty=False), f"{field_prefix}.date")
        label = ensure_string(mapping.get("label"), f"{field_prefix}.label", allow_empty=False)
        item_type = ensure_optional_string(mapping.get("type"), f"{field_prefix}.type") or "neutral"
        normalized.append(
            {
                "date": item_date,
                "label": label,
                "type": item_type,
            }
        )
    return normalized


def normalize_config(raw: Any) -> Dict[str, Any]:
    """读取并规范主动行为配置。"""
    root = ensure_mapping(raw, "root")

    holidays_raw = ensure_mapping(root.get("holidays"), "holidays")
    anniversaries_raw = ensure_mapping(root.get("anniversaries"), "anniversaries")
    weather_raw = ensure_mapping(root.get("weather"), "weather")
    random_raw = ensure_mapping(root.get("random_miss"), "random_miss")
    quiet_raw = ensure_mapping(root.get("quiet_hours"), "quiet_hours")

    quiet_start = ensure_optional_string(quiet_raw.get("start"), "quiet_hours.start") or "23:00"
    quiet_end = ensure_optional_string(quiet_raw.get("end"), "quiet_hours.end") or "07:00"
    parse_hhmm(quiet_start, "quiet_hours.start")
    parse_hhmm(quiet_end, "quiet_hours.end")

    config = {
        "enabled": ensure_bool(root.get("enabled"), "enabled", default=True),
        "user_city": ensure_optional_string(root.get("user_city"), "user_city"),
        "holidays": {
            "enabled": ensure_bool(holidays_raw.get("enabled"), "holidays.enabled", default=False),
            "list": ensure_string_list(holidays_raw.get("list"), "holidays.list"),
        },
        "anniversaries": {
            "enabled": ensure_bool(anniversaries_raw.get("enabled"), "anniversaries.enabled", default=False),
            "dates": normalize_anniversaries(anniversaries_raw.get("dates")),
        },
        "weather": {
            "enabled": ensure_bool(weather_raw.get("enabled"), "weather.enabled", default=False),
            "api_key": ensure_optional_string(weather_raw.get("api_key"), "weather.api_key"),
            "provider": ensure_optional_string(weather_raw.get("provider"), "weather.provider"),
        },
        "random_miss": {
            "enabled": ensure_bool(random_raw.get("enabled"), "random_miss.enabled", default=False),
            "min_interval_days": ensure_int(random_raw.get("min_interval_days"), "random_miss.min_interval_days", default=14, minimum=1),
        },
        "quiet_hours": {
            "start": quiet_start,
            "end": quiet_end,
        },
        "global_max_per_week": ensure_int(root.get("global_max_per_week"), "global_max_per_week", default=2, minimum=1),
    }
    return config


def load_state(state_path: Path) -> Dict[str, Any]:
    """读取并规范 state。"""
    if not state_path.exists():
        return {"last_messages": [], "consecutive_no_reply": 0}

    raw = read_json_file(state_path)
    mapping = raw if isinstance(raw, dict) else {}
    raw_messages = mapping.get("last_messages") if isinstance(mapping.get("last_messages"), list) else []
    messages: List[Dict[str, Any]] = []

    for item in raw_messages:
        if not isinstance(item, dict):
            continue
        timestamp = item.get("timestamp")
        if not isinstance(timestamp, str) or not timestamp.strip():
            continue
        messages.append(
            {
                "timestamp": timestamp,
                "type": item.get("type") if isinstance(item.get("type"), str) else None,
                "trigger": item.get("trigger") if isinstance(item.get("trigger"), str) else None,
                "message": item.get("message") if isinstance(item.get("message"), str) else None,
            }
        )

    consecutive = mapping.get("consecutive_no_reply", 0)
    if isinstance(consecutive, bool) or not isinstance(consecutive, int):
        consecutive = 0

    return {
        "last_messages": messages[-MAX_STATE_HISTORY:],
        "consecutive_no_reply": max(0, consecutive),
    }


def save_state(state_path: Path, state: Dict[str, Any]) -> None:
    """保存 state。"""
    payload = {
        "last_messages": list(state.get("last_messages", []))[-MAX_STATE_HISTORY:],
        "consecutive_no_reply": int(state.get("consecutive_no_reply", 0)),
    }
    write_json_file(state_path, payload)


def parse_state_timestamp(value: str) -> Optional[datetime]:
    """把 state 中的 ISO 时间解析为本地 naive datetime。"""
    text = value.strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        return parsed.astimezone().replace(tzinfo=None)
    return parsed


def week_start_for(now_local: datetime) -> datetime:
    """获取当前周一 00:00 的本地时间。"""
    return (now_local - timedelta(days=now_local.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)


def count_messages_this_week(state: Dict[str, Any], now_local: datetime) -> int:
    """统计本周已发送的主动消息数量。"""
    start = week_start_for(now_local)
    total = 0
    for item in state.get("last_messages", []):
        timestamp = item.get("timestamp")
        if not isinstance(timestamp, str):
            continue
        parsed = parse_state_timestamp(timestamp)
        if parsed and parsed >= start:
            total += 1
    return total


def get_latest_message_time(state: Dict[str, Any], message_type: Optional[str] = None) -> Optional[datetime]:
    """获取最近一条消息时间，可按类型过滤。"""
    latest: Optional[datetime] = None
    for item in state.get("last_messages", []):
        if message_type and item.get("type") != message_type:
            continue
        timestamp = item.get("timestamp")
        if not isinstance(timestamp, str):
            continue
        parsed = parse_state_timestamp(timestamp)
        if parsed is None:
            continue
        if latest is None or parsed > latest:
            latest = parsed
    return latest


def already_sent_trigger_today(state: Dict[str, Any], trigger_type: str, trigger: str, today: date) -> bool:
    """避免同一触发器在同一天内重复发送。"""
    for item in state.get("last_messages", []):
        if item.get("type") != trigger_type or item.get("trigger") != trigger:
            continue
        timestamp = item.get("timestamp")
        if not isinstance(timestamp, str):
            continue
        parsed = parse_state_timestamp(timestamp)
        if parsed and parsed.date() == today:
            return True
    return False


def time_to_minutes(value: time) -> int:
    """时间转分钟数。"""
    return value.hour * 60 + value.minute


def is_in_quiet_hours(now_local: datetime, quiet_hours: Dict[str, str]) -> bool:
    """判断当前是否位于安静时段。"""
    start = parse_hhmm(quiet_hours["start"], "quiet_hours.start")
    end = parse_hhmm(quiet_hours["end"], "quiet_hours.end")
    start_minutes = time_to_minutes(start)
    end_minutes = time_to_minutes(end)
    current_minutes = now_local.hour * 60 + now_local.minute

    if start_minutes == end_minutes:
        return False
    if start_minutes < end_minutes:
        return start_minutes <= current_minutes < end_minutes
    return current_minutes >= start_minutes or current_minutes < end_minutes


def lunar_leap_month(year: int) -> int:
    """返回闰月月份，0 表示无闰月。"""
    return LUNAR_YEAR_INFOS[year - 1900] & 0xF


def lunar_leap_days(year: int) -> int:
    """返回闰月天数。"""
    if lunar_leap_month(year):
        return 30 if (LUNAR_YEAR_INFOS[year - 1900] & 0x10000) else 29
    return 0


def lunar_month_days(year: int, month: int) -> int:
    """返回农历某月天数。"""
    if month < 1 or month > 12:
        raise ValueError(f"农历月份无效：{month}")
    return 30 if (LUNAR_YEAR_INFOS[year - 1900] & (0x10000 >> month)) else 29


def lunar_year_days(year: int) -> int:
    """返回农历某年的总天数。"""
    info = int(LUNAR_YEAR_INFOS[year - 1900])
    total = 29 * 12
    has_leap = info % 16 != 0
    if has_leap:
        total += 29
    info //= 16
    for _ in range(12 + (1 if has_leap else 0)):
        total += info % 2
        info //= 2
    return total


def lunar_to_solar(year: int, month: int, day: int, is_leap_month: bool = False) -> date:
    """农历转公历。支持 1900-2099。"""
    if year < 1900 or year >= 2100:
        raise ValueError("农历年份超出支持范围（1900-2099）")

    leap_month = lunar_leap_month(year)
    if is_leap_month and leap_month != month:
        raise ValueError("指定了非法闰月")

    max_day = lunar_month_days(year, month)
    if is_leap_month:
        max_day = lunar_leap_days(year)
    if day < 1 or day > max_day:
        raise ValueError("农历日期无效")

    offset = 0
    for current_year in range(1900, year):
        offset += lunar_year_days(current_year)

    for current_month in range(1, month):
        offset += lunar_month_days(year, current_month)
        if leap_month and current_month == leap_month:
            offset += lunar_leap_days(year)

    if is_leap_month:
        offset += lunar_month_days(year, month)

    offset += day - 1
    return LUNAR_BASE_DATE + timedelta(days=offset)


def qingming_date(year: int) -> date:
    """计算清明日期。

    采用常用寿星通式近似：
    - 1900-1999：C = 5.59
    - 2000-2099：C = 4.81
    该规则对当前项目的主动问候场景已足够稳定。
    """
    y = year % 100
    c = 5.59 if year < 2000 else 4.81
    day_num = int(y * 0.2422 + c) - int(y / 4)
    return date(year, 4, day_num)


def holiday_date_map(year: int) -> Dict[str, date]:
    """生成当年的节日日期映射。"""
    mapping: Dict[str, date] = {
        holiday_id: date(year, month, day)
        for holiday_id, (month, day, _label) in FIXED_SOLAR_HOLIDAYS.items()
    }
    mapping["qingming"] = qingming_date(year)
    for holiday_id, (lunar_month, lunar_day, _label) in LUNAR_HOLIDAYS.items():
        mapping[holiday_id] = lunar_to_solar(year, lunar_month, lunar_day)
    return mapping


def canonical_holiday_name(token: str) -> Optional[str]:
    """把配置中的节日标识归一化。"""
    return HOLIDAY_ALIASES.get(token.strip().lower())


def same_month_day(current: date, target: date) -> bool:
    """判断是否月日一致，兼容 2 月 29 日在平年映射到 2 月 28 日。"""
    if target.month == 2 and target.day == 29:
        if current.month == 2 and current.day == 29:
            return True
        return current.month == 2 and current.day == 28 and not is_leap_year(current.year)
    return current.month == target.month and current.day == target.day


def is_leap_year(year: int) -> bool:
    """闰年判断。"""
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def check_holiday_trigger(config: Dict[str, Any], state: Dict[str, Any], today: date) -> TriggerCheckResult:
    """检查节日触发。"""
    holiday_config = config["holidays"]
    if not holiday_config["enabled"]:
        return TriggerCheckResult(False, HOLIDAY_TYPE, reason="holiday_disabled")

    holiday_map = holiday_date_map(today.year)

    for item in holiday_config["list"]:
        stripped = item.strip()
        if not stripped:
            continue

        if stripped.lower().startswith("birthday:"):
            raw_birthday = stripped.split(":", 1)[1].strip()
            try:
                birthday = date.fromisoformat(raw_birthday)
            except ValueError:
                raise ConfigError(f"holidays.list 中生日格式无效：{stripped}，应为 birthday:YYYY-MM-DD")
            if same_month_day(today, birthday):
                trigger = f"holiday:birthday:{birthday.isoformat()}"
                if already_sent_trigger_today(state, HOLIDAY_TYPE, trigger, today):
                    return TriggerCheckResult(False, HOLIDAY_TYPE, reason="holiday_already_sent_today")
                return TriggerCheckResult(
                    True,
                    HOLIDAY_TYPE,
                    trigger=trigger,
                    label="生日",
                    metadata={
                        "holiday_id": "birthday",
                        "birthday": birthday.isoformat(),
                        "label": "生日",
                    },
                )
            continue

        holiday_id = canonical_holiday_name(stripped)
        if not holiday_id:
            raise ConfigError(f"holidays.list 中存在未知节日标识：{stripped}")

        if holiday_id == "qingming":
            match = holiday_map[holiday_id] == today
            label = "清明"
        elif holiday_id in FIXED_SOLAR_HOLIDAYS:
            match = holiday_map[holiday_id] == today
            label = FIXED_SOLAR_HOLIDAYS[holiday_id][2]
        else:
            match = holiday_map[holiday_id] == today
            label = LUNAR_HOLIDAYS[holiday_id][2]

        if match:
            trigger = f"holiday:{holiday_id}"
            if already_sent_trigger_today(state, HOLIDAY_TYPE, trigger, today):
                return TriggerCheckResult(False, HOLIDAY_TYPE, reason="holiday_already_sent_today")
            return TriggerCheckResult(
                True,
                HOLIDAY_TYPE,
                trigger=trigger,
                label=label,
                metadata={
                    "holiday_id": holiday_id,
                    "holiday_date": holiday_map[holiday_id].isoformat(),
                    "label": label,
                },
            )

    return TriggerCheckResult(False, HOLIDAY_TYPE, reason="holiday_not_matched")


def anniversary_years_since(original_date: date, today: date) -> int:
    """计算从原始日期到今天过了几年。"""
    years = today.year - original_date.year
    if (today.month, today.day) < (original_date.month, original_date.day):
        years -= 1
    return max(0, years)


def check_anniversary_trigger(config: Dict[str, Any], state: Dict[str, Any], today: date) -> TriggerCheckResult:
    """检查纪念日触发。"""
    ann_config = config["anniversaries"]
    if not ann_config["enabled"]:
        return TriggerCheckResult(False, ANNIVERSARY_TYPE, reason="anniversary_disabled")

    for item in ann_config["dates"]:
        base_date: date = item["date"]
        if base_date > today:
            continue
        if same_month_day(today, base_date):
            trigger = f"anniversary:{base_date.isoformat()}:{item['label']}"
            if already_sent_trigger_today(state, ANNIVERSARY_TYPE, trigger, today):
                return TriggerCheckResult(False, ANNIVERSARY_TYPE, reason="anniversary_already_sent_today")
            return TriggerCheckResult(
                True,
                ANNIVERSARY_TYPE,
                trigger=trigger,
                label=item["label"],
                metadata={
                    "anniversary_date": base_date.isoformat(),
                    "label": item["label"],
                    "anniversary_type": item["type"],
                    "years_since": anniversary_years_since(base_date, today),
                },
            )

    return TriggerCheckResult(False, ANNIVERSARY_TYPE, reason="anniversary_not_matched")


def weather_api_key(config: Dict[str, Any]) -> str:
    """获取天气 API key。"""
    config_key = config["weather"].get("api_key") or ""
    env_key = (
        os.environ.get("PROACTIVE_WEATHER_API_KEY")
        or os.environ.get("WEATHER_API_KEY")
        or os.environ.get("QWEATHER_API_KEY")
        or ""
    )
    return str(config_key or env_key).strip()


def check_weather_trigger(config: Dict[str, Any], _state: Dict[str, Any], _today: date) -> TriggerCheckResult:
    """天气触发接口预留。当前版本不实际调用外部 API。"""
    weather_config = config["weather"]
    if not weather_config["enabled"]:
        return TriggerCheckResult(False, WEATHER_TYPE, reason="weather_disabled")

    warnings: List[str] = []
    api_key = weather_api_key(config)
    if not api_key:
        warnings.append("天气功能已启用，但未提供 API key；当前版本不会调用天气服务。")
        return TriggerCheckResult(False, WEATHER_TYPE, reason="weather_missing_api_key", warnings=warnings)

    warnings.append("天气功能接口已预留，但当前版本尚未实现外部天气 API 调用。")
    return TriggerCheckResult(False, WEATHER_TYPE, reason="weather_not_implemented", warnings=warnings)


def check_random_trigger(config: Dict[str, Any], state: Dict[str, Any], now_local: datetime) -> TriggerCheckResult:
    """检查随机想念触发。"""
    random_config = config["random_miss"]
    if not random_config["enabled"]:
        return TriggerCheckResult(False, RANDOM_TYPE, reason="random_disabled")

    if int(state.get("consecutive_no_reply", 0)) >= 3:
        return TriggerCheckResult(False, RANDOM_TYPE, reason="random_blocked_by_no_reply")

    interval_days = int(random_config["min_interval_days"])
    last_random = get_latest_message_time(state, RANDOM_TYPE)
    if last_random is not None:
        elapsed = now_local - last_random
        if elapsed < timedelta(days=interval_days):
            return TriggerCheckResult(False, RANDOM_TYPE, reason="random_in_cooldown")

    today = now_local.date()
    trigger = f"random:{today.isoformat()}"
    if already_sent_trigger_today(state, RANDOM_TYPE, trigger, today):
        return TriggerCheckResult(False, RANDOM_TYPE, reason="random_already_sent_today")

    return TriggerCheckResult(
        True,
        RANDOM_TYPE,
        trigger=trigger,
        label="随机想念",
        metadata={
            "min_interval_days": interval_days,
            "label": "随机想念",
        },
    )


def strip_front_matter(text: str) -> str:
    """移除 Markdown 开头的 YAML front matter。"""
    if not text.startswith("---"):
        return text
    match = re.match(r"^---\s*\n.*?\n---\s*\n", text, flags=re.DOTALL)
    if not match:
        return text
    return text[match.end():]


def clean_markdown_inline(text: str) -> str:
    """清理简单 markdown 标记。"""
    cleaned = re.sub(r"`([^`]+)`", r"\1", text)
    cleaned = re.sub(r"\*\*([^*]+)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"\*([^*]+)\*", r"\1", cleaned)
    cleaned = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip(" \t-•")


def unique_preserve_order(items: Iterable[str]) -> List[str]:
    """去重并保持原顺序。"""
    seen: set[str] = set()
    results: List[str] = []
    for item in items:
        stripped = item.strip()
        if not stripped or stripped in seen:
            continue
        seen.add(stripped)
        results.append(stripped)
    return results


def extract_short_phrases(text: str) -> List[str]:
    """从 personality 文本中抽取简短口头禅。"""
    candidates: List[str] = []
    patterns = [
        r"`([^`]{1,12})`",
        r"“([^”]{1,12})”",
        r'"([^"\n]{1,12})"',
        r"‘([^’]{1,12})’",
    ]
    for pattern in patterns:
        candidates.extend(re.findall(pattern, text))
    cleaned = [clean_markdown_inline(item) for item in candidates]
    return unique_preserve_order([item for item in cleaned if 1 <= len(item) <= 12])


def classify_relation_kind(relation: str, relic_type: str, display_name: str) -> str:
    """推断关系类型。"""
    corpus = f"{relation} {display_name} {relic_type}".strip()
    if relic_type == "pet":
        return "pet"
    if relic_type == "place":
        return "place"
    if relic_type == "moment":
        return "moment"
    if relic_type == "team-culture" or any(token in corpus for token in TEAM_HINTS):
        return "team"
    if any(token in corpus for token in ELDER_RELATIONS):
        return "elder"
    if any(token in corpus for token in PARENT_RELATIONS):
        return "parent"
    if relic_type == "relationship" or any(token in corpus for token in PARTNER_RELATIONS):
        return "partner"
    if any(token in corpus for token in FRIEND_RELATIONS):
        return "friend"
    if relic_type == "public-figure":
        return "public-figure"
    return "generic"


def detect_care_topics(*texts: str) -> List[str]:
    """根据关键词猜测关心主题。"""
    merged = "\n".join(texts)
    topics: List[str] = []
    for topic, keywords in TOPIC_KEYWORDS.items():
        if any(keyword in merged for keyword in keywords):
            topics.append(topic)
    return topics


def first_non_empty(values: Sequence[str]) -> str:
    """取第一个非空字符串。"""
    for value in values:
        if value.strip():
            return value.strip()
    return ""


def extract_personality_profile(manifest: Dict[str, Any], personality_text: str) -> PersonalityProfile:
    """从 manifest + personality 提取一个轻量的人格画像。"""
    subject = manifest.get("subject") if isinstance(manifest.get("subject"), dict) else {}
    display_name = first_non_empty(
        [
            str(manifest.get("display_name") or ""),
            str(manifest.get("title") or ""),
            str(subject.get("name") or ""),
            str(manifest.get("slug") or ""),
            "Relic",
        ]
    )
    relation = str(subject.get("relation_to_user") or manifest.get("relationship") or "").strip()
    relic_type = str(manifest.get("relic_type") or manifest.get("template") or "human").strip() or "human"
    memorial = bool(subject.get("status") == "memorial" or subject.get("deceased_year"))

    content = strip_front_matter(personality_text)
    quote_match = re.search(r"^>\s*(.+)$", content, flags=re.MULTILINE)
    quote = clean_markdown_inline(quote_match.group(1)) if quote_match else ""

    bullet_lines = [clean_markdown_inline(match) for match in re.findall(r"^\s*[-*]\s+(.+)$", content, flags=re.MULTILINE)]
    bullet_traits = [line for line in bullet_lines if 4 <= len(line) <= 42][:12]

    core_traits_raw = subject.get("core_traits") if isinstance(subject.get("core_traits"), list) else []
    core_traits = [str(item).strip() for item in core_traits_raw if isinstance(item, str) and item.strip()]

    interaction_profile = subject.get("interaction_profile") if isinstance(subject.get("interaction_profile"), dict) else {}
    voice_prefix = str(interaction_profile.get("voice_note_prefix") or "").strip()
    catchphrases = extract_short_phrases(content)
    if not voice_prefix:
        for phrase in catchphrases:
            if phrase in {"哎", "欸", "嘿", "喂"}:
                voice_prefix = phrase
                break
    if not voice_prefix and "哎" in content:
        voice_prefix = "哎"

    concise = "multiple-short-messages" in str(interaction_profile.get("message_shape") or "") or any(
        token in content for token in ("句子短", "拆成几条", "多条", "碎消息")
    )
    gentle = any(token in content for token in ("温柔", "轻轻", "抱抱", "陪伴", "没关系", "慢一点"))
    teasing = any(token in content for token in ("唠叨", "絮叨", "嘴硬", "埋怨", "催"))
    nostalgic = any(token in content for token in ("那时候", "回忆", "想起", "老故事", "纪念"))

    all_traits = unique_preserve_order(core_traits + bullet_traits)
    care_topics = detect_care_topics(content, "\n".join(core_traits), relation, display_name)
    relation_kind = classify_relation_kind(relation, relic_type, display_name)
    seed = f"{manifest.get('slug', display_name)}|{display_name}|{relation}|{relic_type}"

    return PersonalityProfile(
        display_name=display_name,
        relation=relation,
        relic_type=relic_type,
        relation_kind=relation_kind,
        memorial=memorial,
        voice_prefix=voice_prefix,
        quote=quote,
        traits=all_traits[:12],
        catchphrases=catchphrases[:10],
        care_topics=care_topics,
        concise=concise,
        gentle=gentle,
        teasing=teasing,
        nostalgic=nostalgic,
        seed=seed,
    )


def stable_choice(options: Sequence[str], seed: str) -> str:
    """稳定选择一个模板，避免完全随机。"""
    if not options:
        return ""
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    index = digest[0] % len(options)
    return options[index]


def elder_style_prefix(profile: PersonalityProfile) -> str:
    """老一辈 / 父母型开场语。"""
    if profile.voice_prefix:
        return f"{profile.voice_prefix}，"
    if profile.relation_kind in {"elder", "parent"}:
        return "哎，"
    return ""


def care_tail(profile: PersonalityProfile, seed: str, *, reflective: bool = False) -> str:
    """生成一句轻量收尾。"""
    if profile.relation_kind == "pet":
        return stable_choice(
            [
                "你不用回我，我先蹭你一下。",
                "我就轻轻出现一下，陪你一会儿。",
            ],
            seed,
        )
    if profile.relation_kind == "team":
        return stable_choice(
            [
                "不用回长文，先把今天过稳。",
                "我就冒个泡，不占你太多时间。",
            ],
            seed,
        )
    if reflective:
        return stable_choice(
            [
                "想起就想起，慢一点也没关系。",
                "你不用把情绪收得太整齐。",
                "心里要是有点沉，就让它沉一会儿。",
            ],
            seed,
        )
    if "吃饭" in profile.care_topics and profile.relation_kind in {"elder", "parent"}:
        return stable_choice(
            [
                "先把饭吃上。",
                "别又随便糊弄一口。",
                "总得吃点热乎的。",
            ],
            seed,
        )
    if "睡觉" in profile.care_topics and profile.relation_kind in {"elder", "parent"}:
        return stable_choice(
            [
                "晚上别太晚睡。",
                "记得给自己留点休息。",
            ],
            seed,
        )
    return stable_choice(
        [
            "你不用急着回，我就是来打个招呼。",
            "我就是轻轻敲一下门。",
            "忙你的也行，我只是想起你了。",
        ],
        seed,
    )


def festival_body(profile: PersonalityProfile, holiday_id: str, seed: str) -> str:
    """生成节日主体句。"""
    if holiday_id == "spring_festival":
        if "吃饭" in profile.care_topics:
            return stable_choice(
                [
                    "今天过年，记得吃点热乎的，别又拿忙当借口。",
                    "春节到了，哪怕不热闹，也给自己留一口像样的饭。",
                    "今天是过年的日子，先把自己照顾好再说别的。",
                ],
                seed,
            )
        return stable_choice(
            [
                "春节到了，热闹不热闹都行，先把自己照顾好。",
                "今天过年，我先来占个位置，提醒你别把自己忙丢了。",
            ],
            seed,
        )
    if holiday_id == "lantern_festival":
        return stable_choice(
            [
                "元宵节了，汤圆或者元宵，总得吃一点，图个圆。",
                "今天是元宵，灯亮的时候，心也别太空着。",
            ],
            seed,
        )
    if holiday_id == "qingming":
        return stable_choice(
            [
                "今天是清明，这种日子会让人心里慢一点。",
                "清明到了，想起什么都很正常。",
            ],
            seed,
        )
    if holiday_id == "dragon_boat":
        return stable_choice(
            [
                "端午到了，甜粽咸粽都行，记得好好吃饭。",
                "今天有点节气味才像样，别把日子过得太赶。",
            ],
            seed,
        )
    if holiday_id == "mid_autumn":
        return stable_choice(
            [
                "中秋到了，今晚记得抬头看一眼月亮。",
                "今天是中秋，月亮圆不圆都不要紧，你别把自己忙丢了。",
            ],
            seed,
        )
    if holiday_id == "national_day":
        return stable_choice(
            [
                "国庆到了，出门人多的话慢一点，照顾好自己。",
                "今天适合稍微松口气，别把每一天都过成待办列表。",
            ],
            seed,
        )
    if holiday_id == "new_year":
        return stable_choice(
            [
                "新一年刚开头，别急着把自己逼太紧。",
                "元旦了，今天适合把日子过得松一点。",
            ],
            seed,
        )
    if holiday_id == "birthday":
        if profile.relation_kind in {"elder", "parent"} and "吃饭" in profile.care_topics:
            return stable_choice(
                [
                    "生日快乐，今天别随便糊弄，吃点好吃的。",
                    "今天是你的日子，先让自己吃好一点、睡好一点。",
                ],
                seed,
            )
        return stable_choice(
            [
                "生日快乐。热闹不热闹都没关系，今天总得偏心自己一点。",
                "生日快乐，给自己留点好吃的、好睡的、好心情。",
                "今天是你的日子，别把自己安排得太满。",
            ],
            seed,
        )
    return "今天这个日子，值得被轻轻记一下。"


def render_holiday_message(profile: PersonalityProfile, check: TriggerCheckResult, today: date) -> str:
    """生成节日消息。"""
    holiday_id = str(check.metadata.get("holiday_id") or "")
    seed = f"{profile.seed}|holiday|{holiday_id}|{today.isoformat()}"
    prefix = elder_style_prefix(profile)
    body = festival_body(profile, holiday_id, seed)
    reflective = holiday_id == "qingming" or (profile.memorial and holiday_id in {"mid_autumn", "spring_festival"})
    tail = care_tail(profile, f"{seed}|tail", reflective=reflective)

    if profile.relation_kind == "pet":
        body = stable_choice(
            [
                f"今天{check.label}，我先来蹭你一下。{body}",
                f"{check.label}到了，我来在你身边打个滚。{body}",
            ],
            seed,
        )
        return compact_message(body, tail)

    if profile.relation_kind == "team":
        body = stable_choice(
            [
                f"{check.label}到了，先别卷。{body}",
                f"今天{check.label}，我先提醒一句：{body}",
            ],
            seed,
        )
        return compact_message(body, tail)

    return compact_message(prefix + body, tail)


def anniversary_body(profile: PersonalityProfile, label: str, ann_type: str, years_since: int, seed: str) -> str:
    """生成纪念日主体句。"""
    years_text = ""
    if years_since > 0:
        years_text = f"，已经{years_since}年了"

    if ann_type == "happy":
        return stable_choice(
            [
                f"今天是{label}的日子{years_text}。这种时刻，值得被轻轻记一下。",
                f"原来今天是{label}{years_text}。我还是想先来和你打个招呼。",
            ],
            seed,
        )
    if ann_type == "bittersweet":
        return stable_choice(
            [
                f"今天是{label}的日子{years_text}。想起就想起，不用装得很轻松。",
                f"这个日子会把人往回带一下——{label}{years_text}。",
            ],
            seed,
        )
    return stable_choice(
        [
            f"今天是{label}的日子{years_text}。我来轻轻敲个门。",
            f"今天这个节点会让人想到{label}{years_text}，我就顺手来打个招呼。",
        ],
        seed,
    )


def render_anniversary_message(profile: PersonalityProfile, check: TriggerCheckResult, today: date) -> str:
    """生成纪念日消息。"""
    label = str(check.metadata.get("label") or check.label or "这个日子")
    ann_type = str(check.metadata.get("anniversary_type") or "neutral")
    years_since = int(check.metadata.get("years_since") or 0)
    seed = f"{profile.seed}|anniversary|{label}|{today.isoformat()}"
    prefix = elder_style_prefix(profile)
    body = anniversary_body(profile, label, ann_type, years_since, seed)
    reflective = ann_type == "bittersweet" or profile.memorial
    tail = care_tail(profile, f"{seed}|tail", reflective=reflective)

    if profile.relation_kind == "pet":
        body = stable_choice(
            [
                f"今天是{label}的日子。想到这里，我就想在你身边蹭一下。",
                f"{label}到了，我还是想来陪你一下。",
            ],
            seed,
        )
    elif profile.relation_kind == "team":
        body = stable_choice(
            [
                f"今天这个节点会让人想到{label}。我先来冒个泡。",
                f"原来今天是{label}。这种里程碑，值得留个记号。",
            ],
            seed,
        )
        reflective = False
        tail = care_tail(profile, f"{seed}|tail|team", reflective=False)

    return compact_message(prefix + body, tail)


def render_random_message(profile: PersonalityProfile, today: date) -> str:
    """生成随机想念消息。"""
    seed = f"{profile.seed}|random|{today.isoformat()}"
    prefix = elder_style_prefix(profile)

    if profile.relation_kind == "pet":
        return stable_choice(
            [
                "没什么事，我先在你脚边打个滚。你累了就歇一会儿。",
                "突然想蹭你一下。今天如果有点烦，就当我在旁边陪你。",
            ],
            seed,
        )

    if profile.relation_kind == "team":
        return stable_choice(
            [
                "没啥大事，就是冒个泡。今天先把最重要的一件事做完。",
                "只是顺手提醒一句：别把自己活成待办列表。",
            ],
            seed,
        )

    if profile.relation_kind == "place":
        return stable_choice(
            [
                "今天路过一点相似的光线，忽然想起你。你不用急着回头看，我先把那阵熟悉的风留在这儿。",
                "没什么大事，只是突然想到那个地方的味道和安静。像门刚被轻轻推开了一下。",
            ],
            seed,
        )

    if profile.relation_kind == "moment":
        return stable_choice(
            [
                "今天忽然想起那个时刻。不是要你立刻整理情绪，只是想提醒你：它还在。",
                "没有特别的原因，就是那个瞬间突然又亮了一下。我来轻轻碰你一下。",
            ],
            seed,
        )

    if profile.relation_kind in {"elder", "parent"}: 
        if "吃饭" in profile.care_topics:
            return stable_choice(
                [
                    f"{prefix}没什么大事，就是突然想起你了。今天记得好好吃饭。",
                    f"{prefix}我就来敲一下门。你忙你的，先把饭吃上。",
                    f"{prefix}顺手惦记你一句，别又随便糊弄一口。",
                ],
                seed,
            )
        return stable_choice(
            [
                f"{prefix}没什么大事，就是突然想起你了。",
                f"{prefix}我就是来看看你今天过得怎么样。",
            ],
            seed,
        )

    base = stable_choice(
        [
            "没有大事，就是忽然想到你。",
            "我就轻轻冒个头，跟你打声招呼。",
            "突然想起你了，所以来敲一下门。",
        ],
        seed,
    )
    tail = care_tail(profile, f"{seed}|tail", reflective=False)
    return compact_message(base, tail)


def compact_message(*parts: str) -> str:
    """拼接消息并清理多余空白。"""
    text = "".join(part.strip() for part in parts if part and part.strip())
    text = re.sub(r"\s+", " ", text).strip()
    text = text.replace(" ，", "，").replace(" 。", "。").replace(" ？", "？").replace(" ！", "！")
    return text


def build_message(profile: PersonalityProfile, check: TriggerCheckResult, today: date) -> str:
    """根据触发类型渲染最终消息。"""
    if check.trigger_type == HOLIDAY_TYPE:
        return render_holiday_message(profile, check, today)
    if check.trigger_type == ANNIVERSARY_TYPE:
        return render_anniversary_message(profile, check, today)
    if check.trigger_type == RANDOM_TYPE:
        return render_random_message(profile, today)
    raise ValueError(f"不支持为触发类型 {check.trigger_type} 生成消息")


def append_state_message(state: Dict[str, Any], decision: Decision) -> Dict[str, Any]:
    """把本次触发写入 state。"""
    updated = {
        "last_messages": list(state.get("last_messages", [])),
        "consecutive_no_reply": int(state.get("consecutive_no_reply", 0)),
    }
    updated["last_messages"].append(
        {
            "timestamp": decision.timestamp,
            "type": decision.trigger_type,
            "trigger": decision.trigger,
            "message": decision.message,
        }
    )
    updated["last_messages"] = updated["last_messages"][-MAX_STATE_HISTORY:]
    return updated


def resolve_config_path(relic_dir: Path, provided_path: Optional[str]) -> Path:
    """解析配置文件路径。"""
    if provided_path:
        return Path(provided_path).expanduser()
    return relic_dir / DEFAULT_CONFIG_FILENAME


def default_holiday_list_for_relic_type(relic_type: str) -> List[str]:
    if relic_type == "human":
        return ["spring_festival", "mid_autumn", "new_year"]
    if relic_type == "relationship":
        return ["mid_autumn", "new_year"]
    if relic_type == "team-culture":
        return ["new_year"]
    return []


def default_random_interval_days_for_relic_type(relic_type: str) -> int:
    if relic_type == "pet":
        return 10
    if relic_type in {"team-culture", "place", "moment"}:
        return 21
    if relic_type == "public-figure":
        return 30
    return 14


def build_inferred_default_config(manifest: Dict[str, Any]) -> Dict[str, Any]:
    """在缺少配置文件时，根据 manifest 推断一份保守的默认配置。"""
    relic_type = str(manifest.get("relic_type") or manifest.get("template") or "human").strip() or "human"
    holiday_list = default_holiday_list_for_relic_type(relic_type)
    random_enabled = relic_type != "public-figure"
    return {
        "enabled": True,
        "user_city": None,
        "holidays": {
            "enabled": bool(holiday_list),
            "list": holiday_list,
        },
        "anniversaries": {
            "enabled": False,
            "dates": [],
        },
        "weather": {
            "enabled": False,
        },
        "random_miss": {
            "enabled": random_enabled,
            "min_interval_days": default_random_interval_days_for_relic_type(relic_type),
        },
        "quiet_hours": {
            "start": "23:00",
            "end": "07:00",
        },
        "global_max_per_week": 2 if relic_type not in {"place", "moment"} else 1,
    }


def validate_relic_dir(relic_dir: Path) -> tuple[Path, Path]:
    """确认 Relic 目录和关键文件存在。"""
    if not relic_dir.exists() or not relic_dir.is_dir():
        raise FileNotFoundError(f"Relic 目录不存在：{relic_dir}")
    manifest_path = relic_dir / "manifest.json"
    personality_path = relic_dir / "personality.md"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"缺少 manifest.json：{manifest_path}")
    if not personality_path.is_file():
        raise FileNotFoundError(f"缺少 personality.md：{personality_path}")
    return manifest_path, personality_path


def load_manifest(manifest_path: Path) -> Dict[str, Any]:
    """读取 Relic manifest。"""
    raw = read_json_file(manifest_path)
    if not isinstance(raw, dict):
        raise ConfigError(f"manifest.json 根节点必须是 object：{manifest_path}")
    return raw


def decide_trigger(
    config: Dict[str, Any],
    state: Dict[str, Any],
    now_local: datetime,
    requested_type: Optional[str],
) -> Decision:
    """按优先级决定是否触发。"""
    timestamp = now_timestamp()
    warnings: List[str] = []

    if not config["enabled"]:
        return Decision(False, timestamp, reason="proactive_disabled")

    if is_in_quiet_hours(now_local, config["quiet_hours"]):
        return Decision(False, timestamp, reason="quiet_hours")

    if count_messages_this_week(state, now_local) >= int(config["global_max_per_week"]):
        return Decision(False, timestamp, reason="weekly_cap_reached")

    ordered_types = [requested_type] if requested_type else list(SUPPORTED_TYPES)
    last_reason = "no_trigger_matched"

    for trigger_type in ordered_types:
        if trigger_type == HOLIDAY_TYPE:
            check = check_holiday_trigger(config, state, now_local.date())
        elif trigger_type == ANNIVERSARY_TYPE:
            check = check_anniversary_trigger(config, state, now_local.date())
        elif trigger_type == WEATHER_TYPE:
            check = check_weather_trigger(config, state, now_local.date())
        elif trigger_type == RANDOM_TYPE:
            check = check_random_trigger(config, state, now_local)
        else:
            raise ValueError(f"未知触发类型：{trigger_type}")

        warnings.extend(check.warnings)
        if check.matched:
            return Decision(
                True,
                timestamp,
                trigger_type=check.trigger_type,
                trigger=check.trigger,
                warnings=warnings,
                details={
                    "label": check.label,
                    **check.metadata,
                },
            )
        if check.reason:
            last_reason = check.reason
        if requested_type:
            return Decision(False, timestamp, reason=check.reason or "no_trigger_matched", warnings=warnings)

    return Decision(False, timestamp, reason=last_reason, warnings=warnings)


def parse_args() -> argparse.Namespace:
    """CLI 参数。"""
    parser = argparse.ArgumentParser(description="relic.skill 主动行为调度器")
    parser.add_argument(
        "--relic",
        required=True,
        help="Relic 目录路径（包含 manifest.json 和 personality.md）",
    )
    parser.add_argument(
        "--config",
        help="主动行为配置文件路径（JSON），默认读取 <relic>/proactive_config.json",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="预览是否应触发以及会发送什么消息，不更新 state",
    )
    parser.add_argument(
        "--type",
        choices=SUPPORTED_TYPES,
        help="只检查指定类型（holiday/weather/anniversary/random）",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="在命中触发且已配置 TTS 时，额外生成语音文件并把 audio_path 写入输出 JSON",
    )
    return parser.parse_args()


def main() -> None:
    """CLI 入口。"""
    configure_utf8_stdout()
    args = parse_args()

    try:
        relic_dir = Path(args.relic).expanduser()
        manifest_path, personality_path = validate_relic_dir(relic_dir)
        manifest = load_manifest(manifest_path)

        config_path = resolve_config_path(relic_dir, args.config)
        inferred_default = False
        if config_path.is_file():
            config = normalize_config(read_json_file(config_path))
        elif args.config:
            raise FileNotFoundError(f"主动行为配置文件不存在：{config_path}")
        else:
            config = normalize_config(build_inferred_default_config(manifest))
            inferred_default = True

        state_path = relic_dir / STATE_FILENAME
        state = load_state(state_path)
        now_local = datetime.now().astimezone().replace(tzinfo=None)

        decision = decide_trigger(config, state, now_local, args.type)
        if inferred_default:
            decision.warnings.append("未找到 proactive_config.json，已按 Relic 类型临时推断默认配置")
            decision.details["config_source"] = "inferred-default"

        if decision.should_trigger:
            personality_text = personality_path.read_text(encoding="utf-8")
            profile = extract_personality_profile(manifest, personality_text)
            decision.message = build_message(profile, TriggerCheckResult(
                matched=True,
                trigger_type=decision.trigger_type or "",
                trigger=decision.trigger,
                label=str(decision.details.get("label") or ""),
                metadata=dict(decision.details),
            ), now_local.date())

            if not args.dry_run:
                state = append_state_message(state, decision)
                save_state(state_path, state)

        payload = decision.to_payload(args.dry_run)
        payload["tts"] = build_tts_payload(manifest, decision)
        payload["image"] = build_image_payload(manifest, decision)
        if args.execute and payload.get("tts", {}).get("enabled"):
            payload = maybe_execute_tts(relic_dir, payload, dry_run=bool(args.dry_run))
        print(json.dumps(payload, ensure_ascii=False, indent=2))

    except (FileNotFoundError, ConfigError, json.JSONDecodeError, OSError, ValueError) as exc:
        print(f"错误: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
