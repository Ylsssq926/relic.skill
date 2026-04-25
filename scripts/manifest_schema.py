"""Canonical manifest helpers for relic.skill v1.4.0.

This module defines the canonical manifest dataclasses used by relic.skill and
provides small migration utilities so older handwritten examples and
`relic_writer.py` generated manifests can be normalized into one shared shape.

Design goals:
- Keep the canonical data model explicit via dataclasses.
- Accept legacy manifests without crashing.
- Preserve older compatibility fields when migrating dictionary payloads.
- Return validation errors as a list instead of raising schema exceptions.
"""
from __future__ import annotations

import copy
import json
import re
from dataclasses import asdict, dataclass, field, is_dataclass
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence, Union

CANONICAL_SCHEMA_VERSION = "1.4.0"
VALID_KINDS = {
    "human",
    "pet",
    "relationship",
    "team",
    "place",
    "moment",
    "expert",
    "feishu-cli",
    "public-figure",  # legacy-compatible special case
}
VALID_STATUSES = {"living", "memorial", "fictional", "team", "place"}
VALID_DISTANCES = {"intimate", "close", "professional", "public"}
VALID_CHANNEL_STYLES = {"wechat-family-chat", "professional-chat", "casual"}
VALID_MESSAGE_SHAPES = {"split_short_messages", "single_paragraph", "mixed"}
VALID_EMOJI_STYLES = {"none", "occasional", "frequent"}

_FAMILY_RELATION_HINTS = (
    "奶奶",
    "爷爷",
    "外婆",
    "外公",
    "妈妈",
    "母亲",
    "爸爸",
    "父亲",
    "哥哥",
    "姐姐",
    "弟弟",
    "妹妹",
    "家人",
    "老婆",
    "老公",
    "爱人",
    "伴侣",
    "恋人",
    "对象",
    "宝宝",
    "宝贝",
    "亲人",
    "mom",
    "dad",
    "grandma",
    "grandpa",
    "wife",
    "husband",
    "partner",
)
_CLOSE_RELATION_HINTS = (
    "朋友",
    "闺蜜",
    "兄弟",
    "同学",
    "室友",
    "搭子",
    "好友",
    "friend",
    "buddy",
)
_PROFESSIONAL_HINTS = (
    "同事",
    "老板",
    "上司",
    "下属",
    "导师",
    "老师",
    "客户",
    "团队",
    "工作室",
    "专家",
    "mentor",
    "coach",
    "colleague",
    "coworker",
    "manager",
    "team",
    "studio",
)
_PUBLIC_HINTS = (
    "公众",
    "公开",
    "名人",
    "人物",
    "public",
    "figure",
)


@dataclass
class RelicIdentity:
    """Stable identity information for a Relic."""

    name: str
    status: str
    summary: str
    core_drives: List[str]
    contradictions: List[str] = field(default_factory=list)
    attributes: Dict[str, str] = field(default_factory=dict)


@dataclass
class RelicRelationship:
    """How the Relic relates to the user by default."""

    default_relation_to_user: str
    distance: str
    care_priorities: List[str] = field(default_factory=list)
    repair_style: str = ""


@dataclass
class SpeechStyle:
    """Speech rendering defaults for a conversation channel.

    Defaults are intentionally conservative so the class can safely be used in a
    `field(default_factory=SpeechStyle)` context.
    """

    channel_style: str = "casual"
    message_shape: str = "mixed"
    voice_prefix: str = ""
    dialect_hint: str = ""
    emoji_style: str = "occasional"


@dataclass
class ConversationConfig:
    """Conversation defaults for a Relic runtime."""

    default_language: str = "zh-CN"
    default_mode: str = "daily"
    speech_style: SpeechStyle = field(default_factory=SpeechStyle)
    instinct_order: List[str] = field(default_factory=list)
    disclosure_policy: Dict[str, str] = field(default_factory=dict)


@dataclass
class TTSConfig:
    """Text-to-speech configuration."""

    enabled: bool = False
    provider: str = ""
    voice_id: str = ""
    emotion_mapping: Dict[str, str] = field(default_factory=dict)


@dataclass
class ImageConfig:
    """Image generation configuration."""

    enabled: bool = False
    provider: str = ""
    style: str = "soft_illustration"
    avatar_prompt: str = ""


@dataclass
class MediaConfig:
    """Optional media configuration."""

    tts: TTSConfig = field(default_factory=TTSConfig)
    image: ImageConfig = field(default_factory=ImageConfig)


@dataclass
class ProactiveConfig:
    """Proactive messaging defaults."""

    enabled: bool = False
    timezone: str = "Asia/Shanghai"
    quiet_hours_start: str = "23:00"
    quiet_hours_end: str = "07:00"
    max_per_week: int = 2
    holidays: List[str] = field(default_factory=list)
    anniversaries: List[Dict[str, str]] = field(default_factory=list)


@dataclass
class AutomationConfig:
    """Automation-related configuration."""

    proactive: ProactiveConfig = field(default_factory=ProactiveConfig)


@dataclass
class ConsentConfig:
    """Consent and authorization configuration."""

    protocol: str = "six-question-consent-v1"
    authorization_level: str = "B"
    use_scope: str = "personal"
    commercial_use: bool = False


@dataclass
class ComplianceConfig:
    """Compliance and reality-boundary configuration."""

    consent: ConsentConfig = field(default_factory=ConsentConfig)
    is_relic_not_real_person: bool = True


