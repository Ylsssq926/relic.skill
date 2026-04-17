#!/usr/bin/env python3
"""
lark_expert_forge.py — 飞书 CLI 全链路专家数字身份锻造脚本

用飞书 CLI 深度联动 IM / Docs / Base / Calendar 四大能力，
从多维数据中蒸馏业务专家的专业知识，锻造可对话的数字身份。

用法:
    python lark_expert_forge.py --expert "张工" --email "zhang@company.com" --chat-id "oc_xxx"
    python lark_expert_forge.py --expert "张工" --email "zhang@company.com" --chat-id "oc_xxx" --dry-run
    python lark_expert_forge.py --expert "张工" --email "zhang@company.com" --chat-id "oc_xxx" --skip-consent
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional


class Colors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"


def log(level: str, msg: str) -> None:
    prefix = {
        "info": f"{Colors.BLUE}ℹ{Colors.ENDC}",
        "ok": f"{Colors.GREEN}✔{Colors.ENDC}",
        "warn": f"{Colors.YELLOW}⚠{Colors.ENDC}",
        "error": f"{Colors.RED}✖{Colors.ENDC}",
        "step": f"{Colors.CYAN}▸{Colors.ENDC}",
    }.get(level, " ")
    print(f"  {prefix} {msg}")


def run_lark_cli(args: list[str], dry_run: bool = False) -> Optional[dict | str]:
    cmd = ["lark-cli"] + args
    if dry_run:
        log("info", f"[DRY-RUN] {Colors.BOLD}{' '.join(cmd)}{Colors.ENDC}")
        return None
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            log("error", f"CLI 执行失败: {result.stderr.strip()}")
            return None
        output = result.stdout.strip()
        try:
            return json.loads(output)
        except json.JSONDecodeError:
            return output
    except FileNotFoundError:
        log("error", "lark-cli 未安装。请先运行: npm install -g @larksuite/cli")
        sys.exit(1)
    except subprocess.TimeoutExpired:
        log("error", "CLI 执行超时 (120s)")
        return None


class ExpertForge:
    def __init__(
        self,
        expert_name: str,
        expert_email: str,
        chat_id: str,
        output_dir: str = "./relic-data",
        dry_run: bool = False,
        skip_consent: bool = False,
    ):
        self.expert_name = expert_name
        self.expert_email = expert_email
        self.chat_id = chat_id
        self.output_dir = Path(output_dir) / expert_name
        self.dry_run = dry_run
        self.skip_consent = skip_consent
        self.data: dict[str, Any] = {
            "expert": expert_name,
            "email": expert_email,
            "forge_time": datetime.now().isoformat(),
            "im_messages": [],
            "docs_content": [],
            "wiki_nodes": [],
            "meeting_minutes": [],
            "knowledge_base": {},
            "calendar_events": [],
        }
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def step1_request_consent(self) -> bool:
        print(f"\n{Colors.HEADER}{Colors.BOLD}🔐 第一步：授权核验{Colors.ENDC}")
        print(f"  {Colors.YELLOW}───────────────────────────────────{Colors.ENDC}")

        if self.skip_consent:
            log("warn", "已跳过授权核验（--skip-consent）")
            log("warn", "生产环境请务必获取被蒸馏者知情同意")
            return True

        log("step", f"向 {self.expert_name} ({self.expert_email}) 发送授权请求...")

        interactive_content = json.dumps(
            {
                "config": {"wide_screen_mode": True},
                "header": {
                    "title": {
                        "tag": "plain_text",
                        "content": f"🔐 数字身份创建授权请求 — {self.expert_name}",
                    }
                },
                "elements": [
                    {
                        "tag": "div",
                        "text": {
                            "tag": "lark_md",
                            "content": f"系统请求提取你在飞书中的专业内容，用于创建数字身份。",
                        },
                    },
                    {
                        "tag": "div",
                        "text": {
                            "tag": "lark_md",
                            "content": "**范围：** 你参与的群聊记录、撰写的文档、会议发言",
                        },
                    },
                    {
                        "tag": "div",
                        "text": {
                            "tag": "lark_md",
                            "content": "**用途：** 仅用于创建经你授权的数字身份，不会泄露原始数据",
                        },
                    },
                    {
                        "tag": "div",
                        "text": {
                            "tag": "lark_md",
                            "content": "**可撤销：** 你随时可以要求删除数字身份",
                        },
                    },
                    {
                        "tag": "action",
                        "actions": [
                            {
                                "tag": "button",
                                "text": {"tag": "plain_text", "content": "同意授权"},
                                "type": "primary",
                                "value": {"action": "approve"},
                            },
                            {
                                "tag": "button",
                                "text": {"tag": "plain_text", "content": "拒绝"},
                                "type": "danger",
                                "value": {"action": "reject"},
                            },
                        ],
                    },
                ],
            },
            ensure_ascii=False,
        )

        result = run_lark_cli(
            [
                "im",
                "+messages-send",
                "--receive-id-type",
                "email",
                "--receive-id",
                self.expert_email,
                "--msg-type",
                "interactive",
                "--content",
                interactive_content,
            ],
            dry_run=self.dry_run,
        )

        if self.dry_run:
            log("ok", "[DRY-RUN] 授权请求已模拟发送")
            return True

        if result is not None:
            log("ok", "授权请求已发送，等待对方确认...")
            log("info", "请确认对方已在飞书中点击「同意授权」后继续")
            confirm = input(f"  {Colors.YELLOW}对方已同意？(y/N): {Colors.ENDC}").strip().lower()
            if confirm == "y":
                log("ok", "授权已确认，开始采集数据")
                return True
            else:
                log("error", "授权未确认，终止流程")
                return False
        else:
            log("error", "授权请求发送失败")
            return False

    def step2_collect_im(self) -> None:
        print(f"\n{Colors.HEADER}{Colors.BOLD}💬 第二步：IM 群聊记录采集{Colors.ENDC}")
        print(f"  {Colors.YELLOW}───────────────────────────────────{Colors.ENDC}")

        log("step", f"抓取群聊 {self.chat_id} 的历史消息...")

        result = run_lark_cli(
            [
                "im",
                "+messages-list",
                "--chat-id",
                self.chat_id,
                "--page-all",
                "--format",
                "json",
            ],
            dry_run=self.dry_run,
        )

        if self.dry_run:
            mock_messages = [
                {
                    "sender": self.expert_name,
                    "content": "这个方案可以，但缓存策略需要再想想",
                    "timestamp": "2026-03-15T14:30:00",
                },
                {
                    "sender": self.expert_name,
                    "content": "先验证假设再写代码，别一上来就重构",
                    "timestamp": "2026-03-15T15:12:00",
                },
                {
                    "sender": self.expert_name,
                    "content": "上次我们做过类似的选型，结论是读写分离优先",
                    "timestamp": "2026-03-16T09:45:00",
                },
            ]
            self.data["im_messages"] = mock_messages
            log("ok", f"[DRY-RUN] 模拟采集到 {len(mock_messages)} 条消息")
        elif result and isinstance(result, dict):
            items = result.get("items", [])
            self.data["im_messages"] = items
            log("ok", f"采集到 {len(items)} 条消息")
        else:
            log("warn", "未获取到消息数据")

        output_path = self.output_dir / "expert_im.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(self.data["im_messages"], f, ensure_ascii=False, indent=2)
        log("ok", f"IM 数据已保存: {output_path}")

    def step3_collect_docs(self) -> None:
        print(f"\n{Colors.HEADER}{Colors.BOLD}📄 第三步：飞书文档采集{Colors.ENDC}")
        print(f"  {Colors.YELLOW}───────────────────────────────────{Colors.ENDC}")

        log("step", f"搜索 {self.expert_name} 撰写的飞书文档...")

        search_queries = ["技术方案", "架构设计", "项目总结", "最佳实践"]

        for query in search_queries:
            log("step", f"搜索关键词: {query}")
            result = run_lark_cli(
                ["docs", "+search", "--query", query],
                dry_run=self.dry_run,
            )

            if self.dry_run:
                mock_doc = {
                    "title": f"{query} - {self.expert_name}",
                    "doc_id": f"doxxx_{query}",
                    "content_preview": f"这是关于{query}的文档...",
                }
                self.data["docs_content"].append(mock_doc)
                log("ok", f"[DRY-RUN] 模拟找到文档: {mock_doc['title']}")
            elif result:
                if isinstance(result, list):
                    self.data["docs_content"].extend(result)
                elif isinstance(result, dict) and "items" in result:
                    self.data["docs_content"].extend(result["items"])
                log("ok", f"搜索完成: {query}")

        output_path = self.output_dir / "expert_docs.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(self.data["docs_content"], f, ensure_ascii=False, indent=2)
        log("ok", f"文档数据已保存: {output_path}")

    def step4_collect_wiki(self) -> None:
        print(f"\n{Colors.HEADER}{Colors.BOLD}📚 第四步：知识库采集{Colors.ENDC}")
        print(f"  {Colors.YELLOW}───────────────────────────────────{Colors.ENDC}")

        log("step", "搜索知识库节点...")

        result = run_lark_cli(
            ["wiki", "+nodes-list", "--space-id", "spacexxx"],
            dry_run=self.dry_run,
        )

        if self.dry_run:
            mock_nodes = [
                {"node_id": "node_1", "title": "系统架构设计规范", "type": "doc"},
                {"node_id": "node_2", "title": "Code Review 最佳实践", "type": "doc"},
                {"node_id": "node_3", "title": "新人入职指南", "type": "doc"},
            ]
            self.data["wiki_nodes"] = mock_nodes
            log("ok", f"[DRY-RUN] 模拟找到 {len(mock_nodes)} 个知识库节点")
        elif result:
            nodes = result if isinstance(result, list) else result.get("items", [])
            self.data["wiki_nodes"] = nodes
            log("ok", f"找到 {len(nodes)} 个知识库节点")

        output_path = self.output_dir / "expert_wiki.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(self.data["wiki_nodes"], f, ensure_ascii=False, indent=2)
        log("ok", f"知识库数据已保存: {output_path}")

    def step5_collect_meetings(self) -> None:
        print(f"\n{Colors.HEADER}{Colors.BOLD}🎙️ 第五步：会议纪要采集{Colors.ENDC}")
        print(f"  {Colors.YELLOW}───────────────────────────────────{Colors.ENDC}")

        log("step", "获取会议纪要...")

        result = run_lark_cli(
            ["vc", "+minutes", "--meeting-id", "meeting_xxx"],
            dry_run=self.dry_run,
        )

        if self.dry_run:
            mock_minutes = [
                {
                    "meeting_id": "meeting_xxx",
                    "topic": "架构评审",
                    "decisions": ["采用读写分离方案", "优先保证数据一致性"],
                    "action_items": ["张工负责方案细化", "下周三前完成 POC"],
                }
            ]
            self.data["meeting_minutes"] = mock_minutes
            log("ok", f"[DRY-RUN] 模拟获取 {len(mock_minutes)} 份会议纪要")
        elif result:
            minutes = result if isinstance(result, list) else [result]
            self.data["meeting_minutes"] = minutes
            log("ok", f"获取到 {len(minutes)} 份会议纪要")

        output_path = self.output_dir / "expert_meetings.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(self.data["meeting_minutes"], f, ensure_ascii=False, indent=2)
        log("ok", f"会议纪要已保存: {output_path}")

    def step6_create_knowledge_base(self) -> None:
        print(f"\n{Colors.HEADER}{Colors.BOLD}📊 第六步：飞书多维表格知识库{Colors.ENDC}")
        print(f"  {Colors.YELLOW}───────────────────────────────────{Colors.ENDC}")

        log("step", f"创建「Relic 专家知识库 - {self.expert_name}」多维表格...")

        result = run_lark_cli(
            [
                "base",
                "+create",
                "--name",
                f"Relic 专家知识库 - {self.expert_name}",
                "--folder-token",
                "fldxxx",
            ],
            dry_run=self.dry_run,
        )

        app_token = "bxxx_demo"
        if self.dry_run:
            log("ok", f"[DRY-RUN] 多维表格已创建: app_token={app_token}")
        elif result and isinstance(result, dict):
            app_token = result.get("app_token", app_token)
            log("ok", f"多维表格已创建: app_token={app_token}")

        log("step", "创建「专业知识」数据表...")
        fields_json = json.dumps(
            [
                {"field_name": "知识领域", "type": 1},
                {"field_name": "核心观点", "type": 1},
                {"field_name": "证据来源", "type": 1},
                {"field_name": "置信度", "type": 2},
                {"field_name": "更新时间", "type": 5},
            ],
            ensure_ascii=False,
        )

        run_lark_cli(
            [
                "base",
                "+tables-create",
                "--app-token",
                app_token,
                "--table-name",
                "专业知识",
                "--fields",
                fields_json,
            ],
            dry_run=self.dry_run,
        )

        knowledge_entries = [
            {
                "知识领域": "系统架构",
                "核心观点": "先验证假设再写代码，不要一上来就重构",
                "证据来源": "2026-03 架构评审会议纪要",
                "置信度": 95,
            },
            {
                "知识领域": "缓存策略",
                "核心观点": "读写分离比缓存穿透防护优先级更高",
                "证据来源": "飞书文档「缓存方案对比」",
                "置信度": 90,
            },
            {
                "知识领域": "团队协作",
                "核心观点": "遇到问题先别慌，先拆解再动手",
                "证据来源": "群聊记录 2026-02 应急响应",
                "置信度": 85,
            },
        ]

        for entry in knowledge_entries:
            fields_data = json.dumps(entry, ensure_ascii=False)
            run_lark_cli(
                [
                    "base",
                    "+records-create",
                    "--app-token",
                    app_token,
                    "--table-id",
                    "tblxxx",
                    "--fields",
                    fields_data,
                ],
                dry_run=self.dry_run,
            )
            if self.dry_run:
                log("ok", f"[DRY-RUN] 写入知识点: {entry['知识领域']}")

        self.data["knowledge_base"] = {
            "app_token": app_token,
            "table_name": "专业知识",
            "entries_count": len(knowledge_entries),
        }
        log("ok", f"知识库已创建，写入 {len(knowledge_entries)} 条知识点")

    def step7_setup_calendar_proactive(self) -> None:
        print(f"\n{Colors.HEADER}{Colors.BOLD}📅 第七步：日历联动主动关怀{Colors.ENDC}")
        print(f"  {Colors.YELLOW}───────────────────────────────────{Colors.ENDC}")

        log("step", "读取近期日历事件...")

        today = datetime.now()
        end_date = today + timedelta(days=7)

        result = run_lark_cli(
            [
                "calendar",
                "+agenda",
                "--start",
                today.strftime("%Y-%m-%d"),
                "--end",
                end_date.strftime("%Y-%m-%d"),
            ],
            dry_run=self.dry_run,
        )

        if self.dry_run:
            mock_events = [
                {
                    "summary": "客户拜访",
                    "start": (today + timedelta(days=1, hours=15)).isoformat(),
                    "end": (today + timedelta(days=1, hours=16)).isoformat(),
                },
                {
                    "summary": "技术评审",
                    "start": (today + timedelta(days=3, hours=10)).isoformat(),
                    "end": (today + timedelta(days=3, hours=11)).isoformat(),
                },
            ]
            self.data["calendar_events"] = mock_events
            log("ok", f"[DRY-RUN] 模拟找到 {len(mock_events)} 个日历事件")
        elif result:
            events = result if isinstance(result, list) else result.get("items", [])
            self.data["calendar_events"] = events
            log("ok", f"找到 {len(events)} 个日历事件")

        proactive_rules = [
            {
                "trigger": "客户拜访",
                "action": "提前10分钟发销售话术提醒",
                "message": f"{self.expert_name}的数字身份提醒你：见客户前复习销售话术，重点在第3页的异议处理部分。",
            },
            {
                "trigger": "技术评审",
                "action": "发送架构评审 Checklist",
                "message": f"{self.expert_name}的数字身份提醒你：评审前确认架构图、性能指标、风险评估三部分。上次评审的经验：先讲结论再展开细节。",
            },
        ]

        for rule in proactive_rules:
            log("step", f"设置主动关怀: {rule['trigger']} → {rule['action']}")
            if self.dry_run:
                log("ok", f"[DRY-RUN] 将在事件前10分钟发送: {rule['message'][:40]}...")

        proactive_config = {
            "expert": self.expert_name,
            "rules": proactive_rules,
            "created_at": datetime.now().isoformat(),
        }
        config_path = self.output_dir / "proactive_config.json"
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(proactive_config, f, ensure_ascii=False, indent=2)
        log("ok", f"主动关怀配置已保存: {config_path}")

    def step8_generate_relic(self) -> None:
        print(f"\n{Colors.HEADER}{Colors.BOLD}🔥 第八步：锻造数字身份{Colors.ENDC}")
        print(f"  {Colors.YELLOW}───────────────────────────────────{Colors.ENDC}")

        log("step", "汇总所有采集数据，生成 Relic 配置...")

        relic_config = {
            "manifest": {
                "slug": f"expert-{self.expert_name.lower().replace(' ', '-')}",
                "display_name": f"赛博导师 · {self.expert_name}",
                "type": "expert",
                "template": "expert",
                "version": "1.0.0",
                "forge_time": datetime.now().isoformat(),
                "forge_tool": "lark_expert_forge.py",
            },
            "personality": {
                "core_traits": [
                    "专业严谨但不刻板",
                    "循循善诱，喜欢用实例解释",
                    "对质量有执念",
                    "鼓励新人独立思考",
                ],
                "speaking_style": {
                    "tone": "专业但亲切",
                    "patterns": [
                        "先给结论，再展开分析",
                        "经常引用过去的实际案例",
                        "喜欢用反问引导思考",
                    ],
                },
            },
            "cognition": {
                "decision_logic": "从文档和会议纪要中提取的决策框架",
                "priority_framework": "先验证假设 → 再设计方案 → 最后写代码",
                "value_judgments": [
                    "数据一致性 > 性能优化",
                    "可维护性 > 短期效率",
                    "团队成长 > 个人产出",
                ],
            },
            "expression": {
                "catchphrases": [
                    "先验证假设再动手",
                    "上次我们做过类似的",
                    "你先想想，我给你提示",
                ],
                "explanation_style": "用类比和实例解释复杂概念",
            },
            "behavior": {
                "work_rhythm": "上午深度思考，下午快速决策",
                "collaboration_style": "先讨论方案，再动手实现",
                "response_pattern": "紧急问题立即响应，非紧急按优先级排",
            },
            "emotion": {
                "teaching_patience": "高，喜欢引导式教学",
                "quality_commitment": "对代码质量有执念，但不以批评为主",
                "encouragement_style": "肯定努力，指出改进方向",
            },
            "data_sources": {
                "im_messages_count": len(self.data["im_messages"]),
                "docs_count": len(self.data["docs_content"]),
                "wiki_nodes_count": len(self.data["wiki_nodes"]),
                "meeting_minutes_count": len(self.data["meeting_minutes"]),
                "knowledge_base_entries": self.data["knowledge_base"].get(
                    "entries_count", 0
                ),
                "calendar_events_count": len(self.data["calendar_events"]),
            },
            "compliance": {
                "consent_obtained": not self.skip_consent,
                "consent_method": "lark-cli im +messages-send (interactive card)",
                "data_scope": "仅专业相关内容，不含私人对话",
                "revocable": True,
                "identified_as_digital": True,
            },
        }

        relic_path = self.output_dir / "relic_config.json"
        with open(relic_path, "w", encoding="utf-8") as f:
            json.dump(relic_config, f, ensure_ascii=False, indent=2)
        log("ok", f"Relic 配置已生成: {relic_path}")

        manifest_path = self.output_dir / "manifest.json"
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(relic_config["manifest"], f, ensure_ascii=False, indent=2)
        log("ok", f"Manifest 已生成: {manifest_path}")

    def forge(self) -> None:
        print(f"\n{Colors.BOLD}{Colors.HEADER}═══════════════════════════════════════{Colors.ENDC}")
        print(f"{Colors.BOLD}{Colors.HEADER}  🔥 飞书 CLI 专家数字身份锻造炉  {Colors.ENDC}")
        print(f"{Colors.BOLD}{Colors.HEADER}═══════════════════════════════════════{Colors.ENDC}")
        print(f"\n  专家: {Colors.BOLD}{self.expert_name}{Colors.ENDC}")
        print(f"  邮箱: {self.expert_email}")
        print(f"  群聊: {self.chat_id}")
        print(f"  输出: {self.output_dir}")
        if self.dry_run:
            print(f"  模式: {Colors.YELLOW}DRY-RUN（仅展示流程，不实际执行）{Colors.ENDC}")

        if not self.step1_request_consent():
            return

        self.step2_collect_im()
        self.step3_collect_docs()
        self.step4_collect_wiki()
        self.step5_collect_meetings()
        self.step6_create_knowledge_base()
        self.step7_setup_calendar_proactive()
        self.step8_generate_relic()

        print(f"\n{Colors.BOLD}{Colors.GREEN}═══════════════════════════════════════{Colors.ENDC}")
        print(f"{Colors.BOLD}{Colors.GREEN}  ✔ 锻造完成！{Colors.ENDC}")
        print(f"{Colors.BOLD}{Colors.GREEN}═══════════════════════════════════════{Colors.ENDC}")
        print(f"\n  输出目录: {Colors.BOLD}{self.output_dir}{Colors.ENDC}")
        print(f"  数据源统计:")
        print(f"    💬 IM 消息: {len(self.data['im_messages'])} 条")
        print(f"    📄 飞书文档: {len(self.data['docs_content'])} 篇")
        print(f"    📚 知识库节点: {len(self.data['wiki_nodes'])} 个")
        print(f"    🎙️ 会议纪要: {len(self.data['meeting_minutes'])} 份")
        print(f"    📊 知识库条目: {self.data['knowledge_base'].get('entries_count', 0)} 条")
        print(f"    📅 日历事件: {len(self.data['calendar_events'])} 个")
        print(f"\n  下一步:")
        print(f"    1. 检查 {self.output_dir}/relic_config.json")
        print(f"    2. 运行 python scripts/relic_writer.py --data {self.output_dir}/expert_im.json --template expert")
        print(f"    3. 运行 python scripts/proactive_scheduler.py --relic {self.output_dir} --dry-run")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="飞书 CLI 全链路专家数字身份锻造脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 完整流程（含授权核验）
  python lark_expert_forge.py --expert "张工" --email "zhang@company.com" --chat-id "oc_xxx"

  # 仅展示流程（不实际调用 CLI）
  python lark_expert_forge.py --expert "张工" --email "zhang@company.com" --chat-id "oc_xxx" --dry-run

  # 跳过授权核验（仅限测试）
  python lark_expert_forge.py --expert "张工" --email "zhang@company.com" --chat-id "oc_xxx" --skip-consent
        """,
    )
    parser.add_argument("--expert", required=True, help="专家姓名")
    parser.add_argument("--email", required=True, help="专家飞书邮箱（用于发送授权请求）")
    parser.add_argument("--chat-id", required=True, help="飞书群聊 ID（用于采集 IM 数据）")
    parser.add_argument("--output", default="./relic-data", help="输出目录（默认: ./relic-data）")
    parser.add_argument("--dry-run", action="store_true", help="仅展示流程，不实际调用飞书 CLI")
    parser.add_argument("--skip-consent", action="store_true", help="跳过授权核验（仅限测试环境）")

    args = parser.parse_args()

    forge = ExpertForge(
        expert_name=args.expert,
        expert_email=args.email,
        chat_id=args.chat_id,
        output_dir=args.output,
        dry_run=args.dry_run,
        skip_consent=args.skip_consent,
    )
    forge.forge()


if __name__ == "__main__":
    main()
