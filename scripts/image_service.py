"""relic.skill 图像生成服务。

支持：
- Seedream (ByteDance/Volcengine) - 中文人像/插画最佳
- OpenAI GPT Image - 高质量通用
- Google Imagen 4 - 高质量，GCP 用户首选

示例：
    python scripts/image_service.py --provider seedream --prompt "温柔的中国奶奶，厨房灯光" --output avatar.jpg
    python scripts/image_service.py --relic exes/grandma --type avatar
    python scripts/image_service.py --relic exes/grandma --type cover --dry-run

环境变量：
- SEEDREAM_API_KEY (or ARK_API_KEY for Volcengine)
- OPENAI_API_KEY
- GOOGLE_API_KEY (for Imagen)
"""
from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import sys
import tempfile
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple, Type

try:
    import requests
except ImportError as exc:  # pragma: no cover - 依赖保护
    requests = None  # type: ignore[assignment]
    REQUESTS_IMPORT_ERROR = exc
else:
    REQUESTS_IMPORT_ERROR = None

try:  # pragma: no cover - 兼容脚本直接执行 / 包导入
    from .tts_service import (
        DEFAULT_TIMEOUT,
        clean_optional_text,
        clean_text,
        configure_utf8_stdout,
        ensure_relic_dir,
        load_relic_manifest,
        now_stamp,
        parse_bool,
        raise_for_status,
        safe_slug,
    )
except ImportError:  # pragma: no cover - 脚本直跑时回退
    from tts_service import (  # type: ignore[no-redef]
        DEFAULT_TIMEOUT,
        clean_optional_text,
        clean_text,
        configure_utf8_stdout,
        ensure_relic_dir,
        load_relic_manifest,
        now_stamp,
        parse_bool,
        raise_for_status,
        safe_slug,
    )

LOGGER = logging.getLogger("relic.image_service")
DEFAULT_STYLE = "soft_illustration"
DEFAULT_NEGATIVE_PROMPT = "text, logo, watermark, signature, blurry, low quality, deformed anatomy, extra limbs, cropped face"
IMAGE_OUTPUT_FORMAT_ALIASES: Dict[str, str] = {
    "jpg": "jpeg",
    "jpeg": "jpeg",
    "png": "png",
    "webp": "webp",
}
IMAGE_OUTPUT_EXTENSIONS: Dict[str, str] = {
    "jpeg": ".jpg",
    "png": ".png",
    "webp": ".webp",
}
DEFAULT_VARIANT_SIZES: Dict[str, Tuple[int, int]] = {
    "avatar": (1024, 1024),
    "cover": (1536, 1024),
    "custom": (1024, 1024),
}


class ImageServiceError(RuntimeError):
    """图像生成调用失败。"""


class ImageConfigError(ValueError):
    """图像服务配置错误。"""


class ImageHTTPError(ImageServiceError):
    """图像服务 HTTP 请求失败。"""


@dataclass
class ImageRequest:
    """一次图像生成请求。"""

    prompt: str
    negative_prompt: str = ""
    width: int = 1024
    height: int = 1024
    style: str = DEFAULT_STYLE
    output_path: str = ""


@dataclass
class ImageResult:
    """图像生成结果。"""

    provider: str
    file_path: str
    prompt_used: str
    metadata: Dict[str, Any] = field(default_factory=dict)


def require_requests() -> None:
    """确保 requests 已安装。"""
    if requests is None:
        raise RuntimeError("缺少依赖 requests，请先执行 pip install requests") from REQUESTS_IMPORT_ERROR


def configure_logging() -> None:
    """为脚本配置一个轻量日志输出。"""
    if logging.getLogger().handlers:
        return
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def normalize_output_format(value: Optional[str], default: str = "jpeg") -> str:
    """把输出格式归一化为 provider 友好的值。"""
    raw = (clean_optional_text(value) or default).lower()
    normalized = IMAGE_OUTPUT_FORMAT_ALIASES.get(raw)
    if not normalized:
        allowed = ", ".join(sorted(IMAGE_OUTPUT_FORMAT_ALIASES))
        raise ImageConfigError(f"不支持的输出格式：{value}；可选：{allowed}")
    return normalized


def output_extension_for_format(output_format: str) -> str:
    """根据输出格式返回默认文件扩展名。"""
    normalized = normalize_output_format(output_format)
    return IMAGE_OUTPUT_EXTENSIONS[normalized]


def normalize_string_list(value: Any, *, limit: int = 6) -> List[str]:
    """把任意值转成去重后的字符串列表。"""
    if not isinstance(value, list):
        return []
    items: List[str] = []
    seen = set()
    for item in value:
        if not isinstance(item, str):
            continue
        text = item.strip()
        if not text or text in seen:
            continue
        items.append(text)
        seen.add(text)
        if len(items) >= limit:
            break
    return items


