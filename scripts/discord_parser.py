#!/usr/bin/env python3
"""Parse Discord exports into relic.skill normalized JSON.

Handles the two shapes users actually have:

1. DiscordChatExporter JSON (one file per channel):
   {"guild": {...}, "channel": {...}, "messages": [
       {"type":"Default","timestamp":"2021-01-01T12:00:00.000+00:00",
        "content":"hi","author":{"name":"user","nickname":"..."}}]}

2. Discord official data package (Settings -> Data & Privacy):
   messages/<guild_id>/<channel_id>/<channel_id>.json  (same message shape)
   DM_Chats/<user_id>/<user_id>.json

Usage:
  python3 scripts/discord_parser.py --input ~/discord_export --output data.json
  python3 scripts/discord_parser.py --input export.json --output data.json --self-name me
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
PLATFORM = "discord"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def parse_timestamp(value: Any) -> Optional[int]:
    """Discord ISO8601 (with or without offset) -> Unix seconds."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value).strip()
    if not text:
        return None
    text = text.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        for fmt in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S"):
            try:
                dt = datetime.strptime(text, fmt)
                break
            except ValueError:
                continue
        else:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def author_name(raw: Dict[str, Any]) -> str:
    author = raw.get("author") or raw.get("member") or {}
    if isinstance(author, str):
        return author
    for key in ("name", "username", "global_name", "nickname", "displayName"):
        value = author.get(key) or raw.get(key)
        if value:
            return str(value).strip()
    return "unknown"


def message_text(raw: Dict[str, Any]) -> str:
    """Body plus attachment hints (a photo message has no text but still matters)."""
    parts: List[str] = []
    content = str(raw.get("content") or "").strip()
    if content:
        parts.append(content)

    attachments = raw.get("attachments") or []
    if isinstance(attachments, list):
        for att in attachments:
            if isinstance(att, dict):
                name = att.get("fileName") or att.get("filename") or att.get("url") or ""
                if name:
                    parts.append(f"[attachment: {name}]")
            elif isinstance(att, str):
                parts.append(f"[attachment: {att}]")

    embeds = raw.get("embeds") or []
    if isinstance(embeds, list):
        for emb in embeds:
            if isinstance(emb, dict):
                title = str(emb.get("title") or "").strip()
                desc = str(emb.get("description") or "").strip()
                snippet = " — ".join(x for x in (title, desc) if x)
                if snippet:
                    parts.append(f"[embed: {snippet}]")

    stickers = raw.get("stickers") or []
    if isinstance(stickers, list):
        names = [str(s.get("name") or "") for s in stickers if isinstance(s, dict)]
        names = [n for n in names if n]
        if names:
            parts.append(f"[sticker: {', '.join(names)}]")

    reactions = raw.get("reactions") or []
    if isinstance(reactions, list):
        for react in reactions:
            if isinstance(react, dict):
                emoji = react.get("emoji") or {}
                name = emoji.get("name") if isinstance(emoji, dict) else str(emoji)
                count = react.get("count")
                if name:
                    parts.append(f"[reaction: {name} x{count}]" if count else f"[reaction: {name}]")

    return "\n".join(parts).strip()


def channel_label(payload: Dict[str, Any]) -> str:
    channel = payload.get("channel")
    if isinstance(channel, dict):
        label = str(channel.get("name") or channel.get("id") or "").strip()
    else:
        label = str(channel or "").strip()
    guild = payload.get("guild")
    if isinstance(guild, dict):
        guild_name = str(guild.get("name") or "").strip()
        if guild_name and label:
            return f"{guild_name} / #{label}"
        if guild_name:
            return guild_name
    return label or "discord"


def parse_file(path: Path, self_name: Optional[str], self_id: Optional[str]) -> List[Dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise RuntimeError(f"无法读取 {path.name}: {exc}") from exc

    if isinstance(payload, list):
        raw_messages: List[Dict[str, Any]] = [m for m in payload if isinstance(m, dict)]
    elif isinstance(payload, dict):
        raw_messages = [m for m in payload.get("messages", []) if isinstance(m, dict)]
    else:
        raise RuntimeError(f"不支持的 Discord JSON 结构: {path.name}")

    chat = channel_label(payload)
    out: List[Dict[str, Any]] = []
    for raw in raw_messages:
        sender = author_name(raw)
        if not message_text(raw):
            continue
        author = raw.get("author") or {}
        author_id = str(author.get("id") or "") if isinstance(author, dict) else ""
        outgoing = bool(
            (self_name and sender.strip().lower() == self_name.strip().lower())
            or (self_id and author_id == self_id)
        )
        out.append({
            "sender_name": sender,
            "timestamp": parse_timestamp(raw.get("timestamp")),
            "content": message_text(raw),
            "chat_name": chat,
            "direction": "outgoing" if outgoing else "incoming",
        })
    return out


def discover_inputs(input_path: Path) -> List[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.is_dir():
        raise RuntimeError(f"输入路径不存在: {input_path}")
    files = sorted(p for p in input_path.rglob("*.json") if p.is_file())
    if not files:
        raise RuntimeError("目录下没有找到 .json 文件。Discord 导出必须是 JSON。")
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
    parser = argparse.ArgumentParser(description="解析 Discord 导出（DiscordChatExporter 或官方数据包）并输出标准化 JSON")
    parser.add_argument("--input", required=True, help="输入 JSON 文件或目录（递归扫描）")
    parser.add_argument("--output", required=True, help="输出 JSON 文件路径")
    parser.add_argument("--chat", help="按频道名过滤")
    parser.add_argument("--self-name", help="自己的 Discord 用户名，用于判断消息方向")
    parser.add_argument("--self-id", help="自己的 Discord 用户 ID，用于判断消息方向")
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
                collected.extend(parse_file(path, args.self_name, args.self_id))
            except Exception as exc:
                print(f"[WARN] 跳过文件 {path.name}: {exc}", file=sys.stderr)

        if not collected:
            raise RuntimeError("没有解析到任何 Discord 消息，请检查导出格式（需要 JSON）。")

        messages = deduplicate(collected)
        if args.chat:
            needle = args.chat.strip().lower()
            messages = [m for m in messages if needle in str(m.get("chat_name", "")).lower()]
        if args.limit:
            messages = messages[: args.limit]
        if not messages:
            raise RuntimeError("过滤后没有消息可输出。")

        write_json(output_path, build_payload(input_path, files, messages), args.pretty)
        print(f"已输出 {len(messages)} 条 Discord 消息到 {output_path}")
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())