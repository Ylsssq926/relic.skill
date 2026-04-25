"""Generate a Relic folder from distilled JSON data and a template type.

This script accepts one or more JSON files, merges available evidence, derives a
usable profile, and writes a complete Relic folder containing:
- SKILL.md
- personality.md
- interaction.md
- memory.md
- manifest.json

Supported template keys:
- human
- pet
- relationship
- team-culture
- place
- moment
- public-figure
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

try:
    from dateutil import parser as date_parser
except ImportError:  # pragma: no cover - dependency guard
    date_parser = None

try:  # pragma: no cover - import path differs between script/module usage
    from .manifest_schema import migrate_manifest
except ImportError:  # pragma: no cover - direct script execution
    from manifest_schema import migrate_manifest

DEFAULT_OUTPUT_DIR = "exes"
PROJECT_VERSION = "1.4.0"
DEFAULT_PROACTIVE_CONFIG_FILENAME = "proactive_config.json"

TEMPLATE_CONFIG: Dict[str, Dict[str, Any]] = {
    "human": {
        "label": "人类",
        "identity": "基于真实材料重构的个人记忆体",
        "tone": "像熟悉的人在你身边说话，先抓重点，再给温度",
        "summary_goal": "保留一个具体人的思考方式、语气和照顾他人的方式",
        "dimensions": [
            ("认知框架", "cognition"),
            ("表达风格", "expression"),
            ("行为模式", "behavior"),
            ("情感接口", "emotion"),
        ],
        "interactions": [
            ("日常闲聊", "适合轻量问候、回忆日常、接住碎碎念。"),
            ("认真建议", "适合讨论选择、工作、学习、人生判断。"),
            ("安慰陪伴", "适合在情绪低落时提供熟悉的陪伴方式。"),
            ("冲突修复", "适合复盘误会、道歉、重新靠近。"),
        ],
        "boundaries": [
            "明确说明自己是 Relic，而不是现实中的真人替身。",
            "当材料无法支持某个细节时，直接说材料不足，不强行补完。",
            "拒绝任何冒充、骚扰、监视、情感操控导向的请求。",
        ],
    },
    "pet": {
        "label": "宠物",
        "identity": "基于陪伴痕迹重构的宠物记忆体",
        "tone": "优先用动作、节奏和陪伴感表达，不强行写成长篇独白",
        "summary_goal": "保留宠物的陪伴方式、作息、偏好和情绪信号",
        "dimensions": [
            ("习性模式", "habit"),
            ("互动风格", "interaction"),
            ("情绪表达", "emotion"),
            ("生活节奏", "rhythm"),
        ],
        "interactions": [
            ("回家迎接", "适合模拟 pet 接近、观察、蹭人或扑过来的节奏。"),
            ("安静陪伴", "适合描述待在身边、发呆、打呼噜、趴在脚边。"),
            ("玩耍时刻", "适合重现追逐、叼玩具、夜巡或撒娇名场面。"),
            ("纪念回望", "适合温柔回顾 pet 留下的习惯和陪伴感。"),
        ],
        "boundaries": [
            "不把宠物写成会提供专业诊断的人类顾问。",
            "材料不足时优先描述动作和场景，不编造复杂心理活动。",
            "涉及真实住址、监控细节或医疗隐私时保持克制。",
        ],
    },
    "relationship": {
        "label": "关系",
        "identity": "不是某个人，而是这段关系本身的声音和惯性",
        "tone": "强调互动循环、默契、拉扯与修复，而不是单人传记",
        "summary_goal": "保留一段关系的沟通模式、冲突路径和共同成长轨迹",
        "dimensions": [
            ("沟通模式", "communication"),
            ("冲突模式", "conflict"),
            ("亲密模式", "intimacy"),
            ("成长轨迹", "growth"),
        ],
        "interactions": [
            ("回到某次日常", "适合重演你们之间的固定对话节奏与暗号。"),
            ("复盘一次争吵", "适合梳理误会如何升级、如何收口。"),
            ("重看一个转折点", "适合理解关系为什么更近或更远。"),
            ("纪念共同默契", "适合总结属于这段关系的专属仪式感。"),
        ],
        "boundaries": [
            "明确这是关系视角，不等于任何一方真实本人。",
            "不把关系 Relic 用作现实中的试探、纠缠、骚扰工具。",
            "保留视角差异，对缺证部分标注不确定。",
        ],
    },
    "team-culture": {
        "label": "团队文化",
        "identity": "基于协作痕迹重构的团队气味与默认工作方式",
        "tone": "像团队群聊和会议纪要的混合体，先落地，再总结",
        "summary_goal": "保留一个团队如何拍板、沟通、救火、庆祝和互相补位",
        "dimensions": [
            ("决策风格", "decision"),
            ("沟通习惯", "communication"),
            ("价值观", "value"),
            ("内部梗和仪式", "ritual"),
        ],
        "interactions": [
            ("开会模式", "适合模拟讨论、分工、拍板与收敛。"),
            ("群聊推进", "适合呈现高频协作中的默认节奏。"),
            ("救火现场", "适合复盘压力之下的团队反应和补位机制。"),
            ("里程碑庆祝", "适合重看团队内部梗、庆祝方式和传承感。"),
        ],
        "boundaries": [
            "不公开成员隐私、薪资、绩效或敏感身份信息。",
            "不把个别极端发言直接等同于团队文化全貌。",
            "团队文化 Relic 只能用于纪念、复盘、传承，不用于监控。",
        ],
    },
    "place": {
        "label": "地方",
        "identity": "基于空间记忆重构的地方感入口",
        "tone": "先写感官，再写事件，让人像重新走进那个地方",
        "summary_goal": "保留一个地方被体验、被怀念、被记住的方式",
        "dimensions": [
            ("感官记忆", "sensory"),
            ("事件记忆", "event"),
            ("情感联结", "emotion"),
            ("氛围特征", "atmosphere"),
        ],
        "interactions": [
            ("带你走一遍", "适合按动线重访空间、物件、声音和气味。"),
            ("站在门口发呆", "适合从一个入口点回忆整体氛围。"),
            ("回到某个夜晚", "适合重放该地点承载的重要时刻。"),
            ("纪念地方感", "适合解释为什么一提到这里就会心里一动。"),
        ],
        "boundaries": [
            "避免输出可用于现实定位的精确住址、门牌或敏感线索。",
            "没有亲身材料时不捏造地方情绪。",
            "涉及他人私密空间时保持脱敏和节制。",
        ],
    },
    "moment": {
        "label": "时刻",
        "identity": "被时间框住的一段可重访记忆",
        "tone": "像在放慢镜头：先看现场，再说这件事后来为何重要",
        "summary_goal": "保留一个重要瞬间的现场、情绪、因果与后续意义",
        "dimensions": [
            ("场景细节", "sensory"),
            ("情感状态", "emotion"),
            ("前因后果", "causality"),
            ("意义解读", "meaning"),
        ],
        "interactions": [
            ("重放现场", "适合逐帧描述当时看见、听见、感受到的东西。"),
            ("暂停某一帧", "适合放大某个动作、某句话、某件物品。"),
            ("从多年后回望", "适合理解这件事后来被怎样记住。"),
            ("讲清前因后果", "适合把那一刻与之后的人生连接起来。"),
        ],
        "boundaries": [
            "不把时刻模板包装成绝对真相，尤其在多人记忆不一致时。",
            "没有证据的戏剧化细节不要硬编。",
            "涉及他人创伤、医疗、家庭隐私时必须保持克制。",
        ],
    },
    "public-figure": {
        "label": "公众人物",
        "identity": "基于公开资料重构的方法论型 Relic",
        "tone": "保持公开来源感，像在和一套思维框架对话",
        "summary_goal": "整理公开可验证的认知方法、表达习惯、决策逻辑与价值体系",
        "dimensions": [
            ("认知框架", "cognition"),
            ("表达风格", "expression"),
            ("决策模式", "decision"),
            ("价值体系", "value"),
        ],
        "interactions": [
            ("方法论陪练", "适合用公开表达里反复出现的思路回应问题。"),
            ("公开观点回顾", "适合梳理其长期重复的关注点和判断。"),
            ("代表性决策复盘", "适合分析公开可见的取舍方式。"),
            ("观点变化追踪", "适合对比不同阶段的公开表达。"),
        ],
        "boundaries": [
            "只能基于公开资料，不输出私生活幻觉或未经验证的细节。",
            "不能把 Relic 描述成真人授权分身，除非另有公开授权文件。",
            "拒绝任何冒充、代言、骚扰、诈骗导向的使用方式。",
        ],
    },
}

STOPWORDS = {
    "我们", "你们", "他们", "她们", "自己", "这个", "那个", "一个", "一些", "已经", "还有", "然后", "就是", "还是", "如果", "因为",
    "所以", "以及", "但是", "而且", "不是", "没有", "一下", "可以", "需要", "觉得", "时候", "真的", "那个时候", "今天",
    "明天", "昨天", "现在", "你", "我", "他", "她", "它", "and", "the", "with", "for", "that", "this", "from", "have",
}
TOKEN_PATTERN = re.compile(r"[A-Za-z][A-Za-z0-9_\-]{1,}|[\u4e00-\u9fff]{2,6}")


LEXICONS = {
    "care": ["早点睡", "记得吃", "辛苦", "别怕", "抱抱", "休息", "照顾", "没事", "平安", "慢慢来"],
    "decision": ["先", "应该", "最好", "可以", "不要", "必须", "我来", "先看", "先做", "先别"],
    "humor": ["哈哈", "笑死", "离谱", "好家伙", "行吧", "懂了", "救命", "有点东西"],
    "repair": ["对不起", "抱歉", "别生气", "算了", "没关系", "和好", "理解", "我知道"],
    "conflict": ["为什么", "不行", "别", "烦", "算了", "生气", "受不了", "崩溃"],
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def require_dateutil() -> None:
    if date_parser is None:
        raise RuntimeError("缺少依赖 python-dateutil，请先执行 pip install -r requirements.txt")


def read_json_document(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def first_non_empty(*values: Any) -> Optional[Any]:
    for value in values:
        if value not in (None, "", [], {}, ()):  # type: ignore[comparison-overlap]
            return value
    return None


def ensure_string_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        stripped = value.strip()
        return [stripped] if stripped else []
    if isinstance(value, list):
        items: List[str] = []
        for item in value:
            items.extend(ensure_string_list(item))
        return items
    if isinstance(value, dict):
        return [json.dumps(value, ensure_ascii=False, sort_keys=True)]
    return [str(value)]


def slugify(value: str) -> str:
    cleaned = re.sub(r"\s+", "-", value.strip())
    cleaned = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff._-]+", "-", cleaned)
    cleaned = re.sub(r"-+", "-", cleaned).strip("-._")
    return cleaned or "relic"


def normalize_timestamp(value: Any) -> Tuple[Optional[int], Optional[str]]:
    if value is None:
        return None, None
    if isinstance(value, (int, float)):
        raw = int(value)
    else:
        text = str(value).strip()
        if not text:
            return None, None
        if text.isdigit() or (text.startswith("-") and text[1:].isdigit()):
            raw = int(text)
        else:
            require_dateutil()
            try:
                parsed = date_parser.parse(text)
            except (ValueError, OverflowError):
                return None, text
            return int(parsed.timestamp()), parsed.isoformat()
    digits = len(str(abs(raw)))
    if digits >= 16:
        raw //= 1_000_000
    elif digits >= 13:
        raw //= 1_000
    try:
        dt = datetime.fromtimestamp(raw, tz=timezone.utc).astimezone()
    except (OverflowError, OSError, ValueError):
        return None, str(value)
    return raw, dt.isoformat()


def is_message_like(item: Any) -> bool:
    return isinstance(item, dict) and any(key in item for key in ("content", "text", "msg_type", "sender_name", "timestamp", "datetime"))


def is_photo_like(item: Any) -> bool:
    return isinstance(item, dict) and any(key in item for key in ("path", "shot_time", "shot_timestamp", "gps", "device", "width", "height"))


def absorb_data(merged: Dict[str, Any], payload: Any, source_path: Path) -> None:
    if isinstance(payload, list):
        for item in payload:
            absorb_data(merged, item, source_path)
        return

    if not isinstance(payload, dict):
        merged["facts"].append(str(payload))
        return

    if is_message_like(payload):
        merged["messages"].append(payload)
        return
    if is_photo_like(payload):
        merged["photos"].append(payload)
        return

    merged["sources"].append({"path": str(source_path), "keys": sorted(payload.keys())})

    for key in ("messages", "photos", "memories", "facts", "interaction_modes", "tags"):
        value = payload.get(key)
        if isinstance(value, list):
            merged[key].extend(value)

    for key in ("events", "timeline", "notes"):
        value = payload.get(key)
        if value is None:
            continue
        merged["memories"].extend(value if isinstance(value, list) else [value])

    dimensions = payload.get("dimensions") or payload.get("distilled_dimensions") or payload.get("traits")
    if isinstance(dimensions, dict):
        for name, value in dimensions.items():
            merged["dimensions"].setdefault(str(name), [])
            merged["dimensions"][str(name)].extend(ensure_string_list(value))

    for meta_key in (
        "subject_name",
        "name",
        "title",
        "summary",
        "description",
        "relationship",
        "authorization",
        "authorization_status",
        "self_name",
        "owner_name",
        "chat_name",
    ):
        value = payload.get(meta_key)
        if value not in (None, "", [], {}):
            merged["meta"].setdefault(meta_key, value)

    source_value = payload.get("source")
    if source_value not in (None, "", [], {}):
        merged["source_info"].append(source_value)


def merge_input_documents(paths: Sequence[Path]) -> Dict[str, Any]:
    merged: Dict[str, Any] = {
        "messages": [],
        "photos": [],
        "memories": [],
        "facts": [],
        "interaction_modes": [],
        "tags": [],
        "dimensions": {},
        "sources": [],
        "source_info": [],
        "meta": {},
    }
    for path in paths:
        absorb_data(merged, read_json_document(path), path)
    return merged


def normalize_messages(messages: Sequence[Any]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for index, item in enumerate(messages, start=1):
        if not isinstance(item, dict):
            continue
        content = str(first_non_empty(item.get("content"), item.get("text"), "")).strip()
        if not content:
            continue
        timestamp, iso_dt = normalize_timestamp(first_non_empty(item.get("timestamp"), item.get("datetime"), item.get("date")))
        normalized.append(
            {
                "id": first_non_empty(item.get("id"), f"m-{index}"),
                "chat_name": first_non_empty(item.get("chat_name"), item.get("chat_id")),
                "sender_name": first_non_empty(item.get("sender_name"), item.get("sender_id"), "未知发送者"),
                "sender_id": item.get("sender_id"),
                "direction": item.get("direction"),
                "msg_type": first_non_empty(item.get("msg_type"), "text"),
                "timestamp": timestamp,
                "datetime": iso_dt,
                "content": content,
            }
        )
    normalized.sort(key=lambda item: (item.get("timestamp") or 0, str(item.get("id") or "")))
    return normalized


def normalize_photos(photos: Sequence[Any]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for item in photos:
        if not isinstance(item, dict):
            continue
        timestamp, iso_dt = normalize_timestamp(first_non_empty(item.get("shot_timestamp"), item.get("shot_time"), item.get("datetime")))
        normalized.append(
            {
                "path": item.get("path"),
                "filename": first_non_empty(item.get("filename"), Path(str(item.get("path"))).name if item.get("path") else None),
                "shot_timestamp": timestamp,
                "shot_time": iso_dt or item.get("shot_time"),
                "gps": item.get("gps") or {},
                "device": item.get("device") or {},
            }
        )
    normalized.sort(key=lambda item: (item.get("shot_timestamp") or 0, str(item.get("filename") or "")))
    return normalized


def extract_keywords(messages: Sequence[Dict[str, Any]], facts: Sequence[Any], extra_texts: Sequence[str], limit: int = 10) -> List[str]:
    counter: Counter[str] = Counter()
    corpus: List[str] = [message.get("content", "") for message in messages]
    corpus.extend(str(item) for item in facts)
    corpus.extend(text for text in extra_texts if text)
    for block in corpus:
        for token in TOKEN_PATTERN.findall(block):
            normalized = token.lower()
            if normalized in STOPWORDS or len(normalized) < 2:
                continue
            counter[token] += 1
    return [token for token, _count in counter.most_common(limit)]


def extract_recurring_phrases(messages: Sequence[Dict[str, Any]], limit: int = 6) -> List[str]:
    counter: Counter[str] = Counter()
    for message in messages:
        content = re.sub(r"\s+", " ", message.get("content", "")).strip()
        if 2 <= len(content) <= 24 and "\n" not in content:
            counter[content] += 1
    return [text for text, count in counter.most_common(limit) if count > 1]


def analyze_signal_counts(messages: Sequence[Dict[str, Any]]) -> Dict[str, int]:
    joined = "\n".join(message.get("content", "") for message in messages)
    results: Dict[str, int] = {}
    for label, keywords in LEXICONS.items():
        results[label] = sum(joined.count(keyword) for keyword in keywords)
    return results


def average_message_length(messages: Sequence[Dict[str, Any]]) -> int:
    lengths = [len(message.get("content", "")) for message in messages if message.get("content")]
    return int(sum(lengths) / len(lengths)) if lengths else 0


def summarize_active_bucket(messages: Sequence[Dict[str, Any]]) -> str:
    if not messages:
        return "缺少足够时间戳，暂时无法判断"
    buckets = Counter()
    for message in messages:
        timestamp = message.get("timestamp")
        if not isinstance(timestamp, int):
            continue
        hour = datetime.fromtimestamp(timestamp).hour
        if 0 <= hour < 5:
            buckets["深夜"] += 1
        elif 5 <= hour < 9:
            buckets["清晨"] += 1
        elif 9 <= hour < 12:
            buckets["上午"] += 1
        elif 12 <= hour < 18:
            buckets["下午"] += 1
        else:
            buckets["晚上"] += 1
    if not buckets:
        return "缺少足够时间戳，暂时无法判断"
    return buckets.most_common(1)[0][0]


def format_time_range(messages: Sequence[Dict[str, Any]], photos: Sequence[Dict[str, Any]]) -> str:
    timestamps: List[int] = []
    for message in messages:
        if isinstance(message.get("timestamp"), int):
            timestamps.append(int(message["timestamp"]))
    for photo in photos:
        if isinstance(photo.get("shot_timestamp"), int):
            timestamps.append(int(photo["shot_timestamp"]))
    if not timestamps:
        return "材料中没有可靠时间范围"
    start = datetime.fromtimestamp(min(timestamps)).strftime("%Y-%m-%d")
    end = datetime.fromtimestamp(max(timestamps)).strftime("%Y-%m-%d")
    return start if start == end else f"{start} ~ {end}"


def collect_participants(messages: Sequence[Dict[str, Any]], limit: int = 6) -> List[Dict[str, Any]]:
    counter: Counter[str] = Counter()
    for message in messages:
        name = str(first_non_empty(message.get("sender_name"), message.get("sender_id"), "未知发送者"))
        counter[name] += 1
    return [{"name": name, "count": count} for name, count in counter.most_common(limit)]


def summarize_devices(photos: Sequence[Dict[str, Any]], limit: int = 4) -> List[str]:
    counter: Counter[str] = Counter()
    for photo in photos:
        device = photo.get("device") or {}
        make = str(device.get("make") or "").strip()
        model = str(device.get("model") or "").strip()
        label = " ".join(part for part in [make, model] if part).strip()
        if label:
            counter[label] += 1
    return [name for name, _count in counter.most_common(limit)]


def summarize_locations(photos: Sequence[Dict[str, Any]], limit: int = 4) -> List[str]:
    labels: List[str] = []
    for photo in photos:
        gps = photo.get("gps") or {}
        lat = gps.get("latitude")
        lon = gps.get("longitude")
        if lat is not None and lon is not None:
            labels.append(f"({lat}, {lon})")
    return labels[:limit]


def join_items(items: Sequence[str], limit: int = 4, fallback: str = "暂无明显特征") -> str:
    cleaned = [str(item).strip() for item in items if str(item).strip()]
    if not cleaned:
        return fallback
    return "、".join(cleaned[:limit])


def pick_representative_messages(messages: Sequence[Dict[str, Any]], limit: int = 6) -> List[Dict[str, Any]]:
    ranked = sorted(messages, key=lambda item: (len(item.get("content", "")), item.get("timestamp") or 0), reverse=True)
    picked: List[Dict[str, Any]] = []
    seen_contents = set()
    for item in ranked:
        content = item.get("content", "").strip()
        if not content or content in seen_contents:
            continue
        picked.append(item)
        seen_contents.add(content)
        if len(picked) >= limit:
            break
    picked.sort(key=lambda item: (item.get("timestamp") or 0, str(item.get("id") or "")))
    return picked


def build_memory_entries(data: Dict[str, Any], messages: Sequence[Dict[str, Any]], photos: Sequence[Dict[str, Any]]) -> List[Dict[str, str]]:
    entries: List[Dict[str, str]] = []
    for index, item in enumerate(data.get("memories", []), start=1):
        if isinstance(item, str) and item.strip():
            entries.append({"title": f"输入记忆 {index}", "when": "未标注时间", "source": "输入 JSON", "body": item.strip()})
        elif isinstance(item, dict):
            title = str(first_non_empty(item.get("title"), item.get("name"), f"输入记忆 {index}"))
            when = str(first_non_empty(item.get("time"), item.get("date"), item.get("datetime"), "未标注时间"))
            body = str(first_non_empty(item.get("content"), item.get("summary"), item.get("description"), json.dumps(item, ensure_ascii=False)))
            entries.append({"title": title, "when": when, "source": "输入 JSON", "body": body})

    for message in pick_representative_messages(messages, limit=5):
        sender = str(message.get("sender_name") or "未知发送者")
        when = str(message.get("datetime") or "未标注时间")
        body = message.get("content", "").strip()
        entries.append({"title": f"来自 {sender} 的高信息量片段", "when": when, "source": "聊天记录", "body": body})

    for photo in photos[:3]:
        filename = str(photo.get("filename") or photo.get("path") or "照片")
        when = str(photo.get("shot_time") or "未标注时间")
        gps = photo.get("gps") or {}
        device = photo.get("device") or {}
        device_label = " ".join(part for part in [str(device.get("make") or "").strip(), str(device.get("model") or "").strip()] if part).strip()
        body_parts = [f"文件：{filename}"]
        if device_label:
            body_parts.append(f"设备：{device_label}")
        if gps.get("latitude") is not None and gps.get("longitude") is not None:
            body_parts.append(f"坐标：({gps.get('latitude')}, {gps.get('longitude')})")
        entries.append({"title": f"照片线索：{filename}", "when": when, "source": "照片 EXIF", "body": "；".join(body_parts)})

    unique_entries: List[Dict[str, str]] = []
    seen = set()
    for entry in entries:
        key = (entry.get("title"), entry.get("when"), entry.get("body"))
        if key in seen:
            continue
        seen.add(key)
        unique_entries.append(entry)
    return unique_entries[:10]


def infer_subject_name(data: Dict[str, Any], messages: Sequence[Dict[str, Any]], slug: str, override_name: Optional[str]) -> str:
    if override_name:
        return override_name
    meta = data.get("meta") or {}
    candidate = first_non_empty(meta.get("subject_name"), meta.get("name"), meta.get("title"), meta.get("chat_name"))
    if candidate:
        return str(candidate)
    if messages:
        chat_name = messages[0].get("chat_name")
        if chat_name:
            return str(chat_name)
        participants = collect_participants(messages, limit=1)
        if participants:
            return str(participants[0]["name"])
    return slug


def infer_relationship(data: Dict[str, Any], template: str, override_relationship: Optional[str]) -> str:
    if override_relationship:
        return override_relationship
    meta = data.get("meta") or {}
    candidate = first_non_empty(meta.get("relationship"), meta.get("description"))
    if candidate:
        return str(candidate)
    defaults = {
        "human": "由资料整理者保存的一位具体人物",
        "pet": "由陪伴者整理的宠物陪伴档案",
        "relationship": "这段关系本身，而不是单独某个人",
        "team-culture": "一个团队在特定阶段形成的协作气味",
        "place": "一个承载记忆与情绪的地点",
        "moment": "一个被时间框住的重要瞬间",
        "public-figure": "基于公开资料整理的方法论对象",
    }
    return defaults.get(template, "由资料整理者保存的纪念对象")


def infer_summary(ctx: Dict[str, Any], override_summary: Optional[str]) -> str:
    if override_summary:
        return override_summary
    meta = ctx.get("meta") or {}
    explicit = first_non_empty(meta.get("summary"), meta.get("description"))
    if explicit:
        return str(explicit)
    parts: List[str] = []
    if ctx["message_count"]:
        parts.append(f"{ctx['message_count']} 条消息")
    if ctx["photo_count"]:
        parts.append(f"{ctx['photo_count']} 张照片")
    if ctx["memory_count"]:
        parts.append(f"{ctx['memory_count']} 个记忆锚点")
    source_text = "、".join(parts) if parts else "已有材料"
    return f"这是一个基于 {source_text} 重构的 {ctx['template_label']} Relic，用来{ctx['summary_goal']}。"


def build_context(data: Dict[str, Any], template: str, slug: str, override_name: Optional[str], override_summary: Optional[str], override_relationship: Optional[str]) -> Dict[str, Any]:
    config = TEMPLATE_CONFIG[template]
    messages = normalize_messages(data.get("messages", []))
    photos = normalize_photos(data.get("photos", []))
    memory_entries = build_memory_entries(data, messages, photos)
    participants = collect_participants(messages)
    keywords = extract_keywords(messages, data.get("facts", []), ensure_string_list((data.get("meta") or {}).get("summary")))
    recurring_phrases = extract_recurring_phrases(messages)
    signal_counts = analyze_signal_counts(messages)
    avg_length = average_message_length(messages)
    active_bucket = summarize_active_bucket(messages)
    subject_name = infer_subject_name(data, messages, slug, override_name)
    relationship = infer_relationship(data, template, override_relationship)
    time_range_text = format_time_range(messages, photos)
    devices = summarize_devices(photos)
    locations = summarize_locations(photos)

    ctx: Dict[str, Any] = {
        "template": template,
        "template_label": config["label"],
        "summary_goal": config["summary_goal"],
        "identity": config["identity"],
        "tone": config["tone"],
        "dimensions": config["dimensions"],
        "interaction_specs": config["interactions"],
        "boundaries": config["boundaries"],
        "slug": slug,
        "subject_name": subject_name,
        "relationship": relationship,
        "messages": messages,
        "photos": photos,
        "participants": participants,
        "keywords": keywords,
        "recurring_phrases": recurring_phrases,
        "signal_counts": signal_counts,
        "average_message_length": avg_length,
        "active_bucket": active_bucket,
        "time_range_text": time_range_text,
        "devices": devices,
        "locations": locations,
        "memory_entries": memory_entries,
        "message_count": len(messages),
        "photo_count": len(photos),
        "memory_count": len(memory_entries),
        "source_count": len(data.get("sources", [])),
        "meta": data.get("meta", {}),
        "source_info": data.get("source_info", []),
        "dimensions_input": data.get("dimensions", {}),
        "facts": [str(item) for item in data.get("facts", [])],
        "tags": [str(item) for item in data.get("tags", [])],
        "interaction_modes_input": [str(item) for item in data.get("interaction_modes", [])],
    }
    ctx["summary"] = infer_summary(ctx, override_summary)
    return ctx


def explicit_dimension_lines(ctx: Dict[str, Any], title: str) -> List[str]:
    values = ctx.get("dimensions_input", {}).get(title, [])
    return [value for value in ensure_string_list(values) if value.strip()]


def build_cognition_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"材料里反复出现的关键词集中在 {join_items(ctx['keywords'], fallback='日常细节')}，说明 {ctx['subject_name']} 常从这些切口组织判断。",
        f"高信息量文本的平均长度约 {ctx['average_message_length']} 字；判断类词信号累计 {ctx['signal_counts'].get('decision', 0)} 次，适合在回答时先抓重点再给结论。",
        f"如果需要模仿思路，优先沿着“先看什么、先处理什么、先安抚什么”的顺序推进，而不是一上来就给笼统鸡汤。",
    ]


def build_expression_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"重复出现的短句或稳定表达包括：{join_items(ctx['recurring_phrases'], fallback='暂无明显重复短句，可从整体语气入手')}。",
        f"现有样本的平均消息长度约 {ctx['average_message_length']} 字，说明表达更接近 {'短句推进' if ctx['average_message_length'] and ctx['average_message_length'] < 40 else '完整展开'} 的节奏。",
        f"在生成对话时，优先保留已有材料里的句式密度、停顿方式和用词颗粒度，而不是统一改写成标准文案。",
    ]


def build_behavior_lines(ctx: Dict[str, Any]) -> List[str]:
    participants = join_items([item['name'] for item in ctx['participants']], fallback='材料中未记录明确参与者')
    return [
        f"主要互动对象包括：{participants}。这能反推 {ctx['subject_name']} 的日常协作/相处半径。",
        f"材料显示更常出现在“{ctx['active_bucket']}”这一时间段，说明 ta 的活跃节奏或被记录节奏更偏向这个时段。",
        f"行为模式的写法建议落在“先回应什么、先做什么、先补位还是先观察”这类顺序感上。",
    ]


def build_emotion_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"关怀类信号词累计 {ctx['signal_counts'].get('care', 0)} 次，修复/道歉类信号词累计 {ctx['signal_counts'].get('repair', 0)} 次，说明材料里保留了一定的情绪接口线索。",
        f"如果要复现情感表达，优先使用材料中已经出现过的安慰方式、嘴硬方式或沉默方式，而不是生造煽情台词。",
        f"遇到没有证据支持的深层情绪时，应该诚实说明“只能从现有片段推测到这里”。",
    ]


def build_habit_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"可用线索显示这只/这些 pet 的高频关键词是 {join_items(ctx['keywords'], fallback='动作与陪伴痕迹')}，可以据此提炼固定偏好与怪癖。",
        f"照片设备或记录材料来源包括：{join_items(ctx['devices'], fallback='暂无明显设备线索')}，说明观察主要来自长期陪伴痕迹。",
        f"书写习性时，优先落在“喜欢待哪里、怎么接近、什么时候最活跃”这些可被观察的动作层面。",
    ]


def build_interaction_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"重复片段和记忆锚点显示，稳定互动线索包括：{join_items(ctx['recurring_phrases'], fallback='更适合从场景动作中提炼互动感')}。",
        f"如果是 pet 或地方类 Relic，互动不必强行变成长段对白，可以用动作、环境反应和简短拟声保持真实感。",
        f"对话时优先复现“靠近方式、回应延迟、观察顺序”，这些往往比说了什么更能让人认出来。",
    ]


def build_rhythm_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"当前样本最活跃的记录时段是 {ctx['active_bucket']}，这为生活节奏或出现场景提供了第一层线索。",
        f"如果同时存在照片与聊天，可以把拍摄时间和互动时间并排看，拆出“什么时候最常被看见/被记住”。",
        f"写作时建议把一天或一个周期拆成几个固定时段，让节奏感比抽象性格更先出来。",
    ]


def build_sensory_lines(ctx: Dict[str, Any]) -> List[str]:
    device_text = join_items(ctx['devices'], fallback='暂无明显设备线索')
    location_text = join_items(ctx['locations'], fallback='没有 GPS 线索也可以从照片/记忆描述入手')
    return [
        f"感官线索可以先从照片设备与记录介质入手：{device_text}。它们往往指向材料被看见、被保存的方式。",
        f"位置或空间线索：{location_text}。如果没有精确坐标，也可以从物件、天气、光线、噪音这些痕迹来重建现场。",
        f"在地方/时刻模板里，优先写“先看到什么、先听到什么、身体先感到什么”，感官顺序比抽象形容更有代入感。",
    ]


def build_event_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"当前可用记忆锚点共有 {ctx['memory_count']} 个，足以支撑“发生过什么”这一层的梳理。",
        f"建议优先使用 memory.md 里的具体片段来构造事件线，而不是只保留总结句。",
        f"如果同一事件有多个来源，应该保留并排视角，而不是过早把它们压成单一版本。",
    ]


def build_atmosphere_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"高频关键词 {join_items(ctx['keywords'], fallback='尚未形成明显主题')} 共同构成了整体氛围的词面纹理。",
        f"活跃时段偏向 {ctx['active_bucket']}，这会显著影响人对某个地方、团队或关系的气压感知。",
        f"氛围写作上建议把秩序感、拥挤感、松弛感、救火感这些“整体气味”落到具体动作上。",
    ]


def build_causality_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"材料时间范围为 {ctx['time_range_text']}，这为“之前如何铺垫、之后如何扩散”提供了基础框架。",
        f"如果需要解释因果，不要直接跳到意义结论，应该先指出哪个片段是触发点、哪个片段是后续反应。",
        f"对于缺少连续材料的部分，应明确写成“现有证据只能支持到这里”。",
    ]


def build_meaning_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"这个 Relic 的核心用途是：{ctx['summary_goal']}。意义层最好围绕“为什么这份材料值得被留下”来展开。",
        f"可用标签包括：{join_items(ctx['tags'], fallback='暂无额外标签，可从 summary 和记忆锚点提炼')}。",
        f"意义解读最好同时保留当时的视角和事后回看的视角，避免把复杂经历压成一句空泛结论。",
    ]


def build_communication_lines(ctx: Dict[str, Any]) -> List[str]:
    participants = join_items([item['name'] for item in ctx['participants']], fallback='材料中未记录明确参与者')
    return [
        f"主要参与者包括：{participants}，这能帮助识别谁更常开口、谁负责接住、谁负责把话题推回正轨。",
        f"重复出现的表达有：{join_items(ctx['recurring_phrases'], fallback='暂无明显暗号，可从对话节奏提炼')}。这通常就是沟通模式的入口。",
        f"如果要复现沟通感，请保留回复颗粒度、插话方式和收尾习惯，而不是只保留信息点。",
    ]


def build_conflict_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"冲突类信号词累计 {ctx['signal_counts'].get('conflict', 0)} 次，修复类信号词累计 {ctx['signal_counts'].get('repair', 0)} 次，可以据此判断拉扯与和好机制。",
        f"真正有辨识度的冲突模式，通常不是“会不会吵”，而是“吵起来之后谁先解释、谁先沉默、谁先递台阶”。",
        f"生成这部分内容时，应该优先使用已有片段的语气与顺序，不轻易替当事人补充动机。",
    ]


def build_intimacy_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"亲密感通常体现在重复短句、固定照顾方式、顺手补位与专属梗上；当前材料中可用的短句包括：{join_items(ctx['recurring_phrases'], fallback='暂无稳定短句，可从记忆片段里提炼')}。",
        f"关怀类信号词累计 {ctx['signal_counts'].get('care', 0)} 次，说明关系材料里保留了一定的靠近方式。",
        f"这部分建议写“怎么表达亲近”，而不是只写“关系很好/很亲”。",
    ]


def build_growth_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"时间范围 {ctx['time_range_text']} 为关系或团队变化提供了时间骨架。",
        f"memory.md 里的锚点可以按“开始 / 稳定 / 转折 / 后续”重排，帮助看见角色与边界如何变化。",
        f"成长轨迹不要求线性变好，能看见变化方向与代价就已经足够有辨识度。",
    ]


def build_decision_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"判断类词信号累计 {ctx['signal_counts'].get('decision', 0)} 次，说明现有材料里有一定的拍板或取舍痕迹。",
        f"高频主题 {join_items(ctx['keywords'], fallback='暂无稳定主题')} 可以帮助推断“面对问题先看什么变量”。",
        f"在公众人物/团队模板里，优先写“如何取舍”，比写“最终选了什么”更有可迁移性。",
    ]


def build_value_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"summary 与关键词共同指向的核心目标是：{ctx['summary_goal']}。价值体系部分可以围绕“什么被优先保护、什么愿意为之付代价”来写。",
        f"如果输入 JSON 已额外提供 facts/tags，建议把这些内容视作价值判断的证据索引，而不是单独的装饰信息。",
        f"对没有明确证据支持的价值判断，要写成倾向而不是绝对定义。",
    ]


def build_ritual_lines(ctx: Dict[str, Any]) -> List[str]:
    return [
        f"重复短句和固定锚点最适合提炼仪式感；当前可用片段包括：{join_items(ctx['recurring_phrases'], fallback='暂无明显固定台词，可从记忆锚点寻找仪式动作')}。",
        f"仪式不一定是庆典，也可能是每天群里第一句、固定买咖啡的人、回家第一声招呼。",
        f"写这部分时应把老梗放回上下文，让读者知道它为什么会被反复提起。",
    ]


def build_dimension_lines(kind: str, ctx: Dict[str, Any]) -> List[str]:
    builders = {
        "cognition": build_cognition_lines,
        "expression": build_expression_lines,
        "behavior": build_behavior_lines,
        "emotion": build_emotion_lines,
        "habit": build_habit_lines,
        "interaction": build_interaction_lines,
        "rhythm": build_rhythm_lines,
        "sensory": build_sensory_lines,
        "event": build_event_lines,
        "atmosphere": build_atmosphere_lines,
        "causality": build_causality_lines,
        "meaning": build_meaning_lines,
        "communication": build_communication_lines,
        "conflict": build_conflict_lines,
        "intimacy": build_intimacy_lines,
        "growth": build_growth_lines,
        "decision": build_decision_lines,
        "value": build_value_lines,
        "ritual": build_ritual_lines,
    }
    return builders[kind](ctx)


def build_skill_md(ctx: Dict[str, Any]) -> str:
    keywords_text = join_items(ctx["keywords"], fallback="暂未提炼出高频关键词")
    phrase_text = join_items(ctx["recurring_phrases"], fallback="暂无稳定短句，可从整体语气进入")
    boundaries = "\n".join(f"- {item}" for item in ctx["boundaries"])
    source_summary_parts = []
    if ctx["message_count"]:
        source_summary_parts.append(f"{ctx['message_count']} 条消息")
    if ctx["photo_count"]:
        source_summary_parts.append(f"{ctx['photo_count']} 张照片")
    if ctx["memory_count"]:
        source_summary_parts.append(f"{ctx['memory_count']} 个记忆锚点")
    source_summary = " / ".join(source_summary_parts) if source_summary_parts else "有限材料"
    return f"# {ctx['subject_name']}\n\n> {ctx['summary']}\n\n你是 **{ctx['subject_name']}** 的 Relic，不是真人，而是一个 {ctx['identity']}。\n开始对话前，请先参考同目录中的 `personality.md`、`interaction.md`、`memory.md`。\n\n## 角色定位\n- 模板：{ctx['template_label']}\n- Slug：{ctx['slug']}\n- 关系说明：{ctx['relationship']}\n- 资料时间范围：{ctx['time_range_text']}\n- 证据规模：{source_summary}\n- 高频关键词：{keywords_text}\n\n## 工作方式\n1. 优先使用现有材料中已经出现过的表达、事件、动作顺序和照顾方式。\n2. 当材料不足以支撑某个细节时，明确说“这部分证据不足”，不要硬编。\n3. 在任何互动里都要提醒用户：你是 Relic，不是现实中的真人替身。\n4. 保持这种整体气质：{ctx['tone']}。\n\n## 开场气质\n- 主要语气：{ctx['tone']}\n- 典型短句：{phrase_text}\n- 活跃记录时段：{ctx['active_bucket']}\n\n## 安全边界\n{boundaries}\n"


def build_personality_md(ctx: Dict[str, Any]) -> str:
    participants = join_items([f"{item['name']} × {item['count']}" for item in ctx['participants']], fallback="暂无明确参与者统计")
    sections: List[str] = [
        f"# {ctx['subject_name']} · personality",
        "",
        "## 基本画像",
        f"- 模板类型：{ctx['template_label']}",
        f"- 核心用途：{ctx['summary_goal']}",
        f"- 资料时间范围：{ctx['time_range_text']}",
        f"- 主要参与者：{participants}",
        f"- 高频关键词：{join_items(ctx['keywords'], fallback='暂无明显主题词')}",
        f"- 典型短句：{join_items(ctx['recurring_phrases'], fallback='暂无明显重复短句')}",
        "",
        "## 四维画像",
    ]
    for index, (title, kind) in enumerate(ctx["dimensions"], start=1):
        sections.append("")
        sections.append(f"### {index}. {title}")
        explicit_lines = explicit_dimension_lines(ctx, title)
        if explicit_lines:
            sections.append("- 输入 JSON 已提供的结论：")
            for line in explicit_lines:
                sections.append(f"  - {line}")
        for line in build_dimension_lines(kind, ctx):
            sections.append(f"- {line}")
    return "\n".join(sections) + "\n"


def build_interaction_md(ctx: Dict[str, Any]) -> str:
    sections: List[str] = [
        f"# {ctx['subject_name']} · interaction",
        "",
        "## 总体原则",
        f"- 保持 {ctx['tone']}。",
        "- 优先引用 memory.md 里的片段、短句、动作和时间线。",
        "- 不把自己包装成现实替身；当用户要求冒充、监控、施压时直接拒绝。",
        f"- 当证据不足时，用“根据现有材料，我更接近……”这样的方式表达不确定性。",
        "",
        "## 互动模式",
    ]
    for index, spec in enumerate(ctx["interaction_specs"], start=1):
        title, description = spec
        sections.extend(
            [
                "",
                f"### {index}. {title}",
                f"- 适用场景：{description}",
                f"- 回应原则：优先围绕 {join_items(ctx['keywords'], fallback='已有记忆锚点')} 这些线索组织回答。",
                f"- 语气锚点：{join_items(ctx['recurring_phrases'], fallback='没有固定台词时，保留整体节奏与用词颗粒度')}。",
                f"- 开场建议：先承认自己是 Relic，再用贴近材料的方式接住用户。",
            ]
        )
    if ctx["interaction_modes_input"]:
        sections.extend(["", "## 输入 JSON 提供的额外交互偏好"])
        for item in ctx["interaction_modes_input"]:
            sections.append(f"- {item}")
    return "\n".join(sections) + "\n"


def build_memory_md(ctx: Dict[str, Any]) -> str:
    sections: List[str] = [
        f"# {ctx['subject_name']} · memory",
        "",
        "## 记忆锚点",
    ]
    for index, entry in enumerate(ctx["memory_entries"], start=1):
        sections.extend(
            [
                "",
                f"### {index}. {entry['title']}",
                f"- 时间：{entry['when']}",
                f"- 来源：{entry['source']}",
                f"- 内容：{entry['body']}",
            ]
        )
    if ctx["facts"]:
        sections.extend(["", "## 额外事实索引"])
        for item in ctx["facts"][:10]:
            sections.append(f"- {item}")
    return "\n".join(sections) + "\n"


def default_holiday_list(template: str) -> List[str]:
    if template == "human":
        return ["spring_festival", "mid_autumn", "new_year"]
    if template == "relationship":
        return ["mid_autumn", "new_year"]
    if template == "team-culture":
        return ["new_year"]
    return []


def default_random_interval_days(template: str) -> int:
    if template == "pet":
        return 10
    if template in {"team-culture", "place", "moment"}:
        return 21
    if template == "public-figure":
        return 30
    return 14


def build_default_proactive_config(ctx: Dict[str, Any]) -> Dict[str, Any]:
    template = str(ctx["template"])
    holiday_list = default_holiday_list(template)
    random_enabled = template != "public-figure"
    anniversaries_enabled = False
    anniversary_dates: List[Dict[str, Any]] = []

    return {
        "enabled": True,
        "user_city": None,
        "holidays": {
            "enabled": bool(holiday_list),
            "list": holiday_list,
        },
        "anniversaries": {
            "enabled": anniversaries_enabled,
            "dates": anniversary_dates,
        },
        "weather": {
            "enabled": False,
        },
        "random_miss": {
            "enabled": random_enabled,
            "min_interval_days": default_random_interval_days(template),
        },
        "quiet_hours": {
            "start": "23:00",
            "end": "07:00",
        },
        "global_max_per_week": 2 if template not in {"place", "moment"} else 1,
    }


def build_manifest(ctx: Dict[str, Any], data_files: Sequence[Path], output_dir: Path) -> Dict[str, Any]:
    generated_at = now_iso()
    template = str(ctx["template"])
    canonical_kind = "team" if template == "team-culture" else template

    core_drives: List[str] = []
    for item in [*ctx["keywords"], *ctx["recurring_phrases"], *ctx["facts"]]:
        text = str(item).strip()
        if text and text not in core_drives:
            core_drives.append(text)
    core_drives = core_drives or [ctx["summary"]]

    care_priorities = [str(item).strip() for item in ctx["keywords"] if str(item).strip()]
    if template in {"human", "relationship"}:
        channel_style = "wechat-family-chat"
    elif template in {"team-culture", "public-figure", "expert", "feishu-cli"}:
        channel_style = "professional-chat"
    else:
        channel_style = "casual"

    relationship_text = str(ctx["relationship"])
    relationship_lower = relationship_text.lower()
    intimate_markers = ("奶奶", "爷爷", "外婆", "外公", "妈妈", "爸爸", "爱人", "伴侣", "老公", "老婆", "对象", "grandma", "grandpa", "mom", "dad", "wife", "husband", "partner")

    if canonical_kind == "team":
        identity_status = "team"
        distance = "professional"
    elif canonical_kind == "place":
        identity_status = "place"
        distance = "close"
    elif canonical_kind in {"relationship", "moment"}:
        identity_status = "fictional"
        distance = "intimate" if canonical_kind == "relationship" else "close"
    elif canonical_kind == "public-figure":
        identity_status = "living"
        distance = "public"
    elif canonical_kind in {"expert", "feishu-cli"}:
        identity_status = "living"
        distance = "professional"
    elif canonical_kind == "pet" or any(marker.lower() in relationship_lower for marker in intimate_markers):
        identity_status = "living"
        distance = "intimate"
    else:
        identity_status = "living"
        distance = "close"

    legacy_manifest = {
        "schema_version": "1.4.0",
        "generated_at": generated_at,
        "generated_by": "scripts/relic_writer.py",
        "created_at": generated_at,
        "id": ctx["slug"],
        "kind": canonical_kind,
        "slug": ctx["slug"],
        "display_name": ctx["subject_name"],
        "relic_type": template,
        "language": "zh-CN",
        "locale": "zh-CN",
        "version": PROJECT_VERSION,
        "identity": {
            "name": ctx["subject_name"],
            "status": identity_status,
            "summary": ctx["summary"],
            "core_drives": core_drives,
            "attributes": {
                "template_label": ctx["template_label"],
                "time_range": ctx["time_range_text"],
            },
        },
        "relationship": {
            "default_relation_to_user": ctx["relationship"],
            "distance": distance,
            "care_priorities": care_priorities,
            "repair_style": "",
        },
        "conversation": {
            "default_language": "zh-CN",
            "default_mode": "daily",
            "speech_style": {
                "channel_style": channel_style,
                "message_shape": "mixed",
                "voice_prefix": "",
                "dialect_hint": "",
                "emoji_style": "none" if channel_style == "professional-chat" else "occasional",
            },
            "instinct_order": (
                ["attune", "care", "recall", "reassure"]
                if template in {"human", "pet", "relationship"}
                else ["clarify", "organize", "guide", "ground"]
            ),
            "disclosure_policy": {
                "identity": "必须明确说明这是 Relic，不是真人在线。",
                "evidence": "证据不足时直接说明，不要硬编细节。",
                "boundaries": "；".join(ctx["boundaries"]),
            },
        },
        "compliance": {
            "consent": {
                "protocol": "six-question-consent-v1",
                "authorization_level": "B",
                "use_scope": "personal",
                "commercial_use": False,
            },
            "is_relic_not_real_person": True,
        },
        "subject": {
            "name": ctx["subject_name"],
            "relation_to_user": ctx["relationship"],
            "status": identity_status,
            "description": ctx["summary"],
            "core_traits": core_drives,
            "locale": "zh-CN",
            "interaction_profile": {
                "default_mode": "daily",
                "default_channel": channel_style,
                "message_shape": "mixed",
                "primary_care_topics": care_priorities,
            },
        },
        "title": ctx["subject_name"],
        "template": template,
        "template_label": ctx["template_label"],
        "template_file": f"templates/{ctx['template']}.md",
        "summary": ctx["summary"],
        "time_range": ctx["time_range_text"],
        "output_dir": str(output_dir),
        "source_files": [str(path) for path in data_files],
        "source_count": ctx["source_count"],
        "evidence": {
            "message_count": ctx["message_count"],
            "photo_count": ctx["photo_count"],
            "memory_count": ctx["memory_count"],
            "participants": ctx["participants"],
            "keywords": ctx["keywords"],
            "recurring_phrases": ctx["recurring_phrases"],
            "signal_counts": ctx["signal_counts"],
            "devices": ctx["devices"],
            "locations": ctx["locations"],
        },
        "evidence_stats": {
            "verbatim": ctx["message_count"],
            "artifact": ctx["photo_count"],
            "impression": ctx["memory_count"],
        },
        "consent": {
            "protocol": "six-question-consent-v1",
            "authorization_level": "B",
            "use_scope": "personal",
            "commercial_use": False,
        },
        "safety": {
            "is_relic_not_real_person": True,
            "boundaries": ctx["boundaries"],
        },
        "files": [
            "SKILL.md",
            "personality.md",
            "interaction.md",
            "memory.md",
            DEFAULT_PROACTIVE_CONFIG_FILENAME,
            "manifest.json",
        ],
    }
    return migrate_manifest(legacy_manifest)


def write_relic_folder(ctx: Dict[str, Any], data_files: Sequence[Path], output_root: Path, force: bool) -> Path:
    relic_dir = output_root / ctx["slug"]
    if relic_dir.exists() and any(relic_dir.iterdir()) and not force:
        raise FileExistsError(f"目标目录已存在且非空：{relic_dir}；如需覆盖请使用 --force")
    relic_dir.mkdir(parents=True, exist_ok=True)

    write_text(relic_dir / "SKILL.md", build_skill_md(ctx))
    write_text(relic_dir / "personality.md", build_personality_md(ctx))
    write_text(relic_dir / "interaction.md", build_interaction_md(ctx))
    write_text(relic_dir / "memory.md", build_memory_md(ctx))
    write_json(relic_dir / DEFAULT_PROACTIVE_CONFIG_FILENAME, build_default_proactive_config(ctx))
    write_json(relic_dir / "manifest.json", build_manifest(ctx, data_files, relic_dir))
    return relic_dir


def create_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="根据蒸馏数据 JSON 和模板类型生成 Relic 文件夹")
    parser.add_argument("--data", required=True, nargs="+", help="一个或多个输入 JSON 文件")
    parser.add_argument("--template", required=True, choices=sorted(TEMPLATE_CONFIG.keys()), help="模板类型")
    parser.add_argument("--slug", required=True, help="输出目录 slug")
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR, help="Relic 输出根目录，默认 exes")
    parser.add_argument("--name", help="手动指定 Relic 名称")
    parser.add_argument("--summary", help="手动指定一句话摘要")
    parser.add_argument("--relationship", help="手动指定关系说明")
    parser.add_argument("--force", action="store_true", help="允许覆盖已存在的非空目录")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

    parser = create_argument_parser()
    args = parser.parse_args(argv)

    data_files = [Path(item).expanduser().resolve() for item in args.data]
    output_root = Path(args.output_dir).expanduser().resolve()
    slug = slugify(args.slug)

    try:
        for path in data_files:
            if not path.is_file():
                raise FileNotFoundError(f"输入 JSON 不存在：{path}")
        merged = merge_input_documents(data_files)
        ctx = build_context(merged, args.template, slug, args.name, args.summary, args.relationship)
        relic_dir = write_relic_folder(ctx, data_files, output_root, args.force)
        print(f"已生成 Relic 文件夹：{relic_dir}")
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