def parse_image_size(value: Any) -> Optional[Tuple[int, int]]:
    """把多种配置形式解析成 (width, height)。"""
    if value is None:
        return None

    if isinstance(value, str):
        text = value.strip().lower()
        if "x" not in text:
            return None
        left, right = text.split("x", 1)
        if not left.isdigit() or not right.isdigit():
            return None
        return int(left), int(right)

    if isinstance(value, (list, tuple)) and len(value) == 2:
        try:
            return int(value[0]), int(value[1])
        except (TypeError, ValueError):
            return None

    if isinstance(value, dict):
        width = value.get("width")
        height = value.get("height")
        if width is None or height is None:
            return None
        try:
            return int(width), int(height)
        except (TypeError, ValueError):
            return None

    return None


def resolve_relic_image_size(
    config: Optional[Dict[str, Any]],
    relic_kind: str,
    width: Optional[int] = None,
    height: Optional[int] = None,
) -> Tuple[int, int]:
    """解析 Relic 指定类型的目标尺寸。"""
    if width is not None or height is not None:
        if width is None or height is None:
            raise ImageConfigError("--width 和 --height 需要一起提供")
        return int(width), int(height)

    merged = config or {}
    for key in (f"{relic_kind}_size", f"{relic_kind}_dimensions", "size"):
        parsed = parse_image_size(merged.get(key))
        if parsed:
            return parsed

    kind_width = merged.get(f"{relic_kind}_width")
    kind_height = merged.get(f"{relic_kind}_height")
    if kind_width is not None and kind_height is not None:
        return int(kind_width), int(kind_height)

    generic_width = merged.get("width")
    generic_height = merged.get("height")
    if generic_width is not None and generic_height is not None:
        return int(generic_width), int(generic_height)

    return DEFAULT_VARIANT_SIZES.get(relic_kind, DEFAULT_VARIANT_SIZES["custom"])


def build_relic_prompt(base_prompt: str, relic_kind: str, style: str = DEFAULT_STYLE) -> str:
    """Enhance a prompt for Relic image generation.

    Adds style guidance, no-text constraints, and composition hints for avatar / cover.
    """
    style_prefix = {
        "soft_illustration": "Soft digital illustration, warm cinematic lighting, gentle muted color palette, no text, no watermark, no logo, ",
        "portrait": "Portrait photography style, warm natural lighting, no text, ",
        "sketch": "Pencil sketch style, warm tones, no text, ",
    }.get(style, "")
    kind_prefix = {
        "avatar": "close-up portrait, centered composition for avatar crop, clear subject features, ",
        "cover": "wide horizontal cover artwork, scene-led storytelling, no text, ",
    }.get(relic_kind, "")
    return f"{style_prefix}{kind_prefix}{base_prompt}"


def manifest_display_name(manifest: Dict[str, Any]) -> str:
    """提取 Relic 显示名称。"""
    subject = manifest.get("subject") if isinstance(manifest.get("subject"), dict) else {}
    return (
        clean_optional_text(manifest.get("display_name"))
        or clean_optional_text(subject.get("name"))
        or clean_optional_text(manifest.get("title"))
        or clean_optional_text(manifest.get("slug"))
        or "Relic"
    )


def build_relic_base_prompt(manifest: Dict[str, Any], relic_kind: str, scene_hint: str = "") -> str:
    """根据 manifest 生成适合 Relic 的基础提示词。"""
    subject = manifest.get("subject") if isinstance(manifest.get("subject"), dict) else {}
    display_name = manifest_display_name(manifest)
    relic_type = clean_optional_text(manifest.get("relic_type")) or clean_optional_text(manifest.get("template")) or "relic"
    relation = clean_optional_text(subject.get("relation_to_user")) or clean_optional_text(manifest.get("relationship"))
    description = (
        clean_optional_text(subject.get("description"))
        or clean_optional_text(manifest.get("summary"))
        or clean_optional_text(manifest.get("description"))
    )
    core_traits = normalize_string_list(subject.get("core_traits"))
    scene_coverage = normalize_string_list(subject.get("scene_coverage"))

    profile_bits: List[str] = [display_name]
    if relation:
        profile_bits.append(relation)

    if relic_type == "pet":
        species = clean_optional_text(subject.get("species"))
        breed = clean_optional_text(subject.get("breed"))
        if species:
            profile_bits.append(species)
        if breed:
            profile_bits.append(breed)
    elif relic_type == "team":
        profile_bits.append("team portrait")

    if description:
        profile_bits.append(description)
    if core_traits:
        profile_bits.append(f"核心特征：{'、'.join(core_traits)}")

    if relic_kind == "avatar":
        if relic_type == "pet":
            profile_bits.append("主体特征清晰，适合方形头像裁切")
        elif relic_type == "team":
            profile_bits.append("团队主体清晰，适合品牌头像裁切")
        else:
            profile_bits.append("主体居中，表情温和，适合头像裁切")
    elif relic_kind == "cover":
        chosen_scene = clean_optional_text(scene_hint) or (scene_coverage[0] if scene_coverage else None)
        if chosen_scene:
            profile_bits.append(f"场景：{chosen_scene}")
        profile_bits.append("有明确环境叙事感，适合作为封面")

    return "，".join(bit for bit in profile_bits if bit)


