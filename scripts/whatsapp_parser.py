#!/usr/bin/env python3
r"""Parse WhatsApp chat exports into relic.skill normalized JSON.

WhatsApp's official Export Chat writes one .txt per conversation. Formats vary
by locale and platform, so several common shapes are accepted:

  [2023/1/5, 10:00:00] Alice: hello          (iOS, bracketed)
  1/5/23, 10:00 - Alice: hello               (Android)
  01/05/2023, 10:00 - Alice: hello           (EU locale)
  Alice: hello                                (no timestamps)

Multi-line messages and "<Media omitted>" placeholders are handled.

Usage:
  python3 scripts/whatsapp_parser.py --input ~/WhatsApp/Chat\ with\ Alice --output data.json
  python3 scripts/whatsapp_parser.py --input export.zip-dir --output data.json --self-name me
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

SCHEMA_VERSION = "1.0"
PLATFORM = "whatsapp"

# Bracketed: [2023/1/5, 10:00:00] Alice: text
BRACKET_RE = re.compile(
    r"^\[(?P<date>\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}),?\s+"
    r"(?P<time>\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?)\]\s*(?P<rest>.*)$"
)
# Dash form: 1/5/23, 10:00 - Alice: text   /  01/05/2023, 10:00:00 - Alice: text
DASH_RE = re.compile(
    r"^(?P<date>\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}),\s+"
    r"(?P<time>\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?)\s*[-–—]\s*(?P<rest>.*)$"
)
# Plain: 1/5/23, 10:00 - Alice: text  (no leading dash date separator variant)
PLAIN_TS_RE = re.compile(
    r"^(?P<date>\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}),\s+"
    r"(?P<time>\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?),\s*-\s*(?P<rest>.*)$"
)
# "Alice: message" — sender up to the first colon
SENDER_RE = re.compile(r"^(?P<sender>[^:]{1,64}?)\s*:\s?(?P<text>.*)$")

SYSTEM_PATTERNS = (
    "Messages and calls are end-to-end encrypted",
    "created this group",
    "added you",
    "Messages are not visible",
    "<Media omitted>",
    "This message was deleted",
)


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def parse_datetime(date_str: str, time_str: str) -> Optional[int]:
    """Tolerant timestamp parsing across WhatsApp locales."""
    date_str = date_str.strip().replace(".", "/").replace("-", "/")
    time_str = time_str.strip().replace(" ", "")
    ampm = ""
    lowered = time_str.lower()
    for marker in ("am", "pm"):
        if marker in lowered:
            ampm = marker
            time_str = lowered.replace(marker, "")
            break
    parts = date_str.split("/")
    if len(parts) != 3:
        return None
    a, b, c = parts
    year: int
    if len(a) == 4:
        year, month, day = int(a), int(b), int(c)
    else:
        # two-digit year first (1/5/23) or last (05/01/2023)
        if len(c) == 4:
            day, month, year = int(a), int(b), int(c)
        else:
            month, day, year = int(a), int(b), 2000 + int(c)

    hour, minute, second = 0, 0, 0
    tparts = time_str.split(":")
    if tparts:
        hour = int(tparts[0])
    if len(tparts) > 1:
        minute = int(tparts[1])
    if len(tparts) > 2:
        try:
            second = int(tparts[2])
        except ValueError:
            second = 0

    if ampm == "pm" and hour < 12:
        hour += 12
    if ampm == "am" and hour == 12:
        hour = 0

    try:
        dt = datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)
    except ValueError:
        return None
    return int(dt.timestamp())


def split_sender(rest: str) -> Optional[tuple[str, str]]:
    match = SENDER_RE.match(rest.strip())
    if not match:
        return None
    sender = match.group("sender").strip()
    # guard against system lines like "Messages and calls are encrypted: ..."
    if sender.lower().startswith(("messages", "this message", "you deleted")):
        return None
    return sender, match.group("text").strip()


def parse_file(path: Path, self_name: Optional[str]) -> List[Dict[str, Any]]:
    chat = path.stem.replace("_", " ")
    out: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None

    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError as exc:
        raise RuntimeError(f"无法读取 {path.name}: {exc}") from exc

    for line in lines:
        text = line.rstrip()
        timestamp: Optional[int] = None
        rest: Optional[str] = None

        for pattern in (BRACKET_RE, DASH_RE, PLAIN_TS_RE):
            match = pattern.match(text)
            if match:
                timestamp = parse_datetime(match.group("date"), match.group("time"))
                rest = match.group("rest")
                break

        if rest is None:
            # continuation of a multi-line message, or a no-timestamp file
            if current is not None and text.strip():
                current["content"] += "\n" + text.strip()
                continue
            if text.strip():
                sender_text = split_sender(text)
                if sender_text:
                    current = {
                        "sender_name": sender_text[0],
                        "timestamp": None,
                        "content": sender_text[1],
                        "chat_name": chat,
                        "direction": "incoming",
                    }
            continue

        sender_text = split_sender(rest)
        if not sender_text:
            continue
        sender, body = sender_text

        if current is not None:
            out.append(current)
        current = {
            "sender_name": sender,
            "timestamp": timestamp,
            "content": body,
            "chat_name": chat,
            "direction": "outgoing" if (self_name and sender.strip().lower() == self_name.strip().lower()) else "incoming",
        }

    if current is not None:
        out.append(current)

    return [m for m in out if m["content"] and m["sender_name"]]


def discover_inputs(input_path: Path) -> List[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.is_dir():
        raise RuntimeError(f"输入路径不存在: {input_path}")
    files = sorted(p for p in input_path.rglob("*.txt") if p.is_file())
    if not files:
        raise RuntimeError("目录下没有找到 .txt 文件（WhatsApp 导出是每会话一个 txt）。")
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
    parser = argparse.ArgumentParser(description="解析 WhatsApp 导出的 .txt 并输出标准化 JSON")
    parser.add_argument("--input", required=True, help="输入 .txt 文件或目录（递归扫描）")
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
        files = discover_inputs(input_path)
        collected: List[Dict[str, Any]] = []
        for path in files:
            try:
                collected.extend(parse_file(path, args.self_name))
            except Exception as exc:
                print(f"[WARN] 跳过文件 {path.name}: {exc}", file=sys.stderr)

        if not collected:
            raise RuntimeError("没有解析到任何 WhatsApp 消息，请确认导出目录里是 .txt 文件。")

        messages = deduplicate(collected)
        if args.chat:
            needle = args.chat.strip().lower()
            messages = [m for m in messages if needle in str(m.get("chat_name", "")).lower()]
        if args.limit:
            messages = messages[: args.limit]
        if not messages:
            raise RuntimeError("过滤后没有消息可输出。")

        write_json(output_path, build_payload(input_path, files, messages), args.pretty)
        print(f"已输出 {len(messages)} 条 WhatsApp 消息到 {output_path}")
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())