@dataclass
class RelicManifest:
    """Canonical relic.skill manifest schema.

    The canonical schema is intentionally small and stable. Legacy or product-
    specific compatibility fields should stay in the serialized dictionary layer,
    while this dataclass captures the normalized core shape used by new code.
    """

    schema_version: str
    id: str
    kind: str
    display_name: str
    identity: RelicIdentity
    relationship: RelicRelationship
    conversation: ConversationConfig
    media: MediaConfig = field(default_factory=MediaConfig)
    automation: AutomationConfig = field(default_factory=AutomationConfig)
    compliance: ComplianceConfig = field(default_factory=ComplianceConfig)
    locale: str = "zh-CN"
    generated_by: str = ""
    created_at: str = ""


def _first_text(*values: Any) -> str:
    """Return the first non-empty string-like value."""

    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _ensure_mapping(value: Any) -> Dict[str, Any]:
    """Return a shallow dict copy when *value* is a mapping."""

    if isinstance(value, Mapping):
        return dict(value)
    return {}


def _ensure_string_list(value: Any) -> List[str]:
    """Normalize arbitrary input into a clean string list."""

    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        items = list(value)
    else:
        items = [value]
    cleaned: List[str] = []
    for item in items:
        text = _first_text(item)
        if text:
            cleaned.append(text)
    return cleaned


def _dedupe_strings(values: Sequence[str]) -> List[str]:
    """Deduplicate strings while preserving order."""

    seen = set()
    deduped: List[str] = []
    for value in values:
        text = _first_text(value)
        if not text or text in seen:
            continue
        seen.add(text)
        deduped.append(text)
    return deduped


def _merge_string_lists(*values: Any, limit: Optional[int] = None) -> List[str]:
    """Merge several list-like values into one deduplicated string list."""

    merged: List[str] = []
    for value in values:
        merged.extend(_ensure_string_list(value))
    deduped = _dedupe_strings(merged)
    if limit is not None:
        return deduped[:limit]
    return deduped


def _stringify_mapping(value: Any) -> Dict[str, str]:
    """Convert a mapping to `Dict[str, str]`, dropping empty values."""

    if not isinstance(value, Mapping):
        return {}
    result: Dict[str, str] = {}
    for key, item in value.items():
        key_text = _first_text(key)
        item_text = _first_text(item)
        if key_text and item_text:
            result[key_text] = item_text
    return result


def _coerce_bool(value: Any, default: bool = False) -> bool:
    """Convert loose boolean-like values to `bool`."""

    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y", "on"}:
        return True
    if text in {"0", "false", "no", "n", "off"}:
        return False
    return default


def _coerce_int(value: Any, default: int = 0) -> int:
    """Convert a loose number-like value to `int`."""

    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    text = _first_text(value)
    if not text:
        return default
    try:
        return int(float(text))
    except (TypeError, ValueError):
        return default


def _slugify(value: str) -> str:
    """Generate a conservative slug fallback from arbitrary text."""

    text = _first_text(value).lower()
    if not text:
        return "relic"
    slug = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", text)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "relic"


def _normalize_kind(value: Any) -> str:
    """Normalize legacy kind aliases into canonical values when possible."""

    kind = _first_text(value).lower()
    if not kind:
        return "human"
    aliases = {
        "team-culture": "team",
        "team_culture": "team",
        "team": "team",
        "human": "human",
        "pet": "pet",
        "relationship": "relationship",
        "place": "place",
        "moment": "moment",
        "expert": "expert",
        "feishu-cli": "feishu-cli",
        "feishu_cli": "feishu-cli",
        "public-figure": "public-figure",
        "public_figure": "public-figure",
    }
    return aliases.get(kind, kind)


def _default_status_for_kind(kind: str) -> str:
    """Return a safe default identity status for a kind."""

    if kind == "team":
        return "team"
    if kind == "place":
        return "place"
    if kind in {"relationship", "moment"}:
        return "fictional"
    return "living"


def _normalize_status(value: Any, kind: str, subject: Mapping[str, Any]) -> str:
    """Normalize a legacy status string into the canonical status vocabulary."""

    status = _first_text(value).lower()
    if status in VALID_STATUSES:
        return status
    if _first_text(subject.get("deceased_year")) or _first_text(subject.get("age_at_death")):
        return "memorial"
    if status in {"deceased", "passed", "passed-away", "rip", "in-memory"}:
        return "memorial"
    return _default_status_for_kind(kind)


def _default_relation_for_kind(kind: str, display_name: str) -> str:
    """Infer a conservative default relation text."""

    defaults = {
        "human": f"与 {display_name} 对话的用户",
        "pet": "陪伴这只宠物的人",
        "relationship": "这段关系中的一方参与者",
        "team": "与这个团队共同工作或相处的人",
        "place": "对这个地方有记忆的人",
        "moment": "和这个时刻有关的人",
        "expert": "向这位专家请教的人",
        "feishu-cli": "通过飞书流程与 Relic 互动的人",
        "public-figure": "关注这位公众人物的人",
    }
    return defaults.get(kind, f"与 {display_name} 互动的用户")


def _infer_distance(explicit: Any, relation: str, kind: str) -> str:
    """Infer the relationship distance bucket."""

    distance = _first_text(explicit).lower()
    if distance in VALID_DISTANCES:
        return distance
    corpus = f"{relation} {kind}".lower()
    if kind in {"expert", "feishu-cli", "public-figure"}:
        return "public" if kind == "public-figure" else "professional"
    if kind == "team":
        return "professional"
    if any(token.lower() in corpus for token in _FAMILY_RELATION_HINTS):
        return "intimate"
    if any(token.lower() in corpus for token in _CLOSE_RELATION_HINTS):
        return "close"
    if any(token.lower() in corpus for token in _PROFESSIONAL_HINTS):
        return "professional"
    if any(token.lower() in corpus for token in _PUBLIC_HINTS):
        return "public"
    if kind in {"relationship", "pet", "place", "moment"}:
        return "close"
    return "close"


