"""
relic.skill — Relic 质量评估器

对已生成的 Relic 文件夹进行自动化质量检查，评估四维覆盖度、
证据分布、内容具体性，输出完整度评分和改进建议。

用法:
    python scripts/quality_checker.py --relic <relic_directory>
    python scripts/quality_checker.py --relic examples/grandma-demo
    python scripts/quality_checker.py --relic examples/cat-mimi-demo --verbose
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------

@dataclass
class DimensionScore:
    """单个维度的评估结果。"""
    name: str
    word_count: int = 0
    evidence_verbatim: int = 0
    evidence_artifact: int = 0
    evidence_impression: int = 0
    has_specific_examples: bool = False
    issues: list[str] = field(default_factory=list)

    @property
    def evidence_total(self) -> int:
        return self.evidence_verbatim + self.evidence_artifact + self.evidence_impression

    @property
    def score(self) -> float:
        """0-100 分。"""
        s = 0.0
        # 字数：>200 满分 30，<50 得 0
        s += min(30.0, max(0.0, (self.word_count - 50) / 150 * 30))
        # 证据数量：>=3 满分 30
        s += min(30.0, self.evidence_total / 3 * 30)
        # verbatim 占比：有 verbatim 加 20
        if self.evidence_verbatim > 0:
            s += 20.0
        # 具体性：有具体示例加 20
        if self.has_specific_examples:
            s += 20.0
        return round(s, 1)


@dataclass
class RelicReport:
    """整个 Relic 的评估报告。"""
    slug: str
    files_found: list[str] = field(default_factory=list)
    files_missing: list[str] = field(default_factory=list)
    dimensions: list[DimensionScore] = field(default_factory=list)
    memory_count: int = 0
    memory_with_evidence: int = 0
    interaction_scenes: int = 0
    manifest_valid: bool = False
    issues: list[str] = field(default_factory=list)

    @property
    def file_score(self) -> float:
        """文件完整度：5 个文件各 20 分。"""
        return len(self.files_found) / 5 * 100

    @property
    def dimension_score(self) -> float:
        """四维平均分。"""
        if not self.dimensions:
            return 0.0
        return round(sum(d.score for d in self.dimensions) / len(self.dimensions), 1)

    @property
    def memory_score(self) -> float:
        """记忆质量：数量 + 证据标注率。"""
        if self.memory_count == 0:
            return 0.0
        count_score = min(50.0, self.memory_count / 8 * 50)
        evidence_rate = self.memory_with_evidence / self.memory_count
        evidence_score = evidence_rate * 50
        return round(count_score + evidence_score, 1)

    @property
    def total_score(self) -> float:
        """综合评分：文件 20% + 四维 40% + 记忆 20% + 交互 20%。"""
        interaction_s = min(100.0, self.interaction_scenes / 5 * 100)
        total = (
            self.file_score * 0.20
            + self.dimension_score * 0.40
            + self.memory_score * 0.20
            + interaction_s * 0.20
        )
        return round(total, 1)

    @property
    def grade(self) -> str:
        s = self.total_score
        if s >= 85:
            return "A — 灵魂饱满，可以上线"
        elif s >= 70:
            return "B — 轮廓清晰，部分维度可补充"
        elif s >= 50:
            return "C — 骨架有了，需要更多素材"
        else:
            return "D — 素材不足，建议补充后重新蒸馏"


# ---------------------------------------------------------------------------
# 分析函数
# ---------------------------------------------------------------------------

EXPECTED_FILES = ["SKILL.md", "personality.md", "interaction.md", "memory.md", "manifest.json"]

VAGUE_PATTERNS = [
    r"是一个[很非]?[好善良温柔聪明优秀]+的",
    r"非常[好善良温柔聪明优秀]+",
    r"总是[很非]?[好善良温柔聪明优秀]+",
    r"一个[很非]?[不错出色优秀]+的人",
]


def count_chinese_words(text: str) -> int:
    """粗略统计中文字符 + 英文单词数。"""
    chinese = len(re.findall(r"[\u4e00-\u9fff]", text))
    english = len(re.findall(r"[a-zA-Z]+", text))
    return chinese + english


def count_evidence(text: str) -> tuple[int, int, int]:
    """统计 verbatim / artifact / impression 出现次数，支持中英文标记。"""
    v = len(re.findall(r"(?:verbatim|原话|台词|口头禅|名言)", text, re.IGNORECASE))
    a = len(re.findall(r"(?:artifact|物证|照片|截图|录音|文档|会议纪要|来源[：:])", text, re.IGNORECASE))
    i = len(re.findall(r"(?:impression|印象|口述|回忆|访谈)", text, re.IGNORECASE))

    # 兼容 relic_writer.py 生成的 markdown：用“来源：”作为轻量证据信号。
    if v + a + i == 0:
        artifact_like = len(re.findall(r"^\-\s*来源[：:]", text, re.MULTILINE))
        a += artifact_like
    return v, a, i


def has_specifics(text: str) -> bool:
    """检查是否有具体的场景描述（时间、地点、对话、高辨识度细节等）。"""
    indicators = [
        r"\d{4}[-/]",             # 年份
        r'["\'“”‘’].+["\'“”‘’]',  # 引用的话（含中文引号）
        r"比如|例如",             # 举例
        r"有一次|那天|记得|当时",   # 具体时点
        r"每次|经常|总会|一旦",     # 稳定习惯细节
        r"清晨|白天|傍晚|夜间|凌晨|平时|通常", # 时段与作息细节
    ]
    for pattern in indicators:
        if re.search(pattern, text):
            return True
    return False


def check_vague(text: str) -> list[str]:
    """检查空洞描述。"""
    issues: list[str] = []
    for pattern in VAGUE_PATTERNS:
        matches = re.findall(pattern, text)
        if matches:
            issues.append(f"发现空洞描述模式: '{matches[0]}...'")
    return issues


def extract_heading_sections(text: str, levels: tuple[int, ...] = (2, 3)) -> list[tuple[str, str]]:
    """按 ##/### 标题切分章节，兼容 writer 产物和手写示例。"""
    pattern = re.compile(rf"^({'|'.join('#' * level for level in levels)})\s+(.+)$", re.MULTILINE)
    matches = list(pattern.finditer(text))
    sections: list[tuple[str, str]] = []
    for idx, match in enumerate(matches):
        title = match.group(2).strip()
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        sections.append((title, text[start:end].strip()))
    return sections


