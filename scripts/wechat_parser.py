"""Parse WeChat chat exports into normalized JSON.

Supported inputs:
- SQLite databases exported by tools such as WeChatMsg / 留痕 / PyWxDump
- CSV exports with common WeChat-like column names
- JSON exports containing message records

Output schema highlights:
- schema_version
- source
- stats
- messages[]

Each normalized message includes:
- id
- platform
- exporter
- source_format
- chat_id / chat_name
- sender_id / sender_name
- direction
- msg_type
- timestamp / datetime
- content
- media_path
- raw
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sqlite3
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

try:
    from dateutil import parser as date_parser
except ImportError:  # pragma: no cover - dependency guard
    date_parser = None

SUPPORTED_SUFFIXES = {".db", ".sqlite", ".sqlite3", ".csv", ".json"}

MSG_TYPE_MAP = {
    1: "text",
    3: "image",
    34: "voice",
    37: "friend_request",
    42: "contact_card",
    43: "video",
    47: "sticker",
    48: "location",
    49: "share_or_file",
    50: "voice_call",
    51: "system_event",
    62: "short_video",
    10000: "system",
    268445456: "transfer_or_red_packet",
    419430449: "quoted_share",
}

COLUMN_ALIASES = {
    "id": ["localid", "msgsvrid", "message_id", "id", "msgid", "msg_id"],
    "chat_id": [
        "strtalker",
        "talker",
        "conversationid",
        "sessionid",
        "chatid",
        "chat_id",
        "roomid",
        "room_id",
        "username",
    ],
    "chat_name": ["chat_name", "conversation", "session_name", "remark", "nickname", "roomname"],
    "sender_id": ["sender", "senderid", "sender_id", "from", "from_user", "fromusername", "authorid"],
    "sender_name": ["sender_name", "displayname", "fromname", "author", "nickname", "remarkname"],
    "timestamp": [
        "createtime",
        "create_time",
        "time",
        "timestamp",
        "datetime",
        "msgtime",
        "sendtime",
        "date",
    ],
    "content": ["strcontent", "content", "message", "msg", "text", "body"],
    "display_content": ["displaycontent", "display_content", "preview", "summary"],
    "msg_type": ["type", "msgtype", "message_type", "type_name"],
    "sub_type": ["subtype", "sub_type", "subtype_name"],
    "direction": ["issend", "is_send", "issender", "direction", "outbound"],
    "media_path": ["filepath", "path", "imgpath", "imagepath", "attachpath", "thumbpath", "file"],
}


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


def quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        for encoding in ("utf-8", "utf-16", "utf-16le", "gb18030", "latin-1"):
            try:
                return value.decode(encoding).strip()
            except UnicodeDecodeError:
                continue
        return value.hex()
    return str(value).strip()


def compact_hash(*parts: Any) -> str:
    joined = "|".join(to_text(part) for part in parts)
    return hashlib.md5(joined.encode("utf-8", errors="ignore")).hexdigest()[:12]


def read_text_with_fallback(path: Path) -> str:
    for encoding in ("utf-8-sig", "utf-8", "utf-16", "utf-16le", "gb18030", "latin-1"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", b"", 0, 1, f"无法解码文件: {path}")


def normalize_timestamp(value: Any) -> Tuple[Optional[int], Optional[str]]:
    if value is None:
        return None, None
    if isinstance(value, (int, float)):
        raw = int(value)
    else:
        text = to_text(value)
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
    if digits >= 16:
        raw //= 1_000_000
    elif digits >= 13:
        raw //= 1_000
    try:
        dt = datetime.fromtimestamp(raw, tz=timezone.utc).astimezone()
    except (OverflowError, OSError, ValueError):
        return None, to_text(value)
    return raw, dt.isoformat()


def normalize_msg_type(raw_type: Any, raw_sub_type: Any, content: str) -> str:
    raw_text = to_text(raw_type)
    sub_text = to_text(raw_sub_type)
    if raw_text and raw_text.lstrip("-").isdigit():
        mapped = MSG_TYPE_MAP.get(int(raw_text))
        if mapped:
            return mapped
        if sub_text:
            return f"unknown({raw_text}/{sub_text})"
        return f"unknown({raw_text})"
    lower_text = raw_text.lower()
    if lower_text:
        return lower_text.replace(" ", "_")
    if any(token in content for token in ("[图片]", "【图片】", "image")):
        return "image"
    if any(token in content for token in ("[视频]", "【视频】", "video")):
        return "video"
    if any(token in content for token in ("[语音]", "【语音】", "voice")):
        return "voice"
    return "text"


def fallback_content_for_type(msg_type: str) -> str:
    placeholders = {
        "image": "[图片]",
        "video": "[视频]",
        "voice": "[语音]",
        "location": "[位置]",
        "share_or_file": "[分享/文件]",
        "sticker": "[表情]",
        "system": "[系统消息]",
    }
    return placeholders.get(msg_type, "")


def resolve_direction(value: Any, msg_type: str) -> str:
    if msg_type == "system":
        return "system"
    lower = to_text(value).lower()
    if lower in {"1", "true", "yes", "y", "outgoing", "sent", "self"}:
        return "outgoing"
    if lower in {"0", "false", "no", "n", "incoming", "received"}:
        return "incoming"
    return "unknown"


def discover_inputs(input_path: Path) -> List[Path]:
    if input_path.is_file():
        if input_path.suffix.lower() not in SUPPORTED_SUFFIXES:
            raise ValueError(f"不支持的文件类型: {input_path.suffix}")
        return [input_path]
    if not input_path.is_dir():
        raise FileNotFoundError(f"输入路径不存在: {input_path}")
    discovered: List[Path] = []
    for candidate in sorted(input_path.rglob("*")):
        if candidate.is_file() and candidate.suffix.lower() in SUPPORTED_SUFFIXES:
            discovered.append(candidate)
    if not discovered:
        raise FileNotFoundError(f"目录中没有发现可解析文件: {input_path}")
    return discovered


def infer_exporter(path: Path) -> str:
    lower = str(path).lower()
    if "pywxdump" in lower:
        return "PyWxDump"
    if "wechatmsg" in lower:
        return "WeChatMsg"
    if "留痕" in str(path) or "liuhen" in lower:
        return "留痕"
    return "generic_wechat_export"


def pick_column(columns: Sequence[str], aliases: Sequence[str]) -> Optional[str]:
    lowered = {column.lower(): column for column in columns}
    for alias in aliases:
        match = lowered.get(alias.lower())
        if match:
            return match
    return None


def get_tables(conn: sqlite3.Connection) -> List[str]:
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    return [to_text(row[0]) for row in rows if to_text(row[0])]


def get_columns(conn: sqlite3.Connection, table: str) -> List[str]:
    rows = conn.execute(f"PRAGMA table_info({quote_identifier(table)})").fetchall()
    return [to_text(row[1]) for row in rows if to_text(row[1])]


def is_message_table(table: str, columns: Sequence[str]) -> bool:
    lower_name = table.lower()
    if lower_name.startswith("msg") or "message" in lower_name:
        return True
    content_col = pick_column(columns, COLUMN_ALIASES["content"] + COLUMN_ALIASES["display_content"])
    time_col = pick_column(columns, COLUMN_ALIASES["timestamp"])
    chat_col = pick_column(columns, COLUMN_ALIASES["chat_id"])
    return bool(content_col and time_col and chat_col)


def build_contact_lookup(conn: sqlite3.Connection) -> Dict[str, str]:
    lookup: Dict[str, str] = {}
    user_aliases = ["username", "user_name", "wxid", "strtalker", "talker", "alias"]
    nick_aliases = ["nickname", "nick_name", "displayname", "display_name"]
    remark_aliases = ["remark", "remarkname", "conremark", "aliasname"]
    for table in get_tables(conn):
        columns = get_columns(conn, table)
        user_col = pick_column(columns, user_aliases)
        if not user_col:
            continue
        nick_col = pick_column(columns, nick_aliases)
        remark_col = pick_column(columns, remark_aliases)
        if not nick_col and not remark_col:
            continue
        select_parts = [
            f"{quote_identifier(user_col)} AS user_id",
            f"{quote_identifier(nick_col)} AS nickname" if nick_col else "NULL AS nickname",
            f"{quote_identifier(remark_col)} AS remark" if remark_col else "NULL AS remark",
        ]
        query = f"SELECT {', '.join(select_parts)} FROM {quote_identifier(table)}"
        try:
            for row in conn.execute(query):
                user_id = to_text(row[0])
                if not user_id:
                    continue
                nickname = to_text(row[1])
                remark = to_text(row[2])
                display_name = remark or nickname
                if display_name and user_id not in lookup:
                    lookup[user_id] = display_name
        except sqlite3.Error:
            continue
    return lookup


def parse_sqlite_file(path: Path) -> List[Dict[str, Any]]:
    messages: List[Dict[str, Any]] = []
    exporter = infer_exporter(path)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    try:
        contact_lookup = build_contact_lookup(conn)
        for table in get_tables(conn):
            columns = get_columns(conn, table)
            if not is_message_table(table, columns):
                continue
            messages.extend(parse_sqlite_table(conn, path, table, columns, contact_lookup, exporter))
    finally:
        conn.close()
    return messages


def parse_sqlite_table(
    conn: sqlite3.Connection,
    path: Path,
    table: str,
    columns: Sequence[str],
    contact_lookup: Dict[str, str],
    exporter: str,
) -> List[Dict[str, Any]]:
    id_col = pick_column(columns, COLUMN_ALIASES["id"])
    chat_id_col = pick_column(columns, COLUMN_ALIASES["chat_id"])
    chat_name_col = pick_column(columns, COLUMN_ALIASES["chat_name"])
    sender_id_col = pick_column(columns, COLUMN_ALIASES["sender_id"])
    sender_name_col = pick_column(columns, COLUMN_ALIASES["sender_name"])
    content_col = pick_column(columns, COLUMN_ALIASES["content"])
    display_col = pick_column(columns, COLUMN_ALIASES["display_content"])
    time_col = pick_column(columns, COLUMN_ALIASES["timestamp"])
    msg_type_col = pick_column(columns, COLUMN_ALIASES["msg_type"])
    sub_type_col = pick_column(columns, COLUMN_ALIASES["sub_type"])
    direction_col = pick_column(columns, COLUMN_ALIASES["direction"])
    media_col = pick_column(columns, COLUMN_ALIASES["media_path"])

    if not time_col or (not content_col and not display_col):
        return []

    select_parts = [
        f"{quote_identifier(id_col)} AS message_id" if id_col else "NULL AS message_id",
        f"{quote_identifier(chat_id_col)} AS chat_id" if chat_id_col else "NULL AS chat_id",
        f"{quote_identifier(chat_name_col)} AS chat_name" if chat_name_col else "NULL AS chat_name",
        f"{quote_identifier(sender_id_col)} AS sender_id" if sender_id_col else "NULL AS sender_id",
        f"{quote_identifier(sender_name_col)} AS sender_name" if sender_name_col else "NULL AS sender_name",
        f"{quote_identifier(content_col)} AS content" if content_col else "NULL AS content",
        f"{quote_identifier(display_col)} AS display_content" if display_col else "NULL AS display_content",
        f"{quote_identifier(time_col)} AS timestamp",
        f"{quote_identifier(msg_type_col)} AS msg_type" if msg_type_col else "NULL AS msg_type",
        f"{quote_identifier(sub_type_col)} AS sub_type" if sub_type_col else "NULL AS sub_type",
        f"{quote_identifier(direction_col)} AS direction" if direction_col else "NULL AS direction",
        f"{quote_identifier(media_col)} AS media_path" if media_col else "NULL AS media_path",
    ]
    query = f"SELECT {', '.join(select_parts)} FROM {quote_identifier(table)}"

    parsed: List[Dict[str, Any]] = []
    try:
        for row in conn.execute(query):
            content = to_text(row["content"]) or to_text(row["display_content"])
            ts, iso_dt = normalize_timestamp(row["timestamp"])
            msg_type = normalize_msg_type(row["msg_type"], row["sub_type"], content)
            if not content:
                content = fallback_content_for_type(msg_type)
            chat_id = to_text(row["chat_id"]) or to_text(row["sender_id"]) or table
            chat_name = to_text(row["chat_name"]) or contact_lookup.get(chat_id)
            direction = resolve_direction(row["direction"], msg_type)
            sender_id = to_text(row["sender_id"])
            if not sender_id and direction == "incoming":
                sender_id = chat_id
            if not sender_id and direction == "outgoing":
                sender_id = "self"
            sender_name = to_text(row["sender_name"]) or (contact_lookup.get(sender_id) if sender_id else "")
            if not sender_name and direction == "incoming":
                sender_name = contact_lookup.get(chat_id, "")
            if not sender_name and direction == "outgoing":
                sender_name = "self"
            message_id = to_text(row["message_id"]) or f"{table}:{compact_hash(chat_id, sender_id, ts, content)}"
            if not any([content, chat_id, sender_id, ts]):
                continue
            parsed.append(
                {
                    "id": message_id,
                    "platform": "wechat",
                    "exporter": exporter,
                    "source_file": str(path),
                    "source_format": "sqlite",
                    "chat_id": chat_id,
                    "chat_name": chat_name or None,
                    "sender_id": sender_id or None,
                    "sender_name": sender_name or None,
                    "direction": direction,
                    "msg_type": msg_type,
                    "timestamp": ts,
                    "datetime": iso_dt,
                    "content": content,
                    "media_path": to_text(row["media_path"]) or None,
                    "raw": {
                        "table": table,
                        "sub_type": to_text(row["sub_type"]) or None,
                        "display_content": to_text(row["display_content"]) or None,
                    },
                }
            )
    except sqlite3.Error as exc:
        raise RuntimeError(f"SQLite 解析失败: {path}::{table}: {exc}") from exc
    return parsed


def normalize_row(raw_row: Dict[str, Any], source_file: Path, source_format: str, exporter: str) -> Optional[Dict[str, Any]]:
    lowered = {str(key).lower(): value for key, value in raw_row.items()}

    def value_for(name: str) -> Any:
        for alias in COLUMN_ALIASES[name]:
            if alias.lower() in lowered:
                return lowered[alias.lower()]
        return None

    content = to_text(value_for("content")) or to_text(value_for("display_content"))
    msg_type = normalize_msg_type(value_for("msg_type"), value_for("sub_type"), content)
    if not content:
        content = fallback_content_for_type(msg_type)
    ts, iso_dt = normalize_timestamp(value_for("timestamp"))
    chat_id = to_text(value_for("chat_id")) or to_text(value_for("sender_id")) or source_file.stem
    sender_id = to_text(value_for("sender_id"))
    direction = resolve_direction(value_for("direction"), msg_type)
    if not sender_id and direction == "incoming":
        sender_id = chat_id
    if not sender_id and direction == "outgoing":
        sender_id = "self"
    message_id = to_text(value_for("id")) or f"{source_file.stem}:{compact_hash(chat_id, sender_id, ts, content)}"
    if not any([content, chat_id, sender_id, ts]):
        return None
    return {
        "id": message_id,
        "platform": "wechat",
        "exporter": exporter,
        "source_file": str(source_file),
        "source_format": source_format,
        "chat_id": chat_id,
        "chat_name": to_text(value_for("chat_name")) or None,
        "sender_id": sender_id or None,
        "sender_name": to_text(value_for("sender_name")) or None,
        "direction": direction,
        "msg_type": msg_type,
        "timestamp": ts,
        "datetime": iso_dt,
        "content": content,
        "media_path": to_text(value_for("media_path")) or None,
        "raw": {str(key): to_text(val) for key, val in raw_row.items()},
    }


def parse_csv_file(path: Path) -> List[Dict[str, Any]]:
    text = read_text_with_fallback(path)
    lines = text.splitlines()
    if not lines:
        return []
    sample = "\n".join(lines[:20])
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t;")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(lines, dialect=dialect)
    exporter = infer_exporter(path)
    parsed: List[Dict[str, Any]] = []
    for row in reader:
        normalized = normalize_row(row, path, "csv", exporter)
        if normalized:
            parsed.append(normalized)
    return parsed


def walk_json_records(payload: Any, chat_context: Optional[Dict[str, Any]] = None) -> Iterable[Dict[str, Any]]:
    context = dict(chat_context or {})
    if isinstance(payload, list):
        for item in payload:
            for child in walk_json_records(item, context):
                yield child
        return
    if not isinstance(payload, dict):
        return

    next_context = dict(context)
    for key in ("chat_id", "talker", "conversationid", "sessionid", "id"):
        if key in payload and not next_context.get("chat_id"):
            next_context["chat_id"] = payload.get(key)
            break
    for key in ("chat_name", "name", "conversation", "title"):
        if key in payload and not next_context.get("chat_name"):
            next_context["chat_name"] = payload.get(key)
            break

    message_keys = set(COLUMN_ALIASES["content"] + COLUMN_ALIASES["display_content"])
    time_keys = set(COLUMN_ALIASES["timestamp"])
    lower_keys = {str(key).lower() for key in payload.keys()}
    if lower_keys & {key.lower() for key in message_keys} and lower_keys & {key.lower() for key in time_keys}:
        record = dict(payload)
        if next_context.get("chat_id") and "chat_id" not in record:
            record["chat_id"] = next_context["chat_id"]
        if next_context.get("chat_name") and "chat_name" not in record:
            record["chat_name"] = next_context["chat_name"]
        yield record

    for list_key in ("messages", "msglist", "rows", "records", "data", "list"):
        value = payload.get(list_key)
        if isinstance(value, list):
            for item in value:
                for child in walk_json_records(item, next_context):
                    yield child


def parse_json_file(path: Path) -> List[Dict[str, Any]]:
    exporter = infer_exporter(path)
    try:
        payload = json.loads(read_text_with_fallback(path))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"JSON 解析失败: {path}: {exc}") from exc
    parsed: List[Dict[str, Any]] = []
    for row in walk_json_records(payload):
        normalized = normalize_row(row, path, "json", exporter)
        if normalized:
            parsed.append(normalized)
    return parsed


def deduplicate_messages(messages: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduped: Dict[Tuple[Any, ...], Dict[str, Any]] = {}
    for message in messages:
        key = (
            message.get("id"),
            message.get("chat_id"),
            message.get("sender_id"),
            message.get("timestamp"),
            message.get("content"),
        )
        deduped.setdefault(key, message)
    return list(deduped.values())


def filter_messages(messages: Sequence[Dict[str, Any]], chat_filter: Optional[str], limit: Optional[int]) -> List[Dict[str, Any]]:
    filtered = list(messages)
    if chat_filter:
        keyword = chat_filter.casefold()
        filtered = [
            item
            for item in filtered
            if keyword in to_text(item.get("chat_id")).casefold() or keyword in to_text(item.get("chat_name")).casefold()
        ]
    filtered.sort(key=lambda item: (item.get("timestamp") or 0, item.get("id") or ""))
    if limit is not None:
        filtered = filtered[:limit]
    return filtered


def build_stats(messages: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    type_counter = Counter(item.get("msg_type") or "unknown" for item in messages)
    chat_counter = Counter(item.get("chat_name") or item.get("chat_id") or "unknown" for item in messages)
    exporter_counter = Counter(item.get("exporter") or "unknown" for item in messages)
    timestamps = [item.get("timestamp") for item in messages if isinstance(item.get("timestamp"), int)]
    return {
        "message_count": len(messages),
        "chat_count": len(chat_counter),
        "exporters": dict(exporter_counter),
        "message_types": dict(type_counter),
        "top_chats": [{"chat": name, "count": count} for name, count in chat_counter.most_common(10)],
        "time_range": {
            "start": min(timestamps) if timestamps else None,
            "end": max(timestamps) if timestamps else None,
        },
    }


def parse_input_file(path: Path) -> List[Dict[str, Any]]:
    suffix = path.suffix.lower()
    if suffix in {".db", ".sqlite", ".sqlite3"}:
        return parse_sqlite_file(path)
    if suffix == ".csv":
        return parse_csv_file(path)
    if suffix == ".json":
        return parse_json_file(path)
    raise ValueError(f"不支持的文件类型: {path}")


def build_payload(input_path: Path, messages: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "schema_version": "1.0",
        "source": {
            "platform": "wechat",
            "input": str(input_path),
            "generated_at": now_iso(),
        },
        "stats": build_stats(messages),
        "messages": list(messages),
    }


def create_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="解析微信聊天导出并输出标准化 JSON")
    parser.add_argument("--input", required=True, help="输入文件或目录")
    parser.add_argument("--output", required=True, help="输出 JSON 文件路径")
    parser.add_argument("--chat", help="按会话 ID 或会话名过滤")
    parser.add_argument("--self-name", help="自己的微信昵称或备注，用于判断消息方向"
                                             "（导出缺少 issend 字段时作为兜底）")
    parser.add_argument("--limit", type=int, help="最多保留多少条消息")
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
                all_messages.extend(parse_input_file(file_path))
            except Exception as exc:
                print(f"[WARN] 跳过文件 {file_path}: {exc}", file=sys.stderr)
        if not all_messages:
            raise RuntimeError("没有解析到任何消息，请检查输入格式是否正确。")
        deduped = deduplicate_messages(all_messages)
        if args.self_name:
            # 微信导出的方向依赖 issend 字段；部分第三方导出没有该字段，
            # 此时用 --self-name 比对发送者，保证与其它解析器行为一致。
            needle = args.self_name.strip().lower()
            for message in deduped:
                if str(message.get("sender_name") or "").strip().lower() == needle:
                    message["direction"] = "outgoing"
        filtered = filter_messages(deduped, args.chat, args.limit)
        if not filtered:
            raise RuntimeError("过滤后没有消息可输出。")
        payload = build_payload(input_path, filtered)
        write_json(output_path, payload, args.pretty)
        print(f"已输出 {len(filtered)} 条微信消息到 {output_path}")
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
