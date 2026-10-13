#!/usr/bin/env python3
"""Parse Feishu / Lark message exports into relic.skill normalized JSON.

Feishu is the tenth ingestion channel: enterprise history lives in group chats,
doc comments, and Base records, and Lark's own CLI (`lark-cli im messages-list`)
can dump it. This parser accepts the three shapes that actually reach users:

1. lark-cli JSON  — `{"code":0,"data":{"items":[{...}]}}` where each item has
   `sender`, `create_time` (epoch **milliseconds** as a string), `msg_type`,
   and `body.content` (a JSON string that must be parsed a second time).
2. Admin-console CSV — exported per chat, with time / sender / content columns.
3. Plain TXT — the "speaker: message" or "speaker <timestamp>\\nmessage" dumps
   produced by hand or by third-party exporters.

Rich message types (post / image / file / sticker / audio / system) are turned
into readable placeholders rather than being silently dropped — a photo someone
sent at a decisive moment is persona material even without words.

Usage:
  python3 scripts/lark_parser.py --input ~/feishu_export --output data.json
  python3 scripts/lark_parser.py --input messages.json --output data.json --self-name "Zhang"
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

SCHEMA_VERSION = "1.0"
PLATFORM = "feishu"

# 飞书消息体里 text 类型的 content 是 JSON 字符串
RICH_TYPE_HINTS = {
    "image": "[image]",
    "file": "[file]",
    "audio": "[voice message]",
    "media": "[video]",
    "sticker": "[sticker]",
    "system": "[system message]",
    "interactive": "[card]",
    "share_chat": "[shared chat]",
    "share_user": "[shared contact]",
}

TXT_HEADER_RE = re.compile(
    r"^(?P<sender>[^:：]{1,64}?)\s+"
    r"(?P<date>\d{4}[-/]\d{1,2}[-/]\d{1,2})[\sT]+"
    r"(?P<time>\d{1,2}:\d{2}(?::\d{2})?)\s*$"
)
TXT_INLINE_RE = re.compile(r"^(?P<sender>[^:：]{1,64}?)\s*[:：]\s?(?P<text>.*)$")


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def parse_timestamp(value: Any) -> Optional[int]:
    """Feishu uses epoch milliseconds (often as a string); also accept ISO."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        v = float(value)
        return int(v / 1000) if v > 1e11 else int(v)
    text = str(value).strip()
    if not text:
        return None
    if text.isdigit():
        return parse_timestamp(int(text))
    candidate = text.replace("Z", "+00:00").replace("/", "-")
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d %H:%M"):
        try:
            dt = datetime.strptime(candidate, fmt)
        except ValueError:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp())
    try:
        dt = datetime.fromisoformat(candidate)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def sender_name(item: Dict[str, Any], handles: Dict[str, str]) -> str:
    sender = item.get("sender")
    if isinstance(sender, dict):
        for key in ("name", "sender_id", "id", "open_id", "user_id"):
            value = sender.get(key)
            if value:
                text = str(value)
                return handles.get(text, text)
    if isinstance(sender, str) and sender:
        return handles.get(sender, sender)
    for key in ("sender_name", "from", "from_name", "user", "username"):
        value = item.get(key)
        if value:
            return str(value)
    return "unknown"


def message_text(item: Dict[str, Any]) -> str:
    """Flatten every message type into something a persona can be built from."""
    msg_type = str(item.get("msg_type") or item.get("type") or "text").lower()

    # 1) text: body.content 是 JSON 字符串 {"text": "..."}
    body = item.get("body")
    raw_content: Any = None
    if isinstance(body, dict):
        raw_content = body.get("content")
    if raw_content is None:
        raw_content = item.get("content") or item.get("text")

    if isinstance(raw_content, str):
        stripped = raw_content.strip()
        if stripped.startswith("{"):
            try:
                decoded = json.loads(stripped)
            except json.JSONDecodeError:
                decoded = None
            if isinstance(decoded, dict):
                if "text" in decoded and decoded["text"] is not None:
                    return str(decoded["text"]).strip()
                if "title" in decoded:
                    # post / card: 拼 title + 段落文字
                    parts = [str(decoded.get("title") or "").strip()]
                    for block in decoded.get("content") or []:
                        if isinstance(block, list):
                            for node in block:
                                if isinstance(node, dict) and node.get("text"):
                                    parts.append(str(node["text"]))
                    joined = " ".join(p for p in parts if p)
                    if joined:
                        return joined
                # 结构化但没有文字（图片 key、文件 key 等）：走占位符，
                # 不能把原始 JSON 当消息内容抛给下游。
                hint = RICH_TYPE_HINTS.get(msg_type)
                if hint:
                    name = (item.get("file_name") or decoded.get("file_name")
                            or decoded.get("image_key") or decoded.get("file_key") or "")
                    return f"{hint} {name}".strip()
            elif isinstance(decoded, str):
                return decoded.strip()
        elif stripped:
            return stripped

    if isinstance(raw_content, dict):
        if raw_content.get("text"):
            return str(raw_content["text"]).strip()
        if raw_content.get("title"):
            return str(raw_content["title"]).strip()

    # 2) 非文本类型：给出可读占位，而不是直接丢弃
    hint = RICH_TYPE_HINTS.get(msg_type)
    if hint:
        name = item.get("file_name") or item.get("file_key") or ""
        return f"{hint} {name}".strip()
    return ""