def analyze_personality(relic_dir: Path) -> list[DimensionScore]:
    """分析 personality.md 的四维覆盖度。"""
    path = relic_dir / "personality.md"
    if not path.exists():
        return []

    text = path.read_text(encoding="utf-8")

    # 两种格式都要兼容：
    # 1) 手写示例：## 一、认知 ...（正文挂在下方多个 ### 中）
    # 2) writer 产物：## 四维画像 / ### 1. 认知框架
    top_sections_raw = re.split(r"^##\s+", text, flags=re.MULTILINE)
    top_sections: list[tuple[str, str]] = []
    for section in top_sections_raw[1:]:
        title, _, body = section.partition("\n")
        top_sections.append((title.strip(), body.strip()))

    sub_sections = extract_heading_sections(text, levels=(3,))

    dimension_names = ["认知", "表达", "行为", "情感"]
    # 每个槽位收录所有模板的维度名（中英双语）。
    # 模板体系已扩展到 object / expert / relationship 等，四维被各自重定义
    # （使用痕迹 / 专业判断 / 沟通模式 …），只认 human 的四维会把它们误判为缺失。
    alt_names = {
        "认知": [
            "cognition", "habit", "judgment", "intuition", "knowledge", "collaboration",
            "decision", "sensory", "event", "communication",
            "习性", "决策", "认知框架", "感官", "发言", "起承转合", "习性模式", "决策风格",
            "使用痕迹", "专业判断", "经验直觉", "知识体系", "协作记忆", "决策过程",
            "场景细节", "事件记忆", "感官记忆", "沟通模式", "道德", "原则",
            "cognitive frame", "wear traces", "professional judgment", "experiential intuition",
            "knowledge system", "collaboration memory", "decision process", "scene details",
            "sensory memory", "communication pattern",
        ],
        "表达": [
            "expression", "interaction", "projection", "mentoring", "chemistry", "conflict",
            "atmosphere",
            "互动", "沟通", "表达风格", "空间", "行动", "感官锚点", "互动风格", "沟通习惯",
            "情感投射", "传承方式", "团队默契", "冲突模式", "氛围特征", "语气", "语言",
            "expression style", "interaction style", "emotional projection", "mentoring style",
            "team chemistry", "conflict pattern", "atmospheric character",
        ],
        "行为": [
            "behavior", "rhythm", "companionship", "growth", "value", "meaning", "ritual",
            "生活", "节奏", "行为习惯", "生活节奏", "价值", "价值观", "轨迹", "争议", "行为模式",
            "陪伴轨迹", "成长轨迹", "意义解读", "内部梗", "内部梗和仪式", "知识沉淀", "日常",
            "behavioral patterns", "life rhythm", "companionship track", "growth arc",
            "value system", "meaning", "inside jokes and rituals",
        ],
        "情感": [
            "emotion", "anchor", "intimacy", "causality",
            "情绪", "感受", "情感特征", "梗", "仪式", "亲密", "氛围", "心理", "情绪表达",
            "情感接口", "空间锚点", "亲密模式", "情感联结", "情感状态", "前因后果",
            "emotional interface", "emotional expression", "spatial anchor", "intimacy pattern",
            "emotional bond", "emotional state", "causes and effects",
        ],
    }

    results: list[DimensionScore] = []
    used_sub_indexes: set[int] = set()

    for dim_name in dimension_names:
        ds = DimensionScore(name=dim_name)
        search_terms = [dim_name] + alt_names.get(dim_name, [])

        matched_section = ""

        # 先匹配手写示例里的顶层 ## 维度标题
        for title, body in top_sections:
            if any(term.lower() in title.lower() for term in search_terms):
                matched_section = body
                break

        # 再匹配 writer 产物里的 ### 子标题
        if not matched_section:
            for idx, (title, body) in enumerate(sub_sections):
                if idx in used_sub_indexes:
                    continue
                if any(term.lower() in title.lower() for term in search_terms):
                    matched_section = body
                    used_sub_indexes.add(idx)
                    break

        if matched_section:
            ds.word_count = count_chinese_words(matched_section)
            v, a, i = count_evidence(matched_section)
            ds.evidence_verbatim = v
            ds.evidence_artifact = a
            ds.evidence_impression = i
            ds.has_specific_examples = has_specifics(matched_section)
            ds.issues = check_vague(matched_section)

        results.append(ds)

    # 兜底：模板体系的四维是被各自重定义的（place 是感官/事件/联结/氛围，
    # expert 是判断/直觉/知识/传承），关键词表不可能穷尽，硬匹配会把新模板
    # 判成「维度缺失」。这里按 personality.md 的章节顺序，把还没被占用的
    # 章节依次补给空槽——顺序即维度顺序，这正是 writer 生成骨架时的排列方式。
    spare = [i for i in range(len(sub_sections)) if i not in used_sub_indexes]
    empty = [d for d in results if d.word_count == 0]
    for ds, idx in zip(empty, spare):
        _, body = sub_sections[idx]
        used_sub_indexes.add(idx)
        ds.word_count = count_chinese_words(body)
        v, a, i = count_evidence(body)
        ds.evidence_verbatim = v
        ds.evidence_artifact = a
        ds.evidence_impression = i
        ds.has_specific_examples = has_specifics(body)
        ds.issues = check_vague(body)

    for ds in results:
        if ds.word_count == 0:
            ds.issues.append(f"未找到 {ds.name} 维度的内容")

    return results