def _normalize_channel_style(explicit: Any, kind: str) -> str:
    """Normalize legacy channel descriptors into canonical styles."""

    text = _first_text(explicit).lower()
    if text in VALID_CHANNEL_STYLES:
        return text
    if any(token in text for token in ("wechat", "微信")):
        return "wechat-family-chat"
    if any(token in text for token in ("feishu", "飞书", "professional", "work", "team", "slack")):
        return "professional-chat"
    if kind in {"team", "expert", "feishu-cli", "public-figure"}:
        return "professional-chat"
    return "casual"


def _normalize_message_shape(explicit: Any, channel_style: str) -> str:
    """Normalize legacy message-shape descriptors."""

    text = _first_text(explicit).lower()
    mapping = {
        "multiple-short-messages": "split_short_messages",
        "split_short_messages": "split_short_messages",
        "single_paragraph": "single_paragraph",
        "single-paragraph": "single_paragraph",
        "mixed": "mixed",
    }
    if text in mapping:
        return mapping[text]
    if channel_style == "wechat-family-chat":
        return "split_short_messages"
    return "mixed"


def _normalize_emoji_style(explicit: Any, emoji_misuse: Any, channel_style: str) -> str:
    """Normalize emoji frequency hints."""

    text = _first_text(explicit).lower()
    if text in VALID_EMOJI_STYLES:
        return text
    if isinstance(emoji_misuse, bool):
        return "occasional" if emoji_misuse else "none"
    if channel_style == "professional-chat":
        return "none"
    return "occasional"


def _default_instinct_order(kind: str, care_priorities: Sequence[str]) -> List[str]:
    """Return a lightweight default instinct ordering."""

    if kind in {"human", "pet", "relationship"}:
        base = ["attune", "care", "recall", "reassure"]
    elif kind in {"team", "expert", "feishu-cli", "public-figure"}:
        base = ["clarify", "organize", "guide", "ground"]
    else:
        base = ["evoke", "anchor", "explain"]
    if care_priorities:
        return base + [f"focus:{item}" for item in care_priorities[:2]]
    return base


def _default_disclosure_policy() -> Dict[str, str]:
    """Return the minimum disclosure policy for all migrated manifests."""

    return {
        "identity": "必须明确说明这是 Relic，是记忆载体，不是真人在线。",
        "evidence": "当证据不足时要直接说明，不要硬编细节。",
    }


def _safety_boundaries_from_policy(policy: Mapping[str, str]) -> List[str]:
    """Convert disclosure policy text back into a legacy safety boundary list."""

    return [value for value in policy.values() if _first_text(value)]


def _normalize_holidays(value: Any) -> List[str]:
    """Normalize proactive holiday configuration."""

    if isinstance(value, Mapping):
        if isinstance(value.get("list"), (list, tuple, set)):
            return _ensure_string_list(value.get("list"))
        if _coerce_bool(value.get("enabled"), default=False):
            return _ensure_string_list(value.get("holidays"))
        return []
    return _ensure_string_list(value)


def _normalize_anniversaries(value: Any) -> List[Dict[str, str]]:
    """Normalize anniversary items into `List[Dict[str, str]]`."""

    raw_items: List[Any]
    if isinstance(value, Mapping):
        raw_items = list(value.get("dates") or [])
    elif isinstance(value, (list, tuple, set)):
        raw_items = list(value)
    else:
        raw_items = []

    normalized: List[Dict[str, str]] = []
    for item in raw_items:
        if isinstance(item, Mapping):
            payload = _stringify_mapping(item)
            if payload:
                normalized.append(payload)
        else:
            text = _first_text(item)
            if text:
                normalized.append({"date": text})
    return normalized


def _normalize_tts(value: Any) -> Dict[str, Any]:
    """Normalize legacy or canonical TTS config into canonical dict form."""

    raw = _ensure_mapping(value)
    provider = _first_text(raw.get("provider"))
    voice_id = _first_text(raw.get("voice_id"))
    enabled = _coerce_bool(raw.get("enabled"), default=bool(provider or voice_id))
    return {
        "enabled": enabled,
        "provider": provider,
        "voice_id": voice_id,
        "emotion_mapping": _stringify_mapping(raw.get("emotion_mapping")),
    }


def _normalize_image(value: Any) -> Dict[str, Any]:
    """Normalize legacy or canonical image config into canonical dict form."""

    raw = _ensure_mapping(value)
    provider = _first_text(raw.get("provider"))
    avatar_prompt = _first_text(raw.get("avatar_prompt"))
    enabled = _coerce_bool(raw.get("enabled"), default=bool(provider or avatar_prompt))
    return {
        "enabled": enabled,
        "provider": provider,
        "style": _first_text(raw.get("style")) or "soft_illustration",
        "avatar_prompt": avatar_prompt,
    }


def _normalize_proactive(value: Any) -> Dict[str, Any]:
    """Normalize proactive configuration from several historical shapes."""

    raw = _ensure_mapping(value)
    quiet_hours = _ensure_mapping(raw.get("quiet_hours"))
    return {
        "enabled": _coerce_bool(raw.get("enabled"), default=False),
        "timezone": _first_text(raw.get("timezone"), raw.get("user_timezone")) or "Asia/Shanghai",
        "quiet_hours_start": _first_text(raw.get("quiet_hours_start"), quiet_hours.get("start")) or "23:00",
        "quiet_hours_end": _first_text(raw.get("quiet_hours_end"), quiet_hours.get("end")) or "07:00",
        "max_per_week": _coerce_int(raw.get("max_per_week"), _coerce_int(raw.get("global_max_per_week"), 2)),
        "holidays": _normalize_holidays(raw.get("holidays")),
        "anniversaries": _normalize_anniversaries(raw.get("anniversaries")),
    }


