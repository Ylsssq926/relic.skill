#!/usr/bin/env python3
"""Parse Apple iMessage history (~/Library/Messages/chat.db) into relic.skill
normalized JSON.

iMessage is one of the richest personal archives on macOS — and unlike most
platforms, no export dialog is needed: the SQLite database is already there.

Reads:
  - message        (text, attributedBody, handle_id, date, is_from_me, ...)
  - handle         (phone number / email)
  - chat / chat_message_join (conversation grouping)
  - attachment     (file names)

Details handled:
  - Apple epoch conversion (2001-01-01), in both nanosecond and second precision
  - attributedBody fallback: when `text` is NULL, the body lives in a binary
    NSAttributedString blob and is recovered from its readable run
  - reaction / tapback filtering so "Loved \"...\"" noise doesn't pollute the log
  - \ufffc (object replacement char) translated into attachment placeholders

Note for macOS users: reading chat.db may require granting Full Disk Access to
your terminal. Copy the file first (cp ~/Library/Messages/chat.db /tmp/) if you
prefer not to grant it.

Usage:
  python3 scripts/imessage_parser.py --input ~/Library/Messages/chat.db --output data.json
  python3 scripts/imessage_parser.py --input chat.db --output data.json --self-name me@icloud.com
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

SCHEMA_VERSION = "1.0"
PLATFORM = "imessage"

# Apple epoch starts 2001-01-01 00:00:00 UTC
APPLE_EPOCH_OFFSET = 978307200
OBJECT_REPLACEMENT = "\ufffc"
# Tapback reactions are stored as messages with a 2000+ associated_message_type
REACTION_MIN_TYPE = 2000
TAPBACK_LABELS = {
    2000: "Loved", 2001: "Liked", 2002: "Disliked",
    2003: "Laughed at", 2004: "Emphasized", 2005: "Questioned",
    3000: "Removed a heart from", 3001: "Removed a like from",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def apple_to_unix(raw: Any) -> Optional[int]:
    """Apple epoch → Unix seconds, tolerating nanosecond and second precision."""
    if raw is None:
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    if value <= 0:
        return None
    # macOS 10.13+ stores nanoseconds; older stores seconds
    seconds = value / 1_000_000_000 if value > 1e14 else float(value)
    return int(seconds + APPLE_EPOCH_OFFSET)


def extract_from_attributed_body(blob: Optional[bytes]) -> str:
    """Recover text from the NSAttributedString blob when `text` is NULL.

    The blob is a binary plist-ish stream; the readable message run sits after
    the "NSString" marker. We take the longest printable run that follows it.
    """
    if not blob:
        return ""
    try:
        marker = blob.find(b"NSString")
        segment = blob[marker + 8:] if marker != -1 else blob
    except Exception:
        return ""
    # printable ASCII + common CJK/UTF-8 continuation bytes
    runs = re.findall(rb"[\x20-\x7e\xc2-\xf4][\x20-\x7e\x80-\xbf]*", segment)
    if not runs:
        return ""
    best = max(runs, key=len)
    try:
        text = best.decode("utf-8", errors="ignore")
    except Exception:
        return ""
    return text.strip().strip("\x00")


def clean_text(raw: str, has_attachment: bool) -> str:
    text = raw.replace(OBJECT_REPLACEMENT, " ")
    text = re.sub(r"\s{2,}", " ", text).strip()
    if has_attachment:
        text = (text + " [attachment]").strip() if text else "[attachment]"
    return text


def load_chat_names(conn: sqlite3.Connection) -> Dict[int, str]:
    """message.ROWID -> conversation label (display name, else identifier)."""
    mapping: Dict[int, str] = {}
    try:
        rows = conn.execute(
            "SELECT cmj.message_id, COALESCE(c.display_name, c.chat_identifier) "
            "FROM chat_message_join cmj JOIN chat c ON c.ROWID = cmj.chat_id"
        ).fetchall()
        for message_id, label in rows:
            if message_id is not None and label:
                mapping[int(message_id)] = str(label)
    except sqlite3.Error:
        pass
    return mapping


def load_attachment_names(conn: sqlite3.Connection) -> Dict[int, List[str]]:
    """message.ROWID -> attachment file names."""
    mapping: Dict[int, List[str]] = {}
    try:
        rows = conn.execute(
            "SELECT maj.message_id, a.filename FROM message_attachment_join maj "
            "JOIN attachment a ON a.ROWID = maj.attachment_id"
        ).fetchall()
        for message_id, filename in rows:
            if message_id is None or not filename:
                continue
            name = Path(str(filename)).name
            mapping.setdefault(int(message_id), []).append(name)
    except sqlite3.Error:
        pass
    return mapping


def parse_database(db_path: Path, self_name: Optional[str]) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        chat_names = load_chat_names(conn)
        attachments = load_attachment_names(conn)

        has_attributed = True
        try:
            conn.execute("SELECT attributedBody FROM message LIMIT 1")
        except sqlite3.Error:
            has_attributed = False

        columns = "m.ROWID, m.text, m.handle_id, m.date, m.is_from_me, h.id"
        if has_attributed:
            columns += ", m.attributedBody"
        columns += ", m.associated_message_type"

        try:
            rows = conn.execute(
                f"SELECT {columns} FROM message m "
                "LEFT JOIN handle h ON h.ROWID = m.handle_id "
                "ORDER BY m.date ASC"
            ).fetchall()
        except sqlite3.Error as exc:
            raise RuntimeError(f"读取 message 表失败：{exc}") from exc

        out: List[Dict[str, Any]] = []
        for row in rows:
            (rowid, text, handle_id, date, is_from_me, handle_value,
             *rest) = row
            attributed, assoc_type = (rest + [None, None])[:2] if has_attributed else (None, row[-1])

            # reactions are not messages — they're metadata about other messages
            if assoc_type is not None:
                try:
                    if int(assoc_type) >= REACTION_MIN_TYPE:
                        continue
                except (TypeError, ValueError):
                    pass

            body = str(text) if text else ""
            if not body and has_attributed:
                body = extract_from_attributed_body(attributed)

            names = attachments.get(int(rowid), [])
            cleaned = clean_text(body, bool(names))
            if not cleaned:
                continue
            if names:
                cleaned += f" ({', '.join(names)})"

            sender = str(handle_value or "unknown")
            outgoing = bool(is_from_me)
            # is_from_me rows carry no handle: label them with the user's own name
            if outgoing:
                sender = self_name or "me"

            out.append({
                "sender_name": sender,
                "timestamp": apple_to_unix(date),
                "content": cleaned,
                "chat_name": chat_names.get(int(rowid)) or sender,
                "direction": "outgoing" if outgoing else "incoming",
            })
        return out
    finally:
        conn.close()


def deduplicate(messages: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out: List[Dict[str, Any]] = []
    for msg in messages:
        key = (msg.get("chat_name"), msg.get("timestamp"), msg.get("sender_name"), msg.get("content"))
        if key in seen:
            continue
        seen.add(key)
        out.append(msg)
    out.sort(key=lambda m: (m.get("timestamp") or 0, m.get("sender_name") or ""))
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


def build_payload(input_path: Path, messages: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "source": {
            "platform": PLATFORM,
            "input": str(input_path),
            "files": [str(input_path)],
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
        description="解析 macOS iMessage 数据库（chat.db）并输出标准化 JSON")
    parser.add_argument("--input", required=True,
                        help="chat.db 路径（默认 ~/Library/Messages/chat.db，可先复制到别处）")
    parser.add_argument("--output", required=True, help="输出 JSON 文件路径")
    parser.add_argument("--chat", help="按会话名或联系人过滤")
    parser.add_argument("--self-name", help="自己的名字或账号，用于标记发出的消息")
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
        if not input_path.exists():
            raise RuntimeError(
                f"找不到数据库：{input_path}\n"
                "macOS 默认路径为 ~/Library/Messages/chat.db；读取它可能需要给终端"
                "「完全磁盘访问权限」，或先 `cp ~/Library/Messages/chat.db /tmp/` 再解析。"
            )
        if not input_path.is_file():
            raise RuntimeError(f"输入必须是 chat.db 文件，而不是目录：{input_path}")

        collected = parse_database(input_path, args.self_name)
        if not collected:
            raise RuntimeError(
                "没有解析到任何 iMessage 消息。请确认这是 chat.db（而不是导出的 CSV），"
                "并且其中有已同步的历史记录。"
            )

        messages = deduplicate(collected)
        if args.chat:
            needle = args.chat.strip().lower()
            messages = [m for m in messages if needle in str(m.get("chat_name", "")).lower()]
        if args.limit:
            messages = messages[: args.limit]
        if not messages:
            raise RuntimeError("过滤后没有消息可输出。")

        write_json(output_path, build_payload(input_path, messages), args.pretty)
        print(f"已输出 {len(messages)} 条 iMessage 消息到 {output_path}")
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())