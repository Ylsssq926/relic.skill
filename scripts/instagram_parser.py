#!/usr/bin/env python3
"""Parse Instagram data downloads into relic.skill normalized JSON.

Instagram's "Download Your Information" produces a zip; extract it and point
this script at the folder. Two useful sources:

1. Direct messages  (messages/inbox/<thread>/message_1.json, or the older
   messages/inbox/<thread>.json)
   {"participants":[{"name":"Alice"},{"name":"Bob"}], "title":"Alice",
    "messages":[{"sender_name":"Alice","timestamp_ms":1600000000000,"text":"hi"}]}

2. Comments         (posts/comments_*.json or posts/media/*.json)
   [{"owner":{"username":"alice"},"text":"...","timestamp":"2023-01-01T10:00:00Z"}]

Comments carry real signal too — how someone talks to you publicly is persona
material, so both sources are normalized into one message list.

Usage:
  python3 scripts/instagram_parser.py --input ~/instagram-data --output data.json
  python3 scripts/instagram_parser.py --input data-package --output data.json --self-name me
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

SCHEMA_VERSION = "1.0"
PLATFORM = "instagram"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def parse_ts(value: Any) -> Optional[int]:
    """Instagram uses both epoch milliseconds and ISO strings."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        v = float(value)
        return int(v / 1000) if v > 1e11 else int(v)
    text = str(value).strip()
    if not text:
        return None
    if text.isdigit():
        return parse_ts(int(text))
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def iter_message_files(root: Path) -> List[Path]:
    files = sorted(p for p in root.rglob("*.json") if p.is_file())
    msg_files = [
        p for p in files
        if "messages" in p.parts and "inbox" in p.parts
    ]
    comment_files = [
        p for p in files
        if ("comments" in p.name.lower() or "comments" in p.parts)
    ]
    return msg_files + comment_files


def parse_thread_file(path: Path, self_name: Optional[str]) -> List[Dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise RuntimeError(f"无法读取 {path.name}: {exc}") from exc

    chat = ""
    raw_messages: List[Dict[str, Any]] = []

    if isinstance(payload, dict):
        chat = str(payload.get("title") or "").strip()
        raw_messages = [m for m in payload.get("messages", []) if isinstance(m, dict)]
    elif isinstance(payload, list):
        # older format: a list of threads, or a list of messages
        if payload and isinstance(payload[0], dict) and "messages" in payload[0]:
            out: List[Dict[str, Any]] = []
            for thread in payload:
                if isinstance(thread, dict):
                    out.extend(_thread_to_messages(thread, self_name))
            return out
        raw_messages = [m for m in payload if isinstance(m, dict)]

    if not chat:
        participants = payload.get("participants") if isinstance(payload, dict) else None
        if isinstance(participants, list):
            names = [str(p.get("name") or "") for p in participants if isinstance(p, dict)]
            chat = " & ".join(n for n in names if n)
        if not chat:
            chat = path.parent.name.replace("_", " ")

    out = []
    for raw in raw_messages:
        sender = str(raw.get("sender_name") or raw.get("sender") or "unknown")
        body = raw.get("text")
        if body is None:
            body = raw.get("content") or ""
        body = str(body).strip()
        if not body:
            continue
        outgoing = bool(self_name and sender.strip().lower() == self_name.strip().lower())
        out.append({
            "sender_name": sender,
            "timestamp": parse_ts(raw.get("timestamp_ms") or raw.get("timestamp")),
            "content": body,
            "chat_name": chat or "instagram",
            "direction": "outgoing" if outgoing else "incoming",
        })
    return out


def _thread_to_messages(thread: Dict[str, Any], self_name: Optional[str]) -> List[Dict[str, Any]]:
    chat = str(thread.get("title") or "").strip()
    if not chat:
        participants = thread.get("participants") or []
        names = [str(p.get("name") or "") for p in participants if isinstance(p, dict)]
        chat = " & ".join(n for n in names if n) or "instagram"
    out = []
    for raw in thread.get("messages", []):
        if not isinstance(raw, dict):
            continue
        sender = str(raw.get("sender_name") or "unknown")
        body = str(raw.get("text") or "").strip()
        if not body:
            continue
        outgoing = bool(self_name and sender.strip().lower() == self_name.strip().lower())
        out.append({
            "sender_name": sender,
            "timestamp": parse_ts(raw.get("timestamp_ms")),
            "content": body,
            "chat_name": chat,
            "direction": "outgoing" if outgoing else "incoming",
        })
    return out


def parse_comments_file(path: Path, self_name: Optional[str]) -> List[Dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise RuntimeError(f"无法读取 {path.name}: {exc}") from exc

    entries = payload if isinstance(payload, list) else payload.get("comments", [])
    out = []
    for raw in entries:
        if not isinstance(raw, dict):
            continue
        owner = raw.get("owner") or {}
        username = str(owner.get("username") or owner.get("full_name") or "") if isinstance(owner, dict) else str(owner)
        body = str(raw.get("text") or "").strip()
        if not username or not body:
            continue
        out.append({
            "sender_name": username,
            "timestamp": parse_ts(raw.get("timestamp")),
            "content": body,
            "chat_name": f"@{username} (comment)",
            "direction": "outgoing" if (self_name and username.strip().lower() == self_name.strip().lower()) else "incoming",
        })
    return out


def deduplicate(messages: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out: List[Dict[str, Any]] = []
    for msg in messages:
        key = (msg.get("chat_name"), msg.get("timestamp"), msg.get("sender_name"), msg.get("content"))
        if key in seen:
            continue
        seen.add(key)
        out.append(msg)
        # 只按时间戳排序；无时间戳的消息落在 0，稳定排序会保持原始顺序。
    # （把 sender_name 也放进 key 会让无时间戳的导出按人名重排，对话顺序乱掉。）
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
    parser = argparse.ArgumentParser(description="解析 Instagram 数据下载（私信 + 评论）并输出标准化 JSON")
    parser.add_argument("--input", required=True, help="Instagram 数据包目录（解压后的）")
    parser.add_argument("--output", required=True, help="输出 JSON 文件路径")
    parser.add_argument("--self-name", help="自己的用户名，用于判断消息方向")
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
        if not input_path.is_dir():
            raise RuntimeError(
                f"输入目录不存在: {input_path}（Instagram 下载是 zip，请先解压再指向目录）"
            )
        files = iter_message_files(input_path)
        if not files:
            raise RuntimeError(
                "目录下没有找到 messages/inbox 或 comments JSON —— "
                "确认这是 Instagram \"Download Your Information\" 解压后的目录。"
            )

        collected: List[Dict[str, Any]] = []
        for path in files:
            try:
                if "comments" in path.name.lower() or "comments" in path.parts:
                    collected.extend(parse_comments_file(path, args.self_name))
                else:
                    collected.extend(parse_thread_file(path, args.self_name))
            except Exception as exc:
                print(f"[WARN] 跳过文件 {path.name}: {exc}", file=sys.stderr)

        if not collected:
            raise RuntimeError("没有解析到任何 Instagram 消息/评论。")

        messages = deduplicate(collected)
        if args.limit:
            messages = messages[: args.limit]
        if not messages:
            raise RuntimeError("过滤后没有消息可输出。")

        write_json(output_path, build_payload(input_path, files, messages), args.pretty)
        print(f"已输出 {len(messages)} 条 Instagram 消息/评论到 {output_path}")
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())