def _legacy_message_shape(value: str) -> str:
    """Map canonical message shape back to a legacy-compatible descriptor."""

    mapping = {
        "split_short_messages": "multiple-short-messages",
        "single_paragraph": "single_paragraph",
        "mixed": "mixed",
    }
    return mapping.get(value, value)


def _legacy_interaction_profile(
    original: Mapping[str, Any],
    default_mode: str,
    speech_style: Mapping[str, Any],
    care_priorities: Sequence[str],
) -> Dict[str, Any]:
    """Create a legacy `subject.interaction_profile` block."""

    profile = copy.deepcopy(dict(original)) if isinstance(original, Mapping) else {}
    channel_style = _first_text(speech_style.get("channel_style"))
    if channel_style and "default_channel" not in profile:
        profile["default_channel"] = channel_style
    if default_mode and "default_mode" not in profile:
        profile["default_mode"] = default_mode
    message_shape = _first_text(speech_style.get("message_shape"))
    if message_shape and "message_shape" not in profile:
        profile["message_shape"] = _legacy_message_shape(message_shape)
    voice_prefix = _first_text(speech_style.get("voice_prefix"))
    if voice_prefix and "voice_note_prefix" not in profile:
        profile["voice_note_prefix"] = voice_prefix
    emoji_style = _first_text(speech_style.get("emoji_style"))
    if emoji_style and "emoji_style" not in profile:
        profile["emoji_style"] = emoji_style
    if care_priorities and "primary_care_topics" not in profile:
        profile["primary_care_topics"] = list(care_priorities)
    return profile


def _legacy_evidence(
    source: Mapping[str, Any],
    evidence: Mapping[str, Any],
    core_drives: Sequence[str],
) -> Dict[str, Any]:
    """Build a legacy-style `evidence` block when one is missing."""

    raw_stats = _ensure_mapping(source.get("evidence_stats"))
    raw_sources = _ensure_mapping(source.get("sources"))
    return {
        "message_count": _coerce_int(evidence.get("message_count"), _coerce_int(raw_stats.get("verbatim"), 0)),
        "photo_count": _coerce_int(evidence.get("photo_count"), _coerce_int(raw_stats.get("artifact"), 0)),
        "memory_count": _coerce_int(evidence.get("memory_count"), _coerce_int(raw_stats.get("impression"), 0)),
        "participants": _ensure_string_list(evidence.get("participants")),
        "keywords": _merge_string_lists(evidence.get("keywords"), core_drives),
        "recurring_phrases": _ensure_string_list(evidence.get("recurring_phrases")),
        "signal_counts": _ensure_mapping(evidence.get("signal_counts")),
        "devices": _ensure_string_list(evidence.get("devices")),
        "locations": _ensure_string_list(evidence.get("locations")),
        "source_types": _ensure_string_list(raw_sources.get("types")),
        "time_range": copy.deepcopy(raw_sources.get("time_range")) if isinstance(raw_sources.get("time_range"), Mapping) else {},
    }


def _legacy_evidence_stats(source: Mapping[str, Any], evidence: Mapping[str, Any]) -> Dict[str, int]:
    """Build the legacy `evidence_stats` block."""

    raw = _ensure_mapping(source.get("evidence_stats"))
    if raw:
        return {
            "verbatim": _coerce_int(raw.get("verbatim"), 0),
            "artifact": _coerce_int(raw.get("artifact"), 0),
            "impression": _coerce_int(raw.get("impression"), 0),
        }
    return {
        "verbatim": _coerce_int(evidence.get("message_count"), 0),
        "artifact": _coerce_int(evidence.get("photo_count"), 0),
        "impression": _coerce_int(evidence.get("memory_count"), 0),
    }


def _has_meaningful_media_config(value: Mapping[str, Any]) -> bool:
    """Return whether a media config contains user-provided data."""

    return bool(
        _coerce_bool(value.get("enabled"), default=False)
        or _first_text(value.get("provider"))
        or _first_text(value.get("voice_id"))
        or _first_text(value.get("avatar_prompt"))
        or _stringify_mapping(value.get("emotion_mapping"))
    )


def manifest_to_dict(manifest: RelicManifest) -> Dict[str, Any]:
    """Serialize a `RelicManifest` dataclass to a plain dictionary."""

    return asdict(manifest)