def resolve_relic_output_path(
    relic_dir: Path,
    manifest: Dict[str, Any],
    config: Optional[Dict[str, Any]],
    relic_kind: str,
    output_format: str,
    output_path: str = "",
) -> str:
    """为 avatar / cover 之类的固定资源生成默认输出路径。"""
    if clean_optional_text(output_path):
        path = Path(output_path).expanduser()
        if not path.suffix:
            path = path.with_suffix(output_extension_for_format(output_format))
        return str(path.resolve())

    merged = config or {}
    configured = (
        clean_optional_text(merged.get(f"{relic_kind}_output"))
        or clean_optional_text(merged.get(f"{relic_kind}_path"))
        or clean_optional_text(merged.get("output_path"))
    )
    if configured:
        path = Path(configured).expanduser()
        if not path.is_absolute():
            path = (relic_dir / path).resolve()
        else:
            path = path.resolve()
        if not path.suffix:
            path = path.with_suffix(output_extension_for_format(output_format))
        return str(path)

    output_dir_raw = clean_optional_text(merged.get("output_dir")) or "image_output"
    output_dir = Path(output_dir_raw).expanduser()
    if not output_dir.is_absolute():
        output_dir = (relic_dir / output_dir).resolve()
    else:
        output_dir = output_dir.resolve()

    slug = safe_slug(clean_optional_text(manifest.get("slug")) or relic_dir.name, fallback="relic")
    filename = f"{slug}-{relic_kind}-{now_stamp()}{output_extension_for_format(output_format)}"
    return str((output_dir / filename).resolve())


def build_relic_image_request(
    manifest: Dict[str, Any],
    relic_dir: Path,
    config: Optional[Dict[str, Any]],
    relic_kind: str,
    *,
    base_prompt: Optional[str] = None,
    style: str = "",
    scene_hint: str = "",
    output_path: str = "",
    width: Optional[int] = None,
    height: Optional[int] = None,
    negative_prompt: str = "",
) -> ImageRequest:
    """从 manifest + image_config 构造标准的 ImageRequest。"""
    merged = dict(config or {})
    resolved_style = (
        clean_optional_text(style)
        or clean_optional_text(merged.get(f"{relic_kind}_style"))
        or clean_optional_text(merged.get("style"))
        or DEFAULT_STYLE
    )
    resolved_output_format = normalize_output_format(clean_optional_text(merged.get("output_format")) or "jpeg")
    resolved_base_prompt = clean_optional_text(base_prompt) or clean_optional_text(merged.get(f"{relic_kind}_prompt")) or clean_optional_text(merged.get("prompt"))
    if not resolved_base_prompt:
        resolved_base_prompt = build_relic_base_prompt(manifest, relic_kind, scene_hint=scene_hint)

    prompt = build_relic_prompt(resolved_base_prompt, relic_kind, resolved_style)
    resolved_negative_prompt = (
        clean_optional_text(negative_prompt)
        or clean_optional_text(merged.get(f"{relic_kind}_negative_prompt"))
        or clean_optional_text(merged.get("negative_prompt"))
        or DEFAULT_NEGATIVE_PROMPT
    )
    request_width, request_height = resolve_relic_image_size(merged, relic_kind, width=width, height=height)
    resolved_output_path = resolve_relic_output_path(
        relic_dir,
        manifest,
        merged,
        relic_kind,
        resolved_output_format,
        output_path=output_path,
    )
    return ImageRequest(
        prompt=prompt,
        negative_prompt=resolved_negative_prompt,
        width=request_width,
        height=request_height,
        style=resolved_style,
        output_path=resolved_output_path,
    )


