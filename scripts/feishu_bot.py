#!/usr/bin/env python3
"""飞书机器人服务，让 Relic 住在飞书里。

这个版本把 Relic 的核心运行时交给 ``scripts/relic_engine.py``，
当前脚本只保留飞书平台适配职责：

- 接收飞书事件订阅 Webhook
- 校验飞书签名 / challenge
- 管理 tenant_access_token
- 调用飞书消息发送与媒体上传接口
- 把飞书事件转换成 ``IncomingMessage``
- 按 ``ResponsePlan`` 把回复落成文本 / 卡片 / 图片 / 音频消息
- 保留 ``--dry-run`` 与 ``--test-message`` 本地调试体验

示例：
    python scripts/feishu_bot.py --relic examples/grandma-demo
    python scripts/feishu_bot.py --relic examples/grandma-demo --port 8080
    python scripts/feishu_bot.py --relic examples/grandma-demo --dry-run --test-message "奶奶，我今天加班到十一点"
    python scripts/feishu_bot.py --relic-dir examples --multi-relic

依赖：
- Python 3.9+
- Flask（唯一外部依赖）

环境变量：
- FEISHU_APP_ID
- FEISHU_APP_SECRET
- FEISHU_VERIFICATION_TOKEN
- FEISHU_BOT_OPEN_ID（可选；用于在群聊中精准识别是否 @ 了机器人本人）
- FEISHU_SIGNING_SECRET（可选；未设置时会回退到 FEISHU_APP_SECRET）
- FEISHU_BASE_URL（可选，默认 https://open.feishu.cn）
- AI_PROVIDER（claude / openai）
- AI_API_KEY（或 OPENAI_API_KEY / ANTHROPIC_API_KEY）
- AI_MODEL
- AI_BASE_URL（可选）
- OPENAI_BASE_URL / ANTHROPIC_BASE_URL（可选）
- ANTHROPIC_VERSION（可选）

说明：
- 该脚本默认使用飞书开放平台的 tenant_access_token/internal 获取 tenant access token。
- Webhook 加密推送（encrypt key）未在本脚本中实现；如启用了加密推送，请改为明文推送，
  或自行增加 AES 解密依赖与逻辑。
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import logging
import mimetypes
import os
import re
import threading
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

try:  # pragma: no cover - import guard
    from flask import Flask, jsonify, request
except ImportError:  # pragma: no cover - import guard
    Flask = None  # type: ignore[assignment]
    jsonify = None  # type: ignore[assignment]
    request = None  # type: ignore[assignment]

try:  # pragma: no cover - package import
    from scripts.media_service import MediaService
    from scripts.relic_engine import (
        AIProviderError,
        ConfigurationError,
        DEFAULT_ANTHROPIC_BASE_URL,
        DEFAULT_ANTHROPIC_VERSION,
        DEFAULT_CLAUDE_MODEL,
        DEFAULT_OPENAI_BASE_URL,
        DEFAULT_OPENAI_MODEL,
        EngineConfig,
        IncomingMessage,
        OutgoingMessage,
        RelicEngine,
        RelicProfile,
        ResponsePlan,
        Session,
        SUPPORTED_AI_PROVIDERS,
        configure_utf8_stdio,
    )
except ImportError:  # pragma: no cover - direct script execution
    from media_service import MediaService  # type: ignore[no-redef]
    from relic_engine import (  # type: ignore[no-redef]
        AIProviderError,
        ConfigurationError,
        DEFAULT_ANTHROPIC_BASE_URL,
        DEFAULT_ANTHROPIC_VERSION,
        DEFAULT_CLAUDE_MODEL,
        DEFAULT_OPENAI_BASE_URL,
        DEFAULT_OPENAI_MODEL,
        EngineConfig,
        IncomingMessage,
        OutgoingMessage,
        RelicEngine,
        RelicProfile,
        ResponsePlan,
        Session,
        SUPPORTED_AI_PROVIDERS,
        configure_utf8_stdio,
    )


LOGGER = logging.getLogger("feishu_bot")

DEFAULT_PORT = 8080
DEFAULT_HOST = "0.0.0.0"
DEFAULT_MAX_SESSION_MESSAGES = 20
DEFAULT_FEISHU_BASE_URL = "https://open.feishu.cn"
TOKEN_REFRESH_BUFFER_SECONDS = 120
MESSAGE_DEDUP_TTL_SECONDS = 60 * 60
REQUEST_SKEW_SECONDS = 10 * 60

AT_TAG_RE = re.compile(r"<at\b[^>]*?>.*?</at>", re.IGNORECASE | re.DOTALL)
WHITESPACE_RE = re.compile(r"\s+")
RELIC_LIST_RE = re.compile(r"^(?:/relics|/list-relics|列出(?:所有)?relic|relic列表|有哪些relic)$", re.IGNORECASE)
STATUS_CMD_RE = re.compile(r"^(?:/status|状态|当前状态)$", re.IGNORECASE)
RESET_CMD_RE = re.compile(r"^(?:/reset|重置(?:会话|上下文)?|清空(?:会话|上下文)?)$", re.IGNORECASE)
PAUSE_CMD_RE = re.compile(r"^(?:/pause|暂停(?:回复|聊天)?|先别回)$", re.IGNORECASE)
RESUME_CMD_RE = re.compile(r"^(?:/resume|恢复(?:回复|聊天)?|继续回复)$", re.IGNORECASE)
MSYS_CONVERTED_SLASH_RE = re.compile(
    r"^[A-Za-z]:[\\/].*[\\/](?P<command>status|reset|pause|resume|relics|list-relics)(?P<rest>\s+.*)?$",
    re.IGNORECASE,
)
MSYS_CONVERTED_RELIC_RE = re.compile(r"^[A-Za-z]:[\\/].*[\\/]relic(?P<rest>\s+.*)?$", re.IGNORECASE)


class RequestValidationError(RuntimeError):
    """Webhook 请求校验失败。"""


class FeishuAPIError(RuntimeError):
    """调用飞书开放平台失败。"""


@dataclass
class BotConfig:
    """飞书机器人配置。

    Attributes:
        feishu_app_id: 飞书应用 App ID。
        feishu_app_secret: 飞书应用 App Secret。
        ai_provider: 大模型提供方，支持 claude / openai。
        ai_api_key: 大模型 API Key。
        ai_model: 调用的大模型名称。
        relic_dir: 单 Relic 模式下的目录，或多 Relic 模式下的根目录。
        port: Web 服务端口。
        host: Web 服务监听地址。
        dry_run: 是否进入 dry-run 模式；开启后不会真实发消息到飞书。
        multi_relic: 是否启用多 Relic 模式。
        max_session_messages: 保留的最近轮次上限。
        reply_as_card: 是否使用交互式卡片消息回复。
        feishu_verification_token: 飞书事件订阅 Verification Token。
        bot_open_id: 飞书机器人自己的 open_id；用于群聊 @ 提及判断。
        feishu_signing_secret: Webhook 签名密钥；未提供时回退到 feishu_app_secret。
        feishu_base_url: 飞书开放平台域名。
        ai_base_url: 自定义大模型基础地址；为空时根据 provider 选默认值。
        request_timeout: HTTP 请求超时时间（秒）。
        anthropic_version: Claude Messages API 版本头。
    """

    feishu_app_id: str = ""
    feishu_app_secret: str = ""
    ai_provider: str = "claude"
    ai_api_key: str = ""
    ai_model: str = ""
    relic_dir: str = ""
    port: int = DEFAULT_PORT
    host: str = DEFAULT_HOST
    dry_run: bool = False
    multi_relic: bool = False
    max_session_messages: int = DEFAULT_MAX_SESSION_MESSAGES
    reply_as_card: bool = False
    feishu_verification_token: str = ""
    bot_open_id: Optional[str] = None
    feishu_signing_secret: str = ""
    feishu_base_url: str = DEFAULT_FEISHU_BASE_URL
    ai_base_url: str = ""
    request_timeout: int = 30
    anthropic_version: str = DEFAULT_ANTHROPIC_VERSION

    def __post_init__(self) -> None:
        """规范化配置值，并补齐 provider 相关默认值。"""
        self.ai_provider = (self.ai_provider or "claude").strip().lower()
        self.ai_model = (self.ai_model or self.default_model_for_provider()).strip()
        self.bot_open_id = (self.bot_open_id or "").strip() or None
        self.feishu_base_url = (self.feishu_base_url or DEFAULT_FEISHU_BASE_URL).rstrip("/")
        self.ai_base_url = (self.ai_base_url or self.default_ai_base_url()).rstrip("/")
        self.max_session_messages = max(1, int(self.max_session_messages or DEFAULT_MAX_SESSION_MESSAGES))
        self.port = int(self.port or DEFAULT_PORT)
        self.request_timeout = max(3, int(self.request_timeout or 30))
        self.anthropic_version = (self.anthropic_version or DEFAULT_ANTHROPIC_VERSION).strip()

    def default_model_for_provider(self) -> str:
        """返回当前 provider 的默认模型名。"""
        if self.ai_provider == "openai":
            return DEFAULT_OPENAI_MODEL
        return DEFAULT_CLAUDE_MODEL

    def default_ai_base_url(self) -> str:
        """返回当前 provider 的默认 API Base URL。"""
        if self.ai_provider == "openai":
            return DEFAULT_OPENAI_BASE_URL
        return DEFAULT_ANTHROPIC_BASE_URL

    @property
    def signing_secret(self) -> str:
        """返回用于校验 Webhook 请求签名的密钥。"""
        return self.feishu_signing_secret or self.feishu_app_secret


def configure_logging(debug: bool = False) -> None:
    """初始化日志。"""
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def read_json_file(path: Path) -> Any:
    """读取 UTF-8 JSON 文件。"""
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def first_non_empty(*values: Optional[str]) -> str:
    """返回第一个非空字符串值。"""
    for value in values:
        if value and str(value).strip():
            return str(value).strip()
    return ""


def safe_int(value: Any, default: int) -> int:
    """安全地把值转换成 int。"""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def escape_lark_markdown(text: str) -> str:
    """对卡片消息中的 Markdown 做基础转义。"""
    return (
        (text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


class RelicBot:
    """飞书平台上的 Relic 机器人适配器。"""

    def __init__(self, relic_dir: str, config: BotConfig):
        """初始化飞书机器人并挂接 RelicEngine。

        Args:
            relic_dir: 单 Relic 模式下的 Relic 目录，或多 Relic 模式下的根目录。
            config: 飞书平台与引擎共用的运行配置。
        """
        self.config = config
        self.base_relic_dir = Path(relic_dir).expanduser().resolve()
        self._token_cache: Dict[str, Any] = {"value": None, "expires_at": 0.0}
        self._cache_lock = threading.RLock()
        self._processed_message_ids: Dict[str, float] = {}
        self._paused_scopes: set[str] = set()
        self._relic_dirs_by_slug: Dict[str, Path] = {}
        self._media_cache: Dict[str, MediaService] = {}
        self.default_relic_slug: Optional[str] = None
        self.engine = RelicEngine(
            EngineConfig(
                ai_provider=config.ai_provider,
                ai_api_key=config.ai_api_key,
                ai_model=config.ai_model,
                ai_base_url=config.ai_base_url,
                max_session_messages=config.max_session_messages,
                request_timeout=config.request_timeout,
                anthropic_version=config.anthropic_version,
            )
        )
        self._bootstrap_relics()

    def _bootstrap_relics(self) -> None:
        """启动时加载单个 Relic 或扫描整个多 Relic 根目录。"""
        if self.config.multi_relic:
            self._discover_relics(self.base_relic_dir)
            if not self._relic_dirs_by_slug:
                raise ConfigurationError(f"在目录中未发现任何 Relic：{self.base_relic_dir}")
            self.default_relic_slug = sorted(self._relic_dirs_by_slug.keys())[0]
            LOGGER.info("多 Relic 模式已启用，发现 %s 个 Relic", len(self._relic_dirs_by_slug))
            return

        profile = self._load_engine_relic(str(self.base_relic_dir))
        self.default_relic_slug = profile.slug
        LOGGER.info("已加载默认 Relic：%s (%s)", profile.display_name, profile.slug)

    def _discover_relics(self, root_dir: Path) -> None:
        """扫描根目录中的候选 Relic，并逐个交给引擎加载。

        这里只负责平台侧的目录发现；真正的 manifest / markdown 校验与编译都交给
        ``RelicEngine.load_relic()`` 处理。
        """
        if not root_dir.exists() or not root_dir.is_dir():
            raise ConfigurationError(f"Relic 根目录不存在：{root_dir}")

        for child in sorted(root_dir.iterdir()):
            if not child.is_dir() or not (child / "manifest.json").is_file():
                continue
            try:
                profile = self._load_engine_relic(str(child.resolve()))
            except ConfigurationError as exc:
                LOGGER.warning("跳过无效 Relic：%s (%s)", child, exc)
                continue
            self._relic_dirs_by_slug[profile.slug] = profile.relic_dir

    def _load_engine_relic(self, relic_dir_or_slug: str) -> RelicProfile:
        """通过 RelicEngine 加载 Relic，并同步平台层索引。"""
        profile = self.engine.load_relic(relic_dir_or_slug)
        self._relic_dirs_by_slug[profile.slug] = profile.relic_dir
        if not self.default_relic_slug:
            self.default_relic_slug = profile.slug
        return profile

    def load_relic(self, relic_slug: Optional[str] = None) -> RelicProfile:
        """加载指定 Relic，或在省略时返回默认 Relic。"""
        target = relic_slug or self.default_relic_slug or str(self.base_relic_dir)
        return self._load_engine_relic(target)

    def _restore_msys_converted_slash_command(self, text: str) -> str:
        """还原 Git Bash 把 /status 这类参数改成 Windows 路径的情况。"""
        clean_text = (text or "").strip()
        match = MSYS_CONVERTED_RELIC_RE.match(clean_text)
        if match:
            return f"/relic{match.group('rest') or ''}".strip()
        match = MSYS_CONVERTED_SLASH_RE.match(clean_text)
        if match:
            return f"/{match.group('command')}{match.group('rest') or ''}".strip()
        return clean_text

    def detect_intent(self, message_text: str) -> Dict[str, Any]:
        """识别消息意图，并为旧版 ``/relics`` 指令保留兼容分支。

        除平台侧命令外，其余判断全部交给 ``RelicEngine.detect_intent()``。
        """
        clean_text = self._restore_msys_converted_slash_command(self._strip_mentions(message_text))
        command_type = ""
        if STATUS_CMD_RE.match(clean_text):
            command_type = "status"
        elif RESET_CMD_RE.match(clean_text):
            command_type = "reset"
        elif PAUSE_CMD_RE.match(clean_text):
            command_type = "pause"
        elif RESUME_CMD_RE.match(clean_text):
            command_type = "resume"
        elif self.config.multi_relic and RELIC_LIST_RE.match(clean_text):
            command_type = "list_relics"
        if command_type:
            return {
                "type": command_type,
                "clean_text": clean_text,
                "relic_slug": "",
                "proactive_type": "",
                "empty": not bool(clean_text),
            }
        return self.engine.detect_intent(clean_text)

    def get_active_relic_slug(self, user_id: str, chat_id: str = "") -> str:
        """获取某个用户在当前 chat 上下文里激活的 Relic slug。"""
        fallback = self.default_relic_slug or str(self.base_relic_dir)
        return self.engine.get_active_relic_slug(user_id, chat_id=chat_id, fallback=fallback)

    def set_active_relic_for_user(self, user_id: str, relic_slug: str, chat_id: str = "") -> None:
        """设置某个用户在当前 chat 中使用的 Relic。"""
        self.engine.set_active_relic_for_user(user_id, relic_slug, chat_id=chat_id)

    def get_session(self, user_id: str, chat_id: str, relic_slug: str) -> Session:
        """按 ``user_id + chat_id + relic_slug`` 获取或创建会话。"""
        return self.engine.get_session(user_id=user_id, chat_id=chat_id, relic_slug=relic_slug)

    def _pause_scope_key(self, user_id: str, chat_id: str) -> str:
        """构造某个用户在某个会话里的暂停键。"""
        return f"{user_id}:{chat_id}"

    def _is_paused(self, user_id: str, chat_id: str) -> bool:
        """判断当前用户会话是否已暂停回复。"""
        with self._cache_lock:
            return self._pause_scope_key(user_id, chat_id) in self._paused_scopes

    def _set_paused(self, user_id: str, chat_id: str, paused: bool) -> None:
        """暂停或恢复当前用户会话。"""
        key = self._pause_scope_key(user_id, chat_id)
        with self._cache_lock:
            if paused:
                self._paused_scopes.add(key)
            else:
                self._paused_scopes.discard(key)

    def _reset_session(self, user_id: str, chat_id: str, relic_slug: str) -> None:
        """清空当前用户在当前 chat/relic 下的会话。"""
        session_key = self.engine._session_key(user_id, chat_id, relic_slug)
        with self.engine._lock:
            self.engine._sessions.pop(session_key, None)

    def validate_request(
        self,
        raw_body: bytes,
        payload: Mapping[str, Any],
        timestamp: str,
        nonce: str,
        signature: str,
    ) -> None:
        """验证飞书 Webhook 请求。"""
        configured_token = self.config.feishu_verification_token.strip()
        header = payload.get("header") if isinstance(payload.get("header"), Mapping) else {}
        body_token = str(payload.get("token") or header.get("token") or "").strip()

        if configured_token and body_token and body_token != configured_token:
            raise RequestValidationError("Verification Token 不匹配")

        if not self.config.signing_secret:
            self._verify_signature(timestamp=timestamp, nonce=nonce, body=raw_body, signature=signature)
            return

        if not timestamp:
            raise RequestValidationError("缺少 X-Lark-Request-Timestamp")
        if not nonce:
            raise RequestValidationError("缺少 X-Lark-Request-Nonce")
        if not signature:
            raise RequestValidationError("缺少 X-Lark-Signature")

        self._validate_timestamp(timestamp)
        if not self._verify_signature(timestamp=timestamp, nonce=nonce, body=raw_body, signature=signature):
            raise RequestValidationError("X-Lark-Signature 校验失败")

    def _validate_timestamp(self, timestamp: str) -> None:
        """校验签名时间戳，降低重放攻击风险。"""
        try:
            timestamp_int = int(timestamp)
        except ValueError as exc:
            raise RequestValidationError("非法的 X-Lark 时间戳") from exc
        if len(timestamp) > 10:
            timestamp_int = timestamp_int // 1000
        now = int(time.time())
        if abs(now - timestamp_int) > REQUEST_SKEW_SECONDS:
            raise RequestValidationError("X-Lark 时间戳超出允许范围")

    def _verify_signature(self, timestamp: str, nonce: str, body: bytes, signature: str) -> bool:
        """验证飞书事件签名（官方规则）。"""
        signing_secret = self.config.feishu_signing_secret or self.config.feishu_app_secret
        if not signing_secret:
            LOGGER.warning("⚠️  未配置签名密钥，跳过签名校验（仅建议开发环境）")
            return True
        content = timestamp + nonce + signing_secret + body.decode("utf-8")
        expected = hashlib.sha256(content.encode("utf-8")).hexdigest()
        return hmac.compare_digest(expected, signature)

    def handle_webhook(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """处理飞书 Webhook 事件并执行引擎返回的响应计划。"""
        if event.get("type") == "url_verification":
            challenge = event.get("challenge", "")
            LOGGER.info("收到 url_verification challenge")
            return {"challenge": challenge}

        if "encrypt" in event:
            raise ConfigurationError("当前脚本不支持加密推送，请在飞书后台关闭 encrypt key 或自行扩展 AES 解密")

        header = event.get("header") or {}
        event_type = str(header.get("event_type") or "")
        if event_type != "im.message.receive_v1":
            LOGGER.info("忽略未处理事件类型：%s", event_type or "<empty>")
            return {"status": "success", "ignored": True, "reason": f"unsupported_event:{event_type or 'unknown'}"}

        payload = event.get("event") or {}
        message = payload.get("message") or {}
        sender = payload.get("sender") or {}
        sender_type = str(sender.get("sender_type") or "user")
        if sender_type != "user":
            return {"status": "success", "ignored": True, "reason": f"sender_type:{sender_type}"}

        message_id = str(message.get("message_id") or "")
        if message_id and self._is_duplicate_message(message_id):
            LOGGER.info("忽略重复消息：%s", message_id)
            return {"status": "success", "ignored": True, "reason": "duplicate_message"}

        chat_id = str(message.get("chat_id") or payload.get("chat_id") or "")
        message_type = str(message.get("message_type") or "")
        user_id = self._extract_user_id(sender)
        if not user_id:
            LOGGER.warning("无法从事件中识别 user_id：%s", payload)
            return {"status": "success", "ignored": True, "reason": "missing_user_id"}

        text = self._extract_plain_text(message_type=message_type, content=message.get("content"))
        mentions = message.get("mentions") or []
        is_direct_chat = str(message.get("chat_type") or "") == "p2p"
        bot_open_id = self.config.bot_open_id
        is_mentioned = (
            any(m.get("id", {}).get("open_id") == bot_open_id for m in mentions)
            if bot_open_id
            else bool(mentions)
        )

        active_relic_slug = self.get_active_relic_slug(user_id, chat_id=chat_id)

        if message_type not in {"text", "post"}:
            if is_direct_chat or is_mentioned:
                fallback = "我目前先处理文字消息。你可以直接发文本，或先用 /help 看看可用命令。"
                self._send_text_response(chat_id=chat_id, text=fallback, relic_slug=active_relic_slug)
            if message_id:
                self._mark_message_processed(message_id)
            return {"status": "success", "ignored": True, "reason": f"unsupported_message_type:{message_type}"}

        intent = self.detect_intent(text)
        intent_type = str(intent.get("type") or "chat")

        if intent_type == "list_relics":
            reply = self._build_relic_list_text(user_id=user_id, chat_id=chat_id)
            self._send_text_response(chat_id=chat_id, text=reply, relic_slug=active_relic_slug)
            if message_id:
                self._mark_message_processed(message_id)
            return {"status": "success", "handled": True, "intent": "list_relics"}

        if intent_type == "status":
            reply = self._build_status_text(user_id=user_id, chat_id=chat_id, relic_slug=active_relic_slug)
            self._send_text_response(chat_id=chat_id, text=reply, relic_slug=active_relic_slug)
            if message_id:
                self._mark_message_processed(message_id)
            return {"status": "success", "handled": True, "intent": "status"}

        if intent_type == "reset":
            self._reset_session(user_id=user_id, chat_id=chat_id, relic_slug=active_relic_slug)
            self._send_text_response(chat_id=chat_id, text="这段会话已经清空了。我们可以从这里重新开始。", relic_slug=active_relic_slug)
            if message_id:
                self._mark_message_processed(message_id)
            return {"status": "success", "handled": True, "intent": "reset"}

        if intent_type == "pause":
            self._set_paused(user_id=user_id, chat_id=chat_id, paused=True)
            self._send_text_response(chat_id=chat_id, text="好，我先安静下来。需要我继续时发 /resume。", relic_slug=active_relic_slug)
            if message_id:
                self._mark_message_processed(message_id)
            return {"status": "success", "handled": True, "intent": "pause"}

        if intent_type == "resume":
            self._set_paused(user_id=user_id, chat_id=chat_id, paused=False)
            self._send_text_response(chat_id=chat_id, text="我回来了。你继续说就行。", relic_slug=active_relic_slug)
            if message_id:
                self._mark_message_processed(message_id)
            return {"status": "success", "handled": True, "intent": "resume"}

        if self._is_paused(user_id=user_id, chat_id=chat_id):
            if message_id:
                self._mark_message_processed(message_id)
            return {"status": "success", "ignored": True, "reason": "paused"}

        if not is_direct_chat and not is_mentioned and intent_type == "chat":
            if message_id:
                self._mark_message_processed(message_id)
            return {"status": "success", "ignored": True, "reason": "not_mentioned_in_group"}

        incoming = IncomingMessage(
            platform="feishu",
            user_id=user_id,
            chat_id=chat_id,
            text=text,
            message_id=message_id,
            timestamp=time.time(),
            is_direct_chat=is_direct_chat,
            is_mentioned=is_mentioned,
            raw=dict(payload),
        )
        plan = self.engine.handle_message(incoming, active_relic_slug)
        plan = self._prepare_response_plan(plan)

        if not plan.messages:
            if message_id:
                self._mark_message_processed(message_id)
            return {"status": "success", "ignored": True, "reason": "empty_response_plan"}

        self._deliver_plan(chat_id=chat_id, plan=plan)
        if message_id:
            self._mark_message_processed(message_id)
        return {
            "status": "success",
            "handled": True,
            "intent": intent_type,
            "relic_slug": plan.relic_slug,
            "mode": plan.mode,
        }

    def _prepare_response_plan(self, plan: ResponsePlan) -> ResponsePlan:
        """根据消息计划补齐本地媒体资源。

        当前主要做一件事：当引擎返回 ``audio`` 消息但尚未携带 ``media_path`` 时，
        尝试根据当前 Relic 的媒体配置通过 ``MediaService`` 生成 TTS 音频。
        """
        if not plan.messages:
            return plan

        media: Optional[MediaService] = None
        for message in plan.messages:
            if message.kind != "audio" or message.media_path:
                continue
            if media is None:
                media = self._get_media_service(plan.relic_slug)
            if not media.has_tts:
                continue
            audio_path = media.synthesize_speech(message.text, mode=plan.mode)
            if audio_path:
                message.media_path = audio_path
        return plan

    def _get_media_service(self, relic_slug: str) -> MediaService:
        """按 Relic 目录缓存 ``MediaService``，避免重复解析 manifest。"""
        profile = self.load_relic(relic_slug)
        cache_key = str(profile.relic_dir)
        with self._cache_lock:
            cached = self._media_cache.get(cache_key)
            if cached is not None:
                return cached

        try:
            media = MediaService.from_relic(str(profile.relic_dir))
        except Exception as exc:  # pragma: no cover - 防御性兜底
            LOGGER.warning("初始化 MediaService 失败：%s", exc)
            media = MediaService(tts=None, image=None, relic_dir=profile.relic_dir, manifest=dict(profile.manifest))

        if media.tts is not None:
            media.tts.dry_run = self.config.dry_run
        if media.image is not None:
            media.image.dry_run = self.config.dry_run

        with self._cache_lock:
            self._media_cache[cache_key] = media
        return media

    def _make_plan_media_loader(self, relic_dir: str) -> Callable[[], MediaService]:
        """为单个 ResponsePlan 构造懒加载 MediaService 的闭包。"""
        media: Optional[MediaService] = None

        def ensure_media_service() -> MediaService:
            nonlocal media
            if media is not None:
                return media
            try:
                media = MediaService.from_relic(relic_dir)
            except Exception as exc:  # pragma: no cover - 防御性兜底
                LOGGER.warning("初始化 MediaService 失败：%s", exc)
                media = MediaService(tts=None, image=None, relic_dir=Path(relic_dir), manifest={})
            if media.tts is not None:
                media.tts.dry_run = self.config.dry_run
            if media.image is not None:
                media.image.dry_run = self.config.dry_run
            return media

        return ensure_media_service

    def _send_card_plan_message(self, chat_id: str, message: OutgoingMessage, profile: RelicProfile) -> Dict[str, Any]:
        """发送 card 类型的计划消息。"""
        card_payload = message.metadata.get("card") if isinstance(message.metadata, Mapping) else None
        if isinstance(card_payload, Mapping):
            return self.send_message(chat_id=chat_id, msg_type="interactive", content=card_payload)
        return self.send_card_message(chat_id=chat_id, title=message.title or profile.display_name, text=message.text)

    def _send_audio_plan_message(
        self,
        chat_id: str,
        plan: ResponsePlan,
        message: OutgoingMessage,
        ensure_media_service: Callable[[], MediaService],
    ) -> Optional[Dict[str, Any]]:
        """发送 audio 类型的计划消息，失败时降级为文本。"""
        file_key = ""
        audio_path = message.media_path
        if isinstance(message.metadata, Mapping):
            file_key = str(message.metadata.get("file_key") or "")
        if not file_key and not audio_path and message.text:
            try:
                media_service = ensure_media_service()
                if media_service.has_tts:
                    audio_path = media_service.synthesize_speech(message.text, mode=plan.mode) or ""
            except Exception as exc:
                LOGGER.warning("TTS 生成失败，降级为文字：%s", exc)
        if not file_key and audio_path:
            try:
                file_key = self.upload_audio(audio_path)
            except Exception as exc:
                LOGGER.warning("音频上传失败，降级为文字：%s", exc)
        if file_key:
            return self.send_audio_message(chat_id=chat_id, file_key=file_key)
        if message.text:
            LOGGER.warning("音频消息缺少 file_key / media_path，降级为文本发送")
            return self._send_text_response(chat_id=chat_id, text=message.text, relic_slug=plan.relic_slug)
        return None

    def _send_image_plan_message(
        self,
        chat_id: str,
        plan: ResponsePlan,
        message: OutgoingMessage,
        ensure_media_service: Callable[[], MediaService],
    ) -> Optional[Dict[str, Any]]:
        """发送 image 类型的计划消息，失败时降级为文本。"""
        image_key = ""
        image_path = message.media_path
        if isinstance(message.metadata, Mapping):
            image_key = str(message.metadata.get("image_key") or "")
        if not image_key and not image_path:
            try:
                media_service = ensure_media_service()
                if media_service.has_image:
                    image_path = media_service.generate_avatar() or ""
            except Exception as exc:
                LOGGER.warning("图像生成失败：%s", exc)
        if not image_key and image_path:
            try:
                image_key = self.upload_image(image_path)
            except Exception as exc:
                LOGGER.warning("图片上传失败：%s", exc)
        if image_key:
            return self.send_image_message(chat_id=chat_id, image_key=image_key)
        if message.text:
            LOGGER.warning("图片消息缺少 image_key / media_path，降级为文本发送")
            return self._send_text_response(chat_id=chat_id, text=message.text, relic_slug=plan.relic_slug)
        return None

    def _execute_response_plan(self, plan: ResponsePlan, chat_id: str, relic_dir: str) -> List[Dict[str, Any]]:
        """执行 ResponsePlan，把所有消息真正发送到飞书。"""
        profile = self.load_relic(plan.relic_slug or None)
        ensure_media_service = self._make_plan_media_loader(relic_dir)
        results: List[Dict[str, Any]] = []

        for message in plan.messages:
            result: Optional[Dict[str, Any]]
            if message.kind == "text":
                result = self._send_text_response(chat_id=chat_id, text=message.text, relic_slug=plan.relic_slug)
            elif message.kind == "card":
                result = self._send_card_plan_message(chat_id=chat_id, message=message, profile=profile)
            elif message.kind == "audio":
                result = self._send_audio_plan_message(
                    chat_id=chat_id,
                    plan=plan,
                    message=message,
                    ensure_media_service=ensure_media_service,
                )
            elif message.kind == "image":
                result = self._send_image_plan_message(
                    chat_id=chat_id,
                    plan=plan,
                    message=message,
                    ensure_media_service=ensure_media_service,
                )
            else:
                fallback_text = message.text or f"[{message.kind}]"
                LOGGER.warning("未识别的消息类型 %s，降级为文本发送", message.kind)
                result = self._send_text_response(chat_id=chat_id, text=fallback_text, relic_slug=plan.relic_slug)
            if result is not None:
                results.append(result)

        return results

    def _deliver_plan(self, chat_id: str, plan: ResponsePlan) -> List[Dict[str, Any]]:
        """兼容旧调用：解析 relic_dir 后执行 ResponsePlan。"""
        profile = self.load_relic(plan.relic_slug or None)
        return self._execute_response_plan(plan=plan, chat_id=chat_id, relic_dir=str(profile.relic_dir))

    def _send_text_response(self, chat_id: str, text: str, relic_slug: str) -> Dict[str, Any]:
        """按配置选择文本或卡片形式发送纯文本回复。"""
        if self.config.reply_as_card:
            profile = self.load_relic(relic_slug)
            return self.send_card_message(chat_id=chat_id, title=profile.display_name, text=text)
        return self.send_text_message(chat_id=chat_id, text=text)

    def _build_status_text(self, user_id: str, chat_id: str, relic_slug: str) -> str:
        """构建当前飞书会话状态。"""
        profile = self.load_relic(relic_slug)
        paused = "已暂停" if self._is_paused(user_id=user_id, chat_id=chat_id) else "正常"
        mode = "多 Relic" if self.config.multi_relic else "单 Relic"
        return "\n".join(
            [
                f"当前 Relic：{profile.display_name}（{profile.slug}）",
                f"运行模式：{mode}",
                f"回复状态：{paused}",
                f"dry-run：{'开启' if self.config.dry_run else '关闭'}",
            ]
        )

    def _build_relic_list_text(self, user_id: str, chat_id: str = "") -> str:
        """构建多 Relic 列表文案。"""
        if not self.config.multi_relic:
            profile = self.load_relic(self.get_active_relic_slug(user_id, chat_id=chat_id))
            return f"当前是单 Relic 模式，只加载了 {profile.display_name}（{profile.slug}）。"

        current = self.get_active_relic_slug(user_id, chat_id=chat_id)
        lines = ["可用 Relic："]
        for slug in sorted(self._relic_dirs_by_slug.keys()):
            profile = self.load_relic(slug)
            marker = "（当前）" if slug == current else ""
            lines.append(f"- {profile.display_name} [{slug}] {marker}".rstrip())
        lines.append("")
        lines.append("切换方式：/relic slug")
        return "\n".join(lines)

    def _extract_user_id(self, sender: Mapping[str, Any]) -> str:
        """从 sender 结构里提取稳定 user_id。"""
        sender_id = sender.get("sender_id") or {}
        if isinstance(sender_id, Mapping):
            return first_non_empty(
                str(sender_id.get("open_id") or ""),
                str(sender_id.get("user_id") or ""),
                str(sender_id.get("union_id") or ""),
            )
        return ""

    def _extract_plain_text(self, message_type: str, content: Any) -> str:
        """把飞书消息 content 提取成纯文本。"""
        if isinstance(content, str):
            try:
                payload = json.loads(content)
            except json.JSONDecodeError:
                payload = {"text": content}
        elif isinstance(content, Mapping):
            payload = dict(content)
        else:
            payload = {}

        if message_type == "text":
            return str(payload.get("text") or "")

        if message_type == "post":
            post = payload.get("post") or {}
            if not isinstance(post, Mapping):
                return ""
            locales = list(post.values())
            texts: List[str] = []
            for locale_block in locales:
                if not isinstance(locale_block, Mapping):
                    continue
                title = locale_block.get("title")
                if title:
                    texts.append(str(title))
                rows = locale_block.get("content") or []
                if not isinstance(rows, list):
                    continue
                for row in rows:
                    if not isinstance(row, list):
                        continue
                    for item in row:
                        if isinstance(item, Mapping) and item.get("tag") == "text":
                            texts.append(str(item.get("text") or ""))
            return "\n".join(part for part in texts if part)

        return ""

    def _strip_mentions(self, text: str) -> str:
        """移除文本中的 @ 标签与多余空白。"""
        without_tags = AT_TAG_RE.sub(" ", text or "")
        return WHITESPACE_RE.sub(" ", without_tags).strip()

    def _is_duplicate_message(self, message_id: str) -> bool:
        """检查消息是否已经处理过。"""
        if not message_id:
            return False
        now = time.time()
        with self._cache_lock:
            self._prune_processed_message_ids(now)
            seen_at = self._processed_message_ids.get(message_id)
            return seen_at is not None and now - seen_at < MESSAGE_DEDUP_TTL_SECONDS

    def _mark_message_processed(self, message_id: str) -> None:
        """标记消息为已处理。"""
        if not message_id:
            return
        with self._cache_lock:
            self._processed_message_ids[message_id] = time.time()
            self._prune_processed_message_ids(time.time())

    def _prune_processed_message_ids(self, now: float) -> None:
        """清理过期 message_id。"""
        expired = [
            message_id
            for message_id, seen_at in self._processed_message_ids.items()
            if now - seen_at >= MESSAGE_DEDUP_TTL_SECONDS
        ]
        for message_id in expired:
            self._processed_message_ids.pop(message_id, None)

    def send_text_message(self, chat_id: str, text: str) -> Dict[str, Any]:
        """发送飞书纯文本消息。"""
        return self.send_message(chat_id=chat_id, msg_type="text", content={"text": text})

    def send_card_message(self, chat_id: str, title: str, text: str) -> Dict[str, Any]:
        """发送飞书交互式卡片消息。"""
        card = {
            "config": {"wide_screen_mode": True},
            "header": {"title": {"tag": "plain_text", "content": title}},
            "elements": [
                {
                    "tag": "div",
                    "text": {"tag": "lark_md", "content": escape_lark_markdown(text).replace("\n", "  \n")},
                }
            ],
        }
        return self.send_message(chat_id=chat_id, msg_type="interactive", content=card)

    def send_image_message(self, chat_id: str, image_key: str) -> Dict[str, Any]:
        """发送飞书图片消息。"""
        return self.send_message(chat_id=chat_id, msg_type="image", content={"image_key": image_key})

    def send_audio_message(self, chat_id: str, file_key: str) -> Dict[str, Any]:
        """发送飞书音频消息。"""
        return self.send_message(chat_id=chat_id, msg_type="audio", content={"file_key": file_key})

    def send_message(self, chat_id: str, msg_type: str, content: Mapping[str, Any]) -> Dict[str, Any]:
        """调用飞书发送消息接口。"""
        payload = {
            "receive_id": chat_id,
            "msg_type": msg_type,
            "content": json.dumps(content, ensure_ascii=False),
        }

        if self.config.dry_run:
            LOGGER.info("[DRY-RUN] 将发送飞书消息：%s", json.dumps(payload, ensure_ascii=False))
            return {"dry_run": True, "payload": payload}

        token = self._get_tenant_access_token()
        url = f"{self.config.feishu_base_url}/open-apis/im/v1/messages?receive_id_type=chat_id"
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request_obj = urllib.request.Request(url=url, data=data, method="POST")
        request_obj.add_header("Authorization", f"Bearer {token}")
        request_obj.add_header("Content-Type", "application/json; charset=utf-8")
        return self._execute_json_request(request_obj, error_prefix="发送消息失败")

    def upload_image(self, file_path: str) -> str:
        """上传本地图片到飞书并返回 ``image_key``。"""
        path = Path(file_path).expanduser().resolve()
        if self.config.dry_run:
            LOGGER.info("[DRY-RUN] 将上传飞书图片：%s", path)
            return f"dry-run-image-{path.stem}"

        if not path.is_file():
            raise FeishuAPIError(f"图片文件不存在：{path}")

        token = self._get_tenant_access_token()
        mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        body, content_type = self._encode_multipart_formdata(
            fields={"image_type": "message"},
            files=[("image", path.name, path.read_bytes(), mime_type)],
        )
        request_obj = urllib.request.Request(
            url=f"{self.config.feishu_base_url}/open-apis/im/v1/images",
            data=body,
            method="POST",
        )
        request_obj.add_header("Authorization", f"Bearer {token}")
        request_obj.add_header("Content-Type", content_type)
        result = self._execute_json_request(request_obj, error_prefix="上传图片失败")
        image_key = str(((result.get("data") or {}).get("image_key") or ""))
        if not image_key:
            raise FeishuAPIError(f"上传图片失败：响应缺少 image_key：{result}")
        return image_key

    def upload_audio(self, file_path: str) -> str:
        """上传本地音频到飞书并返回 ``file_key``。"""
        path = Path(file_path).expanduser().resolve()
        if self.config.dry_run:
            LOGGER.info("[DRY-RUN] 将上传飞书音频：%s", path)
            return f"dry-run-file-{path.stem}"

        if not path.is_file():
            raise FeishuAPIError(f"音频文件不存在：{path}")

        token = self._get_tenant_access_token()
        file_type = self._guess_feishu_audio_type(path)
        mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        body, content_type = self._encode_multipart_formdata(
            fields={
                "file_type": file_type,
                "file_name": path.name,
            },
            files=[("file", path.name, path.read_bytes(), mime_type)],
        )
        request_obj = urllib.request.Request(
            url=f"{self.config.feishu_base_url}/open-apis/im/v1/files",
            data=body,
            method="POST",
        )
        request_obj.add_header("Authorization", f"Bearer {token}")
        request_obj.add_header("Content-Type", content_type)
        result = self._execute_json_request(request_obj, error_prefix="上传音频失败")
        file_key = str(((result.get("data") or {}).get("file_key") or ""))
        if not file_key:
            raise FeishuAPIError(f"上传音频失败：响应缺少 file_key：{result}")
        return file_key

    def _guess_feishu_audio_type(self, path: Path) -> str:
        """根据文件后缀推断飞书文件上传接口所需的音频类型。"""
        mapping = {
            ".opus": "opus",
            ".mp3": "mp3",
            ".wav": "wav",
            ".ogg": "ogg",
            ".m4a": "m4a",
        }
        suffix = path.suffix.lower()
        guessed = mapping.get(suffix)
        if guessed:
            return guessed
        LOGGER.warning("未识别的音频后缀 %s，回退为 stream", suffix or "<empty>")
        return "stream"

    def _encode_multipart_formdata(
        self,
        fields: Mapping[str, Any],
        files: Sequence[Tuple[str, str, bytes, str]],
    ) -> Tuple[bytes, str]:
        """构造 ``multipart/form-data`` 请求体。"""
        boundary = f"----RelicFeishuBot{uuid.uuid4().hex}"
        boundary_bytes = boundary.encode("utf-8")
        body = bytearray()

        for name, value in fields.items():
            body.extend(b"--" + boundary_bytes + b"\r\n")
            body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
            body.extend(str(value).encode("utf-8"))
            body.extend(b"\r\n")

        for field_name, filename, content, content_type in files:
            safe_filename = filename.replace('"', "")
            body.extend(b"--" + boundary_bytes + b"\r\n")
            body.extend(
                f'Content-Disposition: form-data; name="{field_name}"; filename="{safe_filename}"\r\n'.encode(
                    "utf-8"
                )
            )
            body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
            body.extend(content)
            body.extend(b"\r\n")

        body.extend(b"--" + boundary_bytes + b"--\r\n")
        return bytes(body), f"multipart/form-data; boundary={boundary}"

    def _execute_json_request(self, request_obj: urllib.request.Request, error_prefix: str) -> Dict[str, Any]:
        """执行 HTTP 请求并把响应解析成 JSON。"""
        try:
            with urllib.request.urlopen(request_obj, timeout=self.config.request_timeout) as response:
                raw = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise FeishuAPIError(f"{error_prefix}：HTTP {exc.code} {body}") from exc
        except urllib.error.URLError as exc:
            raise FeishuAPIError(f"{error_prefix}：{exc}") from exc

        try:
            result = json.loads(raw or "{}")
        except json.JSONDecodeError as exc:
            raise FeishuAPIError(f"{error_prefix}：接口返回了非 JSON 响应：{raw}") from exc

        if result.get("code") not in (0, None):
            raise FeishuAPIError(f"{error_prefix}：{result}")
        return result

    def _get_tenant_access_token(self) -> str:
        """获取并缓存 tenant_access_token。"""
        if self.config.dry_run:
            return "dry-run-token"
        if not self.config.feishu_app_id or not self.config.feishu_app_secret:
            raise ConfigurationError("未配置 FEISHU_APP_ID / FEISHU_APP_SECRET，无法获取 tenant_access_token")

        now = time.time()
        with self._cache_lock:
            cached_token = self._token_cache.get("value")
            expires_at = float(self._token_cache.get("expires_at") or 0.0)
            if cached_token and now < expires_at:
                return str(cached_token)

        payload = {
            "app_id": self.config.feishu_app_id,
            "app_secret": self.config.feishu_app_secret,
        }
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request_obj = urllib.request.Request(
            url=f"{self.config.feishu_base_url}/open-apis/auth/v3/tenant_access_token/internal/",
            data=data,
            method="POST",
        )
        request_obj.add_header("Content-Type", "application/json; charset=utf-8")
        result = self._execute_json_request(request_obj, error_prefix="获取 tenant_access_token 失败")

        token = str(result.get("tenant_access_token") or "")
        expires_in = safe_int(result.get("expire"), 0)
        if not token:
            raise FeishuAPIError(f"tenant_access_token 响应缺少 token：{result}")

        expires_at = time.time() + max(0, expires_in - TOKEN_REFRESH_BUFFER_SECONDS)
        with self._cache_lock:
            self._token_cache = {"value": token, "expires_at": expires_at}
        return token

    def render_plan_preview(self, plan: ResponsePlan) -> str:
        """把 ``ResponsePlan`` 转成适合 CLI 预览的单段文本。"""
        parts: List[str] = []
        for message in plan.messages:
            if message.kind == "text":
                if message.text:
                    parts.append(message.text)
                continue
            if message.kind == "audio":
                if message.text:
                    parts.append(message.text)
                else:
                    parts.append("[音频消息]")
                continue
            if message.kind == "card":
                chunk = "\n".join(part for part in (message.title, message.text) if part)
                if chunk:
                    parts.append(chunk)
                continue
            if message.kind == "image":
                parts.append(message.text or "[图片消息]")
                continue
            parts.append(message.text or f"[{message.kind}]")
        return "\n".join(part for part in parts if part).strip()


def build_config(args: argparse.Namespace) -> BotConfig:
    """从默认值、配置文件、环境变量、CLI 参数构建 ``BotConfig``。"""
    config_path = Path(args.config).expanduser() if args.config else None
    file_config: Dict[str, Any] = {}
    if config_path and config_path.is_file():
        file_config = dict(read_json_file(config_path))
        LOGGER.info("已加载配置文件：%s", config_path)

    ai_provider = first_non_empty(
        args.ai_provider,
        os.getenv("AI_PROVIDER"),
        str(file_config.get("ai_provider") or ""),
        "claude",
    ).lower()

    ai_base_url = first_non_empty(
        args.ai_base_url,
        os.getenv("AI_BASE_URL"),
        os.getenv("OPENAI_BASE_URL") if ai_provider == "openai" else os.getenv("ANTHROPIC_BASE_URL"),
        str(file_config.get("ai_base_url") or ""),
    )

    relic_dir = first_non_empty(
        args.relic if not args.multi_relic else "",
        args.relic_dir,
        str(file_config.get("relic_dir") or ""),
    )

    config = BotConfig(
        feishu_app_id=first_non_empty(
            os.getenv("FEISHU_APP_ID"),
            str(file_config.get("feishu_app_id") or ""),
        ),
        feishu_app_secret=first_non_empty(
            os.getenv("FEISHU_APP_SECRET"),
            str(file_config.get("feishu_app_secret") or ""),
        ),
        feishu_verification_token=first_non_empty(
            os.getenv("FEISHU_VERIFICATION_TOKEN"),
            str(file_config.get("feishu_verification_token") or ""),
        ),
        bot_open_id=first_non_empty(
            os.getenv("FEISHU_BOT_OPEN_ID"),
            str(file_config.get("bot_open_id") or ""),
            str(file_config.get("feishu_bot_open_id") or ""),
        )
        or None,
        feishu_signing_secret=first_non_empty(
            os.getenv("FEISHU_SIGNING_SECRET"),
            str(file_config.get("feishu_signing_secret") or ""),
        ),
        feishu_base_url=first_non_empty(
            os.getenv("FEISHU_BASE_URL"),
            os.getenv("LARK_BASE_URL"),
            str(file_config.get("feishu_base_url") or ""),
            DEFAULT_FEISHU_BASE_URL,
        ),
        ai_provider=ai_provider,
        ai_api_key=first_non_empty(
            os.getenv("AI_API_KEY"),
            os.getenv("OPENAI_API_KEY") if ai_provider == "openai" else os.getenv("ANTHROPIC_API_KEY"),
            str(file_config.get("ai_api_key") or ""),
        ),
        ai_model=first_non_empty(
            args.ai_model,
            os.getenv("AI_MODEL"),
            os.getenv("OPENAI_MODEL") if ai_provider == "openai" else os.getenv("ANTHROPIC_MODEL"),
            str(file_config.get("ai_model") or ""),
        ),
        ai_base_url=ai_base_url,
        relic_dir=relic_dir,
        port=args.port if args.port is not None else safe_int(file_config.get("port"), DEFAULT_PORT),
        host=first_non_empty(args.host, str(file_config.get("host") or ""), DEFAULT_HOST),
        dry_run=bool(args.dry_run or bool(file_config.get("dry_run") or False)),
        multi_relic=bool(args.multi_relic or bool(file_config.get("multi_relic") or False)),
        max_session_messages=args.max_session_messages
        if args.max_session_messages is not None
        else safe_int(file_config.get("max_session_messages"), DEFAULT_MAX_SESSION_MESSAGES),
        reply_as_card=bool(args.reply_as_card or bool(file_config.get("reply_as_card") or False)),
        request_timeout=args.request_timeout
        if args.request_timeout is not None
        else safe_int(file_config.get("request_timeout"), 30),
        anthropic_version=first_non_empty(
            os.getenv("ANTHROPIC_VERSION"),
            str(file_config.get("anthropic_version") or ""),
            DEFAULT_ANTHROPIC_VERSION,
        ),
    )
    return config


def validate_runtime_config(config: BotConfig, test_mode: bool = False) -> None:
    """在启动前做必要配置校验。"""
    if not config.relic_dir:
        raise ConfigurationError("请通过 --relic / --relic-dir 或配置文件提供 relic_dir")

    relic_path = Path(config.relic_dir).expanduser()
    if not relic_path.exists():
        raise ConfigurationError(f"Relic 路径不存在：{relic_path}")

    if not config.multi_relic and not (relic_path / "manifest.json").is_file():
        raise ConfigurationError(f"单 Relic 模式下，目录内必须包含 manifest.json：{relic_path}")

    if config.ai_provider not in SUPPORTED_AI_PROVIDERS:
        raise ConfigurationError(f"不支持的 AI Provider：{config.ai_provider}")

    if not config.dry_run and not test_mode:
        if not config.ai_api_key:
            raise ConfigurationError("缺少 AI_API_KEY（或对应 provider 的 API Key）")
        if not config.feishu_app_id or not config.feishu_app_secret:
            raise ConfigurationError("缺少 FEISHU_APP_ID / FEISHU_APP_SECRET")

    if Flask is None and not test_mode:
        raise ConfigurationError("缺少 Flask 依赖，请先执行 pip install flask")


def create_app(bot: RelicBot):
    """创建 Flask 应用。"""
    if Flask is None:
        raise ConfigurationError("缺少 Flask 依赖，请先执行 pip install flask")

    app = Flask(__name__)
    app.config["JSON_AS_ASCII"] = False

    @app.get("/healthz")
    def healthz():
        return jsonify(
            {
                "ok": True,
                "multi_relic": bot.config.multi_relic,
                "default_relic": bot.default_relic_slug,
                "dry_run": bot.config.dry_run,
            }
        )

    @app.post("/webhook")
    def webhook():
        raw_body = request.get_data(cache=False, as_text=False)
        timestamp = request.headers.get("X-Lark-Request-Timestamp", "")
        nonce = request.headers.get("X-Lark-Request-Nonce", "")
        signature = request.headers.get("X-Lark-Signature", "")
        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            LOGGER.warning("收到非法 JSON 请求体")
            return jsonify({"code": 400, "msg": "invalid json"}), 400

        if not isinstance(payload, Mapping):
            LOGGER.warning("收到非对象 JSON 请求体")
            return jsonify({"code": 400, "msg": "payload must be an object"}), 400

        event_type = str(payload.get("type") or "")
        if event_type == "url_verification":
            challenge = payload.get("challenge", "")
            return jsonify({"challenge": challenge}), 200

        try:
            bot.validate_request(
                raw_body=raw_body,
                payload=payload,
                timestamp=timestamp,
                nonce=nonce,
                signature=signature,
            )
            response_payload = bot.handle_webhook(payload)
            return jsonify(response_payload), 200
        except RequestValidationError as exc:
            LOGGER.warning("Webhook 校验失败：%s", exc)
            return jsonify({"code": 401, "msg": str(exc)}), 401
        except ConfigurationError as exc:
            LOGGER.error("配置错误：%s", exc)
            return jsonify({"code": 500, "msg": str(exc)}), 500
        except FeishuAPIError as exc:
            LOGGER.exception("调用飞书 API 失败")
            return jsonify({"code": 502, "msg": str(exc)}), 502
        except AIProviderError as exc:
            LOGGER.exception("调用 AI Provider 失败")
            return jsonify({"code": 502, "msg": str(exc)}), 502
        except Exception:
            LOGGER.exception("处理 webhook 失败")
            return jsonify({"code": 500, "msg": "internal server error"}), 500

    return app


def run_test_message(bot: RelicBot, test_message: str, user_id: str = "local-user", chat_id: str = "local-chat") -> int:
    """本地模拟一条用户消息，便于 dry-run 调试。"""
    intent = bot.detect_intent(test_message)
    active_slug = bot.get_active_relic_slug(user_id, chat_id=chat_id)

    intent_type = str(intent.get("type") or "chat")
    result: Dict[str, Any] = {
        "mode": "test-message",
        "input": str(intent.get("clean_text") or test_message),
        "intent": intent_type,
        "active_relic": active_slug,
        "dry_run": bot.config.dry_run,
    }

    if intent_type == "list_relics":
        result["reply"] = bot._build_relic_list_text(user_id=user_id, chat_id=chat_id)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if intent_type == "status":
        result["reply"] = bot._build_status_text(user_id=user_id, chat_id=chat_id, relic_slug=active_slug)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if intent_type == "reset":
        bot._reset_session(user_id=user_id, chat_id=chat_id, relic_slug=active_slug)
        result["reply"] = "这段会话已经清空了。我们可以从这里重新开始。"
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if intent_type == "pause":
        bot._set_paused(user_id=user_id, chat_id=chat_id, paused=True)
        result["reply"] = "好，我先安静下来。需要我继续时发 /resume。"
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if intent_type == "resume":
        bot._set_paused(user_id=user_id, chat_id=chat_id, paused=False)
        result["reply"] = "我回来了。你继续说就行。"
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if intent_type == "switch_relic":
        target = str(intent.get("relic_slug") or "").strip()
        if target:
            bot.set_active_relic_for_user(user_id, target, chat_id=chat_id)
            profile = bot.load_relic(target)
            result["active_relic"] = profile.slug
            result["reply"] = f"已切换到 {profile.display_name}（{profile.slug}）。现在你可以直接和 TA 说话了。"
        else:
            result["reply"] = bot.engine._build_switch_failure_text()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    incoming = IncomingMessage(
        platform="feishu-test",
        user_id=user_id,
        chat_id=chat_id,
        text=test_message,
        message_id="local-test-message",
        timestamp=time.time(),
        is_direct_chat=True,
        is_mentioned=False,
    )
    plan = bot.engine.handle_message(incoming, active_slug)
    plan = bot._prepare_response_plan(plan)
    result["reply"] = bot.render_plan_preview(plan)
    result["active_relic"] = plan.relic_slug or active_slug
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    """解析命令行参数。"""
    parser = argparse.ArgumentParser(description="飞书机器人服务，让 Relic 住在飞书里")
    parser.add_argument("--config", default="feishu_bot_config.json", help="配置文件路径，默认 feishu_bot_config.json")
    parser.add_argument("--relic", help="单 Relic 目录路径，例如 examples/grandma-demo")
    parser.add_argument("--relic-dir", help="多 Relic 模式下的根目录，例如 examples/")
    parser.add_argument("--multi-relic", action="store_true", help="启用多 Relic 模式")
    parser.add_argument("--host", help=f"监听地址，默认 {DEFAULT_HOST}")
    parser.add_argument("--port", type=int, help=f"监听端口，默认 {DEFAULT_PORT}")
    parser.add_argument("--dry-run", action="store_true", help="只打印消息，不真正发送到飞书")
    parser.add_argument("--reply-as-card", action="store_true", help="回复时使用飞书卡片消息")
    parser.add_argument("--ai-provider", choices=sorted(SUPPORTED_AI_PROVIDERS), help="大模型提供方")
    parser.add_argument("--ai-model", help="大模型名称")
    parser.add_argument("--ai-base-url", help="自定义大模型 API Base URL")
    parser.add_argument("--max-session-messages", type=int, help="保留最近多少轮对话上下文")
    parser.add_argument("--request-timeout", type=int, help="HTTP 请求超时（秒）")
    parser.add_argument("--test-message", help="本地测试一条消息，不启动 Web 服务")
    parser.add_argument("--test-user-id", default="local-user", help="本地测试时使用的用户 ID")
    parser.add_argument("--debug", action="store_true", help="启用调试日志")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    """CLI 入口。"""
    configure_utf8_stdio()
    args = parse_args(argv)
    configure_logging(debug=args.debug)

    config = build_config(args)
    if args.multi_relic and args.relic_dir:
        config.relic_dir = args.relic_dir
    elif args.relic and not args.multi_relic:
        config.relic_dir = args.relic
    elif args.multi_relic and args.relic:
        config.relic_dir = str(Path(args.relic).expanduser().resolve().parent)

    test_mode = bool(args.test_message)
    validate_runtime_config(config=config, test_mode=test_mode)

    bot = RelicBot(relic_dir=config.relic_dir, config=config)

    if args.test_message:
        return run_test_message(bot=bot, test_message=args.test_message, user_id=args.test_user_id)

    app = create_app(bot)
    LOGGER.info(
        "飞书机器人已启动：host=%s port=%s dry_run=%s multi_relic=%s relic_dir=%s",
        config.host,
        config.port,
        config.dry_run,
        config.multi_relic,
        config.relic_dir,
    )
    app.run(host=config.host, port=config.port, debug=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