def chat_label(item: Dict[str, Any], fallback: str) -> str:
    for key in ("chat_name", "chat", "room_name", "channel"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict) and value.get("name"):
            return str(value["name"]).strip()
    return fallback


def load_handle_map(root: Path) -> Dict[str, str]:
    """可选：把 open_id 映射成真名（lark-cli 的联系人导出常见形式）。"""
    mapping: Dict[str, str] = {}
    candidates = [root] if root.is_file() else list(root.rglob("*.json"))
    for path in candidates[:50]:
        if path.name.lower() not in {"users.json", "contacts.json", "members.json"}:
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError, OSError):
            continue
        items = payload.get("data", {}).get("items") if isinstance(payload, dict) else payload
        if not isinstance(items, list):
            continue
        for entry in items:
            if not isinstance(entry, dict):
                continue
            name = entry.get("name") or entry.get("nickname")
            for key in ("open_id", "user_id", "union_id", "id", "email"):
                ident = entry.get(key)
                if ident and name:
                    mapping[str(ident)] = str(name)
    return mapping


def parse_lark_json(path: Path, handles: Dict[str, str], self_name: Optional[str]) -> List[Dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))

    items: List[Dict[str, Any]] = []
    if isinstance(payload, dict):
        data = payload.get("data")
        if isinstance(data, dict) and isinstance(data.get("items"), list):
            items = [i for i in data["items"] if isinstance(i, dict)]
        elif isinstance(payload.get("items"), list):
            items = [i for i in payload["items"] if isinstance(i, dict)]
        elif isinstance(payload.get("messages"), list):
            items = [i for i in payload["messages"] if isinstance(i, dict)]
    elif isinstance(payload, list):
        items = [i for i in payload if isinstance(i, dict)]

    fallback_chat = path.stem.replace("_", " ")
    out: List[Dict[str, Any]] = []
    for item in items:
        body = message_text(item)
        if not body:
            continue
        who = sender_name(item, handles)
        outgoing = bool(self_name and who.strip().lower() == self_name.strip().lower())
        out.append({
            "sender_name": who,
            "timestamp": parse_timestamp(
                item.get("create_time") or item.get("timestamp") or item.get("time")
            ),
            "content": body,
            "chat_name": chat_label(item, fallback_chat),
            "direction": "outgoing" if outgoing else "incoming",
        })
    return out