def migrate_manifest(old_dict: Mapping[str, Any]) -> Dict[str, Any]:
    """Migrate a legacy manifest dictionary into canonical v1.4.0 form.

    Parameters
    ----------
    old_dict:
        The original manifest mapping. It may already be canonical, be a
        handwritten example manifest, or be a legacy `relic_writer.py`
        manifest.

    Returns
    -------
    dict
        A canonical manifest dictionary. The returned dictionary also preserves
        older compatibility fields when practical, so existing runtime code can
        keep reading `slug`, `subject`, `template`, `evidence`, `consent`, and
        related legacy keys.
    """

    if not isinstance(old_dict, Mapping):
        raise TypeError("migrate_manifest() expects a mapping")

    source = copy.deepcopy(dict(old_dict))
    raw_identity = _ensure_mapping(source.get("identity"))
    raw_subject = _ensure_mapping(source.get("subject"))
    raw_relationship_source = source.get("relationship")
    raw_relationship = _ensure_mapping(raw_relationship_source)
    raw_conversation = _ensure_mapping(source.get("conversation"))
    raw_speech_style = _ensure_mapping(raw_conversation.get("speech_style"))
    raw_interaction = _ensure_mapping(raw_subject.get("interaction_profile"))
    raw_media = _ensure_mapping(source.get("media"))
    raw_automation = _ensure_mapping(source.get("automation"))
    raw_compliance = _ensure_mapping(source.get("compliance"))
    raw_evidence = _ensure_mapping(source.get("evidence"))
    raw_safety = _ensure_mapping(source.get("safety"))
    raw_consent = _ensure_mapping(raw_compliance.get("consent") or source.get("consent"))
    raw_tts = _ensure_mapping(raw_media.get("tts") or source.get("tts_config"))
    raw_image = _ensure_mapping(raw_media.get("image") or source.get("image_config"))
    raw_proactive = _ensure_mapping(raw_automation.get("proactive") or source.get("proactive"))

    display_name = _first_text(
        source.get("display_name"),
        source.get("title"),
        raw_identity.get("name"),
        raw_subject.get("name"),
        source.get("slug"),
        source.get("id"),
    )
    manifest_id = _first_text(source.get("id"), source.get("slug")) or _slugify(display_name)
    kind = _normalize_kind(_first_text(source.get("kind"), source.get("relic_type"), source.get("template"), source.get("type")))
    locale = _first_text(
        source.get("locale"),
        source.get("language"),
        raw_subject.get("locale"),
        raw_conversation.get("default_language"),
    ) or "zh-CN"
    generated_by = _first_text(source.get("generated_by"), source.get("forge_tool"))
    created_at = _first_text(source.get("created_at"), source.get("generated_at"), source.get("forge_time"))

    identity_name = _first_text(raw_identity.get("name"), raw_subject.get("name"), display_name, manifest_id)
    identity_summary = _first_text(
        raw_identity.get("summary"),
        source.get("summary"),
        raw_subject.get("description"),
        raw_subject.get("notes"),
        display_name,
    )
    identity_core_drives = _merge_string_lists(
        raw_identity.get("core_drives"),
        raw_subject.get("core_traits"),
        raw_evidence.get("keywords"),
        source.get("keywords"),
        source.get("facts"),
    )
    if not identity_core_drives and identity_summary:
        identity_core_drives = [identity_summary]
    identity_contradictions = _merge_string_lists(raw_identity.get("contradictions"))
    identity_attributes = _stringify_mapping(raw_identity.get("attributes"))
    reserved_subject_keys = {
        "name",
        "relation_to_user",
        "status",
        "description",
        "core_traits",
        "interaction_profile",
        "scene_coverage",
        "notes",
        "locale",
    }
    for key, value in raw_subject.items():
        if key in reserved_subject_keys or value in (None, "", [], {}):
            continue
        if isinstance(value, (str, int, float, bool)):
            identity_attributes.setdefault(str(key), str(value))
    if _first_text(raw_subject.get("status")) and _first_text(raw_subject.get("status")).lower() not in VALID_STATUSES:
        identity_attributes.setdefault("legacy_status", _first_text(raw_subject.get("status")))
    if _first_text(raw_subject.get("notes")):
        identity_attributes.setdefault("notes", _first_text(raw_subject.get("notes")))

    identity_status = _normalize_status(raw_identity.get("status") or raw_subject.get("status"), kind, raw_subject)
    relationship_text = _first_text(
        raw_relationship.get("default_relation_to_user"),
        raw_subject.get("relation_to_user"),
        raw_relationship_source if not isinstance(raw_relationship_source, Mapping) else "",
    )
    relationship_text = relationship_text or _default_relation_for_kind(kind, display_name)
    care_priorities = _merge_string_lists(
        raw_relationship.get("care_priorities"),
        raw_interaction.get("primary_care_topics"),
        raw_interaction.get("primary_behaviors"),
        limit=8,
    )
    repair_style = _first_text(
        raw_relationship.get("repair_style"),
        raw_interaction.get("decision_pattern"),
        raw_interaction.get("language_style"),
    )
    distance = _infer_distance(raw_relationship.get("distance"), relationship_text, kind)

    default_language = _first_text(
        raw_conversation.get("default_language"),
        source.get("language"),
        source.get("locale"),
        raw_subject.get("locale"),
    ) or "zh-CN"
    default_mode = _first_text(
        raw_conversation.get("default_mode"),
        raw_interaction.get("default_mode"),
        source.get("default_mode"),
    ) or "daily"
    channel_style = _normalize_channel_style(
        _first_text(
            raw_speech_style.get("channel_style"),
            raw_interaction.get("default_channel"),
            raw_interaction.get("communication_platform"),
            raw_interaction.get("default_mode"),
        ),
        kind,
    )
    message_shape = _normalize_message_shape(
        _first_text(raw_speech_style.get("message_shape"), raw_interaction.get("message_shape")),
        channel_style,
    )
    voice_prefix = _first_text(raw_speech_style.get("voice_prefix"), raw_interaction.get("voice_note_prefix"))
    dialect_hint = _first_text(raw_speech_style.get("dialect_hint"), raw_subject.get("hometown"))
    emoji_style = _normalize_emoji_style(raw_speech_style.get("emoji_style"), raw_interaction.get("emoji_misuse"), channel_style)
    instinct_order = _merge_string_lists(raw_conversation.get("instinct_order")) or _default_instinct_order(kind, care_priorities)
    disclosure_policy = _stringify_mapping(raw_conversation.get("disclosure_policy")) or _default_disclosure_policy()
    if isinstance(raw_safety.get("boundaries"), list) and raw_safety.get("boundaries"):
        disclosure_policy.setdefault("boundaries", "；".join(_ensure_string_list(raw_safety.get("boundaries"))))

    media = {
        "tts": _normalize_tts(raw_tts),
        "image": _normalize_image(raw_image),
    }
    automation = {
        "proactive": _normalize_proactive(raw_proactive),
    }
    compliance = {
        "consent": {
            "protocol": _first_text(raw_consent.get("protocol")) or "six-question-consent-v1",
            "authorization_level": _first_text(raw_consent.get("authorization_level")) or "B",
            "use_scope": _first_text(raw_consent.get("use_scope")) or "personal",
            "commercial_use": _coerce_bool(raw_consent.get("commercial_use"), default=False),
        },
        "is_relic_not_real_person": _coerce_bool(
            raw_compliance.get("is_relic_not_real_person"),
            default=_coerce_bool(raw_safety.get("is_relic_not_real_person"), default=True),
        ),
    }

    canonical: Dict[str, Any] = {
        "schema_version": CANONICAL_SCHEMA_VERSION,
        "id": manifest_id,
        "kind": kind,
        "display_name": display_name or manifest_id,
        "identity": {
            "name": identity_name,
            "status": identity_status,
            "summary": identity_summary,
            "core_drives": identity_core_drives,
            "contradictions": identity_contradictions,
            "attributes": identity_attributes,
        },
        "relationship": {
            "default_relation_to_user": relationship_text,
            "distance": distance,
            "care_priorities": care_priorities,
            "repair_style": repair_style,
        },
        "conversation": {
            "default_language": default_language,
            "default_mode": default_mode,
            "speech_style": {
                "channel_style": channel_style,
                "message_shape": message_shape,
                "voice_prefix": voice_prefix,
                "dialect_hint": dialect_hint,
                "emoji_style": emoji_style,
            },
            "instinct_order": instinct_order,
            "disclosure_policy": disclosure_policy,
        },
        "media": media,
        "automation": automation,
        "compliance": compliance,
        "locale": locale,
        "generated_by": generated_by,
        "created_at": created_at,
    }

    legacy_relic_type = _first_text(source.get("relic_type"), source.get("template"), source.get("type")) or kind
    legacy_subject = copy.deepcopy(raw_subject) if raw_subject else {}
    legacy_subject.setdefault("name", identity_name)
    legacy_subject.setdefault("relation_to_user", relationship_text)
    if _first_text(raw_subject.get("status")):
        legacy_subject.setdefault("status", _first_text(raw_subject.get("status")))
    else:
        legacy_subject.setdefault("status", identity_status)
    legacy_subject.setdefault("description", identity_summary)
    if identity_core_drives and "core_traits" not in legacy_subject:
        legacy_subject["core_traits"] = list(identity_core_drives)
    if _first_text(raw_subject.get("locale")):
        legacy_subject.setdefault("locale", _first_text(raw_subject.get("locale")))
    elif locale:
        legacy_subject.setdefault("locale", locale)
    legacy_subject["interaction_profile"] = _legacy_interaction_profile(
        original=raw_interaction,
        default_mode=default_mode,
        speech_style=canonical["conversation"]["speech_style"],
        care_priorities=care_priorities,
    )

    legacy_evidence = copy.deepcopy(raw_evidence) if raw_evidence else {}
    legacy_evidence = _legacy_evidence(source=source, evidence=legacy_evidence, core_drives=identity_core_drives)
    legacy_evidence_stats = _legacy_evidence_stats(source, legacy_evidence)
    legacy_safety = copy.deepcopy(raw_safety) if raw_safety else {}
    legacy_safety.setdefault("is_relic_not_real_person", compliance["is_relic_not_real_person"])
    if "boundaries" not in legacy_safety:
        legacy_safety["boundaries"] = _safety_boundaries_from_policy(disclosure_policy)

    canonical["slug"] = _first_text(source.get("slug"), manifest_id) or manifest_id
    canonical["language"] = _first_text(source.get("language"), default_language) or default_language
    canonical["version"] = _first_text(source.get("version")) or CANONICAL_SCHEMA_VERSION
    canonical["subject"] = legacy_subject
    canonical["title"] = _first_text(source.get("title"), display_name) or display_name or manifest_id
    canonical["template"] = _first_text(source.get("template"), legacy_relic_type) or legacy_relic_type
    canonical["summary"] = _first_text(source.get("summary"), identity_summary) or identity_summary
    canonical["generated_at"] = _first_text(source.get("generated_at"), created_at) or created_at
    canonical["evidence"] = legacy_evidence
    canonical["evidence_stats"] = legacy_evidence_stats
    canonical["consent"] = copy.deepcopy(compliance["consent"])
    canonical["safety"] = legacy_safety

    if _has_meaningful_media_config(media["tts"]) or isinstance(source.get("tts_config"), Mapping):
        canonical["tts_config"] = copy.deepcopy(media["tts"])
    if _has_meaningful_media_config(media["image"]) or isinstance(source.get("image_config"), Mapping):
        canonical["image_config"] = copy.deepcopy(media["image"])

    source_schema_version = _first_text(source.get("schema_version"))
    if source_schema_version and source_schema_version != CANONICAL_SCHEMA_VERSION:
        canonical["legacy_schema_version"] = source_schema_version

    if not isinstance(raw_relationship_source, Mapping):
        relationship_text_legacy = _first_text(raw_relationship_source)
        if relationship_text_legacy:
            canonical["legacy_relationship"] = relationship_text_legacy

    for key, value in source.items():
        if key in canonical:
            continue
        canonical[key] = copy.deepcopy(value)

    return canonical