def image_provider_class_for_name(provider: str) -> Type["ImageService"]:
    """根据 provider 名称查找对应实现。"""
    normalized = provider.strip().lower()
    mapping: Dict[str, Type[ImageService]] = {
        "seedream": SeedreamImageService,
        "openai": OpenAIImageService,
        "google": GoogleImageService,
        "imagen": GoogleImageService,
    }
    try:
        return mapping[normalized]
    except KeyError as exc:
        raise ImageConfigError(f"不支持的图像 provider：{provider}") from exc


def is_missing_api_key_error(exc: Exception) -> bool:
    """判断一个异常是否属于缺少 API key / token。"""
    message = str(exc)
    markers = (
        "API_KEY",
        "ACCESS_TOKEN",
        "APP_ID",
        "ARK_API_KEY",
        "SEEDREAM_API_KEY",
        "OPENAI_API_KEY",
        "GOOGLE_API_KEY",
        "缺少环境变量",
    )
    return any(marker in message for marker in markers)


class ImageService(ABC):
    """图像生成服务抽象层。"""

    provider_name = "base"
    default_model = ""
    default_output_format = "jpeg"

    def __init__(
        self,
        *,
        dry_run: bool = False,
        relic_dir: Optional[Path] = None,
        config: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.config = dict(config or {})
        self.relic_dir = relic_dir.resolve() if relic_dir else None
        self.dry_run = dry_run
        self.timeout = int(self.config.get("timeout") or DEFAULT_TIMEOUT)
        self.model = clean_optional_text(self.config.get("model")) or self.default_model
        self.output_format = normalize_output_format(
            clean_optional_text(self.config.get("output_format")) or self.default_output_format,
            default=self.default_output_format,
        )
        self.slug = safe_slug(
            clean_optional_text(self.config.get("_relic_slug"))
            or clean_optional_text(self.config.get("slug"))
            or self.provider_name,
            fallback=self.provider_name,
        )
        self.display_name = clean_optional_text(self.config.get("_relic_display_name")) or self.slug

    @property
    def provider(self) -> str:
        """返回当前 provider 名称。"""
        return self.provider_name

    @classmethod
    def from_relic(cls, relic_dir: str) -> Optional["ImageService"]:
        """从 Relic manifest.json 中读取 media.image / image_config 并构造具体服务。"""
        relic_path = ensure_relic_dir(relic_dir)
        manifest_path = relic_path / "manifest.json"
        if not manifest_path.exists():
            return None

        manifest = load_relic_manifest(relic_path)
        media_config = manifest.get("media") if isinstance(manifest.get("media"), dict) else {}
        raw_image = media_config.get("image")
        if raw_image is None:
            raw_image = manifest.get("image_config")
        if raw_image is None:
            return None
        if not isinstance(raw_image, dict):
            raise ImageConfigError("manifest.json 中的 media.image / image_config 必须是 object")

        provider = clean_optional_text(raw_image.get("provider"))
        if not provider:
            return None

        merged_config = dict(raw_image)
        merged_config["_relic_slug"] = clean_optional_text(manifest.get("slug")) or relic_path.name
        merged_config["_relic_display_name"] = manifest_display_name(manifest)
        provider_cls = image_provider_class_for_name(provider)
        return provider_cls(relic_dir=relic_path, config=merged_config)

    def resolve_output_path(self, output_path: str = "") -> Path:
        """解析输出文件路径。"""
        if clean_optional_text(output_path):
            path = Path(output_path).expanduser()
            if not path.suffix:
                path = path.with_suffix(output_extension_for_format(self.output_format))
            return path.resolve()

        configured_output_dir = clean_optional_text(self.config.get("output_dir"))
        base_dir = Path(tempfile.gettempdir()) / "relic_images"
        if configured_output_dir:
            candidate = Path(configured_output_dir).expanduser()
            if not candidate.is_absolute() and self.relic_dir:
                base_dir = (self.relic_dir / candidate).resolve()
            else:
                base_dir = candidate.resolve()
        elif self.relic_dir:
            base_dir = self.relic_dir / "image_output"

        filename = f"{self.slug}-{now_stamp()}{output_extension_for_format(self.output_format)}"
        return (base_dir / filename).resolve()

    def write_image_file(self, image_bytes: bytes, output_path: Path) -> str:
        """把图片二进制写入磁盘并返回绝对路径。"""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("wb") as handle:
            handle.write(image_bytes)
        return str(output_path)

    def build_provider_prompt(self, request: ImageRequest) -> str:
        """构造实际发送给 provider 的 prompt。"""
        prompt = clean_text(request.prompt)
        negative_prompt = clean_optional_text(request.negative_prompt)
        if negative_prompt:
            return f"{prompt}\nAvoid: {clean_text(negative_prompt)}"
        return prompt

    def generate(self, request: ImageRequest) -> ImageResult:
        """生成图片并返回详细结果。"""
        normalized_request = ImageRequest(
            prompt=clean_text(request.prompt),
            negative_prompt=clean_optional_text(request.negative_prompt) or "",
            width=int(request.width),
            height=int(request.height),
            style=clean_optional_text(request.style) or DEFAULT_STYLE,
            output_path=clean_optional_text(request.output_path) or "",
        )
        if normalized_request.width <= 0 or normalized_request.height <= 0:
            raise ImageConfigError("图片宽高必须为正整数")

        prompt_used = self.build_provider_prompt(normalized_request)
        output_path = self.resolve_output_path(normalized_request.output_path)
        if self.dry_run:
            return ImageResult(
                provider=self.provider,
                file_path=str(output_path),
                prompt_used=prompt_used,
                metadata={
                    "dry_run": True,
                    "model": self.model,
                    "width": normalized_request.width,
                    "height": normalized_request.height,
                    "style": normalized_request.style,
                },
            )

        image_bytes, metadata = self._generate_binary(normalized_request, prompt_used)
        file_path = self.write_image_file(image_bytes, output_path)
        return ImageResult(
            provider=self.provider,
            file_path=file_path,
            prompt_used=prompt_used,
            metadata=metadata,
        )

    def _post_json(
        self,
        url: str,
        *,
        headers: Dict[str, str],
        payload: Dict[str, Any],
        provider: str,
        timeout: Optional[int] = None,
    ) -> Any:
        """以 JSON 方式发送 POST 请求。"""
        require_requests()
        assert requests is not None
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=timeout or self.timeout)
        except requests.RequestException as exc:  # pragma: no cover - requests 运行时异常
            raise ImageHTTPError(f"{provider} API 请求失败：{exc}") from exc
        raise_for_status(response, provider)
        return response

    def _download_bytes(self, url: str, *, provider: str, timeout: Optional[int] = None) -> Tuple[bytes, Dict[str, Any]]:
        """下载 provider 返回的图片 URL。"""
        require_requests()
        assert requests is not None
        try:
            response = requests.get(url, timeout=timeout or self.timeout)
        except requests.RequestException as exc:  # pragma: no cover - requests 运行时异常
            raise ImageHTTPError(f"{provider} 下载图片失败：{exc}") from exc
        raise_for_status(response, provider)
        image_bytes = bytes(response.content)
        if not image_bytes:
            raise ImageServiceError(f"{provider} 返回了空图片")
        return image_bytes, {
            "source_url": url,
            "content_type": clean_optional_text(response.headers.get("Content-Type")),
        }

    @abstractmethod
    def _generate_binary(self, request: ImageRequest, prompt_used: str) -> Tuple[bytes, Dict[str, Any]]:
        """子类实现：调用 provider 并返回图片二进制与元数据。"""
        raise NotImplementedError


