"""Manage Relic versions with snapshot / list / rollback / diff commands.

Default directory layout:
- Relic root: exes/
- Version store: .versions/

Each snapshot is stored under:
.versions/<slug>/<snapshot_id>/files/
"""
from __future__ import annotations

import argparse
import difflib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

DEFAULT_RELIC_ROOT = Path("exes")
DEFAULT_VERSION_ROOT = Path(".versions")
INDEX_FILENAME = "index.json"
SNAPSHOT_META_FILENAME = "snapshot.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def now_compact() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def count_files(path: Path) -> int:
    return sum(1 for item in path.rglob("*") if item.is_file())


def load_index(slug_dir: Path) -> List[Dict[str, Any]]:
    index_path = slug_dir / INDEX_FILENAME
    data = read_json(index_path, [])
    return data if isinstance(data, list) else []


def save_index(slug_dir: Path, index: Sequence[Dict[str, Any]]) -> None:
    write_json(slug_dir / INDEX_FILENAME, list(index))


def relic_dir_for(slug: str, relic_root: Path) -> Path:
    return relic_root / slug


def version_dir_for(slug: str, version_root: Path) -> Path:
    return version_root / slug


def snapshot_files_dir(snapshot_dir: Path) -> Path:
    return snapshot_dir / "files"


def create_snapshot(slug: str, relic_root: Path, version_root: Path, note: str) -> Dict[str, Any]:
    source_dir = relic_dir_for(slug, relic_root)
    if not source_dir.exists() or not source_dir.is_dir():
        raise FileNotFoundError(f"Relic 目录不存在：{source_dir}")

    slug_dir = version_dir_for(slug, version_root)
    slug_dir.mkdir(parents=True, exist_ok=True)
    index = load_index(slug_dir)
    version = max((int(item.get("version", 0)) for item in index), default=0) + 1
    snapshot_id = f"{version:04d}_{now_compact()}"
    target_dir = slug_dir / snapshot_id
    files_dir = snapshot_files_dir(target_dir)

    if target_dir.exists():
        raise FileExistsError(f"快照目录已存在：{target_dir}")

    shutil.copytree(source_dir, files_dir)
    metadata = {
        "slug": slug,
        "version": version,
        "snapshot_id": snapshot_id,
        "created_at": now_iso(),
        "note": note,
        "source_dir": str(source_dir),
        "file_count": count_files(files_dir),
    }
    write_json(target_dir / SNAPSHOT_META_FILENAME, metadata)
    index.append(metadata)
    save_index(slug_dir, index)
    return metadata


def list_snapshots(version_root: Path, slug: Optional[str]) -> List[Dict[str, Any]]:
    if slug:
        slug_dir = version_dir_for(slug, version_root)
        return load_index(slug_dir)

    all_records: List[Dict[str, Any]] = []
    if not version_root.exists():
        return all_records
    for child in sorted(version_root.iterdir()):
        if not child.is_dir():
            continue
        for record in load_index(child):
            all_records.append(record)
    all_records.sort(key=lambda item: (item.get("slug") or "", int(item.get("version", 0))))
    return all_records


def resolve_snapshot(slug: str, version: int, version_root: Path) -> Dict[str, Any]:
    slug_dir = version_dir_for(slug, version_root)
    index = load_index(slug_dir)
    for record in index:
        if int(record.get("version", 0)) == version:
            return record
    raise FileNotFoundError(f"未找到 {slug} 的版本 {version}")


def snapshot_path_from_record(record: Dict[str, Any], version_root: Path) -> Path:
    slug = str(record["slug"])
    snapshot_id = str(record["snapshot_id"])
    return version_dir_for(slug, version_root) / snapshot_id