def _manifest_from_mapping(data: Mapping[str, Any]) -> RelicManifest:
    """Create a `RelicManifest` dataclass from a canonical mapping."""

    identity = _ensure_mapping(data.get("identity"))
    relationship = _ensure_mapping(data.get("relationship"))
    conversation = _ensure_mapping(data.get("conversation"))
    speech_style = _ensure_mapping(conversation.get("speech_style"))
    media = _ensure_mapping(data.get("media"))
    automation = _ensure_mapping(data.get("automation"))
    proactive = _ensure_mapping(automation.get("proactive"))
    compliance = _ensure_mapping(data.get("compliance"))
    consent = _ensure_mapping(compliance.get("consent"))

    manifest = RelicManifest(
        schema_version=_first_text(data.get("schema_version")) or CANONICAL_SCHEMA_VERSION,
        id=_first_text(data.get("id"), data.get("slug")) or "relic",
        kind=_normalize_kind(data.get("kind")),
        display_name=_first_text(data.get("display_name"), data.get("title"), data.get("id")) or "Relic",
        identity=RelicIdentity(
            name=_first_text(identity.get("name"), data.get("display_name"), data.get("id")) or "Relic",
            status=_normalize_status(identity.get("status"), _normalize_kind(data.get("kind")), _ensure_mapping(data.get("subject"))),
            summary=_first_text(identity.get("summary"), data.get("summary"), data.get("display_name")),
            core_drives=_ensure_string_list(identity.get("core_drives")),
            contradictions=_ensure_string_list(identity.get("contradictions")),
            attributes=_stringify_mapping(identity.get("attributes")),
        ),
        relationship=RelicRelationship(
            default_relation_to_user=_first_text(relationship.get("default_relation_to_user")) or _default_relation_for_kind(_normalize_kind(data.get("kind")), _first_text(data.get("display_name"))),
            distance=_infer_distance(relationship.get("distance"), _first_text(relationship.get("default_relation_to_user")), _normalize_kind(data.get("kind"))),
            care_priorities=_ensure_string_list(relationship.get("care_priorities")),
            repair_style=_first_text(relationship.get("repair_style")),
        ),
        conversation=ConversationConfig(
            default_language=_first_text(conversation.get("default_language"), data.get("language"), data.get("locale")) or "zh-CN",
            default_mode=_first_text(conversation.get("default_mode")) or "daily",
            speech_style=SpeechStyle(
                channel_style=_normalize_channel_style(speech_style.get("channel_style"), _normalize_kind(data.get("kind"))),
                message_shape=_normalize_message_shape(speech_style.get("message_shape"), _normalize_channel_style(speech_style.get("channel_style"), _normalize_kind(data.get("kind")))),
                voice_prefix=_first_text(speech_style.get("voice_prefix")),
                dialect_hint=_first_text(speech_style.get("dialect_hint")),
                emoji_style=_normalize_emoji_style(speech_style.get("emoji_style"), None, _normalize_channel_style(speech_style.get("channel_style"), _normalize_kind(data.get("kind")))),
            ),
            instinct_order=_ensure_string_list(conversation.get("instinct_order")),
            disclosure_policy=_stringify_mapping(conversation.get("disclosure_policy")),
        ),
        media=MediaConfig(
            tts=TTSConfig(
                enabled=_coerce_bool(_ensure_mapping(media.get("tts")).get("enabled"), default=False),
                provider=_first_text(_ensure_mapping(media.get("tts")).get("provider")),
                voice_id=_first_text(_ensure_mapping(media.get("tts")).get("voice_id")),
                emotion_mapping=_stringify_mapping(_ensure_mapping(media.get("tts")).get("emotion_mapping")),
            ),
            image=ImageConfig(
                enabled=_coerce_bool(_ensure_mapping(media.get("image")).get("enabled"), default=False),
                provider=_first_text(_ensure_mapping(media.get("image")).get("provider")),
                style=_first_text(_ensure_mapping(media.get("image")).get("style")) or "soft_illustration",
                avatar_prompt=_first_text(_ensure_mapping(media.get("image")).get("avatar_prompt")),
            ),
        ),
        automation=AutomationConfig(
            proactive=ProactiveConfig(
                enabled=_coerce_bool(proactive.get("enabled"), default=False),
                timezone=_first_text(proactive.get("timezone")) or "Asia/Shanghai",
                quiet_hours_start=_first_text(proactive.get("quiet_hours_start")) or "23:00",
                quiet_hours_end=_first_text(proactive.get("quiet_hours_end")) or "07:00",
                max_per_week=_coerce_int(proactive.get("max_per_week"), 2),
                holidays=_ensure_string_list(proactive.get("holidays")),
                anniversaries=[_stringify_mapping(item) for item in proactive.get("anniversaries", []) if isinstance(item, Mapping)],
            )
        ),
        compliance=ComplianceConfig(
            consent=ConsentConfig(
                protocol=_first_text(consent.get("protocol")) or "six-question-consent-v1",
                authorization_level=_first_text(consent.get("authorization_level")) or "B",
                use_scope=_first_text(consent.get("use_scope")) or "personal",
                commercial_use=_coerce_bool(consent.get("commercial_use"), default=False),
            ),
            is_relic_not_real_person=_coerce_bool(compliance.get("is_relic_not_real_person"), default=True),
        ),
        locale=_first_text(data.get("locale"), data.get("language")) or "zh-CN",
        generated_by=_first_text(data.get("generated_by")),
        created_at=_first_text(data.get("created_at"), data.get("generated_at")),
    )
    return manifest