class SeedreamImageService(ImageService):
    """Volcengine Ark / Seedream 图像生成。"""

    provider_name = "seedream"
    default_model = "doubao-seedream-3-0-t2i-250415"
    default_output_format = "jpeg"
    generation_url = "https://ark.cn-beijing.volces.com/api/v3/images/generations"

    def _headers(self) -> Dict[str, str]:
        """生成 Seedream 请求头。"""
        api_key = clean_optional_text(os.environ.get("SEEDREAM_API_KEY")) or clean_optional_text(os.environ.get("ARK_API_KEY"))
        if not api_key and not self.dry_run:
            raise ImageConfigError("缺少环境变量 SEEDREAM_API_KEY 或 ARK_API_KEY")
        return {
            "Authorization": f"Bearer {api_key or 'dry-run-key'}",
            "Content-Type": "application/json",
        }

    def _generate_binary(self, request: ImageRequest, prompt_used: str) -> Tuple[bytes, Dict[str, Any]]:
        """调用 Seedream 文生图接口。"""
        payload: Dict[str, Any] = {
            "model": self.model,
            "prompt": prompt_used,
            "size": f"{request.width}x{request.height}",
        }
        seed = self.config.get("seed")
        if seed is not None:
            payload["seed"] = int(seed)

        response = self._post_json(
            self.generation_url,
            headers=self._headers(),
            payload=payload,
            provider="Seedream 图像生成",
            timeout=max(self.timeout, 120),
        )
        try:
            body = response.json()
        except ValueError as exc:
            raise ImageServiceError("Seedream 返回了无法解析的 JSON") from exc

        data = body.get("data") if isinstance(body, dict) else None
        if not isinstance(data, list) or not data:
            raise ImageServiceError(f"Seedream 返回格式异常：{body}")
        first = data[0] if isinstance(data[0], dict) else {}
        image_url = clean_optional_text(first.get("url"))
        if not image_url:
            raise ImageServiceError(f"Seedream 未返回图片 URL：{body}")

        image_bytes, metadata = self._download_bytes(image_url, provider="Seedream 图像下载", timeout=max(self.timeout, 120))
        metadata.update(
            {
                "model": self.model,
                "size": payload["size"],
                "provider_response": "url",
            }
        )
        return image_bytes, metadata