def parse_csv(path: Path, handles: Dict[str, str], self_name: Optional[str]) -> List[Dict[str, Any]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    reader = csv.DictReader(text.splitlines())
    if not reader.fieldnames:
        return []

    def pick(row: Dict[str, str], *names: str) -> Optional[str]:
        for key in row:
            if key and key.strip().lower() in names:
                return row[key]
        return None

    chat = path.stem.replace("_", " ")
    out: List[Dict[str, Any]] = []
    for row in reader:
        body = pick(row, "content", "message", "text", "消息内容", "内容")
        who = pick(row, "sender", "sender_name", "from", "发送者", "发送人") or "unknown"
        stamp = pick(row, "time", "timestamp", "create_time", "date", "时间", "发送时间")
        if not body:
            continue
        who = handles.get(who, who)
        outgoing = bool(self_name and who.strip().lower() == self_name.strip().lower())
        out.append({
            "sender_name": who,
            "timestamp": parse_timestamp(stamp),
            "content": str(body).strip(),
            "chat_name": chat,
            "direction": "outgoing" if outgoing else "incoming",
        })
    return out


def parse_txt(path: Path, self_name: Optional[str]) -> List[Dict[str, Any]]:
    chat = path.stem.replace("_", " ")
    out: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    pending_sender: Optional[str] = None
    pending_stamp: Optional[int] = None

    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            continue

        header = TXT_HEADER_RE.match(line.strip())
        if header:
            pending_sender = header.group("sender").strip()
            pending_stamp = parse_timestamp(f"{header.group('date')} {header.group('time')}")
            continue

        inline = TXT_INLINE_RE.match(line.strip())
        if inline and not line.startswith(("http", "[", "http")):
            if current is not None:
                out.append(current)
            who = inline.group("sender").strip()
            current = {
                "sender_name": who,
                "timestamp": pending_stamp,
                "content": inline.group("text").strip(),
                "chat_name": chat,
                "direction": "outgoing" if (self_name and who.lower() == self_name.strip().lower()) else "incoming",
            }
            pending_stamp = None
            continue

        if current is not None:
            current["content"] += "\n" + line.strip()
        elif pending_sender:
            current = {
                "sender_name": pending_sender,
                "timestamp": pending_stamp,
                "content": line.strip(),
                "chat_name": chat,
                "direction": "outgoing" if (self_name and pending_sender.lower() == self_name.strip().lower()) else "incoming",
            }
            pending_stamp = None

    if current is not None:
        out.append(current)
    return [m for m in out if m["content"]]


def discover_inputs(input_path: Path) -> List[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.is_dir():
        raise RuntimeError(f"输入路径不存在: {input_path}")
    files = sorted(
        p for p in input_path.rglob("*")
        if p.is_file() and p.suffix.lower() in {".json", ".csv", ".txt"}
        and p.name.lower() not in {"users.json", "contacts.json", "members.json"}
    )
    if not files:
        raise RuntimeError("目录下没有找到 .json / .csv / .txt —— 飞书导出通常是这三种之一。")
    return files


def deduplicate(messages: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out: List[Dict[str, Any]] = []
    for msg in messages:
        key = (msg.get("chat_name"), msg.get("timestamp"), msg.get("sender_name"), msg.get("content"))
        if key in seen:
            continue
        seen.add(key)
        out.append(msg)
    # 只按时间戳排序：无时间戳的消息全部落在 0，稳定排序会保持原始顺序。
    # （曾经把 sender_name 也放进 key，导致没有时间戳的导出被按人名重排，
    # 对话顺序整个乱掉——顺序本身就是人格素材。）
    out.sort(key=lambda m: m.get("timestamp") or 0)
    return out


def build_stats(messages: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    senders: Dict[str, int] = {}
    for msg in messages:
        name = str(msg.get("sender_name") or "")
        senders[name] = senders.get(name, 0) + 1
    stamps = [m["timestamp"] for m in messages if m.get("timestamp")]
    return {
        "message_count": len(messages),
        "participant_count": len(senders),
        "top_speakers": sorted(senders.items(), key=lambda kv: kv[1], reverse=True)[:5],
        "earliest": min(stamps) if stamps else None,
        "latest": max(stamps) if stamps else None,
    }


def build_payload(input_path: Path, files: Sequence[Path], messages: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "source": {
            "platform": PLATFORM,
            "input": str(input_path),
            "files": [str(p) for p in files],
            "generated_at": now_iso(),
        },
        "stats": build_stats(messages),
        "messages": list(messages),
    }


def write_json(output_path: Path, payload: Dict[str, Any], pretty: bool) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2 if pretty else None),
        encoding="utf-8",
    )


def create_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="解析飞书 / Lark 消息导出（lark-cli JSON / 管理后台 CSV / 文本导出）并输出标准化 JSON")
    parser.add_argument("--input", required=True, help="输入文件或目录（递归扫描 .json/.csv/.txt）")
    parser.add_argument("--output", required=True, help="输出 JSON 文件路径")
    parser.add_argument("--chat", help="按会话名过滤")
    parser.add_argument("--self-name", help="自己的显示名，用于判断消息方向")
    parser.add_argument("--limit", type=int, help="最多输出多少条消息")
    parser.add_argument("--pretty", action="store_true", help="输出格式化 JSON")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    args = create_argument_parser().parse_args(argv)
    input_path = Path(args.input).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()

    try:
        handles = load_handle_map(input_path if input_path.is_dir() else input_path.parent)
        files = discover_inputs(input_path)

        collected: List[Dict[str, Any]] = []
        for path in files:
            try:
                suffix = path.suffix.lower()
                if suffix == ".json":
                    collected.extend(parse_lark_json(path, handles, args.self_name))
                elif suffix == ".csv":
                    collected.extend(parse_csv(path, handles, args.self_name))
                else:
                    collected.extend(parse_txt(path, args.self_name))
            except Exception as exc:
                print(f"[WARN] 跳过文件 {path.name}: {exc}", file=sys.stderr)

        if not collected:
            raise RuntimeError(
                "没有解析到任何飞书消息。请确认导出内容包含 sender / content "
                "（lark-cli 的 im messages-list JSON、管理后台 CSV 或文本导出均可）。"
            )

        messages = deduplicate(collected)
        if args.chat:
            needle = args.chat.strip().lower()
            messages = [m for m in messages if needle in str(m.get("chat_name", "")).lower()]
        if args.limit:
            messages = messages[: args.limit]
        if not messages:
            raise RuntimeError("过滤后没有消息可输出。")

        write_json(output_path, build_payload(input_path, files, messages), args.pretty)
        print(f"已输出 {len(messages)} 条飞书消息到 {output_path}")
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())