def analyze_memory(relic_dir: Path) -> tuple[int, int]:
    """分析 memory.md 的记忆数量和证据标注率。"""
    path = relic_dir / "memory.md"
    if not path.exists():
        return 0, 0

    text = path.read_text(encoding="utf-8")
    sections = extract_heading_sections(text, levels=(2, 3))

    # 优先识别 writer 生成的 ### 记忆锚点；否则退回到手写示例的 ## 段落。
    memory_sections = [(title, body) for title, body in sections if re.match(r"\d+\.", title)]
    if not memory_sections:
        memory_sections = [(title, body) for title, body in sections if title.startswith("记忆") or re.match(r"\d+\.", title)]
    if not memory_sections:
        memory_sections = sections

    memory_count = len(memory_sections)
    with_evidence = 0
    for _, body in memory_sections:
        # 中文用「来源：/证据等级」，英文 Relic 用 Source: / Evidence:；
        # 只认中文会让英文 Relic 的记忆证据恒为 0。
        if re.search(
            r"(verbatim|artifact|impression"
            r"|^\-\s*来源[：:]|^\-\s*证据|^\-\s*source[：:]|^\-\s*evidence[：:])",
            body, re.IGNORECASE | re.MULTILINE,
        ):
            with_evidence += 1

    return memory_count, with_evidence