class OpenAIImageService(ImageService):
    """OpenAI GPT Image 图像生成。"""

    provider_name = "openai"
    default_model = "gpt-image-1"
    default_output_format = "jpeg"
    generation_url = "https://api.openai.com/v1/images/generations"

    def _headers(self) -> Dict[str, str]:
        """生成 OpenAI 请求头。"""
        api_key = clean_optional_text(os.environ.get("OPENAI_API_KEY"))
        if not api_key and not self.dry_run:
            raise ImageConfigError("缺少环境变量 OPENAI_API_KEY")
        return {
            "Authorization": f"Bearer {api_key or 'dry-run-key'}",
            "Content-Type": "application/json",
        }

    def _generate_binary(self, request: ImageRequest, prompt_used: str) -> Tuple[bytes, Dict[str, Any]]:
        """调用 OpenAI images/generations 接口。"""
        payload: Dict[str, Any] = {
            "model": self.model,
            "prompt": prompt_used,
            "size": f"{request.width}x{request.height}",
            "quality": clean_optional_text(self.config.get("quality")) or "medium",
            "output_format": self.output_format,
        }
        background = clean_optional_text(self.config.get("background"))
        if background:
            payload["background"] = background
        moderation = clean_optional_text(self.config.get("moderation"))
        if moderation:
            payload["moderation"] = moderation

        response = self._post_json(
            self.generation_url,
            headers=self._headers(),
            payload=payload,
            provider="OpenAI 图像生成",
            timeout=max(self.timeout, 120),
        )
        try:
            body = response.json()
        except ValueError as exc:
            raise ImageServiceError("OpenAI 图像生成返回了无法解析的 JSON") from exc

        data = body.get("data") if isinstance(body, dict) else None
        if not isinstance(data, list) or not data:
            raise ImageServiceError(f"OpenAI 未返回图片数据：{body}")
        first = data[0] if isinstance(data[0], dict) else {}

        if clean_optional_text(first.get("b64_json")):
            try:
                image_bytes = base64.b64decode(first["b64_json"])
            except Exception as exc:  # pragma: no cover - base64 解码保护
                raise ImageServiceError("OpenAI 返回的 b64_json 不是合法的 base64") from exc
            return image_bytes, {
                "model": self.model,
                "size": payload["size"],
                "quality": payload["quality"],
                "output_format": self.output_format,
                "revised_prompt": clean_optional_text(first.get("revised_prompt")),
                "provider_response": "b64_json",
            }

        image_url = clean_optional_text(first.get("url"))
        if image_url:
            image_bytes, metadata = self._download_bytes(image_url, provider="OpenAI 图像下载", timeout=max(self.timeout, 120))
            metadata.update(
                {
                    "model": self.model,
                    "size": payload["size"],
                    "quality": payload["quality"],
                    "output_format": self.output_format,
                    "revised_prompt": clean_optional_text(first.get("revised_prompt")),
                    "provider_response": "url",
                }
            )
            return image_bytes, metadata

        raise ImageServiceError("OpenAI 返回中既没有 b64_json，也没有 url")


