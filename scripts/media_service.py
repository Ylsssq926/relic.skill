"""relic.skill 媒体服务统一层。

从 Relic 的 manifest.json 读取媒体配置，提供统一的媒体生成接口。

示例：
    media = MediaService.from_relic("exes/grandma")
    audio_path = media.synthesize_speech("过年了，吃饺子了没", mode="holiday")
    image_path = media.generate_avatar()
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Sequence

try:  # pragma: no cover - 兼容脚本直接执行 / 包导入
    from .image_service import (
        DEFAULT_STYLE,
        ImageConfigError,
        ImageRequest,
        ImageService,
        ImageServiceError,
        build_relic_image_request,
        configure_logging,
        is_missing_api_key_error,
        manifest_display_name,
    )
    from .tts_service import (
        TTSConfigError,
        TTSError,
        TTSService,
        clean_optional_text,
        configure_utf8_stdout,
        ensure_relic_dir,
        load_relic_manifest,
        parse_bool,
    )
except ImportError:  # pragma: no cover - 脚本直跑时回退
    from image_service import (  # type: ignore[no-redef]
        DEFAULT_STYLE,
        ImageConfigError,
        ImageRequest,
        ImageService,
        ImageServiceError,
        build_relic_image_request,
        configure_logging,
        is_missing_api_key_error,
        manifest_display_name,
    )
    from tts_service import (  # type: ignore[no-redef]
        TTSConfigError,
        TTSError,
        TTSService,
        clean_optional_text,
        configure_utf8_stdout,
        ensure_relic_dir,
        load_relic_manifest,
        parse_bool,
    )

LOGGER = logging.getLogger("relic.media_service")


class MediaService:
    """统一协调 Relic 的 TTS 与图像生成服务。"""

    def __init__(
        self,
        tts: Optional[TTSService],
        image: Optional[ImageService],
        *,
        relic_dir: Optional[Path] = None,
        manifest: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.tts = tts
        self.image = image
        self.relic_dir = relic_dir.resolve() if relic_dir else None
        self.manifest = dict(manifest or {})

    @classmethod
    def from_relic(cls, relic_dir: str) -> "MediaService":
        """Load media services from Relic manifest config."""
        relic_path = ensure_relic_dir(relic_dir)
        manifest = load_relic_manifest(relic_path)

        tts_service: Optional[TTSService] = None
        image_service: Optional[ImageService] = None

        media_config = manifest.get("media") if isinstance(manifest.get("media"), dict) else {}

        raw_tts = media_config.get("tts")
        if raw_tts is None:
            raw_tts = manifest.get("tts_config")
        if isinstance(raw_tts, dict) and parse_bool(raw_tts.get("enabled"), True):
            provider = clean_optional_text(raw_tts.get("provider"))
            if provider:
                try:
                    tts_service = TTSService.from_relic(str(relic_path))
                except (FileNotFoundError, PermissionError, TTSConfigError, TTSError, OSError, ValueError) as exc:
                    LOGGER.warning("初始化 TTS 服务失败：%s", exc)

        raw_image = media_config.get("image")
        if raw_image is None:
            raw_image = manifest.get("image_config")
        if isinstance(raw_image, dict) and parse_bool(raw_image.get("enabled"), True):
            provider = clean_optional_text(raw_image.get("provider"))
            if provider:
                try:
                    image_service = ImageService.from_relic(str(relic_path))
                except (FileNotFoundError, PermissionError, ImageConfigError, ImageServiceError, OSError, ValueError) as exc:
                    LOGGER.warning("初始化图像服务失败：%s", exc)

        return cls(tts=tts_service, image=image_service, relic_dir=relic_path, manifest=manifest)

    @property
    def has_tts(self) -> bool:
        """当前是否已配置 TTS 服务。"""
        return self.tts is not None

    @property
    def has_image(self) -> bool:
        """当前是否已配置图像服务。"""
        return self.image is not None

    def _image_config(self) -> Dict[str, Any]:
        """读取 manifest 中的 media.image / image_config。"""
        media_config = self.manifest.get("media") if isinstance(self.manifest.get("media"), dict) else {}
        raw_image = media_config.get("image")
        if raw_image is None:
            raw_image = self.manifest.get("image_config")
        return dict(raw_image) if isinstance(raw_image, dict) else {}

    def _build_image_request(
        self,
        relic_kind: str,
        *,
        style: str = "",
        scene_hint: str = "",
        base_prompt: Optional[str] = None,
    ) -> ImageRequest:
        """根据 manifest 构造 avatar / cover 的图像请求。"""
        if not self.relic_dir:
            raise ImageConfigError("MediaService 缺少 relic_dir，无法生成固定图片资源")
        config = self._image_config()
        if self.image is not None:
            config.setdefault("output_format", self.image.output_format)
        return build_relic_image_request(
            self.manifest,
            self.relic_dir,
            config,
            relic_kind,
            base_prompt=base_prompt,
            style=style,
            scene_hint=scene_hint,
        )

    def synthesize_speech(self, text: str, mode: str = "daily") -> Optional[str]:
        """Generate speech audio. Returns file path or None if TTS not configured."""
        if not self.tts:
            return None
        try:
            emotion = self.tts.emotion_for_mode(mode)
            return self.tts.synthesize(text=text, emotion=emotion)
        except (TTSConfigError, TTSError, FileNotFoundError, PermissionError, OSError, ValueError) as exc:
            if is_missing_api_key_error(exc):
                LOGGER.warning("TTS 未执行：%s", exc)
                return None
            LOGGER.warning("语音生成失败：%s", exc)
            return None

    def generate_avatar(self, style: str = DEFAULT_STYLE) -> Optional[str]:
        """Generate avatar image. Returns file path or None if image not configured."""
        if not self.image:
            return None
        try:
            config = self._image_config()
            resolved_style = style
            if style == DEFAULT_STYLE:
                resolved_style = clean_optional_text(config.get("avatar_style")) or clean_optional_text(config.get("style")) or style
            request = self._build_image_request("avatar", style=resolved_style)
            result = self.image.generate(request)
            return result.file_path
        except (ImageConfigError, ImageServiceError, FileNotFoundError, PermissionError, OSError, ValueError) as exc:
            if is_missing_api_key_error(exc):
                LOGGER.warning("图像生成未执行：%s", exc)
                return None
            LOGGER.warning("头像生成失败：%s", exc)
            return None

    def generate_cover(self, scene_hint: str = "") -> Optional[str]:
        """Generate cover/scene image."""
        if not self.image:
            return None
        try:
            config = self._image_config()
            style = clean_optional_text(config.get("cover_style")) or clean_optional_text(config.get("style")) or DEFAULT_STYLE
            request = self._build_image_request("cover", style=style, scene_hint=scene_hint)
            result = self.image.generate(request)
            return result.file_path
        except (ImageConfigError, ImageServiceError, FileNotFoundError, PermissionError, OSError, ValueError) as exc:
            if is_missing_api_key_error(exc):
                LOGGER.warning("图像生成未执行：%s", exc)
                return None
            LOGGER.warning("封面生成失败：%s", exc)
            return None


def create_argument_parser() -> argparse.ArgumentParser:
    """构建 CLI 参数解析器。"""
    parser = argparse.ArgumentParser(description="relic.skill 媒体服务统一层")
    parser.add_argument("--relic", required=True, help="Relic 目录路径，读取 manifest.json 中的 media.tts / media.image（兼容 tts_config / image_config）")
    parser.add_argument("--text", help="要合成的文本")
    parser.add_argument("--mode", default="daily", help="语音模式名；会尝试映射到情绪，例如 holiday / late_night")
    parser.add_argument("--avatar", action="store_true", help="生成头像图")
    parser.add_argument("--cover", action="store_true", help="生成封面图")
    parser.add_argument("--scene-hint", help="封面图场景补充，例如 厨房灯光 / 春节团聚")
    parser.add_argument("--style", default=DEFAULT_STYLE, help="头像图风格提示，例如 soft_illustration / portrait / sketch")
    parser.add_argument("--dry-run", action="store_true", help="只预演参数解析，不调用外部 API")
    return parser


def validate_args(args: argparse.Namespace) -> None:
    """校验 CLI 参数组合是否合法。"""
    if args.text or args.avatar or args.cover:
        return
    raise ValueError("至少需要指定一个动作：--text / --avatar / --cover")


def apply_dry_run(media: MediaService, dry_run: bool) -> None:
    """把 dry-run 状态同步到子服务。"""
    if media.tts is not None:
        media.tts.dry_run = dry_run
    if media.image is not None:
        media.image.dry_run = dry_run


def main(argv: Optional[Sequence[str]] = None) -> int:
    """CLI 入口。"""
    configure_utf8_stdout()
    configure_logging()
    parser = create_argument_parser()
    args = parser.parse_args(argv)

    try:
        validate_args(args)
        media = MediaService.from_relic(args.relic)
        apply_dry_run(media, bool(args.dry_run))

        payload: Dict[str, Any] = {
            "ok": True,
            "relic": str(ensure_relic_dir(args.relic)),
            "display_name": manifest_display_name(media.manifest),
            "has_tts": media.has_tts,
            "has_image": media.has_image,
            "dry_run": bool(args.dry_run),
        }

        if args.text:
            payload["speech_path"] = media.synthesize_speech(args.text, mode=args.mode)
        if args.avatar:
            payload["avatar_path"] = media.generate_avatar(style=args.style)
        if args.cover:
            payload["cover_path"] = media.generate_cover(scene_hint=clean_optional_text(args.scene_hint) or "")

        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    except (FileNotFoundError, PermissionError, ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"错误: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
