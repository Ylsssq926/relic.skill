#!/usr/bin/env python3
"""Parse Slack workspace/channel exports into relic.skill normalized JSON.

Slack exports come as a directory of per-channel JSON files, each an array of
message objects:

  [{"user":"U123","text":"hello","ts":"1672531200.000100","type":"message"}]

Also handles the single-file workspace export ({"channels": {...}} or a bare
array) and resolves user IDs to display names via users.json when present.

Usage:
  python3 scripts/slack_parser.py --input ~/slack_export --output data.json
  python3 scripts/slack_parser.py --input export.json --output data.json --self-name me
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

SCHEMA_VERSION = "1.0"
PLATFORM = "slack"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_user_map(root: Path) -> Dict[str, str]:
    """users.json maps user IDs to names — presence makes direction detection work."""
    mapping: Dict[str, str] = {}
    for candidate in root.glob("**/users.json"):
        try:
            payload = json.loads(candidate.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        entries = payload if isinstance(payload, list) else payload.get("members", [])
        for member in entries:
            if isinstance(member, dict):
                uid = str(member.get("id") or "")
                name = str(member.get("real_name") or member.get("name") or "")
                if uid:
                    mapping[uid] = name or uid
    return mapping


def parse_ts(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(float(value))
    text = str(value).strip()
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def resolve_sender(raw: Dict[str, Any], users: Dict[str, str]) -> str:
    """Messages carry user IDs; bot messages carry names; replies may be nested."""
    if raw.get("bot_id"):
        profile = raw.get("user_profile") or raw.get("bot_profile") or {}
        for key in ("display_name", "real_name", "name"):
            if isinstance(profile, dict) and profile.get(key):
                return str(profile[key])
        return str(raw.get("username") or raw.get("bot_id"))
    uid = str(raw.get("user") or "")
    if not uid:
        return str(raw.get("username") or "unknown")
    return users.get(uid, uid)


def message_text(raw: Dict[str, Any]) -> str:
    parts: List[str] = []
    text = str(raw.get("text") or "").strip()
    if text:
        parts.append(text)

    # thread replies
    replies = raw.get("replies")
    if isinstance(replies, list):
        for reply in replies:
            if isinstance(reply, dict):
                reply_text = str(reply.get("text") or "").strip()
                if reply_text:
                    parts.append(f"[thread] {reply_text}")

    files = raw.get("files")
    if isinstance(files, list):
        for item in files:
            if isinstance(item, dict) and item.get("name"):
                parts.append(f"[file: {item['name']}]")
            elif isinstance(item, str):
                parts.append(f"[file: {item}]")

    reactions = raw.get("reactions")
    if isinstance(reactions, list):
        for react in reactions:
            if isinstance(react, dict) and react.get("name"):
                count = react.get("count")
                parts.append(f"[reaction: {react['name']} x{count}]" if count else f"[reaction: {react['name']}]")

    return "\n".join(parts).strip()


def parse_file(path: Path, users: Dict[str, str], self_name: Optional[str]) -> List[Dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise RuntimeError(f"无法读取 {path.name}: {exc}") from exc

    # channel name: folder name when the export is one file per channel,
    # otherwise channel_id from the message or the file stem
    channel = path.stem

    raw_messages: List[Dict[str, Any]] = []
    if isinstance(payload, list):
        raw_messages = [m for m in payload if isinstance(m, dict)]
    elif isinstance(payload, dict):
        if isinstance(payload.get("messages"), list):
            raw_messages = [m for m in payload["messages"] if isinstance(m, dict)]
        elif isinstance(payload.get("channel"), str):
            channel = payload["channel"]
            raw_messages = [m for m in payload.get("messages", []) if isinstance(m, dict)]
        else:
            for chan_name, chan_payload in payload.items():
                if isinstance(chan_payload, list):
                    for item in chan_payload:
                        if isinstance(item, dict):
                            entry = dict(item)
                            entry.setdefault("__channel", chan_name)
                            raw_messages.append(entry)

    out: List[Dict[str, Any]] = []
    for raw in raw_messages:
        text = message_text(raw)
        if not text:
            continue
        sender = resolve_sender(raw, users)
        label = str(raw.get("__channel") or raw.get("channel") or channel)
        outgoing = bool(self_name and sender.strip().lower() == self_name.strip().lower())
        out.append({
            "sender_name": sender,
            "timestamp": parse_ts(raw.get("ts")),
            "content": text,
            "chat_name": f"#{label}" if not label.startswith("#") else label,
            "direction": "outgoing" if outgoing else "incoming",
        })
    return out


def discover_inputs(input_path: Path) -> List[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.is_dir():
        raise RuntimeError(f"输入路径不存在: {input_path}")
    files = sorted(
        p for p in input_path.rglob("*.json")
        if p.is_file() and p.name.lower() not in {"users.json", "channels.json", "integration_logs.json"}
    )
    if not files:
        raise RuntimeError("目录下没有找到渠道 JSON 文件（users.json 等辅助文件会被自动跳过）。")
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
    parser = argparse.ArgumentParser(description="解析 Slack 导出 JSON 并输出标准化 JSON")
    parser.add_argument("--input", required=True, help="输入 JSON 文件或目录（递归扫描，users.json 自动识别）")
    parser.add_argument("--output", required=True, help="输出 JSON 文件路径")
    parser.add_argument("--chat", help="按频道名过滤")
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
        users = load_user_map(input_path if input_path.is_dir() else input_path.parent)
        files = discover_inputs(input_path)
        collected: List[Dict[str, Any]] = []
        for path in files:
            try:
                collected.extend(parse_file(path, users, args.self_name))
            except Exception as exc:
                print(f"[WARN] 跳过文件 {path.name}: {exc}", file=sys.stderr)

        if not collected:
            raise RuntimeError("没有解析到任何 Slack 消息，请确认导出的是频道 JSON。")

        messages = deduplicate(collected)
        if args.chat:
            needle = args.chat.strip().lower().lstrip("#")
            messages = [m for m in messages if needle in str(m.get("chat_name", "")).lower()]
        if args.limit:
            messages = messages[: args.limit]
        if not messages:
            raise RuntimeError("过滤后没有消息可输出。")

        write_json(output_path, build_payload(input_path, files, messages), args.pretty)
        print(f"已输出 {len(messages)} 条 Slack 消息到 {output_path}")
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())