class GoogleImageService(ImageService):
    """Google Imagen 4 图像生成。"""

    provider_name = "google"
    default_model = "imagen-4.0-generate-001"
    default_output_format = "png"
    endpoint_template = "https://generativelanguage.googleapis.com/v1beta/models/{model}:predict"

    def _headers(self) -> Dict[str, str]:
        """生成 Google Imagen 请求头。"""
        api_key = clean_optional_text(os.environ.get("GOOGLE_API_KEY"))
        if not api_key and not self.dry_run:
            raise ImageConfigError("缺少环境变量 GOOGLE_API_KEY")
        return {
            "x-goog-api-key": api_key or "dry-run-key",
            "Content-Type": "application/json",
        }

    def _aspect_ratio(self, request: ImageRequest) -> str:
        """把任意尺寸映射为 Imagen 支持的纵横比。"""
        ratio = float(request.width) / float(request.height)
        supported = {
            "1:1": 1.0,
            "3:4": 3.0 / 4.0,
            "4:3": 4.0 / 3.0,
            "9:16": 9.0 / 16.0,
            "16:9": 16.0 / 9.0,
        }
        return min(supported, key=lambda key: abs(supported[key] - ratio))

    def _extract_prediction_base64(self, payload: Dict[str, Any]) -> Optional[str]:
        """从 Google Imagen 响应里提取 base64 图像。"""
        predictions = payload.get("predictions")
        if not isinstance(predictions, list) or not predictions:
            return None
        first = predictions[0] if isinstance(predictions[0], dict) else {}
        direct = clean_optional_text(first.get("bytesBase64Encoded"))
        if direct:
            return direct
        image_object = first.get("image") if isinstance(first.get("image"), dict) else {}
        nested = clean_optional_text(image_object.get("bytesBase64Encoded"))
        if nested:
            return nested
        images = payload.get("images")
        if isinstance(images, list) and images:
            first_image = images[0] if isinstance(images[0], dict) else {}
            return clean_optional_text(first_image.get("bytesBase64Encoded"))
        return None

    def _generate_binary(self, request: ImageRequest, prompt_used: str) -> Tuple[bytes, Dict[str, Any]]:
        """调用 Google Imagen 4 REST 接口。"""
        payload: Dict[str, Any] = {
            "instances": [{"prompt": prompt_used}],
            "parameters": {
                "sampleCount": 1,
                "aspectRatio": self._aspect_ratio(request),
            },
        }
        person_generation = clean_optional_text(self.config.get("person_generation"))
        if person_generation:
            payload["parameters"]["personGeneration"] = person_generation
        safety_filter = clean_optional_text(self.config.get("safety_filter_level"))
        if safety_filter:
            payload["parameters"]["safetyFilterLevel"] = safety_filter

        url = self.endpoint_template.format(model=self.model)
        response = self._post_json(
            url,
            headers=self._headers(),
            payload=payload,
            provider="Google Imagen",
            timeout=max(self.timeout, 120),
        )
        try:
            body = response.json()
        except ValueError as exc:
            raise ImageServiceError("Google Imagen 返回了无法解析的 JSON") from exc
        if not isinstance(body, dict):
            raise ImageServiceError("Google Imagen 返回格式异常")

        image_base64 = self._extract_prediction_base64(body)
        if not image_base64:
            raise ImageServiceError(f"Google Imagen 未返回可解析的图片数据：{body}")
        try:
            image_bytes = base64.b64decode(image_base64)
        except Exception as exc:  # pragma: no cover - base64 解码保护
            raise ImageServiceError("Google Imagen 返回的图片数据不是合法 base64") from exc
        return image_bytes, {
            "model": self.model,
            "aspect_ratio": payload["parameters"]["aspectRatio"],
            "provider_response": "base64",
        }


def load_cli_context(args: argparse.Namespace) -> Tuple[Optional[Path], Dict[str, Any], Dict[str, Any]]:
    """加载 CLI 所需的 Relic / manifest / image_config 上下文。"""
    manifest: Dict[str, Any] = {}
    relic_path: Optional[Path] = None
    merged_config: Dict[str, Any] = {}

    if args.relic:
        relic_path = ensure_relic_dir(args.relic)
        manifest = load_relic_manifest(relic_path)
        media_config = manifest.get("media") if isinstance(manifest.get("media"), dict) else {}
        raw_image = media_config.get("image")
        if raw_image is None:
            raw_image = manifest.get("image_config")
        if isinstance(raw_image, dict):
            merged_config.update(raw_image)
        merged_config["_relic_slug"] = clean_optional_text(manifest.get("slug")) or relic_path.name
        merged_config["_relic_display_name"] = manifest_display_name(manifest)

    return relic_path, manifest, merged_config


def build_service_from_args(
    args: argparse.Namespace,
    relic_path: Optional[Path],
    merged_config: Dict[str, Any],
) -> ImageService:
    """根据 CLI 参数构造图像服务实例。"""
    provider = clean_optional_text(args.provider) or clean_optional_text(merged_config.get("provider"))
    if not provider:
        raise ImageConfigError("请通过 --provider 指定图像服务商，或在 Relic 的 manifest.json 中配置 media.image.provider / image_config.provider")

    if args.output_format:
        merged_config["output_format"] = args.output_format
    provider_cls = image_provider_class_for_name(provider)
    return provider_cls(
        relic_dir=relic_path,
        dry_run=bool(args.dry_run),
        config=merged_config,
    )


