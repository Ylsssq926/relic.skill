#!/usr/bin/env python3
"""端到端集成测试脚本。

测试 Relic 的完整使用链路：
1. 加载 Relic
2. 生成对话回复
3. TTS 语音合成（dry-run）
4. 图像生成（dry-run）
5. 主动行为触发（dry-run）

示例：
    python scripts/test_integration.py --relic examples/grandma-demo
    python scripts/test_integration.py --relic examples/grandma-demo --live  # 真实 API 调用
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

try:  # pragma: no cover - 兼容包导入 / 脚本直跑
    from .media_service import MediaService, apply_dry_run
    from .relic_engine import AIProviderError, ConfigurationError, EngineConfig, IncomingMessage, RelicEngine
except ImportError:  # pragma: no cover - direct script execution
    from media_service import MediaService, apply_dry_run  # type: ignore[no-redef]
    from relic_engine import AIProviderError, ConfigurationError, EngineConfig, IncomingMessage, RelicEngine  # type: ignore[no-redef]

ROOT = Path(__file__).resolve().parents[1]
PROACTIVE_SCHEDULER = Path(__file__).with_name("proactive_scheduler.py")
DEFAULT_TEST_MESSAGE = "奶奶，我今天加班到十一点，刚到家。"


@dataclass
class CheckResult:
    """单项检查结果。"""

    name: str
    status: str
    summary: str
    details: Dict[str, Any] = field(default_factory=dict)


def configure_utf8_stdio() -> None:
    """尽量确保 Windows 下 stdout / stderr 为 UTF-8。"""
    for name in ("stdout", "stderr"):
        stream = getattr(sys, name)
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            continue


def first_non_empty(*values: Optional[str]) -> str:
    """返回第一个非空字符串。"""
    for value in values:
        if value and str(value).strip():
            return str(value).strip()
    return ""


def resolve_engine_config() -> EngineConfig:
    """从环境变量组装引擎配置。"""
    ai_provider = first_non_empty(os.getenv("AI_PROVIDER"), "claude").lower()
    ai_api_key = first_non_empty(
        os.getenv("AI_API_KEY"),
        os.getenv("OPENAI_API_KEY") if ai_provider == "openai" else os.getenv("ANTHROPIC_API_KEY"),
    )
    ai_model = first_non_empty(
        os.getenv("AI_MODEL"),
        os.getenv("OPENAI_MODEL") if ai_provider == "openai" else os.getenv("ANTHROPIC_MODEL"),
    )
    ai_base_url = first_non_empty(
        os.getenv("AI_BASE_URL"),
        os.getenv("OPENAI_BASE_URL") if ai_provider == "openai" else os.getenv("ANTHROPIC_BASE_URL"),
    )
    return EngineConfig(
        ai_provider=ai_provider,
        ai_api_key=ai_api_key,
        ai_model=ai_model,
        ai_base_url=ai_base_url,
        anthropic_version=first_non_empty(os.getenv("ANTHROPIC_VERSION"), "2023-06-01"),
    )


def summarize_plan_messages(messages: Sequence[Any], max_items: int = 3) -> str:
    """把 ResponsePlan 中的消息压缩成简短预览。"""
    previews: List[str] = []
    for index, message in enumerate(messages):
        if index >= max_items:
            previews.append("…")
            break
        kind = str(getattr(message, "kind", "text") or "text")
        text = str(getattr(message, "text", "") or "").strip().replace("\n", " ")
        snippet = text[:80] + ("…" if len(text) > 80 else "")
        if kind == "audio":
            previews.append(f"[audio] {snippet or '无文本'}")
        elif kind == "image":
            previews.append(f"[image] {snippet or '无文本'}")
        elif kind == "card":
            previews.append(f"[card] {snippet or '无文本'}")
        else:
            previews.append(snippet or f"[{kind}]")
    return " | ".join(previews) if previews else "空计划"


def test_relic_loading(relic_dir: Path) -> Dict[str, Any]:
    """加载 Relic，并返回 engine / profile。"""
    result: Dict[str, Any] = {"engine": None, "profile": None}
    try:
        engine = RelicEngine(resolve_engine_config())
        profile = engine.load_relic(str(relic_dir))
        result["engine"] = engine
        result["profile"] = profile
        result["check"] = CheckResult(
            name="Relic 加载",
            status="ok",
            summary=f"已加载 {profile.display_name}（slug={profile.slug}）",
            details={
                "slug": profile.slug,
                "display_name": profile.display_name,
                "relic_dir": str(profile.relic_dir),
            },
        )
    except Exception as exc:
        result["check"] = CheckResult(
            name="Relic 加载",
            status="error",
            summary=f"加载失败：{exc}",
            details={"error": str(exc)},
        )
    return result


def test_conversation_reply(engine: RelicEngine, profile: Any, test_message: str, *, live: bool) -> CheckResult:
    """测试对话回复链路。"""
    if not live:
        return CheckResult(
            name="对话回复",
            status="skipped",
            summary="默认 dry-run 不调用大模型；使用 --live 可验证真实回复链路",
            details={"test_message": test_message},
        )

    incoming = IncomingMessage(
        platform="integration-test",
        user_id="integration-user",
        chat_id="integration-chat",
        text=test_message,
        message_id="integration-test-message",
        is_direct_chat=True,
        is_mentioned=True,
    )
    try:
        plan = engine.handle_message(incoming, profile.slug)
        if not plan.messages:
            return CheckResult(
                name="对话回复",
                status="error",
                summary="引擎返回了空的 ResponsePlan",
                details={"mode": plan.mode, "session_key": plan.session_key},
            )
        return CheckResult(
            name="对话回复",
            status="ok",
            summary=f"成功生成 {len(plan.messages)} 条回复，mode={plan.mode}",
            details={
                "mode": plan.mode,
                "session_key": plan.session_key,
                "preview": summarize_plan_messages(plan.messages),
            },
        )
    except (ConfigurationError, AIProviderError) as exc:
        return CheckResult(
            name="对话回复",
            status="needs_config",
            summary=f"未完成真实回复：{exc}",
            details={"test_message": test_message, "error": str(exc)},
        )
    except Exception as exc:
        return CheckResult(
            name="对话回复",
            status="error",
            summary=f"回复生成失败：{exc}",
            details={"test_message": test_message, "error": str(exc)},
        )


def test_tts(media: MediaService, manifest: Dict[str, Any], *, live: bool) -> CheckResult:
    """测试 TTS 合成链路。"""
    tts_config = ((manifest.get("media") or {}).get("tts") if isinstance(manifest.get("media"), dict) else {}) or {}
    note = str(tts_config.get("note") or "").strip()
    if not media.has_tts:
        return CheckResult(
            name="TTS",
            status="needs_config",
            summary="manifest 未配置可用的 TTS 服务",
            details={"note": note},
        )

    try:
        audio_path = media.synthesize_speech("哎，别空着肚子睡，回家先吃点热乎的。", mode="late_night")
        if not audio_path:
            return CheckResult(
                name="TTS",
                status="needs_config",
                summary="TTS 已声明但未生成音频，通常是缺少 API Key、voice_id 或 provider 配置",
                details={"note": note},
            )
        detail_summary = f"{'真实调用' if live else 'dry-run'} 成功，输出路径：{audio_path}"
        if not live:
            detail_summary += "（dry-run 不会真正写文件）"
        return CheckResult(
            name="TTS",
            status="ok",
            summary=detail_summary,
            details={
                "provider": getattr(media.tts, "provider", "") if media.tts is not None else "",
                "audio_path": audio_path,
                "note": note,
            },
        )
    except Exception as exc:
        return CheckResult(
            name="TTS",
            status="error",
            summary=f"TTS 测试失败：{exc}",
            details={"error": str(exc), "note": note},
        )


def test_images(media: MediaService, manifest: Dict[str, Any], *, live: bool) -> CheckResult:
    """测试头像与封面图生成链路。"""
    image_config = ((manifest.get("media") or {}).get("image") if isinstance(manifest.get("media"), dict) else {}) or {}
    note = str(image_config.get("note") or "").strip()
    if not media.has_image:
        return CheckResult(
            name="图像生成",
            status="needs_config",
            summary="manifest 未配置可用的图像生成服务",
            details={"note": note},
        )

    try:
        avatar_path = media.generate_avatar()
        cover_path = media.generate_cover(scene_hint="厨房包饺子")
        if not avatar_path and not cover_path:
            return CheckResult(
                name="图像生成",
                status="needs_config",
                summary="图像服务已声明但未生成结果，通常是缺少 API Key 或 provider 配置",
                details={"note": note},
            )
        summary_parts = []
        if avatar_path:
            summary_parts.append(f"头像：{avatar_path}")
        if cover_path:
            summary_parts.append(f"封面：{cover_path}")
        summary = f"{'真实调用' if live else 'dry-run'} 成功，" + "；".join(summary_parts)
        if not live:
            summary += "（dry-run 不会真正写文件）"
        return CheckResult(
            name="图像生成",
            status="ok",
            summary=summary,
            details={
                "provider": getattr(media.image, "provider", "") if media.image is not None else "",
                "avatar_path": avatar_path,
                "cover_path": cover_path,
                "note": note,
            },
        )
    except Exception as exc:
        return CheckResult(
            name="图像生成",
            status="error",
            summary=f"图像生成测试失败：{exc}",
            details={"error": str(exc), "note": note},
        )


def test_proactive_scheduler(relic_dir: Path, *, live: bool) -> CheckResult:
    """通过 CLI 测试 proactive_scheduler 的 dry-run / execute 链路。"""
    command = [
        sys.executable,
        str(PROACTIVE_SCHEDULER),
        "--relic",
        str(relic_dir),
        "--dry-run",
        "--execute",
    ]
    try:
        completed = subprocess.run(
            command,
            cwd=ROOT,
            text=True,
            capture_output=True,
            encoding="utf-8",
        )
    except OSError as exc:
        return CheckResult(
            name="主动行为",
            status="error",
            summary=f"无法启动 proactive_scheduler.py：{exc}",
            details={"command": command, "error": str(exc)},
        )

    if completed.returncode != 0:
        return CheckResult(
            name="主动行为",
            status="error",
            summary="proactive_scheduler.py 执行失败",
            details={
                "command": command,
                "stdout": completed.stdout.strip(),
                "stderr": completed.stderr.strip(),
                "returncode": completed.returncode,
            },
        )

    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        return CheckResult(
            name="主动行为",
            status="error",
            summary=f"主动行为输出不是合法 JSON：{exc}",
            details={"stdout": completed.stdout.strip()},
        )

    tts_payload = payload.get("tts") if isinstance(payload.get("tts"), dict) else {}
    should_trigger = bool(payload.get("should_trigger"))
    if should_trigger:
        summary = f"已命中 {payload.get('type') or 'unknown'} 触发：{payload.get('message') or ''}".strip()
        if tts_payload.get("audio_path"):
            summary += f" | TTS 路径：{tts_payload.get('audio_path')}"
        elif tts_payload.get("enabled"):
            summary += " | 已走过 --execute 逻辑，但当前没有 audio_path"
        if not live:
            summary += "（当前仍为 dry-run，不会更新 state）"
        return CheckResult(
            name="主动行为",
            status="ok",
            summary=summary,
            details=payload,
        )

    return CheckResult(
        name="主动行为",
        status="ok",
        summary=f"当前未命中主动触发条件：{payload.get('reason') or 'no_trigger'}",
        details=payload,
    )


def render_results(relic_dir: Path, results: Sequence[CheckResult], *, live: bool) -> None:
    """打印控制台摘要。"""
    status_labels = {
        "ok": "OK",
        "needs_config": "NEEDS-CONFIG",
        "error": "ERROR",
        "skipped": "SKIPPED",
    }
    print(f"Relic 集成测试：{relic_dir}")
    print(f"模式：{'LIVE' if live else 'DRY-RUN'}")
    print()
    for item in results:
        label = status_labels.get(item.status, item.status.upper())
        print(f"[{label}] {item.name}: {item.summary}")
        preview = item.details.get("preview") if isinstance(item.details, dict) else None
        if isinstance(preview, str) and preview.strip():
            print(f"       预览：{preview}")
        note = item.details.get("note") if isinstance(item.details, dict) else None
        if isinstance(note, str) and note.strip():
            print(f"       提示：{note}")
    print()

    errors = [item for item in results if item.status == "error"]
    needs_config = [item for item in results if item.status == "needs_config"]
    skipped = [item for item in results if item.status == "skipped"]

    print("总结：")
    if errors:
        print(f"- 有 {len(errors)} 项失败，需先修复代码或运行环境。")
    else:
        print("- 没有发现脚本级运行错误。")
    if needs_config:
        print(f"- 有 {len(needs_config)} 项还需要补充配置（常见是 API Key / voice_id / provider）。")
    if skipped:
        print(f"- 有 {len(skipped)} 项因为当前是 dry-run 被跳过；如需真实验证请加 --live。")
    if not errors and not needs_config and not skipped:
        print("- 当前链路全部通过。")


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    """解析命令行参数。"""
    parser = argparse.ArgumentParser(description="relic.skill 端到端集成测试")
    parser.add_argument("--relic", required=True, help="Relic 目录，例如 examples/grandma-demo")
    parser.add_argument("--test-message", default=DEFAULT_TEST_MESSAGE, help="用于验证对话回复的测试消息")
    parser.add_argument("--live", action="store_true", help="执行真实 API 调用；默认只做 dry-run 检查")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    """CLI 入口。"""
    configure_utf8_stdio()
    args = parse_args(argv)
    relic_dir = Path(args.relic).expanduser().resolve()

    load_result = test_relic_loading(relic_dir)
    checks: List[CheckResult] = [load_result["check"]]
    engine = load_result.get("engine")
    profile = load_result.get("profile")
    if engine is None or profile is None:
        render_results(relic_dir, checks, live=bool(args.live))
        return 1

    manifest = dict(profile.manifest)
    media = MediaService.from_relic(str(relic_dir))
    apply_dry_run(media, not args.live)

    checks.append(test_conversation_reply(engine, profile, args.test_message, live=bool(args.live)))
    checks.append(test_tts(media, manifest, live=bool(args.live)))
    checks.append(test_images(media, manifest, live=bool(args.live)))
    checks.append(test_proactive_scheduler(relic_dir, live=bool(args.live)))

    render_results(relic_dir, checks, live=bool(args.live))

    if any(item.status == "error" for item in checks):
        return 1
    if any(item.status == "needs_config" for item in checks):
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