def load_manifest(path: Union[str, Path]) -> RelicManifest:
    """Load a manifest file and normalize it to `RelicManifest`.

    Parameters
    ----------
    path:
        Path to `manifest.json`.

    Returns
    -------
    RelicManifest
        The normalized canonical dataclass representation.
    """

    manifest_path = Path(path)
    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(raw, Mapping):
        raise ValueError(f"manifest root must be an object: {manifest_path}")
    migrated = migrate_manifest(raw)
    return _manifest_from_mapping(migrated)


def validate_manifest(manifest: Union[RelicManifest, Mapping[str, Any]]) -> List[str]:
    """Validate a manifest and return human-readable errors.

    Parameters
    ----------
    manifest:
        A `RelicManifest` instance or a manifest mapping. Mappings are migrated
        to canonical form before validation.

    Returns
    -------
    list[str]
        A list of validation errors. The list is empty when the manifest looks
        valid enough for normal use.
    """

    errors: List[str] = []
    if is_dataclass(manifest):
        normalized = manifest
    elif isinstance(manifest, Mapping):
        for field in ("id", "kind", "display_name"):
            if not _first_text(manifest.get(field)):
                errors.append(f"Missing required field: {field}")

        identity = manifest.get("identity") if isinstance(manifest.get("identity"), Mapping) else {}
        subject = manifest.get("subject") if isinstance(manifest.get("subject"), Mapping) else {}
        if not _first_text(identity.get("name"), subject.get("name"), manifest.get("display_name")):
            errors.append("Missing identity.name (or legacy subject/display_name)")

        try:
            normalized = _manifest_from_mapping(migrate_manifest(manifest))
        except Exception as exc:
            errors.append(f"Migration failed: {exc}")
            return errors
    else:
        return ["manifest must be a RelicManifest or mapping"]

    if normalized.schema_version != CANONICAL_SCHEMA_VERSION:
        errors.append(f"schema_version must be {CANONICAL_SCHEMA_VERSION}")
    if not _first_text(normalized.id):
        errors.append("id is required")
    if normalized.kind not in VALID_KINDS:
        errors.append(f"kind must be one of: {', '.join(sorted(VALID_KINDS))}")
    if not _first_text(normalized.display_name):
        errors.append("display_name is required")

    if not _first_text(normalized.identity.name):
        errors.append("identity.name is required")
    if normalized.identity.status not in VALID_STATUSES:
        errors.append(f"identity.status must be one of: {', '.join(sorted(VALID_STATUSES))}")
    if not _first_text(normalized.identity.summary):
        errors.append("identity.summary is required")
    if not normalized.identity.core_drives:
        errors.append("identity.core_drives must contain at least one item")

    if not _first_text(normalized.relationship.default_relation_to_user):
        errors.append("relationship.default_relation_to_user is required")
    if normalized.relationship.distance not in VALID_DISTANCES:
        errors.append(f"relationship.distance must be one of: {', '.join(sorted(VALID_DISTANCES))}")

    if not _first_text(normalized.conversation.default_language):
        errors.append("conversation.default_language is required")
    if not _first_text(normalized.conversation.default_mode):
        errors.append("conversation.default_mode is required")
    if normalized.conversation.speech_style.channel_style not in VALID_CHANNEL_STYLES:
        errors.append(
            "conversation.speech_style.channel_style must be one of: "
            + ", ".join(sorted(VALID_CHANNEL_STYLES))
        )
    if normalized.conversation.speech_style.message_shape not in VALID_MESSAGE_SHAPES:
        errors.append(
            "conversation.speech_style.message_shape must be one of: "
            + ", ".join(sorted(VALID_MESSAGE_SHAPES))
        )
    if normalized.conversation.speech_style.emoji_style not in VALID_EMOJI_STYLES:
        errors.append(
            "conversation.speech_style.emoji_style must be one of: "
            + ", ".join(sorted(VALID_EMOJI_STYLES))
        )

    if normalized.automation.proactive.max_per_week < 0:
        errors.append("automation.proactive.max_per_week must be >= 0")
    if not _first_text(normalized.compliance.consent.protocol):
        errors.append("compliance.consent.protocol is required")
    if not _first_text(normalized.locale):
        errors.append("locale is required")
    return errors


