"""Parse QQ chat exports (TXT / MHT) into normalized JSON.

Supported inputs:
- Official or manually整理过的 TXT 聊天记录
- MHT / MHTML 网页归档导出

The parser extracts message blocks, normalizes timestamps, and emits a shared
message schema that can be consumed by other relic.skill scripts.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from email import policy
from email.parser import BytesParser
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

try:
    from dateutil import parser as date_parser
except ImportError:  # pragma: no cover - dependency guard
    date_parser = None

SUPPORTED_SUFFIXES = {".txt", ".mht", ".mhtml"}
TIME_PATTERN = r"\d{4}[-/年]\d{1,2}[-/月]\d{1,2}(?:日)?\s+\d{1,2}:\d{2}(?::\d{2})?"
HEADER_PATTERNS = [
    re.compile(rf"^(?P<name>.+?)\((?P<qq>\d{{5,}})\)\s+(?P<time>{TIME_PATTERN})$"),
    re.compile(rf"^(?P<name>.+?)\s+<(?P<qq>\d{{5,}})>\s+(?P<time>{TIME_PATTERN})$"),
    re.compile(rf"^(?P<name>.+?)\s+(?P<time>{TIME_PATTERN})$"),
]
META_PATTERNS = {
    "chat_name": ["消息对象", "聊天对象", "群名称", "好友昵称", "会话"],
    "exported_at": ["导出时间", "消息记录时间", "导出日期"],
}


class HTMLTextExtractor(HTMLParser):
    """Extract readable text from HTML while preserving coarse line breaks."""

    BLOCK_TAGS = {"p", "div", "br", "li", "tr", "table", "section", "article", "h1", "h2", "h3", "h4"}

    def __init__(self) -> None:
        super().__init__()
        self._parts: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        if tag.lower() in self.BLOCK_TAGS:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in self.BLOCK_TAGS:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        if data:
            self._parts.append(data)

    def get_text(self) -> str:
        text = html.unescape("".join(self._parts))
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        lines = [line.rstrip() for line in text.split("\n")]
        compacted: List[str] = []
        previous_blank = False
        for line in lines:
            blank = not line.strip()
            if blank and previous_blank:
                continue
            compacted.append(line)
            previous_blank = blank
        return "\n".join(compacted).strip()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_text_with_fallback(path: Path) -> str:
    for encoding in ("utf-8-sig", "utf-8", "utf-16", "utf-16le", "gb18030", "latin-1"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", b"", 0, 1, f"无法解码文件: {path}")


def write_json(path: Path, payload: Dict[str, Any], pretty: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2 if pretty else None)
        handle.write("\n")


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



def normalize_time_text(text: str) -> str:
    return text.replace("年", "-").replace("月", "-").replace("日", "")


def normalize_timestamp(value: Any) -> Tuple[Optional[int], Optional[str]]:
    text = str(value).strip()
    if not text:
        return None, None
    parsed = parse_datetime_flexible(normalize_time_text(text))
    if parsed is None:
        return None, text
    return int(parsed.timestamp()), parsed.isoformat()


def discover_inputs(input_path: Path) -> List[Path]:
    if input_path.is_file():
        if input_path.suffix.lower() not in SUPPORTED_SUFFIXES:
            raise ValueError(f"不支持的文件类型: {input_path.suffix}")
        return [input_path]
    if not input_path.is_dir():
        raise FileNotFoundError(f"输入路径不存在: {input_path}")
    files = [path for path in sorted(input_path.rglob("*")) if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES]
    if not files:
        raise FileNotFoundError(f"目录中没有 TXT/MHT 文件: {input_path}")
    return files


def extract_text_from_mht(path: Path) -> str:
    with path.open("rb") as handle:
        message = BytesParser(policy=policy.default).parse(handle)
    html_parts: List[str] = []
    text_parts: List[str] = []
    for part in message.walk():
        content_type = part.get_content_type().lower()
        if content_type == "text/html":
            payload = part.get_content()
            extractor = HTMLTextExtractor()
            extractor.feed(payload)
            html_parts.append(extractor.get_text())
        elif content_type == "text/plain":
            text_parts.append(part.get_content())
    if html_parts:
        return "\n".join(part for part in html_parts if part.strip()).strip()
    if text_parts:
        return "\n".join(part for part in text_parts if part.strip()).strip()
    raise RuntimeError(f"MHT 文件中未找到可解析文本: {path}")


def load_text(path: Path) -> str:
    if path.suffix.lower() in {".mht", ".mhtml"}:
        return extract_text_from_mht(path)
    return read_text_with_fallback(path)


def classify_message_type(content: str) -> str:
    markers = {
        "image": ["[图片]", "【图片】", "发送了一张图片", "image"],
        "video": ["[视频]", "【视频】", "发送了一段视频", "video"],
        "voice": ["[语音]", "【语音】", "语音消息"],
        "file": ["[文件]", "【文件】", "发送了文件", "file"],
        "location": ["[位置]", "【位置】", "共享位置"],
    }
    if any(keyword in content for keyword in ("撤回了一条消息", "加入群聊", "退出群聊", "被移出群聊")):
        return "system"
    for msg_type, candidates in markers.items():
        if any(token in content for token in candidates):
            return msg_type
    if "http://" in content or "https://" in content:
        return "link"
    return "text"


def infer_direction(sender_name: str, sender_id: Optional[str], self_name: Optional[str], self_id: Optional[str], msg_type: str) -> str:
    if msg_type == "system":
        return "system"
    if self_id and sender_id and sender_id == self_id:
        return "outgoing"
    if self_name and sender_name == self_name:
        return "outgoing"
    if self_id or self_name:
        return "incoming"
    return "unknown"


def parse_metadata(lines: Sequence[str]) -> Dict[str, str]:
    metadata: Dict[str, str] = {}
    for line in lines[:80]:
        stripped = line.strip()
        if not stripped:
            continue
        for key, labels in META_PATTERNS.items():
            for label in labels:
                prefix = f"{label}："
                if stripped.startswith(prefix):
                    metadata[key] = stripped[len(prefix) :].strip()
                prefix_ascii = f"{label}:"
                if stripped.startswith(prefix_ascii):
                    metadata[key] = stripped[len(prefix_ascii) :].strip()
    return metadata


def match_header(line: str) -> Optional[Dict[str, Optional[str]]]:
    stripped = line.strip()
    for pattern in HEADER_PATTERNS:
        match = pattern.match(stripped)
        if match:
            name = (match.groupdict().get("name") or "").strip()
            qq = (match.groupdict().get("qq") or "").strip() or None
            time_text = (match.groupdict().get("time") or "").strip()
            return {"sender_name": name, "sender_id": qq, "time_text": time_text}
    return None


def compact_text_lines(lines: Iterable[str]) -> List[str]:
    collected: List[str] = []
    previous_blank = False
    for line in lines:
        stripped = line.rstrip()
        blank = not stripped.strip()
        if blank and previous_blank:
            continue
        collected.append(stripped)
        previous_blank = blank
    return collected


def parse_text_messages(
    text: str,
    source_file: Path,
    self_name: Optional[str],
    self_id: Optional[str],
    default_chat_name: Optional[str],
) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    lines = compact_text_lines(text.replace("\r\n", "\n").replace("\r", "\n").split("\n"))
    metadata = parse_metadata(lines)
    chat_name = default_chat_name or metadata.get("chat_name") or source_file.stem

    messages: List[Dict[str, Any]] = []
    current_header: Optional[Dict[str, Optional[str]]] = None
    buffer: List[str] = []

    def flush_current() -> None:
        nonlocal current_header, buffer
        if not current_header:
            return
        content = "\n".join(line for line in buffer).strip()
        msg_type = classify_message_type(content)
        if not content:
            content = "[空消息]"
        timestamp, iso_dt = normalize_timestamp(current_header.get("time_text"))
        sender_name = current_header.get("sender_name") or "未知发送者"
        sender_id = current_header.get("sender_id")
        direction = infer_direction(sender_name, sender_id, self_name, self_id, msg_type)
        message_id = f"{source_file.stem}:{sender_id or sender_name}:{timestamp or 0}:{len(messages) + 1}"
        messages.append(
            {
                "id": message_id,
                "platform": "qq",
                "exporter": "qq_text_export",
                "source_file": str(source_file),
                "source_format": source_file.suffix.lower().lstrip("."),
                "chat_id": chat_name,
                "chat_name": chat_name,
                "sender_id": sender_id,
                "sender_name": sender_name,
                "direction": direction,
                "msg_type": msg_type,
                "timestamp": timestamp,
                "datetime": iso_dt,
                "content": content,
                "media_path": None,
                "raw": {"header_time": current_header.get("time_text")},
            }
        )
        current_header = None
        buffer = []

    for line in lines:
        header = match_header(line)
        if header:
            flush_current()
            current_header = header
            continue
        if current_header is None:
            continue
        buffer.append(line)
    flush_current()
    return messages, metadata


def deduplicate_messages(messages: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: Dict[Tuple[Any, ...], Dict[str, Any]] = {}
    for message in messages:
        key = (
            message.get("chat_id"),
            message.get("sender_id") or message.get("sender_name"),
            message.get("timestamp"),
            message.get("content"),
        )
        seen.setdefault(key, message)
    result = list(seen.values())
    result.sort(key=lambda item: (item.get("timestamp") or 0, item.get("id") or ""))
    return result


def build_stats(messages: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    type_counter = Counter(item.get("msg_type") or "unknown" for item in messages)
    sender_counter = Counter(item.get("sender_name") or item.get("sender_id") or "unknown" for item in messages)
    timestamps = [item.get("timestamp") for item in messages if isinstance(item.get("timestamp"), int)]
    return {
        "message_count": len(messages),
        "sender_count": len(sender_counter),
        "message_types": dict(type_counter),
        "top_senders": [{"sender": name, "count": count} for name, count in sender_counter.most_common(10)],
        "time_range": {
            "start": min(timestamps) if timestamps else None,
            "end": max(timestamps) if timestamps else None,
        },
    }


def build_payload(input_path: Path, messages: Sequence[Dict[str, Any]], files: Sequence[Path]) -> Dict[str, Any]:
    return {
        "schema_version": "1.0",
        "source": {
            "platform": "qq",
            "input": str(input_path),
            "files": [str(path) for path in files],
            "generated_at": now_iso(),
        },
        "stats": build_stats(messages),
        "messages": list(messages),
    }


def create_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="解析 QQ 聊天导出（TXT/MHT）并输出标准化 JSON")
    parser.add_argument("--input", required=True, help="输入文件或目录")
    parser.add_argument("--output", required=True, help="输出 JSON 文件路径")
    parser.add_argument("--self-name", help="自己的 QQ 昵称，用于判断消息方向")
    parser.add_argument("--self-id", help="自己的 QQ 号，用于判断消息方向")
    parser.add_argument("--chat-name", help="强制指定会话名称")
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
                text = load_text(file_path)
                parsed, _metadata = parse_text_messages(text, file_path, args.self_name, args.self_id, args.chat_name)
                all_messages.extend(parsed)
            except Exception as exc:
                print(f"[WARN] 跳过文件 {file_path}: {exc}", file=sys.stderr)
        if not all_messages:
            raise RuntimeError("没有解析到任何 QQ 消息，请检查输入文件。")
        deduped = deduplicate_messages(all_messages)
        if args.limit is not None:
            deduped = deduped[: args.limit]
        payload = build_payload(input_path, deduped, discovered)
        write_json(output_path, payload, args.pretty)
        print(f"已输出 {len(deduped)} 条 QQ 消息到 {output_path}")
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
