#!/usr/bin/env python3
"""Parse email exports (Gmail MBOX / .eml / single .mbox) into relic.skill
normalized JSON.

Email is the most universal archive people have — and long threads with one
person are often the richest persona material after chat logs.

Supported inputs:
  - Gmail Takeout: *.mbox (one per label)
  - Apple Mail: MailData.zip containing V*.mbox / *.eml  — point at the folder
  - A folder of .eml files
  - A single .mbox file

Quoted replies are trimmed to the newest message so the "content" reflects what
this person actually wrote, not the whole chain. Attachments and subject
context are kept.

Usage:
  python3 scripts/email_parser.py --input ~/Takeout/Archive.mbox --output data.json
  python3 scripts/email_parser.py --input ~/MailData --output data.json --self-name me@x.com
"""
from __future__ import annotations

import argparse
import email
import json
import mailbox
import re
import sys
from datetime import datetime, timezone
from email.header import decode_header, make_header
from email.utils import parseaddr
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

SCHEMA_VERSION = "1.0"
PLATFORM = "email"

QUOTE_PATTERNS = (
    re.compile(r"^\s*>", re.M),
    re.compile(r"^On .+ wrote:\s*$", re.M),
    re.compile(r"^-{2,}\s*Original Message\s*-{2,}", re.M | re.I),
    re.compile(r"^_{5,}", re.M),
)


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def decode_value(raw: Optional[str]) -> str:
    if not raw:
        return ""
    try:
        return str(make_header(decode_header(raw)))
    except Exception:
        return str(raw)


def parse_timestamp(raw: Any) -> Optional[int]:
    if raw is None:
        return None
    try:
        dt = email.utils.parsedate_to_datetime(str(raw))
    except (TypeError, ValueError):
        return None
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def split_reply(body: str) -> str:
    """Keep only the new part of a reply."""
    if not body:
        return ""
    cut = len(body)
    for pattern in QUOTE_PATTERNS:
        match = pattern.search(body)
        if match and match.start() < cut:
            cut = match.start()
    return body[:cut].strip()


def clean_body(msg: email.message.Message) -> str:
    if msg.is_multipart():
        parts: List[str] = []
        for part in msg.walk():
            if part.get_content_maintype() == "multipart":
                continue
            if part.get_content_type() != "text/plain":
                continue
            try:
                payload = part.get_payload(decode=True)
                if payload is None:
                    continue
                charset = part.get_content_charset() or "utf-8"
                parts.append(payload.decode(charset, errors="replace"))
            except Exception:
                continue
        body = "\n".join(parts)
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload is None:
                body = str(msg.get_payload() or "")
            else:
                charset = msg.get_content_charset() or "utf-8"
                body = payload.decode(charset, errors="replace")
        except Exception:
            body = str(msg.get_payload() or "")

    body = split_reply(body.strip())

    attachments: List[str] = []
    if msg.is_multipart():
        for part in msg.walk():
            fname = part.get_filename()
            if fname:
                attachments.append(decode_value(fname))
    if attachments:
        body += "\n[attachments: " + ", ".join(attachments) + "]"
    return body.strip()


def message_to_dict(msg: email.message.Message, self_addr: Optional[str], default_chat: str) -> Optional[Dict[str, Any]]:
    body = clean_body(msg)
    if not body:
        return None

    from_header = decode_value(msg.get("From"))
    sender = parseaddr(from_header)[1] or from_header or "unknown"
    display = parseaddr(from_header)[0] or sender

    subject = decode_value(msg.get("Subject"))
    chat = f"{default_chat}: {subject}" if subject else default_chat

    outgoing = False
    if self_addr:
        outgoing = sender.strip().lower() == self_addr.strip().lower()

    return {
        "sender_name": display or sender,
        "sender_email": sender,
        "timestamp": parse_timestamp(msg.get("Date")),
        "content": body,
        "chat_name": chat,
        "direction": "outgoing" if outgoing else "incoming",
    }


def discover_inputs(input_path: Path) -> List[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.is_dir():
        raise RuntimeError(f"输入路径不存在: {input_path}")
    files = sorted(
        p for p in input_path.rglob("*")
        if p.is_file() and p.suffix.lower() in {".mbox", ".eml", ".txt"}
    )
    if not files:
        raise RuntimeError("目录下没有找到 .mbox / .eml 文件。")
    return files


def parse_file(path: Path, self_addr: Optional[str]) -> List[Dict[str, Any]]:
    label = path.stem.replace("_", " ")
    out: List[Dict[str, Any]] = []

    try:
        if path.suffix.lower() == ".eml":
            msg = email.message_from_bytes(path.read_bytes())
            item = message_to_dict(msg, self_addr, label)
            return [item] if item else []

        box = mailbox.mbox(str(path), create=False)
        try:
            for msg in box:
                if not isinstance(msg, email.message.Message):
                    continue
                item = message_to_dict(msg, self_addr, label)
                if item:
                    out.append(item)
        finally:
            box.close()
    except Exception as exc:
        raise RuntimeError(f"无法读取 {path.name}: {exc}") from exc

    return out


def deduplicate(messages: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out: List[Dict[str, Any]] = []
    for msg in messages:
        key = (msg.get("sender_email") or msg.get("sender_name"),
               msg.get("timestamp"), msg.get("content"))
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
    parser = argparse.ArgumentParser(description="解析邮件导出（MBOX / EML）并输出标准化 JSON")
    parser.add_argument("--input", required=True, help="输入 .mbox / .eml 文件或目录（递归扫描）")
    parser.add_argument("--output", required=True, help="输出 JSON 文件路径")
    parser.add_argument("--self-name", help="自己的邮箱地址，用于判断消息方向")
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
            raise RuntimeError("没有解析到任何邮件，请确认输入是 MBOX 或 EML。")

        messages = deduplicate(collected)
        if args.limit:
            messages = messages[: args.limit]

        write_json(output_path, build_payload(input_path, files, messages), args.pretty)
        print(f"已输出 {len(messages)} 封邮件到 {output_path}")
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())