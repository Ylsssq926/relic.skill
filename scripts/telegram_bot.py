#!/usr/bin/env python3
"""Telegram 机器人，让 Relic 住在 Telegram 里。

示例：
    python scripts/telegram_bot.py --relic examples/grandma-demo
    python scripts/telegram_bot.py --relic examples/grandma-demo --dry-run --test-message "奶奶，我今天加班到十一点"
    python scripts/telegram_bot.py --relic-dir examples --multi-relic
    python scripts/telegram_bot.py --relic examples/grandma-demo --polling

环境变量：
    TELEGRAM_BOT_TOKEN
    TELEGRAM_SECRET_TOKEN  (optional, for webhook verification)
    AI_PROVIDER / AI_API_KEY / AI_MODEL
"""
from __future__ import annotations

import argparse
import html
import json
import logging
import os
import re
import sys
import time
from dataclasses import asdict, dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence

try:  # pragma: no cover - requests is an external dependency
    import requests
except ImportError:  # pragma: no cover - handled at runtime
    requests = None  # type: ignore[assignment]

try:  # pragma: no cover - import path differs between script/module usage
    from .media_service import MediaService, apply_dry_run
    from .relic_engine import (
        ConfigurationError,
        EngineConfig,
        IncomingMessage,
        OutgoingMessage,
        RelicEngine,
        ResponsePlan,
        SUPPORTED_AI_PROVIDERS,
        configure_utf8_stdio,
    )
except ImportError:  # pragma: no cover - direct script execution
    from media_service import MediaService, apply_dry_run  # type: ignore[no-redef]
    from relic_engine import (  # type: ignore[no-redef]
        ConfigurationError,
        EngineConfig,
        IncomingMessage,
        OutgoingMessage,
        RelicEngine,
        ResponsePlan,
        SUPPORTED_AI_PROVIDERS,
        configure_utf8_stdio,
    )


LOGGER = logging.getLogger("telegram_bot")

DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8080
DEFAULT_POLLING_INTERVAL = 1.0
DEFAULT_REQUEST_TIMEOUT = 30
TELEGRAM_API_BASE = "https://api.telegram.org"
WEBHOOK_PATH = "/webhook"
HEALTHZ_PATH = "/healthz"
SECRET_TOKEN_HEADER = "X-Telegram-Bot-Api-Secret-Token"
TEXT_LIMIT = 4000
CAPTION_LIMIT = 1024
SUPPORTED_VOICE_SUFFIXES = {".ogg", ".oga", ".opus", ".mp3", ".m4a", ".mpeg", ".mpga", ".wav"}
MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".opus": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".mpeg": "audio/mpeg",
    ".mpga": "audio/mpeg",
    ".wav": "audio/wav",
}
BOT_MENTION_RE_TEMPLATE = r"(?<![\w_])@{username}\b"


@dataclass
class TelegramBotConfig:
    """Telegram 机器人运行配置。"""

    bot_token: str = ""
    secret_token: str = ""
    ai_provider: str = "claude"
    ai_api_key: str = ""
    ai_model: str = ""
    ai_base_url: str = ""
    relic_dir: str = ""
    port: int = DEFAULT_PORT
    host: str = DEFAULT_HOST
    max_session_messages: int = 20
    max_active_memories: int = 4
    session_ttl_hours: int = 24
    multi_relic: bool = False
    polling_interval: float = DEFAULT_POLLING_INTERVAL
    dry_run: bool = False
    request_timeout: int = DEFAULT_REQUEST_TIMEOUT

    def __post_init__(self) -> None:
        """规范化配置字段。"""
        self.bot_token = (self.bot_token or "").strip()
        self.secret_token = (self.secret_token or "").strip()
        self.ai_provider = (self.ai_provider or "claude").strip().lower()
        if self.ai_provider not in SUPPORTED_AI_PROVIDERS:
            raise ConfigurationError(f"不支持的 AI Provider：{self.ai_provider}")
        self.ai_api_key = (self.ai_api_key or "").strip()
        self.ai_model = (self.ai_model or "").strip()
        self.ai_base_url = (self.ai_base_url or "").strip()
        self.relic_dir = (self.relic_dir or "").strip()
        self.host = (self.host or DEFAULT_HOST).strip() or DEFAULT_HOST
        self.port = max(1, int(self.port or DEFAULT_PORT))
        self.max_session_messages = max(1, int(self.max_session_messages or 20))
        self.max_active_memories = max(1, int(self.max_active_memories or 4))
        self.session_ttl_hours = max(1, int(self.session_ttl_hours or 24))
        self.polling_interval = max(0.0, float(self.polling_interval or DEFAULT_POLLING_INTERVAL))
        self.request_timeout = max(3, int(self.request_timeout or DEFAULT_REQUEST_TIMEOUT))
        self.multi_relic = bool(self.multi_relic)
        self.dry_run = bool(self.dry_run)


