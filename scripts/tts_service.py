"""relic.skill TTS 服务抽象层。

为 Relic 提供统一的文字转语音（TTS）接口，支持以下能力：
- 统一的 `TTSService.synthesize()` 调用方式
- 多服务商接入：豆包语音 / MiniMax / ElevenLabs / OpenAI TTS
- 从 Relic `manifest.json` 中读取 `tts_config`
- 从 `voice_samples/` 目录读取样本进行声音克隆
- 输出 mp3 / wav 音频文件
- `--dry-run` 预演模式，不实际调用外部 API

示例：
    # 直接指定服务商合成
    python scripts/tts_service.py --text "吃饭了没有" --provider doubao --output test.mp3

    # 从 Relic 配置合成，并按 mode 映射情绪
    python scripts/tts_service.py --relic exes/grandma --text "过年了，吃饺子了没" --mode holiday

    # 使用声音样本进行克隆
    python scripts/tts_service.py --relic exes/grandma --clone-voice --sample-dir voice_samples/

环境变量：
- DOUBAO_APP_ID
- DOUBAO_ACCESS_TOKEN
- ELEVENLABS_API_KEY
- MINIMAX_API_KEY
- OPENAI_API_KEY

说明：
- 仅依赖 Python 标准库 + requests。
- OpenAI / ElevenLabs / 豆包的某些高级功能与账号权限相关；脚本已尽量做了保守兼容。
- OpenAI 自定义声音需要额外的 consent 录音；脚本会优先从样本目录中寻找文件名包含 consent 的录音。
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import logging
import mimetypes
import os
import re
import sys
import tempfile
import time
import uuid
import wave
from contextlib import ExitStack
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple, Type

try:
    import requests
except ImportError as exc:  # pragma: no cover - 依赖保护
    requests = None  # type: ignore[assignment]
    REQUESTS_IMPORT_ERROR = exc
else:
    REQUESTS_IMPORT_ERROR = None

LOGGER = logging.getLogger("relic.tts_service")
DEFAULT_OUTPUT_FORMAT = "mp3"
DEFAULT_TIMEOUT = 90
AUDIO_FILE_SUFFIXES = {
    ".mp3",
    ".wav",
    ".m4a",
    ".aac",
    ".flac",
    ".ogg",
    ".opus",
    ".webm",
    ".mp4",
    ".mpeg",
    ".mpga",
}
OPENAI_SAMPLE_SUFFIXES = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".webm", ".mp4", ".mpeg", ".mpga", ".ogg"}

DEFAULT_EMOTION_MAPPING: Dict[str, str] = {
    "daily": "calm",
    "random": "calm",
    "holiday": "happy",
    "anniversary": "gentle",
    "late_night": "gentle",
    "weather": "calm",
    "default": "calm",
}


class TTSError(RuntimeError):
    """TTS 服务调用失败。"""


class TTSConfigError(ValueError):
    """TTS 配置错误。"""


class HTTPError(TTSError):
    """HTTP 请求失败。"""


def require_requests() -> None:
    """确保 requests 已安装。"""
    if requests is None:
        raise RuntimeError("缺少依赖 requests，请先执行 pip install requests") from REQUESTS_IMPORT_ERROR


def now_stamp() -> str:
    """返回用于文件名的时间戳。"""
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def clean_text(text: str) -> str:
    """清理输入文本中的多余空白。"""
    normalized = re.sub(r"\s+", " ", text or "").strip()
    if not normalized:
        raise ValueError("文本不能为空")
    return normalized


def clean_optional_text(value: Any) -> Optional[str]:
    """把任意值转成非空字符串或 None。"""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def safe_slug(value: str, fallback: str = "relic") -> str:
    """把任意文本转成适合文件名的 slug。"""
    text = re.sub(r"[^0-9a-zA-Z\u4e00-\u9fff_-]+", "-", value.strip())
    text = re.sub(r"-+", "-", text).strip("-")
    return text or fallback


def safe_identifier(value: str, fallback: str = "relic") -> str:
    """把任意文本转成适合 API 标识符的 ASCII 字符串。"""
    text = re.sub(r"[^0-9a-zA-Z_-]+", "-", value.strip())
    text = re.sub(r"-+", "-", text).strip("-")
    return text or fallback


def parse_bool(value: Any, default: bool = False) -> bool:
    """解析配置中的布尔值，兼容字符串。"""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"1", "true", "yes", "y", "on"}:
            return True
        if lowered in {"0", "false", "no", "n", "off"}:
            return False
    return bool(value)


def configure_utf8_stdout() -> None:
    """尽量确保 Windows 下 stdout / stderr 使用 UTF-8。"""
    for name in ("stdout", "stderr"):
        stream = getattr(sys, name)
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            continue


def configure_logging() -> None:
    """为脚本配置一个轻量日志输出。"""
    if logging.getLogger().handlers:
        return
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def is_missing_credential_error(exc: Exception) -> bool:
    """判断异常是否属于缺少 API key / token / app id。"""
    message = str(exc)
    markers = ("API_KEY", "ACCESS_TOKEN", "APP_ID", "缺少环境变量")
    return any(marker in message for marker in markers)


def read_json_file(path: Path) -> Any:
    """读取 UTF-8 JSON 文件。"""
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def guess_mime_type(path: Path) -> str:
    """推断上传音频文件的 MIME 类型。"""
    mime_type, _encoding = mimetypes.guess_type(path.name)
    if mime_type:
        return mime_type
    if path.suffix.lower() in {".wav"}:
        return "audio/x-wav"
    if path.suffix.lower() in {".mp3", ".mpeg", ".mpga"}:
        return "audio/mpeg"
    if path.suffix.lower() in {".m4a", ".mp4"}:
        return "audio/mp4"
    if path.suffix.lower() in {".webm"}:
        return "audio/webm"
    if path.suffix.lower() in {".aac"}:
        return "audio/aac"
    if path.suffix.lower() in {".flac"}:
        return "audio/flac"
    if path.suffix.lower() in {".ogg", ".opus"}:
        return "audio/ogg"
    return "application/octet-stream"


def collect_audio_files(sample_dir: Path, *, allowed_suffixes: Optional[set[str]] = None) -> List[Path]:
    """递归收集样本目录中的音频文件。"""
    suffixes = allowed_suffixes or AUDIO_FILE_SUFFIXES
    files = [
        path
        for path in sorted(sample_dir.rglob("*"))
        if path.is_file() and path.suffix.lower() in suffixes
    ]
    if not files:
        raise FileNotFoundError(f"样本目录中没有找到音频文件：{sample_dir}")
    return files


def choose_largest_audio(files: Sequence[Path]) -> Path:
    """选择体积最大的样本文件，通常更接近长样本。"""
    if not files:
        raise ValueError("没有可用音频文件")
    return max(files, key=lambda path: (path.stat().st_size, path.name))


def pcm_to_wav_bytes(pcm_bytes: bytes, *, sample_rate: int, channels: int = 1, sample_width: int = 2) -> bytes:
    """把原始 PCM 数据封装成 WAV。"""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_bytes)
    return buffer.getvalue()


def extract_error_message(response: Any) -> str:
    """尽量从 HTTP 响应中提取可读错误信息。"""
    try:
        payload = response.json()
    except ValueError:
        text = (response.text or "").strip()
        return text[:500] or f"HTTP {response.status_code}"

    if isinstance(payload, dict):
        for key in ("message", "msg", "error", "detail"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
            if isinstance(value, dict):
                nested_message = value.get("message") or value.get("msg")
                if isinstance(nested_message, str) and nested_message.strip():
                    return nested_message.strip()
        return json.dumps(payload, ensure_ascii=False)[:500]
    return str(payload)[:500]


def raise_for_status(response: Any, provider: str) -> None:
    """统一处理非 2xx HTTP 响应。"""
    if response.ok:
        return
    message = extract_error_message(response)
    raise HTTPError(f"{provider} API 请求失败（HTTP {response.status_code}）：{message}")


def ensure_relic_dir(relic_dir: str) -> Path:
    """确认 Relic 目录存在。"""
    path = Path(relic_dir).expanduser()
    if not path.exists() or not path.is_dir():
        raise FileNotFoundError(f"Relic 目录不存在：{path}")
    return path.resolve()


def load_relic_manifest(relic_dir: Path) -> Dict[str, Any]:
    """读取 Relic 的 manifest.json。"""
    manifest_path = relic_dir / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"缺少 manifest.json：{manifest_path}")
    payload = read_json_file(manifest_path)
    if not isinstance(payload, dict):
        raise TTSConfigError(f"manifest.json 根节点必须是 object：{manifest_path}")
    return payload


def provider_class_for_name(provider: str) -> Type["TTSService"]:
    """根据 provider 名称查找对应实现。"""
    normalized = provider.strip().lower()
    try:
        return {
            "doubao": DoubaoTTS,
            "elevenlabs": ElevenLabsTTS,
            "minimax": MiniMaxTTS,
            "openai": OpenAITTS,
        }[normalized]
    except KeyError as exc:
        raise TTSConfigError(f"不支持的 TTS provider：{provider}") from exc


class TTSService:
    """TTS 服务抽象层。"""

    provider_name = "base"
    default_voice_id: Optional[str] = None

    def __init__(
        self,
        voice_id: Optional[str] = None,
        *,
        output_format: Optional[str] = None,
        dry_run: bool = False,
        relic_dir: Optional[Path] = None,
        config: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.config = dict(config or {})
        self.relic_dir = relic_dir.resolve() if relic_dir else None
        self.dry_run = dry_run
        self.voice_id = clean_optional_text(voice_id) or clean_optional_text(self.config.get("voice_id")) or self.default_voice_id
        self.output_format = (clean_optional_text(output_format) or clean_optional_text(self.config.get("output_format")) or DEFAULT_OUTPUT_FORMAT).lower()
        self.timeout = int(self.config.get("timeout") or DEFAULT_TIMEOUT)
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
    def from_relic(cls, relic_dir: str) -> Optional["TTSService"]:
        """从 Relic 配置创建 TTS 服务。"""
        relic_path = ensure_relic_dir(relic_dir)
        manifest_path = relic_path / "manifest.json"
        if not manifest_path.exists():
            return None

        manifest = load_relic_manifest(relic_path)
        media_config = manifest.get("media") if isinstance(manifest.get("media"), dict) else {}
        raw_tts = media_config.get("tts")
        if raw_tts is None:
            raw_tts = manifest.get("tts_config")
        if raw_tts is None:
            return None
        if not isinstance(raw_tts, dict):
            raise TTSConfigError("manifest.json 中的 media.tts / tts_config 必须是 object")

        provider = clean_optional_text(raw_tts.get("provider"))
        if not provider:
            return None

        merged_config = dict(raw_tts)
        merged_config["_relic_slug"] = clean_optional_text(manifest.get("slug")) or relic_path.name
        merged_config["_relic_display_name"] = (
            clean_optional_text(manifest.get("display_name"))
            or clean_optional_text((manifest.get("subject") or {}).get("name") if isinstance(manifest.get("subject"), dict) else None)
            or relic_path.name
        )
        provider_cls = provider_class_for_name(provider)
        return provider_cls(
            voice_id=clean_optional_text(raw_tts.get("voice_id")),
            output_format=clean_optional_text(raw_tts.get("output_format")),
            relic_dir=relic_path,
            config=merged_config,
        )

    def emotion_for_mode(self, mode: Optional[str]) -> Optional[str]:
        """根据 mode 从配置中映射情绪；若无自定义配置则使用保守默认值。"""
        if not mode:
            return None
        raw_mapping = self.config.get("emotion_mapping")
        mapping = raw_mapping if isinstance(raw_mapping, dict) else {}
        normalized_mode = str(mode).strip().lower()
        for key in (normalized_mode, "default"):
            value = mapping.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return DEFAULT_EMOTION_MAPPING.get(normalized_mode) or DEFAULT_EMOTION_MAPPING.get("default")

    def resolve_voice_id(self, voice_id: Optional[str]) -> str:
        """解析本次请求使用的 voice_id。"""
        resolved = clean_optional_text(voice_id) or self.voice_id
        if not resolved:
            raise TTSConfigError(f"{self.provider_name} 缺少 voice_id，请通过 --voice-id 或 manifest.json 配置")
        return resolved

    def resolve_output_path(self, output_path: Optional[str]) -> Tuple[Path, str]:
        """解析输出文件路径与格式。"""
        if output_path:
            path = Path(output_path).expanduser()
            file_format = path.suffix.lower().lstrip(".") if path.suffix else self.output_format
            if not path.suffix:
                path = path.with_suffix(f".{file_format}")
            return path.resolve(), file_format.lower()

        file_format = self.output_format
        base_dir = Path(tempfile.gettempdir()) / "relic_tts"
        if self.relic_dir:
            base_dir = self.relic_dir / "voice_output"
        file_name = f"{self.slug}-{now_stamp()}.{file_format}"
        return (base_dir / file_name).resolve(), file_format.lower()

    def resolve_sample_dir(self, sample_dir: Optional[str]) -> Path:
        """解析声音样本目录。"""
        raw_value = clean_optional_text(sample_dir) or clean_optional_text(self.config.get("voice_sample_dir"))
        if not raw_value:
            raise TTSConfigError("缺少样本目录，请通过 --sample-dir 或 manifest.json 的 tts_config.voice_sample_dir 提供")
        path = Path(raw_value).expanduser()
        if not path.is_absolute() and self.relic_dir:
            path = (self.relic_dir / path).resolve()
        else:
            path = path.resolve()
        if not path.exists() or not path.is_dir():
            raise FileNotFoundError(f"声音样本目录不存在：{path}")
        return path

    def write_audio_file(self, audio_bytes: bytes, output_path: Path) -> str:
        """把二进制音频写入磁盘并返回绝对路径。"""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("wb") as handle:
            handle.write(audio_bytes)
        return str(output_path)

    def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        output_path: Optional[str] = None,
        emotion: Optional[str] = None,
    ) -> str:
        """合成语音并返回音频文件路径。"""
        normalized_text = clean_text(text)
        resolved_voice_id = self.resolve_voice_id(voice_id)
        resolved_output_path, file_format = self.resolve_output_path(output_path)

        if self.dry_run:
            return str(resolved_output_path)

        audio_bytes = self._synthesize_bytes(
            text=normalized_text,
            voice_id=resolved_voice_id,
            output_format=file_format,
            emotion=clean_optional_text(emotion),
        )
        return self.write_audio_file(audio_bytes, resolved_output_path)

    def clone_voice(self, sample_dir: Optional[str] = None, voice_name: Optional[str] = None) -> str:
        """从样本目录克隆声音并返回新的 voice_id。"""
        raise NotImplementedError(f"{self.provider_name} 暂未实现声音克隆")

    def _synthesize_bytes(
        self,
        *,
        text: str,
        voice_id: str,
        output_format: str,
        emotion: Optional[str],
    ) -> bytes:
        """子类实现：调用具体 provider 并返回音频字节。"""
        raise NotImplementedError

    def _post_json(self, url: str, *, headers: Dict[str, str], payload: Dict[str, Any], provider: str, timeout: Optional[int] = None) -> Any:
        """以 JSON 方式 POST 请求。"""
        require_requests()
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=timeout or self.timeout)
        except requests.RequestException as exc:
            raise HTTPError(f"{provider} API 请求失败：{exc}") from exc
        raise_for_status(response, provider)
        return response

    def _post_multipart(self, url: str, *, headers: Dict[str, str], data: Dict[str, Any], files: List[Tuple[str, Tuple[str, Any, str]]], provider: str, timeout: Optional[int] = None) -> Any:
        """以 multipart/form-data 方式 POST 请求。"""
        require_requests()
        try:
            response = requests.post(url, headers=headers, data=data, files=files, timeout=timeout or self.timeout)
        except requests.RequestException as exc:
            raise HTTPError(f"{provider} API 请求失败：{exc}") from exc
        raise_for_status(response, provider)
        return response


class DoubaoTTS(TTSService):
    """火山引擎豆包语音实现。"""

    provider_name = "doubao"
    default_voice_id = "zh_female_roumeinvyou_emo_v2_mars_bigtts"
    tts_url = "https://openspeech.bytedance.com/api/v1/tts"
    clone_upload_url = "https://openspeech.bytedance.com/api/v1/mega_tts/audio/upload"
    clone_status_url = "https://openspeech.bytedance.com/api/v1/mega_tts/status"

    def _auth_headers(self, *, include_resource_id: bool = False) -> Dict[str, str]:
        """生成豆包接口请求头。"""
        access_token = clean_optional_text(os.environ.get("DOUBAO_ACCESS_TOKEN"))
        if not access_token and not self.dry_run:
            raise TTSConfigError("缺少环境变量 DOUBAO_ACCESS_TOKEN")
        headers = {
            "Authorization": f"Bearer;{access_token or 'dry-run-token'}",
            "Content-Type": "application/json",
        }
        if include_resource_id:
            resource_id = clean_optional_text(self.config.get("resource_id")) or "seed-icl-2.0"
            headers["Resource-Id"] = resource_id
        return headers

    def _app_config(self, voice_id: str) -> Dict[str, str]:
        """构造 app 配置。"""
        app_id = clean_optional_text(os.environ.get("DOUBAO_APP_ID"))
        if not app_id and not self.dry_run:
            raise TTSConfigError("缺少环境变量 DOUBAO_APP_ID")

        custom_cluster = clean_optional_text(self.config.get("cluster"))
        if custom_cluster:
            cluster = custom_cluster
        elif voice_id.startswith("relic_") or voice_id.startswith("S_"):
            cluster = "volcano_icl"
        else:
            cluster = "volcano_tts"

        return {
            "appid": app_id or "dry-run-app-id",
            "token": clean_optional_text(self.config.get("token")) or "placeholder",
            "cluster": cluster,
        }

    def _synthesize_bytes(
        self,
        *,
        text: str,
        voice_id: str,
        output_format: str,
        emotion: Optional[str],
    ) -> bytes:
        """调用豆包一次性 TTS 接口，返回音频字节。"""
        file_format = output_format.lower()
        if file_format not in {"mp3", "wav"}:
            raise TTSConfigError("豆包当前仅支持输出 mp3 或 wav")

        speed_ratio = float(self.config.get("speed_ratio") or 1.0)
        emotion_scale = float(self.config.get("emotion_scale") or 4.0)
        rate = int(self.config.get("rate") or (24000 if file_format == "wav" else 24000))

        payload: Dict[str, Any] = {
            "app": self._app_config(voice_id),
            "user": {
                "uid": clean_optional_text(self.config.get("uid")) or f"relic-{self.slug}",
            },
            "audio": {
                "voice_type": voice_id,
                "encoding": file_format,
                "speed_ratio": speed_ratio,
                "rate": rate,
            },
            "request": {
                "reqid": str(uuid.uuid4()),
                "text": text,
                "operation": "query",
            },
        }
        if emotion:
            payload["audio"]["enable_emotion"] = True
            payload["audio"]["emotion"] = emotion
            payload["audio"]["emotion_scale"] = emotion_scale

        response = self._post_json(
            self.tts_url,
            headers=self._auth_headers(),
            payload=payload,
            provider="豆包语音",
        )
        try:
            body = response.json()
        except ValueError as exc:
            raise TTSError("豆包语音返回了无法解析的 JSON") from exc

        if not isinstance(body, dict):
            raise TTSError("豆包语音返回格式异常")
        if int(body.get("code") or -1) != 3000:
            raise TTSError(f"豆包语音合成失败：{body.get('message') or body.get('msg') or body}")

        audio_base64 = clean_optional_text(body.get("data"))
        if not audio_base64:
            raise TTSError("豆包语音未返回音频数据")
        try:
            return base64.b64decode(audio_base64)
        except ValueError as exc:
            raise TTSError("豆包语音返回的音频数据不是合法 base64") from exc

    def clone_voice(self, sample_dir: Optional[str] = None, voice_name: Optional[str] = None) -> str:
        """使用豆包声音复刻接口上传样本并轮询状态。"""
        samples_path = self.resolve_sample_dir(sample_dir)
        sample_files = collect_audio_files(samples_path)
        sample_file = choose_largest_audio(sample_files)
        generated_voice_id = safe_slug(
            clean_optional_text(voice_name)
            or clean_optional_text(self.config.get("voice_name"))
            or f"relic_{self.slug}_{uuid.uuid4().hex[:8]}",
            fallback=f"relic_{self.slug}_{uuid.uuid4().hex[:8]}",
        )

        if self.dry_run:
            self.voice_id = generated_voice_id
            return generated_voice_id

        with sample_file.open("rb") as handle:
            audio_bytes = handle.read()
        if not audio_bytes:
            raise TTSError(f"样本文件为空：{sample_file}")

        audio_format = sample_file.suffix.lower().lstrip(".")
        language = int(self.config.get("clone_language") or 0)
        model_type = int(self.config.get("clone_model_type") or 4)
        remove_background_noise = bool(self.config.get("remove_background_noise", True))

        payload: Dict[str, Any] = {
            "appid": self._app_config(generated_voice_id)["appid"],
            "speaker_id": generated_voice_id,
            "audios": [
                {
                    "audio_bytes": base64.b64encode(audio_bytes).decode("utf-8"),
                    "audio_format": audio_format,
                }
            ],
            "source": 2,
            "language": language,
            "model_type": model_type,
            "enable_noise_reduction": remove_background_noise,
        }

        response = self._post_json(
            self.clone_upload_url,
            headers=self._auth_headers(include_resource_id=True),
            payload=payload,
            provider="豆包声音复刻",
            timeout=max(self.timeout, 120),
        )
        try:
            body = response.json()
        except ValueError as exc:
            raise TTSError("豆包声音复刻返回了无法解析的 JSON") from exc

        if not isinstance(body, dict) or body.get("BaseResp", {}).get("StatusCode") != 0:
            raise TTSError(f"豆包声音复刻提交失败：{body}")

        poll_timeout = int(self.config.get("clone_poll_timeout") or 180)
        poll_interval = float(self.config.get("clone_poll_interval") or 3)
        deadline = time.time() + poll_timeout
        last_status: Optional[Any] = None

        while time.time() < deadline:
            status_response = self._post_json(
                self.clone_status_url,
                headers=self._auth_headers(include_resource_id=True),
                payload={
                    "appid": self._app_config(generated_voice_id)["appid"],
                    "speaker_id": generated_voice_id,
                },
                provider="豆包声音复刻状态查询",
            )
            try:
                status_body = status_response.json()
            except ValueError as exc:
                raise TTSError("豆包声音复刻状态接口返回了无法解析的 JSON") from exc

            if not isinstance(status_body, dict) or status_body.get("BaseResp", {}).get("StatusCode") != 0:
                raise TTSError(f"豆包声音复刻状态查询失败：{status_body}")

            last_status = status_body.get("status")
            if last_status in {2, 4}:
                self.voice_id = generated_voice_id
                return generated_voice_id
            if last_status == 3:
                raise TTSError(f"豆包声音复刻训练失败：{status_body}")
            time.sleep(poll_interval)

        raise TTSError(f"豆包声音复刻超时，speaker_id={generated_voice_id}，最后状态={last_status}")


class MiniMaxTTS(TTSService):
    """MiniMax TTS / 声音克隆实现。"""

    provider_name = "minimax"
    default_voice_id = "female-tianmei"
    default_model = "speech-2.8-turbo"
    tts_url = "https://api.minimax.io/v1/t2a_v2"
    file_upload_url = "https://api.minimax.io/v1/files/upload"
    clone_url = "https://api.minimax.io/v1/voice_clone"

    def _headers(self) -> Dict[str, str]:
        """生成 MiniMax 请求头。"""
        api_key = clean_optional_text(os.environ.get("MINIMAX_API_KEY"))
        if not api_key and not self.dry_run:
            raise TTSConfigError("缺少环境变量 MINIMAX_API_KEY")
        return {
            "Authorization": f"Bearer {api_key or 'dry-run-key'}",
        }

    def _voice_setting(self, voice_id: str, emotion: Optional[str]) -> Dict[str, Any]:
        """构造 MiniMax 的 voice_setting。"""
        raw_settings = self.config.get("voice_setting") if isinstance(self.config.get("voice_setting"), dict) else {}
        explicit_speed = raw_settings.get("speed") is not None or self.config.get("speed") is not None
        explicit_vol = raw_settings.get("vol") is not None or self.config.get("vol") is not None
        explicit_pitch = raw_settings.get("pitch") is not None or self.config.get("pitch") is not None

        speed = float(raw_settings.get("speed") or self.config.get("speed") or 1.0)
        vol = float(raw_settings.get("vol") or self.config.get("vol") or 1.0)
        pitch = int(raw_settings.get("pitch") or self.config.get("pitch") or 0)

        presets: Dict[str, Dict[str, Any]] = {
            "calm": {"speed": 1.0, "vol": 1.0, "pitch": 0},
            "gentle": {"speed": 0.95, "vol": 1.0, "pitch": -1},
            "happy": {"speed": 1.06, "vol": 1.02, "pitch": 1},
            "sad": {"speed": 0.90, "vol": 0.96, "pitch": -2},
            "warm": {"speed": 0.98, "vol": 1.03, "pitch": 0},
        }
        preset = presets.get((emotion or "").lower()) if emotion else None
        if preset:
            if not explicit_speed:
                speed = float(preset["speed"])
            if not explicit_vol:
                vol = float(preset["vol"])
            if not explicit_pitch:
                pitch = int(preset["pitch"])

        return {
            "voice_id": voice_id,
            "speed": speed,
            "vol": vol,
            "pitch": pitch,
        }

    def _audio_setting(self, output_format: str) -> Dict[str, Any]:
        """构造 MiniMax 的 audio_setting。"""
        file_format = output_format.lower()
        if file_format != "mp3":
            raise TTSConfigError("MiniMax 当前仅支持输出 mp3")

        raw_settings = self.config.get("audio_setting") if isinstance(self.config.get("audio_setting"), dict) else {}
        sample_rate = int(raw_settings.get("sample_rate") or self.config.get("sample_rate") or 32000)
        bitrate = int(raw_settings.get("bitrate") or self.config.get("bitrate") or 128000)
        return {
            "sample_rate": sample_rate,
            "bitrate": bitrate,
            "format": file_format,
        }

    def _synthesize_bytes(
        self,
        *,
        text: str,
        voice_id: str,
        output_format: str,
        emotion: Optional[str],
    ) -> bytes:
        """调用 MiniMax 一次性 TTS 接口。"""
        audio_setting = self._audio_setting(output_format)
        audio_setting["format"] = output_format.lower()
        payload: Dict[str, Any] = {
            "model": clean_optional_text(self.config.get("model")) or self.default_model,
            "text": text,
            "voice_setting": self._voice_setting(voice_id, emotion),
            "audio_setting": audio_setting,
        }

        response = self._post_json(
            self.tts_url,
            headers={**self._headers(), "Content-Type": "application/json"},
            payload=payload,
            provider="MiniMax TTS",
            timeout=max(self.timeout, 120),
        )
        try:
            body = response.json()
        except ValueError as exc:
            raise TTSError("MiniMax TTS 返回了无法解析的 JSON") from exc

        if not isinstance(body, dict):
            raise TTSError("MiniMax TTS 返回格式异常")

        base_resp = body.get("base_resp") if isinstance(body.get("base_resp"), dict) else {}
        if int(base_resp.get("status_code") or 0) != 0:
            raise TTSError(f"MiniMax TTS 合成失败：{base_resp.get('status_msg') or body}")

        data = body.get("data") if isinstance(body.get("data"), dict) else {}
        audio_hex = clean_optional_text(data.get("audio"))
        if not audio_hex:
            raise TTSError("MiniMax TTS 返回空音频数据")
        try:
            return bytes.fromhex(audio_hex)
        except ValueError as exc:
            raise TTSError("MiniMax TTS 返回的音频数据不是合法 hex") from exc

    def clone_voice(self, sample_dir: Optional[str] = None, voice_name: Optional[str] = None) -> str:
        """使用 MiniMax 文件上传 + 声音克隆流程返回 voice_id。"""
        samples_path = self.resolve_sample_dir(sample_dir)
        sample_files = collect_audio_files(samples_path)
        sample_file = choose_largest_audio(sample_files)
        requested_voice_id = safe_identifier(
            clean_optional_text(voice_name)
            or clean_optional_text(self.config.get("voice_id"))
            or clean_optional_text(self.config.get("voice_name"))
            or f"relic-{self.slug}-{uuid.uuid4().hex[:8]}",
            fallback=f"relic-{uuid.uuid4().hex[:8]}",
        )

        if self.dry_run:
            self.voice_id = requested_voice_id
            return requested_voice_id

        with sample_file.open("rb") as handle:
            upload_response = self._post_multipart(
                self.file_upload_url,
                headers=self._headers(),
                data={"purpose": "voice_clone"},
                files=[("file", (sample_file.name, handle, guess_mime_type(sample_file)))],
                provider="MiniMax 文件上传",
                timeout=max(self.timeout, 180),
            )

        try:
            upload_body = upload_response.json()
        except ValueError as exc:
            raise TTSError("MiniMax 文件上传返回了无法解析的 JSON") from exc

        if not isinstance(upload_body, dict):
            raise TTSError("MiniMax 文件上传返回格式异常")

        upload_base_resp = upload_body.get("base_resp") if isinstance(upload_body.get("base_resp"), dict) else {}
        if int(upload_base_resp.get("status_code") or 0) != 0:
            raise TTSError(f"MiniMax 文件上传失败：{upload_base_resp.get('status_msg') or upload_body}")

        file_info = upload_body.get("file") if isinstance(upload_body.get("file"), dict) else {}
        file_id = clean_optional_text(file_info.get("file_id"))
        if not file_id:
            raise TTSError(f"MiniMax 文件上传未返回 file_id：{upload_body}")

        response = self._post_json(
            self.clone_url,
            headers={**self._headers(), "Content-Type": "application/json"},
            payload={
                "file_id": file_id,
                "voice_id": requested_voice_id,
            },
            provider="MiniMax 声音克隆",
            timeout=max(self.timeout, 180),
        )

        try:
            body = response.json()
        except ValueError as exc:
            raise TTSError("MiniMax 声音克隆返回了无法解析的 JSON") from exc

        if not isinstance(body, dict):
            raise TTSError("MiniMax 声音克隆返回格式异常")

        base_resp = body.get("base_resp") if isinstance(body.get("base_resp"), dict) else {}
        if int(base_resp.get("status_code") or 0) != 0:
            raise TTSError(f"MiniMax 声音克隆失败：{base_resp.get('status_msg') or body}")

        voice_id = clean_optional_text(body.get("voice_id"))
        if not voice_id:
            data = body.get("data") if isinstance(body.get("data"), dict) else {}
            voice_id = clean_optional_text(data.get("voice_id"))
        voice_id = voice_id or requested_voice_id
        self.voice_id = voice_id
        return voice_id


class ElevenLabsTTS(TTSService):
    """ElevenLabs TTS / 声音克隆实现。"""

    provider_name = "elevenlabs"
    default_voice_id = "JBFqnCBsd6RMkjVDRZzb"
    synthesize_url_template = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    clone_url = "https://api.elevenlabs.io/v1/voices/add"

    def _headers(self) -> Dict[str, str]:
        """生成 ElevenLabs 请求头。"""
        api_key = clean_optional_text(os.environ.get("ELEVENLABS_API_KEY"))
        if not api_key and not self.dry_run:
            raise TTSConfigError("缺少环境变量 ELEVENLABS_API_KEY")
        return {
            "xi-api-key": api_key or "dry-run-key",
        }

    def _emotion_voice_settings(self, emotion: Optional[str]) -> Dict[str, Any]:
        """把统一 emotion 映射到 ElevenLabs 的 voice_settings。"""
        presets: Dict[str, Dict[str, Any]] = {
            "calm": {"stability": 0.80, "similarity_boost": 0.80, "style": 0.10, "use_speaker_boost": True, "speed": 0.95},
            "gentle": {"stability": 0.72, "similarity_boost": 0.82, "style": 0.16, "use_speaker_boost": True, "speed": 0.92},
            "happy": {"stability": 0.48, "similarity_boost": 0.75, "style": 0.62, "use_speaker_boost": True, "speed": 1.05},
            "sad": {"stability": 0.85, "similarity_boost": 0.83, "style": 0.10, "use_speaker_boost": True, "speed": 0.90},
            "warm": {"stability": 0.65, "similarity_boost": 0.82, "style": 0.25, "use_speaker_boost": True, "speed": 0.97},
        }
        if emotion:
            preset = presets.get(emotion.lower())
            if preset:
                return preset
        return dict(self.config.get("voice_settings") or {}) if isinstance(self.config.get("voice_settings"), dict) else {}

    def _resolve_output_query(self, output_format: str) -> Tuple[str, Optional[int]]:
        """把通用输出格式映射到 ElevenLabs 的 query 参数。"""
        fmt = output_format.lower()
        if fmt == "mp3":
            return clean_optional_text(self.config.get("eleven_output_format")) or "mp3_44100_128", None
        if fmt == "wav":
            sample_rate = int(self.config.get("eleven_pcm_sample_rate") or 24000)
            return f"pcm_{sample_rate}", sample_rate
        raise TTSConfigError("ElevenLabs 当前仅支持输出 mp3 或 wav")

    def _synthesize_bytes(
        self,
        *,
        text: str,
        voice_id: str,
        output_format: str,
        emotion: Optional[str],
    ) -> bytes:
        """调用 ElevenLabs TTS 接口。"""
        query_output_format, pcm_rate = self._resolve_output_query(output_format)
        model_id = clean_optional_text(self.config.get("model_id")) or "eleven_multilingual_v2"
        payload: Dict[str, Any] = {
            "text": text,
            "model_id": model_id,
        }

        language_code = clean_optional_text(self.config.get("language_code"))
        if language_code:
            payload["language_code"] = language_code

        voice_settings = self._emotion_voice_settings(emotion)
        if voice_settings:
            payload["voice_settings"] = voice_settings

        url = f"{self.synthesize_url_template.format(voice_id=voice_id)}?output_format={query_output_format}"
        response = self._post_json(
            url,
            headers={**self._headers(), "Content-Type": "application/json"},
            payload=payload,
            provider="ElevenLabs",
            timeout=max(self.timeout, 120),
        )
        audio_bytes = bytes(response.content)
        if not audio_bytes:
            raise TTSError("ElevenLabs 未返回音频数据")
        if output_format.lower() == "wav":
            if pcm_rate is None:
                raise TTSError("ElevenLabs WAV 输出缺少 PCM 采样率")
            return pcm_to_wav_bytes(audio_bytes, sample_rate=pcm_rate)
        return audio_bytes

    def clone_voice(self, sample_dir: Optional[str] = None, voice_name: Optional[str] = None) -> str:
        """使用 ElevenLabs 声音克隆接口上传多个样本。"""
        samples_path = self.resolve_sample_dir(sample_dir)
        sample_files = collect_audio_files(samples_path)
        resolved_voice_name = (
            clean_optional_text(voice_name)
            or clean_optional_text(self.config.get("voice_name"))
            or self.display_name
            or self.slug
        )

        if self.dry_run:
            fake_voice_id = f"dryrun-{self.slug}-{uuid.uuid4().hex[:8]}"
            self.voice_id = fake_voice_id
            return fake_voice_id

        with ExitStack() as stack:
            file_payloads: List[Tuple[str, Tuple[str, Any, str]]] = []
            for sample_file in sample_files:
                handle = stack.enter_context(sample_file.open("rb"))
                file_payloads.append(("files", (sample_file.name, handle, guess_mime_type(sample_file))))

            data: Dict[str, Any] = {
                "name": resolved_voice_name,
                "remove_background_noise": "true" if parse_bool(self.config.get("remove_background_noise"), True) else "false",
            }
            description = clean_optional_text(self.config.get("description"))
            if description:
                data["description"] = description

            labels = self.config.get("labels")
            if isinstance(labels, dict) and labels:
                data["labels"] = json.dumps(labels, ensure_ascii=False)

            response = self._post_multipart(
                self.clone_url,
                headers=self._headers(),
                data=data,
                files=file_payloads,
                provider="ElevenLabs 声音克隆",
                timeout=max(self.timeout, 180),
            )

        try:
            body = response.json()
        except ValueError as exc:
            raise TTSError("ElevenLabs 声音克隆返回了无法解析的 JSON") from exc

        voice_id = clean_optional_text(body.get("voice_id") if isinstance(body, dict) else None)
        if not voice_id:
            raise TTSError(f"ElevenLabs 声音克隆返回异常：{body}")
        self.voice_id = voice_id
        return voice_id


class OpenAITTS(TTSService):
    """OpenAI TTS / 自定义声音实现。"""

    provider_name = "openai"
    default_voice_id = "alloy"
    speech_url = "https://api.openai.com/v1/audio/speech"
    create_voice_consent_url = "https://api.openai.com/v1/audio/voice_consents"
    create_voice_url = "https://api.openai.com/v1/audio/voices"

    def _headers(self) -> Dict[str, str]:
        """生成 OpenAI 请求头。"""
        api_key = clean_optional_text(os.environ.get("OPENAI_API_KEY"))
        if not api_key and not self.dry_run:
            raise TTSConfigError("缺少环境变量 OPENAI_API_KEY")
        return {
            "Authorization": f"Bearer {api_key or 'dry-run-key'}",
        }

    def _voice_payload(self, voice_id: str) -> Any:
        """构造 OpenAI speech 接口的 voice 字段。"""
        if voice_id.startswith("voice_"):
            return {"id": voice_id}
        return voice_id

    def _emotion_instructions(self, emotion: Optional[str]) -> Optional[str]:
        """为 OpenAI TTS 生成简短的语音风格指令。"""
        mapping = {
            "happy": "请用明亮、开心、亲切的语气朗读这段中文。",
            "sad": "请用轻柔、低沉、克制的语气朗读这段中文。",
            "calm": "请用平静、自然、稳定的语气朗读这段中文。",
            "gentle": "请用温柔、轻声、安抚感更强的语气朗读这段中文。",
            "warm": "请用温暖、有人情味、像熟人说话的语气朗读这段中文。",
        }
        if not emotion:
            return None
        return mapping.get(emotion.lower())

    def _synthesize_bytes(
        self,
        *,
        text: str,
        voice_id: str,
        output_format: str,
        emotion: Optional[str],
    ) -> bytes:
        """调用 OpenAI audio speech 接口。"""
        if len(text) > 4096:
            raise TTSConfigError("OpenAI TTS 的 input 最长为 4096 字符")

        response_format = output_format.lower()
        allowed_formats = {"mp3", "wav", "aac", "flac", "opus", "pcm"}
        if response_format not in allowed_formats:
            raise TTSConfigError(f"OpenAI 不支持输出格式：{output_format}")

        configured_model = clean_optional_text(self.config.get("model"))
        model = configured_model or ("tts-1-hd" if voice_id.startswith("voice_") else "gpt-4o-mini-tts")
        payload: Dict[str, Any] = {
            "model": model,
            "input": text,
            "voice": self._voice_payload(voice_id),
            "response_format": response_format,
        }
        speed = self.config.get("speed")
        if speed is not None:
            payload["speed"] = float(speed)

        instructions = self._emotion_instructions(emotion)
        if instructions and model == "gpt-4o-mini-tts":
            payload["instructions"] = instructions

        response = self._post_json(
            self.speech_url,
            headers={**self._headers(), "Content-Type": "application/json"},
            payload=payload,
            provider="OpenAI TTS",
            timeout=max(self.timeout, 120),
        )
        audio_bytes = bytes(response.content)
        if not audio_bytes:
            raise TTSError("OpenAI TTS 未返回音频数据")
        return audio_bytes

    def _find_openai_clone_files(self, sample_dir: Path) -> Tuple[Optional[Path], Path]:
        """在样本目录中寻找 consent 录音与主样本录音。"""
        audio_files = collect_audio_files(sample_dir, allowed_suffixes=set(OPENAI_SAMPLE_SUFFIXES))
        consent_files = [path for path in audio_files if "consent" in path.stem.lower()]
        consent_file = choose_largest_audio(consent_files) if consent_files else None
        sample_candidates = [path for path in audio_files if consent_file is None or path != consent_file]
        if not sample_candidates:
            raise TTSConfigError(
                "OpenAI 自定义声音至少需要一个主样本音频。若目录里只有 consent 录音，请再放一个普通声音样本。"
            )
        return consent_file, choose_largest_audio(sample_candidates)

    def clone_voice(self, sample_dir: Optional[str] = None, voice_name: Optional[str] = None) -> str:
        """使用 OpenAI 的 consent + custom voice 两步流程创建声音。"""
        samples_path = self.resolve_sample_dir(sample_dir)
        consent_file, audio_sample = self._find_openai_clone_files(samples_path)
        resolved_voice_name = (
            clean_optional_text(voice_name)
            or clean_optional_text(self.config.get("voice_name"))
            or self.display_name
            or self.slug
        )

        if self.dry_run:
            fake_voice_id = f"voice_dryrun_{uuid.uuid4().hex[:8]}"
            self.voice_id = fake_voice_id
            return fake_voice_id

        consent_id = clean_optional_text(self.config.get("consent_id"))
        if not consent_id:
            if consent_file is None:
                raise TTSConfigError(
                    "OpenAI 自定义声音需要 consent 录音。请在样本目录中放一个文件名包含 consent 的录音，"
                    "或在 manifest.json 的 tts_config 中提供 consent_id。"
                )
            consent_language = clean_optional_text(self.config.get("consent_language")) or "zh-CN"
            with consent_file.open("rb") as handle:
                response = self._post_multipart(
                    self.create_voice_consent_url,
                    headers=self._headers(),
                    data={
                        "name": resolved_voice_name,
                        "language": consent_language,
                    },
                    files=[("recording", (consent_file.name, handle, guess_mime_type(consent_file)))],
                    provider="OpenAI Voice Consent",
                    timeout=max(self.timeout, 120),
                )
            try:
                consent_payload = response.json()
            except ValueError as exc:
                raise TTSError("OpenAI Voice Consent 返回了无法解析的 JSON") from exc
            consent_id = clean_optional_text(consent_payload.get("id") if isinstance(consent_payload, dict) else None)
            if not consent_id:
                raise TTSError(f"OpenAI Voice Consent 返回异常：{consent_payload}")

        with audio_sample.open("rb") as handle:
            response = self._post_multipart(
                self.create_voice_url,
                headers=self._headers(),
                data={
                    "name": resolved_voice_name,
                    "consent": consent_id,
                },
                files=[("audio_sample", (audio_sample.name, handle, guess_mime_type(audio_sample)))],
                provider="OpenAI 自定义声音",
                timeout=max(self.timeout, 180),
            )

        try:
            voice_payload = response.json()
        except ValueError as exc:
            raise TTSError("OpenAI 自定义声音返回了无法解析的 JSON") from exc

        voice_id = clean_optional_text(voice_payload.get("id") if isinstance(voice_payload, dict) else None)
        if not voice_id:
            raise TTSError(f"OpenAI 自定义声音返回异常：{voice_payload}")
        self.voice_id = voice_id
        return voice_id


def build_service_from_args(args: argparse.Namespace) -> TTSService:
    """根据 CLI 参数构造具体 TTS 服务实例。"""
    manifest: Dict[str, Any] = {}
    relic_path: Optional[Path] = None
    merged_config: Dict[str, Any] = {}

    if args.relic:
        relic_path = ensure_relic_dir(args.relic)
        manifest = load_relic_manifest(relic_path)
        media_config = manifest.get("media") if isinstance(manifest.get("media"), dict) else {}
        raw_tts = media_config.get("tts")
        if raw_tts is None:
            raw_tts = manifest.get("tts_config")
        if isinstance(raw_tts, dict):
            merged_config.update(raw_tts)
        merged_config["_relic_slug"] = clean_optional_text(manifest.get("slug")) or relic_path.name
        merged_config["_relic_display_name"] = (
            clean_optional_text(manifest.get("display_name"))
            or clean_optional_text((manifest.get("subject") or {}).get("name") if isinstance(manifest.get("subject"), dict) else None)
            or relic_path.name
        )

    provider = clean_optional_text(args.provider) or clean_optional_text(merged_config.get("provider"))
    if not provider:
        raise TTSConfigError("请通过 --provider 指定服务商，或在 Relic 的 manifest.json 中配置 media.tts.provider / tts_config.provider")

    if args.voice_id:
        merged_config["voice_id"] = args.voice_id
    if args.sample_dir:
        merged_config["voice_sample_dir"] = args.sample_dir
    if args.mode and "requested_mode" not in merged_config:
        merged_config["requested_mode"] = args.mode

    provider_cls = provider_class_for_name(provider)
    service = provider_cls(
        voice_id=clean_optional_text(args.voice_id) or clean_optional_text(merged_config.get("voice_id")),
        output_format=clean_optional_text(args.format) or clean_optional_text(merged_config.get("output_format")),
        dry_run=bool(args.dry_run),
        relic_dir=relic_path,
        config=merged_config,
    )
    return service


def create_argument_parser() -> argparse.ArgumentParser:
    """构建 CLI 参数解析器。"""
    parser = argparse.ArgumentParser(description="relic.skill TTS 服务脚本")
    parser.add_argument("--relic", help="Relic 目录路径，读取 manifest.json 中的 media.tts / tts_config")
    parser.add_argument("--provider", choices=["doubao", "elevenlabs", "minimax", "openai"], help="TTS provider；若不传则尝试从 Relic 配置读取")
    parser.add_argument("--voice-id", help="服务商 voice_id；不传则优先读取 manifest.json，再使用 provider 默认值")
    parser.add_argument("--text", help="要合成的文本")
    parser.add_argument("--output", help="输出文件路径，后缀决定输出格式；默认自动生成 .mp3")
    parser.add_argument("--format", choices=["mp3", "wav", "aac", "flac", "opus", "pcm"], help="输出格式；当 --output 没有后缀时使用")
    parser.add_argument("--emotion", help="显式指定情绪，例如 happy/sad/calm/gentle")
    parser.add_argument("--mode", help="模式名；会尝试从 manifest.json 的 emotion_mapping 映射 emotion")
    parser.add_argument("--clone-voice", action="store_true", help="从样本目录克隆声音，而不是合成语音")
    parser.add_argument("--sample-dir", help="声音样本目录；不传则尝试读取 tts_config.voice_sample_dir")
    parser.add_argument("--voice-name", help="克隆声音时使用的名称")
    parser.add_argument("--dry-run", action="store_true", help="只预演参数解析，不调用外部 API")
    return parser


def validate_args(args: argparse.Namespace) -> None:
    """校验 CLI 参数组合是否合法。"""
    if args.clone_voice:
        return
    if not args.text:
        raise TTSConfigError("未提供 --text；合成语音时必须传入文本")


def main(argv: Optional[Sequence[str]] = None) -> int:
    """CLI 入口。"""
    configure_utf8_stdout()
    configure_logging()
    parser = create_argument_parser()
    args = parser.parse_args(argv)
    service: Optional[TTSService] = None

    try:
        validate_args(args)
        service = build_service_from_args(args)

        if args.clone_voice:
            voice_id = service.clone_voice(sample_dir=args.sample_dir, voice_name=args.voice_name)
            payload = {
                "ok": True,
                "provider": service.provider,
                "voice_id": voice_id,
                "sample_dir": str(service.resolve_sample_dir(args.sample_dir)),
                "dry_run": bool(args.dry_run),
            }
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            return 0

        emotion = clean_optional_text(args.emotion) or service.emotion_for_mode(args.mode)
        output_path = service.synthesize(
            text=args.text,
            voice_id=args.voice_id,
            output_path=args.output,
            emotion=emotion,
        )
        payload = {
            "ok": True,
            "provider": service.provider,
            "voice_id": service.resolve_voice_id(args.voice_id),
            "output_path": output_path,
            "emotion": emotion,
            "dry_run": bool(args.dry_run),
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    except TTSConfigError as exc:
        if is_missing_credential_error(exc):
            LOGGER.warning("%s", exc)
            payload: Dict[str, Any] = {
                "ok": False,
                "provider": service.provider if service is not None else clean_optional_text(args.provider),
                "dry_run": bool(args.dry_run),
                "reason": str(exc),
            }
            if args.clone_voice:
                payload["voice_id"] = None
                payload["sample_dir"] = args.sample_dir
            else:
                payload["voice_id"] = clean_optional_text(args.voice_id) or (service.voice_id if service is not None else None)
                payload["output_path"] = None
                payload["emotion"] = clean_optional_text(args.emotion) or (service.emotion_for_mode(args.mode) if service is not None else None)
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            return 0
        print(f"错误: {exc}", file=sys.stderr)
        return 1
    except (FileNotFoundError, PermissionError, ValueError, TTSError, OSError, json.JSONDecodeError) as exc:
        print(f"错误: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