def analyze_interaction(relic_dir: Path) -> int:
    """统计 interaction.md 的场景数量。"""
    path = relic_dir / "interaction.md"
    if not path.exists():
        return 0

    text = path.read_text(encoding="utf-8")
    sections = extract_heading_sections(text, levels=(2, 3))
    numbered = [title for title, _ in sections if re.match(r"\d+\.", title)]
    if numbered:
        return len(numbered)

    scenes = [title for title, _ in sections if re.search(r"场景|模式|scene|scenario", title, re.IGNORECASE)]
    return len(scenes) if scenes else len(sections)


def analyze_manifest(relic_dir: Path) -> bool:
    """检查 manifest.json 格式是否正确，兼容手写示例和 relic_writer 生成格式。"""
    path = relic_dir / "manifest.json"
    if not path.exists():
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        current_schema = all(k in data for k in ["slug", "display_name", "relic_type", "version"])
        writer_schema = all(k in data for k in ["schema_version", "slug", "title", "template"])
        return current_schema or writer_schema
    except (json.JSONDecodeError, KeyError):
        return False


def evaluate(relic_dir: Path) -> RelicReport:
    """对一个 Relic 目录执行完整评估。"""
    report = RelicReport(slug=relic_dir.name)

    # 文件检查
    for f in EXPECTED_FILES:
        if (relic_dir / f).exists():
            report.files_found.append(f)
        else:
            report.files_missing.append(f)
            report.issues.append(f"缺少文件: {f}")

    # 四维分析
    report.dimensions = analyze_personality(relic_dir)

    # 记忆分析
    report.memory_count, report.memory_with_evidence = analyze_memory(relic_dir)

    # 交互分析
    report.interaction_scenes = analyze_interaction(relic_dir)

    # manifest 检查
    report.manifest_valid = analyze_manifest(relic_dir)
    if not report.manifest_valid and "manifest.json" in report.files_found:
        report.issues.append("manifest.json 格式不正确或缺少必要字段")

    return report


# ---------------------------------------------------------------------------
# 输出
# ---------------------------------------------------------------------------