def restore_snapshot(slug: str, version: int, relic_root: Path, version_root: Path, backup_current: bool) -> Dict[str, Any]:
    record = resolve_snapshot(slug, version, version_root)
    source_snapshot_dir = snapshot_files_dir(snapshot_path_from_record(record, version_root))
    if not source_snapshot_dir.exists():
        raise FileNotFoundError(f"快照文件目录不存在：{source_snapshot_dir}")

    target_dir = relic_dir_for(slug, relic_root)
    if target_dir.exists() and backup_current:
        create_snapshot(slug, relic_root, version_root, note=f"auto-backup before rollback to v{version}")

    if target_dir.exists():
        shutil.rmtree(target_dir)
    shutil.copytree(source_snapshot_dir, target_dir)
    return record


def collect_files(root: Path) -> Dict[str, Path]:
    files: Dict[str, Path] = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            relative = path.relative_to(root).as_posix()
            files[relative] = path
    return files


def read_text_for_diff(path: Path) -> Optional[str]:
    data = path.read_bytes()
    if b"\x00" in data[:4096]:
        return None
    for encoding in ("utf-8", "utf-8-sig", "gb18030", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return None


def build_diff(left_root: Path, right_root: Path, left_label: str, right_label: str) -> str:
    left_files = collect_files(left_root)
    right_files = collect_files(right_root)
    all_paths = sorted(set(left_files) | set(right_files))
    chunks: List[str] = []

    for relative in all_paths:
        left_path = left_files.get(relative)
        right_path = right_files.get(relative)
        if left_path is None:
            chunks.append(f"# only in {right_label}: {relative}")
            continue
        if right_path is None:
            chunks.append(f"# only in {left_label}: {relative}")
            continue
        left_text = read_text_for_diff(left_path)
        right_text = read_text_for_diff(right_path)
        if left_text is None or right_text is None:
            if left_text == right_text:
                continue
            chunks.append(f"# binary or undecodable file changed: {relative}")
            continue
        if left_text == right_text:
            continue
        diff_lines = difflib.unified_diff(
            left_text.splitlines(),
            right_text.splitlines(),
            fromfile=f"{left_label}/{relative}",
            tofile=f"{right_label}/{relative}",
            lineterm="",
        )
        chunks.extend(diff_lines)
        chunks.append("")

    return "\n".join(chunks).rstrip() + ("\n" if chunks else "")


def print_snapshot_table(records: Sequence[Dict[str, Any]]) -> None:
    if not records:
        print("没有可用快照。")
        return
    header = f"{'slug':<24} {'version':<8} {'created_at':<24} {'files':<8} note"
    print(header)
    print("-" * len(header))
    for record in records:
        slug = str(record.get("slug", ""))[:24]
        version = str(record.get("version", ""))
        created_at = str(record.get("created_at", ""))[:24]
        file_count = str(record.get("file_count", ""))
        note = str(record.get("note", ""))
        print(f"{slug:<24} {version:<8} {created_at:<24} {file_count:<8} {note}")


def create_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Relic 版本管理：snapshot / list / rollback / diff")
    subparsers = parser.add_subparsers(dest="command")

    snapshot_parser = subparsers.add_parser("snapshot", help="为某个 Relic 创建快照")
    snapshot_parser.add_argument("--slug", required=True, help="Relic slug")
    snapshot_parser.add_argument("--note", default="", help="快照备注")
    snapshot_parser.add_argument("--relic-root", default=str(DEFAULT_RELIC_ROOT), help="Relic 根目录，默认 exes")
    snapshot_parser.add_argument("--versions-root", default=str(DEFAULT_VERSION_ROOT), help="版本目录，默认 .versions")

    list_parser = subparsers.add_parser("list", help="列出快照")
    list_parser.add_argument("--slug", help="只列出某个 slug 的快照")
    list_parser.add_argument("--versions-root", default=str(DEFAULT_VERSION_ROOT), help="版本目录，默认 .versions")
    list_parser.add_argument("--json", action="store_true", help="以 JSON 输出")

    rollback_parser = subparsers.add_parser("rollback", help="回滚到指定版本")
    rollback_parser.add_argument("--slug", required=True, help="Relic slug")
    rollback_parser.add_argument("--version", required=True, type=int, help="要回滚到的版本号")
    rollback_parser.add_argument("--relic-root", default=str(DEFAULT_RELIC_ROOT), help="Relic 根目录，默认 exes")
    rollback_parser.add_argument("--versions-root", default=str(DEFAULT_VERSION_ROOT), help="版本目录，默认 .versions")
    rollback_parser.add_argument("--no-backup-current", action="store_true", help="回滚前不自动备份当前版本")

    diff_parser = subparsers.add_parser("diff", help="比较两个版本或版本与当前目录")
    diff_parser.add_argument("--slug", required=True, help="Relic slug")
    diff_parser.add_argument("--version-a", required=True, type=int, help="左侧版本号")
    diff_parser.add_argument("--version-b", type=int, help="右侧版本号")
    diff_parser.add_argument("--against-current", action="store_true", help="将 version-a 与当前 Relic 目录比较")
    diff_parser.add_argument("--relic-root", default=str(DEFAULT_RELIC_ROOT), help="Relic 根目录，默认 exes")
    diff_parser.add_argument("--versions-root", default=str(DEFAULT_VERSION_ROOT), help="版本目录，默认 .versions")
    diff_parser.add_argument("--output", help="将 diff 写入文件")

    return parser


def ensure_command_selected(parser: argparse.ArgumentParser, args: argparse.Namespace) -> None:
    if not args.command:
        parser.print_help()
        raise SystemExit(1)


def cmd_snapshot(args: argparse.Namespace) -> int:
    relic_root = Path(args.relic_root).expanduser().resolve()
    version_root = Path(args.versions_root).expanduser().resolve()
    record = create_snapshot(args.slug, relic_root, version_root, args.note)
    print(json.dumps(record, ensure_ascii=False, indent=2))
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    version_root = Path(args.versions_root).expanduser().resolve()
    records = list_snapshots(version_root, args.slug)
    if args.json:
        print(json.dumps(records, ensure_ascii=False, indent=2))
    else:
        print_snapshot_table(records)
    return 0


def cmd_rollback(args: argparse.Namespace) -> int:
    relic_root = Path(args.relic_root).expanduser().resolve()
    version_root = Path(args.versions_root).expanduser().resolve()
    record = restore_snapshot(args.slug, args.version, relic_root, version_root, backup_current=not args.no_backup_current)
    print(
        json.dumps(
            {
                "status": "ok",
                "slug": args.slug,
                "rolled_back_to": record.get("version"),
                "snapshot_id": record.get("snapshot_id"),
                "target_dir": str(relic_dir_for(args.slug, relic_root)),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def cmd_diff(args: argparse.Namespace) -> int:
    relic_root = Path(args.relic_root).expanduser().resolve()
    version_root = Path(args.versions_root).expanduser().resolve()
    left_record = resolve_snapshot(args.slug, args.version_a, version_root)
    left_root = snapshot_files_dir(snapshot_path_from_record(left_record, version_root))
    left_label = f"v{args.version_a}"

    if args.against_current:
        right_root = relic_dir_for(args.slug, relic_root)
        if not right_root.exists():
            raise FileNotFoundError(f"当前 Relic 目录不存在：{right_root}")
        right_label = "current"
    else:
        if args.version_b is None:
            raise ValueError("未指定 --version-b，也未开启 --against-current")
        right_record = resolve_snapshot(args.slug, args.version_b, version_root)
        right_root = snapshot_files_dir(snapshot_path_from_record(right_record, version_root))
        right_label = f"v{args.version_b}"

    diff_text = build_diff(left_root, right_root, left_label, right_label)
    if not diff_text:
        diff_text = "No differences found.\n"

    if args.output:
        output_path = Path(args.output).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(diff_text, encoding="utf-8")
        print(f"diff 已写入 {output_path}")
    else:
        sys.stdout.write(diff_text)
    return 0


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
    ensure_command_selected(parser, args)

    try:
        if args.command == "snapshot":
            return cmd_snapshot(args)
        if args.command == "list":
            return cmd_list(args)
        if args.command == "rollback":
            return cmd_rollback(args)
        if args.command == "diff":
            return cmd_diff(args)
        raise ValueError(f"未知命令：{args.command}")
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