def build_request_from_args(
    args: argparse.Namespace,
    *,
    manifest: Dict[str, Any],
    relic_path: Optional[Path],
    merged_config: Dict[str, Any],
    output_format: str,
) -> ImageRequest:
    """根据 CLI 参数组装 ImageRequest。"""
    relic_kind = clean_optional_text(args.type) or "custom"

    if relic_path and relic_kind in {"avatar", "cover"}:
        request_config = dict(merged_config)
        request_config.setdefault("output_format", output_format)
        return build_relic_image_request(
            manifest,
            relic_path,
            request_config,
            relic_kind,
            base_prompt=clean_optional_text(args.prompt),
            style=clean_optional_text(args.style) or "",
            scene_hint=clean_optional_text(args.scene_hint) or "",
            output_path=clean_optional_text(args.output) or "",
            width=args.width,
            height=args.height,
            negative_prompt=clean_optional_text(args.negative_prompt) or "",
        )

    prompt = clean_optional_text(args.prompt)
    if not prompt:
        raise ImageConfigError("未提供 --prompt；若要自动从 Relic 构造提示词，请同时传入 --relic 和 --type avatar/cover")

    style = clean_optional_text(args.style) or clean_optional_text(merged_config.get("style")) or DEFAULT_STYLE
    final_prompt = build_relic_prompt(prompt, relic_kind, style)
    negative_prompt = (
        clean_optional_text(args.negative_prompt)
        or clean_optional_text(merged_config.get("negative_prompt"))
        or DEFAULT_NEGATIVE_PROMPT
    )
    width, height = resolve_relic_image_size(merged_config, relic_kind, width=args.width, height=args.height)
    output_path = clean_optional_text(args.output) or ""
    if output_path:
        path = Path(output_path).expanduser()
        if not path.suffix:
            path = path.with_suffix(output_extension_for_format(output_format))
        output_path = str(path.resolve())

    return ImageRequest(
        prompt=final_prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        style=style,
        output_path=output_path,
    )


def create_argument_parser() -> argparse.ArgumentParser:
    """构建 CLI 参数解析器。"""
    parser = argparse.ArgumentParser(description="relic.skill 图像生成服务脚本")
    parser.add_argument("--relic", help="Relic 目录路径，读取 manifest.json 中的 media.image / image_config")
    parser.add_argument("--provider", choices=["seedream", "openai", "google", "imagen"], help="图像 provider；若不传则尝试从 Relic 配置读取")
    parser.add_argument("--prompt", help="基础提示词；若不传且指定 --relic --type avatar/cover，则自动从 manifest 构造")
    parser.add_argument("--negative-prompt", help="负面提示词")
    parser.add_argument("--output", help="输出文件路径；默认写入 image_output/ 或临时目录")
    parser.add_argument("--output-format", choices=["jpg", "jpeg", "png", "webp"], help="输出格式；当 --output 没有后缀时使用")
    parser.add_argument("--style", help="风格提示，如 soft_illustration / portrait / sketch")
    parser.add_argument("--type", choices=["avatar", "cover", "custom"], default="custom", help="预设图像类型")
    parser.add_argument("--scene-hint", help="封面图额外场景提示，例如 厨房灯光 / 春节团聚")
    parser.add_argument("--width", type=int, help="请求宽度")
    parser.add_argument("--height", type=int, help="请求高度")
    parser.add_argument("--dry-run", action="store_true", help="只预演参数解析，不调用外部 API")
    return parser


def validate_args(args: argparse.Namespace) -> None:
    """校验 CLI 参数组合是否合法。"""
    if args.prompt:
        return
    if args.relic and args.type in {"avatar", "cover"}:
        return
    raise ImageConfigError("未提供 --prompt；或者请使用 --relic 并搭配 --type avatar/cover")


def main(argv: Optional[Sequence[str]] = None) -> int:
    """CLI 入口。"""
    configure_utf8_stdout()
    configure_logging()
    parser = create_argument_parser()
    args = parser.parse_args(argv)

    try:
        validate_args(args)
        relic_path, manifest, merged_config = load_cli_context(args)
        service = build_service_from_args(args, relic_path, merged_config)
        request = build_request_from_args(
            args,
            manifest=manifest,
            relic_path=relic_path,
            merged_config=merged_config,
            output_format=service.output_format,
        )
        result = service.generate(request)
        payload = {
            "ok": True,
            "provider": result.provider,
            "file_path": result.file_path,
            "prompt_used": result.prompt_used,
            "metadata": result.metadata,
            "dry_run": bool(args.dry_run),
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    except ImageConfigError as exc:
        if is_missing_api_key_error(exc):
            LOGGER.warning("%s", exc)
            print(
                json.dumps(
                    {
                        "ok": False,
                        "reason": str(exc),
                        "dry_run": bool(args.dry_run),
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 0
        print(f"错误: {exc}", file=sys.stderr)
        return 1
    except (FileNotFoundError, PermissionError, ImageServiceError, OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"错误: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