def print_report(report: RelicReport, verbose: bool = False) -> None:
    """打印评估报告。"""
    print(f"\n{'=' * 50}")
    print(f"  Relic 质量评估: {report.slug}")
    print(f"{'=' * 50}\n")

    # 综合评分
    print(f"  综合评分: {report.total_score} / 100")
    print(f"  等级: {report.grade}\n")

    # 分项
    print(f"  文件完整度: {report.file_score:.0f}%  ({len(report.files_found)}/5 个文件)")
    print(f"  四维覆盖度: {report.dimension_score:.0f} 分")
    print(f"  记忆质量:   {report.memory_score:.0f} 分  ({report.memory_count} 段记忆, {report.memory_with_evidence} 段有证据)")
    interaction_s = min(100.0, report.interaction_scenes / 5 * 100)
    print(f"  交互丰富度: {interaction_s:.0f} 分  ({report.interaction_scenes} 个场景)")

    # 四维详情
    if report.dimensions:
        print(f"\n  {'─' * 46}")
        print(f"  四维详情:")
        for d in report.dimensions:
            status = "✅" if d.score >= 70 else "⚠️" if d.score >= 40 else "❌"
            print(f"    {status} {d.name}: {d.score:.0f} 分  "
                  f"({d.word_count} 字, {d.evidence_total} 条证据)")
            if verbose and d.issues:
                for issue in d.issues:
                    print(f"       └─ {issue}")

    # 问题
    if report.issues:
        print(f"\n  {'─' * 46}")
        print(f"  发现的问题:")
        for issue in report.issues:
            print(f"    ⚠️  {issue}")

    # 建议
    print(f"\n  {'─' * 46}")
    print(f"  改进建议:")
    suggestions = []
    if report.files_missing:
        suggestions.append(f"补充缺失文件: {', '.join(report.files_missing)}")
    for d in report.dimensions:
        if d.score < 40:
            suggestions.append(f"补充 {d.name} 维度的素材（当前证据不足）")
        elif d.evidence_verbatim == 0:
            suggestions.append(f"为 {d.name} 维度补充原话（verbatim）证据")
    if report.memory_count < 5:
        suggestions.append("补充更多记忆片段（建议 8 段以上）")
    if report.interaction_scenes < 3:
        suggestions.append("补充更多交互场景（建议 5 个以上）")

    if suggestions:
        for s in suggestions:
            print(f"    → {s}")
    else:
        print(f"    ✅ 暂无明显短板，Relic 质量不错！")

    print()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _ensure_utf8_output() -> None:
    """Windows 控制台默认 cp936，直接 print 中文会 UnicodeEncodeError 崩掉脚本。"""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

def main() -> None:
    # 确保 Windows 终端下 stdout / stderr 都使用 UTF-8
    _ensure_utf8_output()
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(
        description="relic.skill 质量评估器 — 检查 Relic 的四维覆盖度、证据分布和内容具体性",
    )
    parser.add_argument(
        "--relic",
        type=str,
        required=True,
        help="Relic 目录路径，例如 examples/grandma-demo",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="显示详细的维度问题",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="以 JSON 格式输出结果",
    )

    args = parser.parse_args()
    relic_path = Path(args.relic)

    if not relic_path.is_dir():
        print(f"错误: 目录不存在 — {relic_path}", file=sys.stderr)
        sys.exit(1)

    report = evaluate(relic_path)

    if args.json:
        output = {
            "slug": report.slug,
            "total_score": report.total_score,
            "grade": report.grade,
            "file_score": report.file_score,
            "dimension_score": report.dimension_score,
            "memory_score": report.memory_score,
            "interaction_scenes": report.interaction_scenes,
            "files_found": report.files_found,
            "files_missing": report.files_missing,
            "dimensions": [
                {
                    "name": d.name,
                    "score": d.score,
                    "word_count": d.word_count,
                    "evidence": {
                        "verbatim": d.evidence_verbatim,
                        "artifact": d.evidence_artifact,
                        "impression": d.evidence_impression,
                    },
                    "issues": d.issues,
                }
                for d in report.dimensions
            ],
            "issues": report.issues,
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        print_report(report, verbose=args.verbose)


if __name__ == "__main__":
    main()
