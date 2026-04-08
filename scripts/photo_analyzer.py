"""Analyze photo EXIF metadata and export normalized JSON.

Features:
- Scans a single image or a directory recursively
- Extracts shooting time, GPS, device information, image size, and selected EXIF
- Outputs one JSON file that can feed later distillation steps
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

try:
    from PIL import ExifTags, Image, UnidentifiedImageError
except ImportError:  # pragma: no cover - dependency guard
    ExifTags = None
    Image = None
    UnidentifiedImageError = OSError

SUPPORTED_SUFFIXES = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}
GPS_TAGS = {value: key for key, value in ExifTags.GPSTAGS.items()} if ExifTags else {}
EXIF_TAGS = {value: key for key, value in ExifTags.TAGS.items()} if ExifTags else {}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def require_pillow() -> None:
    if Image is None or ExifTags is None:
        raise RuntimeError("缺少依赖 pillow，请先执行 pip install -r requirements.txt")


def write_json(path: Path, payload: Dict[str, Any], pretty: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2 if pretty else None)
        handle.write("\n")


def discover_images(input_path: Path) -> List[Path]:
    if input_path.is_file():
        if input_path.suffix.lower() not in SUPPORTED_SUFFIXES:
            raise ValueError(f"不支持的图片类型: {input_path.suffix}")
        return [input_path]
    if not input_path.is_dir():
        raise FileNotFoundError(f"输入路径不存在: {input_path}")
    images = [path for path in sorted(input_path.rglob("*")) if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES]
    if not images:
        raise FileNotFoundError(f"目录中没有找到支持的图片文件: {input_path}")
    return images


def rational_to_float(value: Any) -> Optional[float]:
    try:
        if isinstance(value, tuple) and len(value) == 2:
            numerator, denominator = value
            return float(numerator) / float(denominator)
        return float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def convert_gps_coordinate(values: Any, reference: Any) -> Optional[float]:
    if not values or not reference:
        return None
    if not isinstance(values, (list, tuple)) or len(values) < 3:
        return None
    degrees = rational_to_float(values[0])
    minutes = rational_to_float(values[1])
    seconds = rational_to_float(values[2])
    if degrees is None or minutes is None or seconds is None:
        return None
    decimal = degrees + minutes / 60.0 + seconds / 3600.0
    ref = str(reference).upper()
    if ref in {"S", "W"}:
        decimal *= -1
    return round(decimal, 8)


def parse_datetime_text(text: str) -> Tuple[Optional[int], Optional[str]]:
    normalized = text.strip()
    if not normalized:
        return None, None
    normalized = normalized.replace("\x00", "")
    formats = ["%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"]
    for fmt in formats:
        try:
            dt = datetime.strptime(normalized, fmt)
            return int(dt.timestamp()), dt.isoformat()
        except ValueError:
            continue
    return None, normalized


def decode_exif(exif: Any) -> Dict[str, Any]:
    decoded: Dict[str, Any] = {}
    if not exif:
        return decoded
    for tag_id, value in exif.items():
        tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
        if tag_name == "GPSInfo" and isinstance(value, dict):
            gps_map: Dict[str, Any] = {}
            for gps_id, gps_value in value.items():
                gps_name = ExifTags.GPSTAGS.get(gps_id, str(gps_id))
                gps_map[gps_name] = gps_value
            decoded[tag_name] = gps_map
        else:
            decoded[tag_name] = value
    return decoded


def extract_photo_record(path: Path) -> Dict[str, Any]:
    require_pillow()
    try:
        with Image.open(path) as image:
            exif_raw = image.getexif()
            exif = decode_exif(exif_raw)
            gps = exif.get("GPSInfo", {}) if isinstance(exif.get("GPSInfo"), dict) else {}
            latitude = convert_gps_coordinate(gps.get("GPSLatitude"), gps.get("GPSLatitudeRef"))
            longitude = convert_gps_coordinate(gps.get("GPSLongitude"), gps.get("GPSLongitudeRef"))
            altitude = rational_to_float(gps.get("GPSAltitude"))

            shot_timestamp: Optional[int] = None
            shot_datetime: Optional[str] = None
            for key in ("DateTimeOriginal", "DateTimeDigitized", "DateTime"):
                value = exif.get(key)
                if value:
                    shot_timestamp, shot_datetime = parse_datetime_text(str(value))
                    if shot_datetime:
                        break

            device = {
                "make": str(exif.get("Make") or "").strip() or None,
                "model": str(exif.get("Model") or "").strip() or None,
                "lens": str(exif.get("LensModel") or "").strip() or None,
                "software": str(exif.get("Software") or "").strip() or None,
            }
            selected_exif = {
                "DateTimeOriginal": exif.get("DateTimeOriginal"),
                "DateTimeDigitized": exif.get("DateTimeDigitized"),
                "DateTime": exif.get("DateTime"),
                "Make": exif.get("Make"),
                "Model": exif.get("Model"),
                "LensModel": exif.get("LensModel"),
                "Software": exif.get("Software"),
                "FNumber": str(exif.get("FNumber")) if exif.get("FNumber") is not None else None,
                "ExposureTime": str(exif.get("ExposureTime")) if exif.get("ExposureTime") is not None else None,
                "ISOSpeedRatings": exif.get("ISOSpeedRatings"),
                "FocalLength": str(exif.get("FocalLength")) if exif.get("FocalLength") is not None else None,
            }
            return {
                "path": str(path),
                "filename": path.name,
                "format": image.format,
                "width": image.width,
                "height": image.height,
                "shot_timestamp": shot_timestamp,
                "shot_time": shot_datetime,
                "gps": {
                    "latitude": latitude,
                    "longitude": longitude,
                    "altitude": altitude,
                },
                "device": device,
                "exif": selected_exif,
            }
    except UnidentifiedImageError as exc:
        raise RuntimeError(f"无法识别图片文件: {path}") from exc
    except OSError as exc:
        raise RuntimeError(f"读取图片失败: {path}: {exc}") from exc


def build_stats(records: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    with_exif = 0
    with_gps = 0
    with_shot_time = 0
    device_counter: Counter[str] = Counter()
    timestamps: List[int] = []
    for record in records:
        exif = record.get("exif") or {}
        if any(value for value in exif.values()):
            with_exif += 1
        gps = record.get("gps") or {}
        if gps.get("latitude") is not None and gps.get("longitude") is not None:
            with_gps += 1
        if record.get("shot_timestamp") is not None:
            with_shot_time += 1
            timestamps.append(int(record["shot_timestamp"]))
        device = record.get("device") or {}
        make = device.get("make") or ""
        model = device.get("model") or ""
        device_name = " ".join(part for part in [make, model] if part).strip()
        if device_name:
            device_counter[device_name] += 1
    return {
        "photo_count": len(records),
        "with_exif": with_exif,
        "with_gps": with_gps,
        "with_shot_time": with_shot_time,
        "devices": dict(device_counter),
        "time_range": {
            "start": min(timestamps) if timestamps else None,
            "end": max(timestamps) if timestamps else None,
        },
    }


def build_payload(input_path: Path, files: Sequence[Path], records: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "schema_version": "1.0",
        "source": {
            "platform": "photo",
            "input": str(input_path),
            "files": [str(path) for path in files],
            "generated_at": now_iso(),
        },
        "stats": build_stats(records),
        "photos": list(records),
    }


def create_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="分析照片 EXIF 并输出标准化 JSON")
    parser.add_argument("--input", required=True, help="输入图片文件或目录")
    parser.add_argument("--output", required=True, help="输出 JSON 文件路径")
    parser.add_argument("--limit", type=int, help="最多输出多少张图片")
    parser.add_argument("--pretty", action="store_true", help="输出格式化 JSON")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = create_argument_parser()
    args = parser.parse_args(argv)

    input_path = Path(args.input).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()

    try:
        files = discover_images(input_path)
        records: List[Dict[str, Any]] = []
        for file_path in files:
            try:
                records.append(extract_photo_record(file_path))
            except Exception as exc:
                print(f"[WARN] 跳过文件 {file_path}: {exc}", file=sys.stderr)
        if not records:
            raise RuntimeError("没有成功解析任何照片。")
        records.sort(key=lambda item: (item.get("shot_timestamp") or 0, item.get("path") or ""))
        if args.limit is not None:
            records = records[: args.limit]
        payload = build_payload(input_path, files, records)
        write_json(output_path, payload, args.pretty)
        print(f"已输出 {len(records)} 张照片的分析结果到 {output_path}")
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