def _demo_payload() -> Dict[str, Any]:
    """Return a small handwritten legacy manifest for demo purposes."""

    return {
        "slug": "grandma-demo",
        "display_name": "奶奶·示例",
        "relic_type": "human",
        "language": "zh-CN",
        "subject": {
            "name": "王奶奶",
            "relation_to_user": "奶奶",
            "status": "memorial",
            "description": "一个会提醒你吃饭的奶奶 Relic。",
            "core_traits": ["嘴硬心软", "总担心你没吃饭", "爱发语音"],
            "interaction_profile": {
                "default_channel": "wechat-style-chat",
                "message_shape": "multiple-short-messages",
                "voice_note_prefix": "哎",
                "primary_care_topics": ["吃饭", "睡觉"],
            },
        },
        "consent": {
            "protocol": "six-question-consent-v1",
            "authorization_level": "B",
            "use_scope": "personal",
            "commercial_use": False,
        },
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Normalize relic.skill manifest files")
    parser.add_argument("path", nargs="?", help="Optional manifest.json path to inspect")
    args = parser.parse_args()

    if args.path:
        manifest = load_manifest(args.path)
        payload = manifest_to_dict(manifest)
    else:
        payload = migrate_manifest(_demo_payload())
        manifest = _manifest_from_mapping(payload)

    print(json.dumps(payload, ensure_ascii=False, indent=2))
    errors = validate_manifest(manifest)
    if errors:
        print("\nValidation errors:")
        for item in errors:
            print(f"- {item}")
    else:
        print("\nValidation passed.")