class TelegramBot:
    """Telegram 机器人，使用 RelicEngine 处理对话。"""

    def __init__(self, config: TelegramBotConfig):
        """初始化 Telegram 机器人与 RelicEngine。"""
        self.config = config
        self.api_url = f"{TELEGRAM_API_BASE}/bot{config.bot_token}" if config.bot_token else ""
        self._http = requests.Session() if requests is not None else None
        self._bot_info_cache: Dict[str, Any] = {}
        self._bot_info_last_attempt = 0.0
        self.base_relic_dir = Path(config.relic_dir).expanduser().resolve() if config.relic_dir else Path.cwd()
        self.default_relic_slug = ""
        self.loaded_relic_slugs: List[str] = []

        engine_config = EngineConfig(
            ai_provider=config.ai_provider,
            ai_api_key=config.ai_api_key,
            ai_model=config.ai_model,
            ai_base_url=config.ai_base_url,
            max_session_messages=config.max_session_messages,
            max_active_memories=config.max_active_memories,
            session_ttl_hours=config.session_ttl_hours,
            request_timeout=config.request_timeout,
        )
        self.engine = RelicEngine(engine_config)
        self._bootstrap_relics()

    # ------------------------------------------------------------------
    # Relic 加载
    # ------------------------------------------------------------------
    def _bootstrap_relics(self) -> None:
        """启动时加载单 Relic 或扫描多 Relic 根目录。"""
        if self.config.multi_relic:
            self._discover_relics(self.base_relic_dir)
            if not self.loaded_relic_slugs:
                raise ConfigurationError(f"在目录中未发现任何可用 Relic：{self.base_relic_dir}")
            self.default_relic_slug = self.loaded_relic_slugs[0]
            LOGGER.info("多 Relic 模式已启用，发现 %s 个 Relic", len(self.loaded_relic_slugs))
            return

        profile = self.engine.load_relic(str(self.base_relic_dir))
        self.default_relic_slug = profile.slug
        self.loaded_relic_slugs = [profile.slug]
        LOGGER.info("已加载默认 Relic：%s (%s)", profile.display_name, profile.slug)

    def _discover_relics(self, root_dir: Path) -> None:
        """扫描根目录并预加载所有合法 Relic。"""
        if not root_dir.exists() or not root_dir.is_dir():
            raise ConfigurationError(f"Relic 根目录不存在：{root_dir}")

        discovered: List[str] = []
        for child in sorted(root_dir.iterdir()):
            if not child.is_dir() or not (child / "manifest.json").is_file():
                continue
            try:
                profile = self.engine.load_relic(str(child))
            except Exception as exc:
                LOGGER.warning("跳过无法加载的 Relic：%s (%s)", child, exc)
                continue
            discovered.append(profile.slug)

        self.loaded_relic_slugs = sorted(dict.fromkeys(discovered))

    def _iter_loaded_slugs(self) -> List[str]:
        """返回当前已加载 Relic slug 列表。"""
        return list(self.loaded_relic_slugs)

    def _resolve_relic_target(self, target: str) -> Optional[str]:
        """把 /relic 参数解析成已加载或可直接加载的 slug。"""
        normalized = (target or "").strip()
        if not normalized:
            return None
        try:
            profile = self.engine.load_relic(normalized)
            return profile.slug
        except (ConfigurationError, OSError, ValueError, TypeError):
            LOGGER.debug("解析 Relic 目标失败：%s", target, exc_info=True)
            return None

    def _get_relic_dir(self, relic_slug: str) -> str:
        """返回指定 Relic 的目录路径字符串。"""
        profile = self.engine.load_relic(relic_slug)
        return str(profile.relic_dir)

    def _get_active_relic_slug(self, user_id: str, chat_id: str) -> str:
        """返回当前用户在当前 chat 内激活的 Relic。"""
        return self.engine.get_active_relic_slug(user_id, chat_id, fallback=self.default_relic_slug)

    def _session_key(self, user_id: str, chat_id: str, relic_slug: str) -> str:
        """构造与引擎一致的会话键。"""
        return f"{user_id}::{chat_id}::{relic_slug}"

    # ------------------------------------------------------------------
    # Update / 命令 / 消息解析
    # ------------------------------------------------------------------
    def handle_update(self, update: Mapping[str, Any]) -> None:
        """处理一条 Telegram Update。"""
        update_id = update.get("update_id")
        try:
            message = update.get("message") or update.get("edited_message")
            if not isinstance(message, Mapping):
                return

            incoming = self._parse_message(dict(message))
            if not incoming:
                return

            if incoming.text.startswith("/"):
                self._handle_command(incoming, dict(message))
                return

            relic_slug = self._get_active_relic_slug(incoming.user_id, incoming.chat_id)
            plan = self.engine.handle_message(incoming, relic_slug)
            self._execute_plan(incoming.chat_id, plan)
        except Exception:
            LOGGER.exception("处理 Telegram update 失败：%s", update_id if update_id is not None else "<unknown>")
            raise

    def _parse_message(self, message: Mapping[str, Any]) -> Optional[IncomingMessage]:
        """把 Telegram message 结构转换为 IncomingMessage。"""
        chat = message.get("chat") or {}
        user = message.get("from") or {}
        if not isinstance(chat, Mapping) or not isinstance(user, Mapping):
            return None
        if bool(user.get("is_bot")):
            return None

        raw_text = str(message.get("text") or message.get("caption") or "")
        text = raw_text.strip()
        if not text:
            return None

        is_direct = str(chat.get("type") or "") == "private"
        entities = message.get("entities") or message.get("caption_entities") or []
        bot_username = self._get_bot_username()
        bot_id = self._get_bot_id()

        command_target = self._command_target_username(text)
        if command_target and bot_username and command_target.lower() != bot_username.lower():
            return None

        is_mentioned = is_direct
        if not is_direct:
            is_mentioned = self._message_mentions_bot(text, entities, bot_username, bot_id)
            if self._is_reply_to_bot(message.get("reply_to_message"), bot_username, bot_id):
                is_mentioned = True
            if text.startswith("/") and (not command_target or not bot_username or command_target.lower() == bot_username.lower()):
                is_mentioned = True

        if not is_direct and not is_mentioned and not text.startswith("/"):
            return None

        cleaned_text = self._strip_bot_mention(text, bot_username)
        return IncomingMessage(
            platform="telegram",
            user_id=str(user.get("id", "")),
            chat_id=str(chat.get("id", "")),
            text=cleaned_text,
            message_id=str(message.get("message_id", "")),
            is_direct_chat=is_direct,
            is_mentioned=is_mentioned,
            timestamp=float(message.get("date", 0) or 0),
            raw=dict(message),
        )

    def _handle_command(self, incoming: IncomingMessage, raw_message: Mapping[str, Any]) -> None:
        """处理 Telegram 原生命令。"""
        plan = self._plan_command(incoming)
        if plan is None:
            return
        self._execute_plan(incoming.chat_id, plan)

    def _plan_command(self, incoming: IncomingMessage) -> Optional[ResponsePlan]:
        """把命令解析成平台无关的响应计划。"""
        text = incoming.text.strip()
        if not text.startswith("/"):
            return None

        first_token = text.split()[0]
        command_name = first_token.lstrip("/")
        command, _, command_target = command_name.partition("@")
        bot_username = self._get_bot_username()
        if command_target and bot_username and command_target.lower() != bot_username.lower():
            return None
        command = command.lower()
        args = text.split()[1:]
        active_slug = self._get_active_relic_slug(incoming.user_id, incoming.chat_id)
        session_key = self._session_key(incoming.user_id, incoming.chat_id, active_slug)

        if command == "start":
            reply = self._build_start_text(active_slug)
            return ResponsePlan(
                messages=[OutgoingMessage(kind="text", text=reply)],
                mode="daily",
                relic_slug=active_slug,
                session_key=session_key,
            )

        if command == "help":
            reply = self._build_help_text(active_slug)
            return ResponsePlan(
                messages=[OutgoingMessage(kind="text", text=reply)],
                mode="daily",
                relic_slug=active_slug,
                session_key=session_key,
            )

        if command == "relic":
            if not self.config.multi_relic:
                profile = self.engine.load_relic(active_slug)
                reply = f"当前是单 Relic 模式，只加载了 {profile.display_name}（{profile.slug}）。"
                return ResponsePlan(
                    messages=[OutgoingMessage(kind="text", text=reply)],
                    mode="daily",
                    relic_slug=active_slug,
                    session_key=session_key,
                )

            if not args:
                reply = self._build_relic_list_text(active_slug)
                return ResponsePlan(
                    messages=[OutgoingMessage(kind="text", text=reply)],
                    mode="daily",
                    relic_slug=active_slug,
                    session_key=session_key,
                )

            target = " ".join(args).strip()
            slug = self._resolve_relic_target(target)
            if not slug:
                reply = self._build_switch_failure_text()
                return ResponsePlan(
                    messages=[OutgoingMessage(kind="text", text=reply)],
                    mode="daily",
                    relic_slug=active_slug,
                    session_key=session_key,
                )

            self.engine.set_active_relic_for_user(incoming.user_id, slug, chat_id=incoming.chat_id)
            profile = self.engine.load_relic(slug)
            switched_key = self._session_key(incoming.user_id, incoming.chat_id, profile.slug)
            reply = f"已切换到 {profile.display_name}（{profile.slug}）。现在你可以直接和 TA 说话了。"
            return ResponsePlan(
                messages=[OutgoingMessage(kind="text", text=reply, metadata={"switched": True})],
                mode="daily",
                relic_slug=profile.slug,
                session_key=switched_key,
            )

        if command == "relics":
            reply = self._build_relic_list_text(active_slug)
            return ResponsePlan(
                messages=[OutgoingMessage(kind="text", text=reply)],
                mode="daily",
                relic_slug=active_slug,
                session_key=session_key,
            )

        if command == "proactive":
            plan = self.engine.handle_message(incoming, active_slug)
            if not plan.session_key:
                plan.session_key = session_key
            return plan

        reply = "我目前支持这些命令：/start、/help、/relic、/relics、/proactive"
        return ResponsePlan(
            messages=[OutgoingMessage(kind="text", text=reply)],
            mode="daily",
            relic_slug=active_slug,
            session_key=session_key,
        )

    def _message_mentions_bot(
        self,
        text: str,
        entities: Any,
        bot_username: str,
        bot_id: str,
    ) -> bool:
        """判断群聊消息是否显式提及当前机器人。"""
        if bot_username and f"@{bot_username}".lower() in text.lower():
            return True

        if not isinstance(entities, list):
            return False
        for entity in entities:
            if not isinstance(entity, Mapping):
                continue
            entity_type = str(entity.get("type") or "")
            if entity_type == "text_mention":
                mentioned_user = entity.get("user") or {}
                if not isinstance(mentioned_user, Mapping):
                    continue
                mentioned_id = str(mentioned_user.get("id") or "")
                mentioned_username = str(mentioned_user.get("username") or "").lstrip("@")
                if bot_id and mentioned_id == bot_id:
                    return True
                if bot_username and mentioned_username.lower() == bot_username.lower():
                    return True
        return False

    def _is_reply_to_bot(self, reply_to_message: Any, bot_username: str, bot_id: str) -> bool:
        """判断当前消息是否是在回复机器人。"""
        if not isinstance(reply_to_message, Mapping):
            return False
        reply_from = reply_to_message.get("from") or {}
        if not isinstance(reply_from, Mapping) or not bool(reply_from.get("is_bot")):
            return False
        reply_id = str(reply_from.get("id") or "")
        reply_username = str(reply_from.get("username") or "").lstrip("@")
        if bot_id:
            return reply_id == bot_id
        if bot_username:
            return reply_username.lower() == bot_username.lower()
        return False

    def _command_target_username(self, text: str) -> str:
        """提取 /command@bot 中的 bot 用户名。"""
        compact = (text or "").strip()
        if not compact.startswith("/"):
            return ""
        token = compact.split()[0].lstrip("/")
        if "@" not in token:
            return ""
        return token.split("@", 1)[1].strip().lstrip("@")

    def _strip_bot_mention(self, text: str, bot_username: str) -> str:
        """移除文本中的 @botname，方便直接送入引擎。"""
        cleaned = (text or "").strip()
        if bot_username:
            pattern = BOT_MENTION_RE_TEMPLATE.format(username=re.escape(bot_username))
            cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    # ------------------------------------------------------------------
    # 响应执行 / 发送消息
    # ------------------------------------------------------------------
    def _execute_plan(self, chat_id: str, plan: ResponsePlan) -> None:
        """兼容旧调用：解析 relic_dir 后执行完整 ResponsePlan。"""
        relic_slug = plan.relic_slug or self.default_relic_slug
        relic_dir = self._get_relic_dir(relic_slug) if relic_slug else str(self.base_relic_dir)
        self._execute_response_plan(plan=plan, chat_id=chat_id, relic_dir=relic_dir)

    def _execute_response_plan(self, plan: ResponsePlan, chat_id: str, relic_dir: str) -> None:
        """执行 ResponsePlan，补齐 TTS / 图片生成并发送到 Telegram。"""
        media: Optional[MediaService] = None

        def ensure_media_service() -> MediaService:
            nonlocal media
            if media is None:
                media = MediaService.from_relic(relic_dir)
                apply_dry_run(media, self.config.dry_run)
            return media

        for msg in plan.messages:
            try:
                if msg.kind == "text":
                    self._send_text(chat_id, msg.text)
                    continue

                if msg.kind == "audio":
                    media_path = msg.media_path
                    if not media_path and msg.text:
                        try:
                            media_service = ensure_media_service()
                            if media_service.has_tts:
                                media_path = media_service.synthesize_speech(msg.text, mode=plan.mode) or ""
                        except Exception as exc:
                            LOGGER.warning("Telegram TTS 生成失败，降级为文字：%s", exc)
                    if media_path:
                        result = self._send_voice(chat_id, media_path)
                        if result.get("ok"):
                            continue
                    if msg.text:
                        self._send_text(chat_id, msg.text)
                    continue

                if msg.kind == "image":
                    image_path = msg.media_path
                    if not image_path:
                        try:
                            media_service = ensure_media_service()
                            if media_service.has_image:
                                image_path = media_service.generate_avatar() or ""
                        except Exception as exc:
                            LOGGER.warning("Telegram 图像生成失败：%s", exc)
                    if image_path:
                        result = self._send_photo(chat_id, image_path, caption=msg.text)
                        if result.get("ok"):
                            continue
                    if msg.text:
                        self._send_text(chat_id, msg.text)
                    continue

                if msg.kind == "card":
                    card_text = "\n\n".join(part for part in [msg.title, msg.text] if part).strip()
                    if card_text:
                        self._send_text(chat_id, card_text)
                    continue

                if msg.text:
                    self._send_text(chat_id, msg.text)
            except Exception:
                LOGGER.exception("执行 Telegram 出站消息失败：kind=%s relic_dir=%s", msg.kind, relic_dir)
                if msg.text:
                    self._send_text(chat_id, msg.text)

    def _send_text(self, chat_id: str, text: str) -> Dict[str, Any]:
        """通过 Telegram sendMessage 发送文本消息。"""
        compact = (text or "").strip()
        if not compact:
            return {"ok": False, "description": "empty text"}

        url = f"{self.api_url}/sendMessage"
        results: List[Dict[str, Any]] = []
        for chunk in self._split_text_chunks(compact):
            payload = {
                "chat_id": chat_id,
                "text": html.escape(chunk, quote=False),
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            }
            results.append(self._post_json(url, payload))
        return {
            "ok": all(bool(item.get("ok")) for item in results),
            "results": results,
        }

    def _send_voice(self, chat_id: str, audio_path: str) -> Dict[str, Any]:
        """通过 Telegram sendVoice 上传并发送语音。"""
        path = Path(audio_path).expanduser()
        if not path.is_file():
            LOGGER.warning("语音文件不存在，无法发送：%s", path)
            return {"ok": False, "description": f"missing file: {path}"}
        if path.suffix.lower() not in SUPPORTED_VOICE_SUFFIXES:
            LOGGER.warning("语音文件后缀可能不被 Telegram 作为 voice 支持：%s", path.suffix)

        url = f"{self.api_url}/sendVoice"
        with path.open("rb") as handle:
            return self._post_multipart(
                url,
                data={"chat_id": chat_id},
                files={
                    "voice": (
                        path.name,
                        handle,
                        self._guess_mime_type(path),
                    )
                },
            )

    def _send_photo(self, chat_id: str, image_path: str, caption: str = "") -> Dict[str, Any]:
        """通过 Telegram sendPhoto 上传并发送图片。"""
        path = Path(image_path).expanduser()
        if not path.is_file():
            LOGGER.warning("图片文件不存在，无法发送：%s", path)
            return {"ok": False, "description": f"missing file: {path}"}

        url = f"{self.api_url}/sendPhoto"
        data: Dict[str, Any] = {"chat_id": chat_id}
        caption_text = self._normalize_caption(caption)
        if caption_text:
            data["caption"] = html.escape(caption_text, quote=False)
            data["parse_mode"] = "HTML"
        with path.open("rb") as handle:
            return self._post_multipart(
                url,
                data=data,
                files={
                    "photo": (
                        path.name,
                        handle,
                        self._guess_mime_type(path),
                    )
                },
            )

    def _post_json(self, url: str, payload: Mapping[str, Any], timeout: Optional[float] = None) -> Dict[str, Any]:
        """向 Telegram API 发送 JSON POST 请求。"""
        if self.config.dry_run:
            LOGGER.info("[DRY-RUN] POST %s -> %s", url, json.dumps(dict(payload), ensure_ascii=False))
            return {"ok": True, "result": {"dry_run": True, "url": url, "payload": dict(payload)}}

        if requests is None or self._http is None:
            LOGGER.error("缺少 requests 依赖，无法调用 Telegram API：%s", url)
            return {"ok": False, "description": "requests is not installed"}
        if not self.api_url:
            LOGGER.error("缺少 TELEGRAM_BOT_TOKEN，无法调用 Telegram API：%s", url)
            return {"ok": False, "description": "missing TELEGRAM_BOT_TOKEN"}

        actual_timeout = timeout if timeout is not None else self.config.request_timeout
        try:
            response = self._http.post(url, json=dict(payload), timeout=actual_timeout)
        except requests.RequestException as exc:
            LOGGER.warning("Telegram API 请求失败：%s", exc)
            return {"ok": False, "description": str(exc)}

        try:
            result = response.json() if response.content else {}
        except ValueError:
            body = response.text.strip()
            LOGGER.warning("Telegram API 返回非 JSON：HTTP %s %s", response.status_code, body)
            return {"ok": False, "description": f"non-json response: HTTP {response.status_code}", "raw": body}

        if not response.ok:
            LOGGER.warning("Telegram API HTTP 错误：%s %s", response.status_code, result)
            if isinstance(result, Mapping):
                return dict(result)
            return {"ok": False, "description": f"HTTP {response.status_code}", "raw": result}

        if isinstance(result, Mapping):
            if not bool(result.get("ok", True)):
                LOGGER.warning("Telegram API 调用失败：%s", result)
            return dict(result)

        LOGGER.warning("Telegram API 返回异常结构：%r", result)
        return {"ok": False, "description": "unexpected response type", "raw": result}

    def _post_multipart(
        self,
        url: str,
        data: Mapping[str, Any],
        files: Mapping[str, Any],
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        """向 Telegram API 发送 multipart/form-data 请求。"""
        if self.config.dry_run:
            file_names = {
                field_name: value[0] if isinstance(value, tuple) and value else str(value)
                for field_name, value in files.items()
            }
            LOGGER.info(
                "[DRY-RUN] MULTIPART %s -> data=%s files=%s",
                url,
                json.dumps(dict(data), ensure_ascii=False),
                json.dumps(file_names, ensure_ascii=False),
            )
            return {
                "ok": True,
                "result": {
                    "dry_run": True,
                    "url": url,
                    "data": dict(data),
                    "files": file_names,
                },
            }

        if requests is None or self._http is None:
            LOGGER.error("缺少 requests 依赖，无法调用 Telegram API：%s", url)
            return {"ok": False, "description": "requests is not installed"}
        if not self.api_url:
            LOGGER.error("缺少 TELEGRAM_BOT_TOKEN，无法调用 Telegram API：%s", url)
            return {"ok": False, "description": "missing TELEGRAM_BOT_TOKEN"}

        actual_timeout = timeout if timeout is not None else self.config.request_timeout
        try:
            response = self._http.post(url, data=dict(data), files=dict(files), timeout=actual_timeout)
        except requests.RequestException as exc:
            LOGGER.warning("Telegram multipart 请求失败：%s", exc)
            return {"ok": False, "description": str(exc)}

        try:
            result = response.json() if response.content else {}
        except ValueError:
            body = response.text.strip()
            LOGGER.warning("Telegram multipart 返回非 JSON：HTTP %s %s", response.status_code, body)
            return {"ok": False, "description": f"non-json response: HTTP {response.status_code}", "raw": body}

        if not response.ok:
            LOGGER.warning("Telegram multipart HTTP 错误：%s %s", response.status_code, result)
            if isinstance(result, Mapping):
                return dict(result)
            return {"ok": False, "description": f"HTTP {response.status_code}", "raw": result}

        if isinstance(result, Mapping):
            if not bool(result.get("ok", True)):
                LOGGER.warning("Telegram multipart 调用失败：%s", result)
            return dict(result)

        LOGGER.warning("Telegram multipart 返回异常结构：%r", result)
        return {"ok": False, "description": "unexpected response type", "raw": result}

    # ------------------------------------------------------------------
    # Telegram API 扩展能力
    # ------------------------------------------------------------------
    def run_webhook(self) -> None:
        """启动标准库实现的 webhook HTTP 服务。"""
        bot = self

        class Handler(BaseHTTPRequestHandler):
            """处理 Telegram webhook 的 HTTP 请求。"""

            def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
                path = self.path.split("?", 1)[0]
                if path != HEALTHZ_PATH:
                    self._write_json(404, {"ok": False, "error": "not found"})
                    return
                self._write_json(
                    200,
                    {
                        "ok": True,
                        "multi_relic": bot.config.multi_relic,
                        "default_relic": bot.default_relic_slug,
                        "dry_run": bot.config.dry_run,
                    },
                )

            def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
                path = self.path.split("?", 1)[0]
                if path != WEBHOOK_PATH:
                    self._write_json(404, {"ok": False, "error": "not found"})
                    return

                if bot.config.secret_token:
                    received_secret = self.headers.get(SECRET_TOKEN_HEADER, "")
                    if received_secret != bot.config.secret_token:
                        LOGGER.warning("Webhook secret_token 校验失败")
                        self._write_json(401, {"ok": False, "error": "invalid secret token"})
                        return

                try:
                    content_length = int(self.headers.get("Content-Length", "0") or 0)
                except ValueError:
                    content_length = 0
                raw_body = self.rfile.read(max(0, content_length))

                try:
                    payload = json.loads(raw_body.decode("utf-8") or "{}")
                except json.JSONDecodeError:
                    LOGGER.warning("收到非法 JSON webhook 请求体")
                    self._write_json(400, {"ok": False, "error": "invalid json"})
                    return

                if not isinstance(payload, Mapping):
                    self._write_json(400, {"ok": False, "error": "payload must be an object"})
                    return

                try:
                    bot.handle_update(payload)
                    self._write_json(200, {"ok": True})
                except Exception as exc:
                    LOGGER.error("处理 webhook update 失败: %s", exc)
                    self._write_json(500, {"ok": False, "error": "internal server error"})

            def log_message(self, format: str, *args: Any) -> None:  # noqa: A003 - stdlib API
                LOGGER.debug("webhook %s - %s", self.address_string(), format % args)

            def _write_json(self, status_code: int, payload: Mapping[str, Any]) -> None:
                body = json.dumps(dict(payload), ensure_ascii=False).encode("utf-8")
                self.send_response(status_code)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        server = ThreadingHTTPServer((self.config.host, self.config.port), Handler)
        LOGGER.info(
            "Telegram webhook 服务已启动：host=%s port=%s dry_run=%s multi_relic=%s relic_dir=%s",
            self.config.host,
            self.config.port,
            self.config.dry_run,
            self.config.multi_relic,
            self.config.relic_dir,
        )
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            LOGGER.info("收到中断信号，正在关闭 webhook 服务")
        finally:
            server.server_close()

    def run_polling(self) -> None:
        """启动 Telegram long polling 循环。"""
        self.delete_webhook(drop_pending_updates=False)
        offset = 0
        LOGGER.info(
            "Telegram polling 已启动：interval=%ss dry_run=%s multi_relic=%s relic_dir=%s",
            self.config.polling_interval,
            self.config.dry_run,
            self.config.multi_relic,
            self.config.relic_dir,
        )
        try:
            while True:
                try:
                    updates = self._get_updates(offset)
                    for update in updates:
                        if not isinstance(update, Mapping):
                            continue
                        try:
                            update_id = int(update.get("update_id", 0))
                        except (TypeError, ValueError):
                            update_id = 0

                        try:
                            self.handle_update(update)
                            offset = max(offset, update_id + 1)
                        except Exception as exc:
                            LOGGER.error("处理 update %d 失败: %s", update_id, exc)
                            offset = max(offset, update_id + 1)
                except Exception as exc:
                    LOGGER.error("getUpdates 失败: %s", exc)
                time.sleep(self.config.polling_interval)
        except KeyboardInterrupt:
            LOGGER.info("收到中断信号，停止 polling")

    def _get_updates(self, offset: int = 0) -> List[Dict[str, Any]]:
        """调用 Telegram getUpdates API。"""
        url = f"{self.api_url}/getUpdates"
        payload = {
            "offset": offset,
            "timeout": 30,
            "limit": 100,
            "allowed_updates": ["message", "edited_message"],
        }
        result = self._post_json(url, payload, timeout=max(self.config.request_timeout, 35))
        if not bool(result.get("ok")):
            return []
        updates = result.get("result") or []
        if not isinstance(updates, list):
            return []
        return [dict(item) for item in updates if isinstance(item, Mapping)]

    def set_webhook(self, webhook_url: str) -> bool:
        """向 Telegram 注册 webhook URL。"""
        payload: Dict[str, Any] = {
            "url": webhook_url,
            "allowed_updates": ["message", "edited_message"],
        }
        if self.config.secret_token:
            payload["secret_token"] = self.config.secret_token
        result = self._post_json(f"{self.api_url}/setWebhook", payload)
        success = bool(result.get("ok")) and bool(result.get("result", False))
        if success:
            LOGGER.info("Telegram webhook 注册成功：%s", webhook_url)
        else:
            LOGGER.warning("Telegram webhook 注册失败：%s", result)
        return success

    def delete_webhook(self, drop_pending_updates: bool = False) -> bool:
        """删除 webhook，便于切到 polling 模式。"""
        result = self._post_json(
            f"{self.api_url}/deleteWebhook",
            {"drop_pending_updates": bool(drop_pending_updates)},
        )
        success = bool(result.get("ok"))
        if not success:
            LOGGER.warning("删除 Telegram webhook 失败：%s", result)
        return success

    def set_commands(self) -> None:
        """向 Telegram 注册机器人命令列表。"""
        commands = [
            {"command": "start", "description": "开始对话"},
            {"command": "help", "description": "查看帮助"},
            {"command": "relic", "description": "切换 Relic"},
            {"command": "relics", "description": "查看所有 Relic"},
            {"command": "proactive", "description": "触发主动消息"},
        ]
        result = self._post_json(f"{self.api_url}/setMyCommands", {"commands": commands})
        if bool(result.get("ok")):
            LOGGER.info("Telegram 命令列表已更新")
            return
        LOGGER.warning("更新 Telegram 命令列表失败：%s", result)

    def _fetch_bot_info(self) -> Dict[str, Any]:
        """调用 getMe 并缓存机器人自身信息。"""
        if self._bot_info_cache:
            return dict(self._bot_info_cache)
        if self.config.dry_run or not self.api_url or requests is None or self._http is None:
            return {}

        now = time.time()
        if now - self._bot_info_last_attempt < 60:
            return {}
        self._bot_info_last_attempt = now

        try:
            response = self._http.get(f"{self.api_url}/getMe", timeout=self.config.request_timeout)
        except requests.RequestException as exc:
            LOGGER.warning("获取 bot 信息失败：%s", exc)
            return {}

        try:
            result = response.json() if response.content else {}
        except ValueError:
            LOGGER.warning("getMe 返回非 JSON：HTTP %s %s", response.status_code, response.text)
            return {}

        if not response.ok or not isinstance(result, Mapping) or not bool(result.get("ok")):
            LOGGER.warning("getMe 失败：%s", result)
            return {}

        payload = result.get("result") or {}
        if isinstance(payload, Mapping):
            self._bot_info_cache = dict(payload)
            return dict(self._bot_info_cache)
        return {}

    def _get_bot_username(self) -> str:
        """返回机器人 username。"""
        payload = self._fetch_bot_info()
        return str(payload.get("username") or "").lstrip("@")

    def _get_bot_id(self) -> str:
        """返回机器人用户 ID。"""
        payload = self._fetch_bot_info()
        return str(payload.get("id") or "")

    # ------------------------------------------------------------------
    # 文案 / 文本处理
    # ------------------------------------------------------------------
    def _build_start_text(self, active_slug: str) -> str:
        """构建 /start 欢迎文案。"""
        profile = self.engine.load_relic(active_slug)
        lines = [
            f"你好，我已经把 Relic 接进 Telegram 了。当前 Relic：{profile.display_name}（{profile.slug}）",
            "",
            "你可以直接跟我聊天。群聊里请 @我，或者回复我的消息。",
        ]
        if self.config.multi_relic:
            lines.extend(["", self._build_relic_list_text(active_slug)])
        lines.extend(["", "发送 /help 可以看完整命令。"])
        return "\n".join(lines)

    def _build_help_text(self, active_slug: str) -> str:
        """构建 Telegram 平台帮助文案。"""
        profile = self.engine.load_relic(active_slug)
        lines = [
            f"当前 Relic：{profile.display_name}（{profile.slug}）",
            "",
            "你可以直接跟我聊天。",
            "常用命令：",
            "- /start：开始对话",
            "- /help：查看帮助",
            "- /proactive [holiday|anniversary|weather|random]：手动触发一条主动消息",
        ]
        if self.config.multi_relic and len(self._iter_loaded_slugs()) > 1:
            lines.extend(
                [
                    "- /relics：查看已加载的 Relic",
                    "- /relic 名称：切换到指定 Relic",
                ]
            )
        lines.extend(["", "群聊里请 @我，或者回复我的消息。"])
        return "\n".join(lines)

    def _build_relic_list_text(self, active_slug: str) -> str:
        """构建 /relics 返回文案。"""
        loaded_slugs = self._iter_loaded_slugs()
        if not self.config.multi_relic or len(loaded_slugs) <= 1:
            profile = self.engine.load_relic(active_slug)
            return f"当前是单 Relic 模式，只加载了 {profile.display_name}（{profile.slug}）。"

        lines = ["可用 Relic："]
        for slug in loaded_slugs:
            profile = self.engine.load_relic(slug)
            marker = "（当前）" if slug == active_slug else ""
            lines.append(f"- {profile.display_name} [{profile.slug}] {marker}".rstrip())
        lines.append("")
        lines.append("切换方式：/relic slug")
        return "\n".join(lines)

    def _build_switch_failure_text(self) -> str:
        """构建 /relic 未识别成功时的提示。"""
        loaded_slugs = self._iter_loaded_slugs()
        if not loaded_slugs:
            return "我这边还没有加载任何 Relic。请先检查 --relic 或 --relic-dir 配置。"

        lines = ["我没认出你想切到哪个 Relic。当前已加载："]
        for slug in loaded_slugs:
            profile = self.engine.load_relic(slug)
            lines.append(f"- {profile.display_name} [{profile.slug}]")
        lines.append("")
        lines.append("你可以发送 /relic slug 来切换。")
        return "\n".join(lines)

    def _split_text_chunks(self, text: str, limit: int = TEXT_LIMIT) -> List[str]:
        """按 Telegram 文本长度限制拆分长消息。"""
        normalized = (text or "").replace("\r\n", "\n").strip()
        if not normalized:
            return []
        if len(normalized) <= limit:
            return [normalized]

        chunks: List[str] = []
        current = ""
        for paragraph in normalized.split("\n"):
            candidate = paragraph if not current else f"{current}\n{paragraph}"
            if len(candidate) <= limit:
                current = candidate
                continue
            if current:
                chunks.append(current)
                current = ""
            if len(paragraph) <= limit:
                current = paragraph
                continue
            start = 0
            while start < len(paragraph):
                piece = paragraph[start : start + limit]
                chunks.append(piece)
                start += limit
        if current:
            chunks.append(current)
        return chunks

    def _normalize_caption(self, caption: str) -> str:
        """裁剪 caption 到 Telegram 允许的长度。"""
        compact = (caption or "").strip()
        if len(compact) <= CAPTION_LIMIT:
            return compact
        return compact[: CAPTION_LIMIT - 1].rstrip() + "…"

    def _guess_mime_type(self, path: Path) -> str:
        """根据后缀推断上传文件的 MIME 类型。"""
        return MIME_TYPES.get(path.suffix.lower(), "application/octet-stream")


# ----------------------------------------------------------------------
# CLI / 运行时辅助
# ----------------------------------------------------------------------
def configure_logging(debug: bool = False) -> None:
    """初始化日志。"""
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def first_non_empty(*values: Optional[str]) -> str:
    """返回第一个非空字符串。"""
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


def safe_float(value: Any, default: float) -> float:
    """安全地把值转换成 float。"""
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def build_config(args: argparse.Namespace) -> TelegramBotConfig:
    """从环境变量与 CLI 参数构建 TelegramBotConfig。"""
    ai_provider = first_non_empty(args.ai_provider, os.getenv("AI_PROVIDER"), "claude").lower()
    ai_base_url = first_non_empty(
        args.ai_base_url,
        os.getenv("AI_BASE_URL"),
        os.getenv("OPENAI_BASE_URL") if ai_provider == "openai" else os.getenv("ANTHROPIC_BASE_URL"),
    )
    relic_dir = ""
    if args.multi_relic and args.relic_dir:
        relic_dir = args.relic_dir
    elif args.relic and not args.multi_relic:
        relic_dir = args.relic
    elif args.multi_relic and args.relic:
        relic_dir = str(Path(args.relic).expanduser().resolve().parent)
    else:
        relic_dir = first_non_empty(args.relic_dir, args.relic)

    return TelegramBotConfig(
        bot_token=first_non_empty(args.bot_token, os.getenv("TELEGRAM_BOT_TOKEN")),
        secret_token=first_non_empty(args.secret_token, os.getenv("TELEGRAM_SECRET_TOKEN")),
        ai_provider=ai_provider,
        ai_api_key=first_non_empty(
            os.getenv("AI_API_KEY"),
            os.getenv("OPENAI_API_KEY") if ai_provider == "openai" else os.getenv("ANTHROPIC_API_KEY"),
        ),
        ai_model=first_non_empty(
            args.ai_model,
            os.getenv("AI_MODEL"),
            os.getenv("OPENAI_MODEL") if ai_provider == "openai" else os.getenv("ANTHROPIC_MODEL"),
        ),
        ai_base_url=ai_base_url,
        relic_dir=relic_dir,
        port=args.port if args.port is not None else DEFAULT_PORT,
        host=first_non_empty(args.host, DEFAULT_HOST),
        max_session_messages=args.max_session_messages
        if args.max_session_messages is not None
        else 20,
        max_active_memories=args.max_active_memories
        if args.max_active_memories is not None
        else 4,
        session_ttl_hours=args.session_ttl_hours if args.session_ttl_hours is not None else 24,
        multi_relic=bool(args.multi_relic),
        polling_interval=safe_float(args.polling_interval, DEFAULT_POLLING_INTERVAL),
        dry_run=bool(args.dry_run),
        request_timeout=args.request_timeout if args.request_timeout is not None else DEFAULT_REQUEST_TIMEOUT,
    )


def validate_runtime_config(config: TelegramBotConfig, test_mode: bool = False) -> None:
    """启动前校验运行配置。"""
    if not config.relic_dir:
        raise ConfigurationError("请通过 --relic / --relic-dir 提供 relic_dir")

    relic_path = Path(config.relic_dir).expanduser()
    if not relic_path.exists():
        raise ConfigurationError(f"Relic 路径不存在：{relic_path}")
    if not relic_path.is_dir():
        raise ConfigurationError(f"Relic 路径不是目录：{relic_path}")

    if not config.multi_relic and not (relic_path / "manifest.json").is_file():
        raise ConfigurationError(f"单 Relic 模式下目录内必须包含 manifest.json：{relic_path}")

    if requests is None and not test_mode:
        raise ConfigurationError("缺少 requests 依赖，请先执行 pip install requests")

    if not test_mode and not config.bot_token:
        raise ConfigurationError("缺少 TELEGRAM_BOT_TOKEN")


def run_test_message(
    bot: TelegramBot,
    test_message: str,
    user_id: str = "local-user",
    chat_id: str = "local-chat",
) -> int:
    """本地模拟一条 Telegram 消息，不启动服务也不真正发消息。"""
    incoming = IncomingMessage(
        platform="telegram",
        user_id=user_id,
        chat_id=chat_id,
        text=test_message,
        message_id="local-test-message",
        timestamp=time.time(),
        is_direct_chat=True,
        is_mentioned=True,
        raw={"mode": "test-message"},
    )

    if test_message.strip().startswith("/"):
        plan = bot._plan_command(incoming) or ResponsePlan(messages=[])
    else:
        active_slug = bot._get_active_relic_slug(user_id, chat_id)
        plan = bot.engine.handle_message(incoming, active_slug)

    payload = {
        "mode": "test-message",
        "input": asdict(incoming),
        "dry_run": bot.config.dry_run,
        "active_relic": plan.relic_slug or bot._get_active_relic_slug(user_id, chat_id),
        "response_plan": {
            "messages": [asdict(item) for item in plan.messages],
            "mode": plan.mode,
            "relic_slug": plan.relic_slug,
            "session_key": plan.session_key,
        },
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    """解析命令行参数。"""
    parser = argparse.ArgumentParser(description="Telegram 机器人服务，让 Relic 住在 Telegram 里")
    parser.add_argument("--bot-token", help="Telegram Bot Token；默认读取 TELEGRAM_BOT_TOKEN")
    parser.add_argument("--secret-token", help="Webhook secret_token；默认读取 TELEGRAM_SECRET_TOKEN")
    parser.add_argument("--relic", help="单 Relic 目录路径，例如 examples/grandma-demo")
    parser.add_argument("--relic-dir", help="多 Relic 模式下的根目录，例如 examples/")
    parser.add_argument("--multi-relic", action="store_true", help="启用多 Relic 模式")
    parser.add_argument("--polling", action="store_true", help="启用 long polling 模式")
    parser.add_argument("--polling-interval", type=float, default=DEFAULT_POLLING_INTERVAL, help="两次 getUpdates 之间的额外等待秒数")
    parser.add_argument("--webhook-url", help="可选：启动前自动调用 setWebhook 注册公网地址")
    parser.add_argument("--host", help=f"Webhook 监听地址，默认 {DEFAULT_HOST}")
    parser.add_argument("--port", type=int, help=f"Webhook 监听端口，默认 {DEFAULT_PORT}")
    parser.add_argument("--dry-run", action="store_true", help="只打印即将发送的内容，不真正请求 Telegram 发送消息")
    parser.add_argument("--ai-provider", choices=sorted(SUPPORTED_AI_PROVIDERS), help="大模型提供方")
    parser.add_argument("--ai-model", help="大模型名称")
    parser.add_argument("--ai-base-url", help="自定义大模型 API Base URL")
    parser.add_argument("--max-session-messages", type=int, help="保留最近多少轮对话上下文")
    parser.add_argument("--max-active-memories", type=int, help="单轮最多注入多少条活动记忆")
    parser.add_argument("--session-ttl-hours", type=int, help="会话 TTL（小时）")
    parser.add_argument("--request-timeout", type=int, help="HTTP 请求超时（秒）")
    parser.add_argument("--test-message", help="本地测试一条消息，不启动 webhook / polling")
    parser.add_argument("--test-user-id", default="local-user", help="本地测试使用的用户 ID")
    parser.add_argument("--test-chat-id", default="local-chat", help="本地测试使用的 chat ID")
    parser.add_argument("--debug", action="store_true", help="启用调试日志")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    """CLI 入口。"""
    configure_utf8_stdio()
    args = parse_args(argv)
    configure_logging(debug=args.debug)

    try:
        config = build_config(args)
        validate_runtime_config(config=config, test_mode=bool(args.test_message))
        bot = TelegramBot(config)

        if args.test_message:
            return run_test_message(
                bot,
                test_message=args.test_message,
                user_id=args.test_user_id,
                chat_id=args.test_chat_id,
            )

        bot.set_commands()

        if args.polling:
            if args.webhook_url:
                LOGGER.info("检测到 --polling，忽略 --webhook-url=%s", args.webhook_url)
            bot.run_polling()
            return 0

        if args.webhook_url:
            bot.set_webhook(args.webhook_url)
        else:
            LOGGER.info("未提供 --webhook-url；如需自动注册 webhook，请手动调用 setWebhook 或重启时附带该参数")
        bot.run_webhook()
        return 0
    except ConfigurationError as exc:
        LOGGER.error("配置错误：%s", exc)
        return 1
    except Exception:
        LOGGER.exception("Telegram 机器人启动失败")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
