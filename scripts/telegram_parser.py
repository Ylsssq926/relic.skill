"""Parse Telegram official export JSON into normalized JSON.

Supported inputs:
- result.json exported by Telegram Desktop
- A directory containing one or more Telegram export JSON files

The script normalizes message content, timestamps, media paths, and sender info
into a shared schema that can feed later distillation or Relic generation steps.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

try:
    from dateutil import parser as date_parser
except ImportError:  # pragma: no cover - dependency guard
    date_parser = None

SUPPORTED_SUFFIXES = {".json"}


_STDLIB_DATETIME_FORMATS = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%d",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M",
    "%d-%m-%Y %H:%M:%S",
    "%m-%d-%Y %H:%M:%S",
)


def parse_datetime_flexible(text: str) -> Optional[datetime]:
    """把日期字符串解析成 datetime，优先用 dateutil，缺依赖时退回标准库。

    标准库路径覆盖导出文件里实际出现过的写法：ISO（含时区）、
    "YYYY-MM-DD HH:MM[:SS]"、以及中文的"YYYY年M月D日"。
    naive 结果保持 naive —— 与 dateutil 的行为一致，时间戳按本地时区换算。
    """
    candidate = str(text).strip()
    if not candidate:
        return None

    if date_parser is not None:
        try:
            return date_parser.parse(candidate)
        except (ValueError, OverflowError, TypeError):
            return None

    # --- 标准库路径 ---
    iso_candidate = candidate.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(iso_candidate)
    except ValueError:
        pass

    normalized = (candidate
                  .replace("年", "-").replace("月", "-").replace("日", " ")
                  .replace("/", "-").replace(".", "-"))
    normalized = re.sub(r"\s+", " ", normalized).strip().rstrip("-")
    for fmt in _STDLIB_DATETIME_FORMATS:
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            continue
    return None


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def write_json(path: Path, payload: Dict[str, Any], pretty: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2 if pretty else None)
        handle.write("\n")


def read_text_with_fallback(path: Path) -> str:
    for encoding in ("utf-8-sig", "utf-8", "utf-16", "utf-16le", "latin-1"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", b"", 0, 1, f"无法解码文件: {path}")


def discover_inputs(input_path: Path) -> List[Path]:
    if input_path.is_file():
        if input_path.suffix.lower() not in SUPPORTED_SUFFIXES:
            raise ValueError(f"不支持的文件类型: {input_path.suffix}")
        return [input_path]
    if not input_path.is_dir():
        raise FileNotFoundError(f"输入路径不存在: {input_path}")
    files = [path for path in sorted(input_path.rglob("*.json")) if path.is_file()]
    if not files:
        raise FileNotFoundError(f"目录中没有 Telegram JSON 文件: {input_path}")
    return files


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
            parsed = parse_datetime_flexible(text)
            if parsed is None:
                return None, text
            return int(parsed.timestamp()), parsed.isoformat()
    digits = len(str(abs(raw)))
    if digits >= 13:
        raw //= 1_000
    try:
        parsed_dt = datetime.fromtimestamp(raw, tz=timezone.utc).astimezone()
    except (OverflowError, OSError, ValueError):
        return None, str(value)
    return raw, parsed_dt.isoformat()


def flatten_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: List[str] = []
        for item in value:
            chunk = flatten_text(item)
            if chunk:
                parts.append(chunk)
        return "".join(parts).strip()
    if isinstance(value, dict):
        if "text" in value:
            return flatten_text(value.get("text"))
        if "href" in value:
            text = flatten_text(value.get("text"))
            href = flatten_text(value.get("href"))
            return f"{text} ({href})" if text else href
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


def infer_direction(sender_name: Optional[str], sender_id: Optional[str], self_name: Optional[str], self_id: Optional[str], msg_type: str) -> str:
    if msg_type == "system":
        return "system"
    if self_id and sender_id and sender_id == self_id:
        return "outgoing"
    if self_name and sender_name and sender_name == self_name:
        return "outgoing"
    if self_name or self_id:
        return "incoming"
    return "unknown"


def infer_message_type(message: Dict[str, Any], content: str) -> str:
    raw_type = str(message.get("type") or "message").strip().lower()
    if raw_type in {"service", "service_message"}:
        return "system"
    media_candidates = {
        "photo": ["photo"],
        "video": ["video_file", "video"],
        "voice": ["voice_message"],
        "file": ["file"],
        "sticker": ["sticker_emoji", "sticker"],
    }
    for msg_type, keys in media_candidates.items():
        for key in keys:
            if message.get(key):
                return msg_type
    if raw_type and raw_type != "message":
        return raw_type.replace(" ", "_")
    if content.startswith("[") and content.endswith("]"):
        return content.strip("[]")
    if "http://" in content or "https://" in content:
        return "link"
    return "text"


def extract_media_path(message: Dict[str, Any], base_dir: Path) -> Optional[str]:
    for key in ("photo", "file", "thumbnail", "voice_message"):
        value = message.get(key)
        if not value:
            continue
        candidate = base_dir / str(value)
        return str(candidate if candidate.exists() else value)
    return None


def extract_content(message: Dict[str, Any]) -> str:
    content = flatten_text(message.get("text"))
    if content:
        return content
    for key in ("caption", "media_type", "action", "title"):
        candidate = flatten_text(message.get(key))
        if candidate:
            return candidate
    return ""


def parse_chat_payload(
    payload: Dict[str, Any],
    source_file: Path,
    self_name: Optional[str],
    self_id: Optional[str],
) -> List[Dict[str, Any]]:
    if not isinstance(payload, dict) or not isinstance(payload.get("messages"), list):
        return []

    chat_name = str(payload.get("name") or payload.get("title") or source_file.stem)
    chat_id = str(payload.get("id") or payload.get("chat_id") or chat_name)
    exporter = "telegram_official_export"
    messages: List[Dict[str, Any]] = []

    for index, item in enumerate(payload.get("messages", []), start=1):
        if not isinstance(item, dict):
            continue
        content = extract_content(item)
        msg_type = infer_message_type(item, content)
        if not content:
            placeholders = {
                "photo": "[照片]",
                "video": "[视频]",
                "voice": "[语音]",
                "file": "[文件]",
                "sticker": "[贴纸]",
                "system": "[系统消息]",
            }
            content = placeholders.get(msg_type, "[空消息]")
        timestamp, iso_dt = normalize_timestamp(item.get("date_unixtime") or item.get("date"))
        sender_name = item.get("from") or item.get("actor") or item.get("author")
        sender_id = item.get("from_id") or item.get("actor_id")
        if sender_id is not None:
            sender_id = str(sender_id)
        if sender_name is not None:
            sender_name = str(sender_name)
        direction = infer_direction(sender_name, sender_id, self_name, self_id, msg_type)
        message_id = str(item.get("id") or f"{chat_id}:{timestamp or 0}:{index}")
        messages.append(
            {
                "id": message_id,
                "platform": "telegram",
                "exporter": exporter,
                "source_file": str(source_file),
                "source_format": "json",
                "chat_id": chat_id,
                "chat_name": chat_name,
                "sender_id": sender_id,
                "sender_name": sender_name,
                "direction": direction,
                "msg_type": msg_type,
                "timestamp": timestamp,
                "datetime": iso_dt,
                "content": content,
                "media_path": extract_media_path(item, source_file.parent),
                "raw": {
                    "reply_to_message_id": item.get("reply_to_message_id"),
                    "edited": item.get("edited"),
                    "forwarded_from": item.get("forwarded_from"),
                },
            }
        )
    return messages


def load_json_payload(path: Path) -> Any:
    try:
        return json.loads(read_text_with_fallback(path))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"JSON 解析失败: {path}: {exc}") from exc


def parse_file(path: Path, self_name: Optional[str], self_id: Optional[str]) -> List[Dict[str, Any]]:
    payload = load_json_payload(path)
    messages: List[Dict[str, Any]] = []
    if isinstance(payload, dict):
        messages.extend(parse_chat_payload(payload, path, self_name, self_id))
        if isinstance(payload.get("chats"), list):
            for chat_payload in payload["chats"]:
                if isinstance(chat_payload, dict):
                    messages.extend(parse_chat_payload(chat_payload, path, self_name, self_id))
    elif isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                messages.extend(parse_chat_payload(item, path, self_name, self_id))
    return messages


def deduplicate_messages(messages: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    unique: Dict[Tuple[Any, ...], Dict[str, Any]] = {}
    for message in messages:
        key = (
            message.get("chat_id"),
            message.get("id"),
            message.get("timestamp"),
            message.get("sender_id") or message.get("sender_name"),
            message.get("content"),
        )
        unique.setdefault(key, message)
    result = list(unique.values())
    result.sort(key=lambda item: (item.get("timestamp") or 0, item.get("id") or ""))
    return result


def filter_messages(messages: Sequence[Dict[str, Any]], chat_filter: Optional[str], limit: Optional[int]) -> List[Dict[str, Any]]:
    filtered = list(messages)
    if chat_filter:
        keyword = chat_filter.casefold()
        filtered = [
            item
            for item in filtered
            if keyword in str(item.get("chat_id") or "").casefold() or keyword in str(item.get("chat_name") or "").casefold()
        ]
    if limit is not None:
        filtered = filtered[:limit]
    return filtered


def build_stats(messages: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    type_counter = Counter(item.get("msg_type") or "unknown" for item in messages)
    chat_counter = Counter(item.get("chat_name") or item.get("chat_id") or "unknown" for item in messages)
    sender_counter = Counter(item.get("sender_name") or item.get("sender_id") or "unknown" for item in messages)
    timestamps = [item.get("timestamp") for item in messages if isinstance(item.get("timestamp"), int)]
    return {
        "message_count": len(messages),
        "chat_count": len(chat_counter),
        "message_types": dict(type_counter),
        "top_chats": [{"chat": name, "count": count} for name, count in chat_counter.most_common(10)],
        "top_senders": [{"sender": name, "count": count} for name, count in sender_counter.most_common(10)],
        "time_range": {
            "start": min(timestamps) if timestamps else None,
            "end": max(timestamps) if timestamps else None,
        },
    }


def build_payload(input_path: Path, files: Sequence[Path], messages: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "schema_version": "1.0",
        "source": {
            "platform": "telegram",
            "input": str(input_path),
            "files": [str(path) for path in files],
            "generated_at": now_iso(),
        },
        "stats": build_stats(messages),
        "messages": list(messages),
    }


def create_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="解析 Telegram 官方导出 JSON 并输出标准化 JSON")
    parser.add_argument("--input", required=True, help="输入 JSON 文件或目录")
    parser.add_argument("--output", required=True, help="输出 JSON 文件路径")
    parser.add_argument("--chat", help="按 chat id 或 chat name 过滤")
    parser.add_argument("--self-name", help="自己的 Telegram 昵称，用于判断消息方向")
    parser.add_argument("--self-id", help="自己的 Telegram 用户 ID，用于判断消息方向")
    parser.add_argument("--limit", type=int, help="最多输出多少条消息")
    parser.add_argument("--pretty", action="store_true", help="输出格式化 JSON")
    return parser


def _ensure_utf8_output() -> None:
    """Windows 控制台默认 cp936，直接 print 中文会 UnicodeEncodeError 崩掉脚本。"""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

def main(argv: Optional[Sequence[str]] = None) -> int:
    _ensure_utf8_output()
    parser = create_argument_parser()
    args = parser.parse_args(argv)

    input_path = Path(args.input).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()

    try:
        discovered = discover_inputs(input_path)
        all_messages: List[Dict[str, Any]] = []
        for file_path in discovered:
            try:
                all_messages.extend(parse_file(file_path, args.self_name, args.self_id))
            except Exception as exc:
                print(f"[WARN] 跳过文件 {file_path}: {exc}", file=sys.stderr)
        if not all_messages:
            raise RuntimeError("没有解析到任何 Telegram 消息，请检查输入导出。")
        deduped = deduplicate_messages(all_messages)
        filtered = filter_messages(deduped, args.chat, args.limit)
        if not filtered:
            raise RuntimeError("过滤后没有消息可输出。")
        payload = build_payload(input_path, discovered, filtered)
        write_json(output_path, payload, args.pretty)
        print(f"已输出 {len(filtered)} 条 Telegram 消息到 {output_path}")
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
