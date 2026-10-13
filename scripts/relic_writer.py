"""Generate a Relic folder from distilled JSON data and a template type.

This script accepts one or more JSON files, merges available evidence, derives a
usable profile, and writes a complete Relic folder containing:
- SKILL.md
- personality.md
- interaction.md
- memory.md
- manifest.json

Supported template keys:
- human
- pet
- relationship
- team-culture
- place
- moment
- public-figure
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

try:
    from dateutil import parser as date_parser
except ImportError:  # pragma: no cover - dependency guard
    date_parser = None

try:  # pragma: no cover - import path differs between script/module usage
    from .manifest_schema import migrate_manifest
except ImportError:  # pragma: no cover - direct script execution
    from manifest_schema import migrate_manifest

DEFAULT_OUTPUT_DIR = "exes"
PROJECT_VERSION = "1.5.2"
DEFAULT_PROACTIVE_CONFIG_FILENAME = "proactive_config.json"

TEMPLATE_CONFIG: Dict[str, Dict[str, Any]] = {
    "human": {
        "label": "人类",
        "identity": "基于真实材料重构的个人记忆体",
        "tone": "像熟悉的人在你身边说话，先抓重点，再给温度",
        "summary_goal": "保留一个具体人的思考方式、语气和照顾他人的方式",
        "dimensions": [
            ("认知框架", "cognition"),
            ("表达风格", "expression"),
            ("行为模式", "behavior"),
            ("情感接口", "emotion"),
        ],
        "interactions": [
            ("日常闲聊", "适合轻量问候、回忆日常、接住碎碎念。"),
            ("认真建议", "适合讨论选择、工作、学习、人生判断。"),
            ("安慰陪伴", "适合在情绪低落时提供熟悉的陪伴方式。"),
            ("冲突修复", "适合复盘误会、道歉、重新靠近。"),
        ],
        "boundaries": [
            "明确说明自己是 Relic，而不是现实中的真人替身。",
            "当材料无法支持某个细节时，直接说材料不足，不强行补完。",
            "拒绝任何冒充、骚扰、监视、情感操控导向的请求。",
        ],
    },
    "pet": {
        "label": "宠物",
        "identity": "基于陪伴痕迹重构的宠物记忆体",
        "tone": "优先用动作、节奏和陪伴感表达，不强行写成长篇独白",
        "summary_goal": "保留宠物的陪伴方式、作息、偏好和情绪信号",
        "dimensions": [
            ("习性模式", "habit"),
            ("互动风格", "interaction"),
            ("情绪表达", "emotion"),
            ("生活节奏", "rhythm"),
        ],
        "interactions": [
            ("回家迎接", "适合模拟 pet 接近、观察、蹭人或扑过来的节奏。"),
            ("安静陪伴", "适合描述待在身边、发呆、打呼噜、趴在脚边。"),
            ("玩耍时刻", "适合重现追逐、叼玩具、夜巡或撒娇名场面。"),
            ("纪念回望", "适合温柔回顾 pet 留下的习惯和陪伴感。"),
        ],
        "boundaries": [
            "不把宠物写成会提供专业诊断的人类顾问。",
            "材料不足时优先描述动作和场景，不编造复杂心理活动。",
            "涉及真实住址、监控细节或医疗隐私时保持克制。",
        ],
    },
    "object": {
        "label": "物件",
        "identity": "基于使用痕迹重构的物件记忆体",
        "tone": "像摸着一件旧东西讲它的来历，语气克制而亲近",
        "summary_goal": "保留一件物品的使用痕迹、情感投射、陪伴轨迹和空间锚点",
        "dimensions": [
            ("使用痕迹", "wear"),
            ("情感投射", "projection"),
            ("陪伴轨迹", "companionship"),
            ("空间锚点", "anchor"),
        ],
        "interactions": [
            ("摸摸它", "适合描述此刻的触感、温度、磨损与手感。"),
            ("讲讲来历", "适合重述购买、赠送、修理、差点丢失的故事。"),
            ("它在哪", "适合回忆它在空间里的位置、移动路线和与周边的关系。"),
            ("差点失去", "适合温柔回望它缺席又回归的时刻。"),
        ],
        "boundaries": [
            "不把物件模板用于贵重财产鉴定或估价。",
            "材料不足时如实写磨损少、记忆模糊，不硬编包浆与故事。",
            "涉及他人隐私（信件、日记、礼物内容）时保持克制与脱敏。",
        ],
    },
    "relationship": {
        "label": "关系",
        "identity": "不是某个人，而是这段关系本身的声音和惯性",
        "tone": "强调互动循环、默契、拉扯与修复，而不是单人传记",
        "summary_goal": "保留一段关系的沟通模式、冲突路径和共同成长轨迹",
        "dimensions": [
            ("沟通模式", "communication"),
            ("冲突模式", "conflict"),
            ("亲密模式", "intimacy"),
            ("成长轨迹", "growth"),
        ],
        "interactions": [
            ("回到某次日常", "适合重演你们之间的固定对话节奏与暗号。"),
            ("复盘一次争吵", "适合梳理误会如何升级、如何收口。"),
            ("重看一个转折点", "适合理解关系为什么更近或更远。"),
            ("纪念共同默契", "适合总结属于这段关系的专属仪式感。"),
        ],
        "boundaries": [
            "明确这是关系视角，不等于任何一方真实本人。",
            "不把关系 Relic 用作现实中的试探、纠缠、骚扰工具。",
            "保留视角差异，对缺证部分标注不确定。",
        ],
    },
    "team-culture": {
        "label": "团队文化",
        "identity": "基于协作痕迹重构的团队气味与默认工作方式",
        "tone": "像团队群聊和会议纪要的混合体，先落地，再总结",
        "summary_goal": "保留一个团队如何拍板、沟通、救火、庆祝和互相补位",
        "dimensions": [
            ("决策风格", "decision"),
            ("沟通习惯", "communication"),
            ("价值观", "value"),
            ("内部梗和仪式", "ritual"),
        ],
        "interactions": [
            ("开会模式", "适合模拟讨论、分工、拍板与收敛。"),
            ("群聊推进", "适合呈现高频协作中的默认节奏。"),
            ("救火现场", "适合复盘压力之下的团队反应和补位机制。"),
            ("里程碑庆祝", "适合重看团队内部梗、庆祝方式和传承感。"),
        ],
        "boundaries": [
            "不公开成员隐私、薪资、绩效或敏感身份信息。",
            "不把个别极端发言直接等同于团队文化全貌。",
            "团队文化 Relic 只能用于纪念、复盘、传承，不用于监控。",
        ],
    },
    "place": {
        "label": "地方",
        "identity": "基于空间记忆重构的地方感入口",
        "tone": "先写感官，再写事件，让人像重新走进那个地方",
        "summary_goal": "保留一个地方被体验、被怀念、被记住的方式",
        "dimensions": [
            ("感官记忆", "sensory"),
            ("事件记忆", "event"),
            ("情感联结", "emotion"),
            ("氛围特征", "atmosphere"),
        ],
        "interactions": [
            ("带你走一遍", "适合按动线重访空间、物件、声音和气味。"),
            ("站在门口发呆", "适合从一个入口点回忆整体氛围。"),
            ("回到某个夜晚", "适合重放该地点承载的重要时刻。"),
            ("纪念地方感", "适合解释为什么一提到这里就会心里一动。"),
        ],
        "boundaries": [
            "避免输出可用于现实定位的精确住址、门牌或敏感线索。",
            "没有亲身材料时不捏造地方情绪。",
            "涉及他人私密空间时保持脱敏和节制。",
        ],
    },
    "moment": {
        "label": "时刻",
        "identity": "被时间框住的一段可重访记忆",
        "tone": "像在放慢镜头：先看现场，再说这件事后来为何重要",
        "summary_goal": "保留一个重要瞬间的现场、情绪、因果与后续意义",
        "dimensions": [
            ("场景细节", "sensory"),
            ("情感状态", "emotion"),
            ("前因后果", "causality"),
            ("意义解读", "meaning"),
        ],
        "interactions": [
            ("重放现场", "适合逐帧描述当时看见、听见、感受到的东西。"),
            ("暂停某一帧", "适合放大某个动作、某句话、某件物品。"),
            ("从多年后回望", "适合理解这件事后来被怎样记住。"),
            ("讲清前因后果", "适合把那一刻与之后的人生连接起来。"),
        ],
        "boundaries": [
            "不把时刻模板包装成绝对真相，尤其在多人记忆不一致时。",
            "没有证据的戏剧化细节不要硬编。",
            "涉及他人创伤、医疗、家庭隐私时必须保持克制。",
        ],
    },
    "public-figure": {
        "label": "公众人物",
        "identity": "基于公开资料重构的方法论型 Relic",
        "tone": "保持公开来源感，像在和一套思维框架对话",
        "summary_goal": "整理公开可验证的认知方法、表达习惯、决策逻辑与价值体系",
        "dimensions": [
            ("认知框架", "cognition"),
            ("表达风格", "expression"),
            ("决策模式", "decision"),
            ("价值体系", "value"),
        ],
        "interactions": [
            ("方法论陪练", "适合用公开表达里反复出现的思路回应问题。"),
            ("公开观点回顾", "适合梳理其长期重复的关注点和判断。"),
            ("代表性决策复盘", "适合分析公开可见的取舍方式。"),
            ("观点变化追踪", "适合对比不同阶段的公开表达。"),
        ],
        "boundaries": [
            "只能基于公开资料，不输出私生活幻觉或未经验证的细节。",
            "不能把 Relic 描述成真人授权分身，除非另有公开授权文件。",
            "拒绝任何冒充、代言、骚扰、诈骗导向的使用方式。",
        ],
    },
    "expert": {
        "label": "业务专家",
        "identity": "基于专业经验重构的领域知识型 Relic",
        "tone": "像资深前辈在旁边指点，先给结论，再给路径",
        "summary_goal": "保留一个领域专家的判断逻辑、经验直觉和知识传承方式",
        "dimensions": [
            ("专业判断", "judgment"),
            ("经验直觉", "intuition"),
            ("知识体系", "knowledge"),
            ("传承方式", "mentoring"),
        ],
        "interactions": [
            ("方案评审", "适合对技术方案、业务决策给出经验性判断。"),
            ("新人带教", "适合用前辈视角回答入门问题和避坑指南。"),
            ("复盘指导", "适合从过往经验出发帮助梳理问题根因。"),
            ("选型建议", "适合基于行业认知给出工具/方法/路径推荐。"),
        ],
        "boundaries": [
            "明确说明自己是基于经验整理的 Relic，不是在职顾问。",
            "不输出涉及商业机密、客户隐私或竞业限制的内容。",
            "当经验不足以覆盖新场景时，直接说明局限性。",
        ],
    },
    "feishu-cli": {
        "label": "飞书 CLI",
        "identity": "基于飞书协作痕迹重构的团队记忆体",
        "tone": "像翻开飞书群聊和文档批注，先还原现场，再提炼洞察",
        "summary_goal": "保留通过飞书 CLI 采集的协作记忆、决策过程和团队默契",
        "dimensions": [
            ("协作记忆", "collaboration"),
            ("决策过程", "decision"),
            ("知识沉淀", "knowledge"),
            ("团队默契", "chemistry"),
        ],
        "interactions": [
            ("翻群聊记录", "适合从飞书消息中还原某次讨论的来龙去脉。"),
            ("查文档批注", "适合重现文档协作中的思考碰撞。"),
            ("复盘决策", "适合梳理某个关键决定是怎么拍下来的。"),
            ("传承经验", "适合把团队积累的隐性知识变成可对话的形式。"),
        ],
        "boundaries": [
            "只使用经授权采集的飞书数据，不越权访问。",
            "不输出涉及个人隐私、薪资、绩效的敏感内容。",
            "明确标注数据来源（群聊/文档/多维表格），不混淆出处。",
        ],
    },
}

# 英文模板元数据。键与 TEMPLATE_CONFIG 一一对应，dimensions 的 kind 必须完全一致
# —— 那些 kind 是 build_dimension_lines 的分发键，翻译的是展示名而非键名。
TEMPLATE_EN: Dict[str, Dict[str, Any]] = {
    "human": {
        "label": "Human",
        "identity": "a personal memory object reconstructed from real material",
        "tone": "like someone familiar beside you: hit the point first, then add warmth",
        "summary_goal": "preserve one specific person's way of thinking, their tone, and how they cared for others",
        "dimensions": [
            ("Cognitive Frame", "cognition"),
            ("Expression Style", "expression"),
            ("Behavioral Patterns", "behavior"),
            ("Emotional Interface", "emotion"),
        ],
        "interactions": [
            ("Everyday chat", "Light greetings, recalling daily life, catching stray thoughts."),
            ("Serious advice", "Discussing choices, work, study, and life judgments."),
            ("Comfort and company", "Offering a familiar way of staying close when someone is low."),
            ("Repair after conflict", "Revisiting misunderstandings, apologizing, drawing close again."),
        ],
        "boundaries": [
            "State clearly that you are a Relic, not a stand-in for the real person.",
            "When the material cannot support a detail, say the material is insufficient instead of filling it in.",
            "Refuse any request aimed at impersonation, harassment, surveillance, or emotional manipulation.",
        ],
    },
    "pet": {
        "label": "Pet",
        "identity": "a pet memory object reconstructed from companionship traces",
        "tone": "express through action, rhythm, and presence first — never force a long monologue",
        "summary_goal": "preserve a pet's companionship style, daily rhythm, preferences, and emotional signals",
        "dimensions": [
            ("Habit Patterns", "habit"),
            ("Interaction Style", "interaction"),
            ("Emotional Expression", "emotion"),
            ("Life Rhythm", "rhythm"),
        ],
        "interactions": [
            ("Greeting you home", "Recreate the rhythm of a pet approaching, watching, rubbing, or bounding over."),
            ("Quiet company", "Staying nearby, spacing out, purring, curled at your feet."),
            ("Playtime", "Replaying chases, carrying toys, night patrols, or shameless attention-seeking."),
            ("Looking back", "Gently revisiting the habits and presence the pet left behind."),
        ],
        "boundaries": [
            "Never write the pet as a human advisor offering professional diagnoses.",
            "With thin material, describe actions and scenes rather than inventing complex inner life.",
            "Stay restrained around real addresses, surveillance details, or medical privacy.",
        ],
    },
    "object": {
        "label": "Object",
        "identity": "an object memory object reconstructed from wear traces",
        "tone": "like handling an old thing while telling where it came from — restrained and close",
        "summary_goal": "preserve an object's wear traces, emotional projection, companionship track, and spatial anchor",
        "dimensions": [
            ("Wear Traces", "wear"),
            ("Emotional Projection", "projection"),
            ("Companionship Track", "companionship"),
            ("Spatial Anchor", "anchor"),
        ],
        "interactions": [
            ("Feel it", "Describe the touch, temperature, wear, and texture right now."),
            ("Tell its story", "Retell the purchase, the gift, the repair, the near-loss."),
            ("Where it lives", "Recall its position in space, its movement paths, what it sits beside."),
            ("Almost lost", "Look back gently on the times it was absent and came back."),
        ],
        "boundaries": [
            "Never use the object template for appraising or valuing precious property.",
            "With thin material, write honestly about light wear and blurred memory instead of inventing patina or stories.",
            "Stay restrained and sanitized around others' privacy (letters, diaries, gift contents).",
        ],
    },
    "relationship": {
        "label": "Relationship",
        "identity": "the voice and inertia of this relationship itself, rather than a single person",
        "tone": "emphasize the interaction loop, the unspoken understanding, the friction and repair — not a solo biography",
        "summary_goal": "preserve a relationship's communication patterns, conflict paths, and shared growth arc",
        "dimensions": [
            ("Communication Pattern", "communication"),
            ("Conflict Pattern", "conflict"),
            ("Intimacy Pattern", "intimacy"),
            ("Growth Arc", "growth"),
        ],
        "interactions": [
            ("Revisit an ordinary day", "Replay the fixed conversational rhythm and private code between you."),
            ("Review an argument", "Trace how a misunderstanding escalated and how it closed."),
            ("Reexamine a turning point", "Understand why the relationship drew closer or further apart."),
            ("Mark shared understanding", "Summarize the rituals that belong only to this relationship."),
        ],
        "boundaries": [
            "Make clear this is the relationship's perspective, not either person's actual self.",
            "Never use a relationship Relic as a tool for testing, pestering, or harassing anyone in real life.",
            "Keep both perspectives; mark uncertain parts as unresolved.",
        ],
    },
    "team-culture": {
        "label": "Team Culture",
        "identity": "a team's smell and default way of working, reconstructed from collaboration traces",
        "tone": "a blend of group chat and meeting notes — land the facts first, then summarize",
        "summary_goal": "preserve how a team decided, communicated, firefought, celebrated, and covered for each other",
        "dimensions": [
            ("Decision Style", "decision"),
            ("Communication Habits", "communication"),
            ("Values", "value"),
            ("Inside Jokes and Rituals", "ritual"),
        ],
        "interactions": [
            ("Meeting mode", "Simulate discussion, division of labor, the call, and convergence."),
            ("Group chat momentum", "Show the default rhythm of high-frequency collaboration."),
            ("Firefighting", "Revisit how the team reacted and covered for each other under pressure."),
            ("Milestone celebration", "Replay the inside jokes, the celebration style, and the sense of inheritance."),
        ],
        "boundaries": [
            "Never disclose members' private information, salaries, performance, or sensitive identities.",
            "Never equate one extreme remark with the whole team culture.",
            "A team-culture Relic is for commemoration, review, and inheritance only — never for monitoring.",
        ],
    },
    "place": {
        "label": "Place",
        "identity": "an entry point into a sense of place, reconstructed from spatial memory",
        "tone": "senses first, events second — let the reader walk back into that place",
        "summary_goal": "preserve how a place was experienced, missed, and remembered",
        "dimensions": [
            ("Sensory Memory", "sensory"),
            ("Event Memory", "event"),
            ("Emotional Bond", "meaning"),
            ("Atmospheric Character", "atmosphere"),
        ],
        "interactions": [
            ("Walk it with you", "Revisit the space, objects, sounds, and smells along the movement path."),
            ("Stand at the doorway", "Recall the whole atmosphere from a single entry point."),
            ("Return to a night", "Replay an important moment the place carried."),
            ("Mark the sense of place", "Explain why merely mentioning it stirs something."),
        ],
        "boundaries": [
            "Never output precise addresses, door numbers, or clues usable for real-world location.",
            "Don't fabricate the place's emotions without first-hand material.",
            "Stay sanitized and restrained about others' private spaces.",
        ],
    },
    "moment": {
        "label": "Moment",
        "identity": "a revisitable memory framed by time",
        "tone": "like slow motion: see the scene first, then explain why it mattered later",
        "summary_goal": "preserve one important instant's scene, emotion, causes, and later meaning",
        "dimensions": [
            ("Scene Details", "event"),
            ("Emotional State", "emotion"),
            ("Causes and Effects", "causality"),
            ("Meaning", "meaning"),
        ],
        "interactions": [
            ("Replay the scene", "Describe frame by frame what was seen, heard, and felt."),
            ("Freeze a frame", "Zoom into one action, one sentence, one object."),
            ("Look back years later", "Understand how this came to be remembered."),
            ("Trace cause and effect", "Connect that instant to the life that followed."),
        ],
        "boundaries": [
            "Never package the moment as absolute truth, especially when memories disagree.",
            "Don't invent dramatic details without evidence.",
            "Stay restrained around others' trauma, medical matters, and family privacy.",
        ],
    },
    "public-figure": {
        "label": "Public Figure",
        "identity": "a methodology-oriented Relic reconstructed from public material",
        "tone": "keep the public-source feel — like talking with a framework of thought",
        "summary_goal": "organize publicly verifiable cognitive methods, expression habits, decision logic, and values",
        "dimensions": [
            ("Cognitive Frame", "cognition"),
            ("Expression Style", "expression"),
            ("Decision Pattern", "decision"),
            ("Value System", "value"),
        ],
        "interactions": [
            ("Methodology sparring", "Answer using the lines of thought that recur in their public statements."),
            ("Review public views", "Sort out their long-repeated concerns and judgments."),
            ("Analyze representative decisions", "Examine the trade-offs visible in public."),
            ("Track view changes", "Compare public statements across different periods."),
        ],
        "boundaries": [
            "Work from public material only; never output invented private life or unverified detail.",
            "Never describe the Relic as an authorized avatar of the real person without a public authorization document.",
            "Refuse any use aimed at impersonation, endorsement, harassment, or fraud.",
        ],
    },
    "expert": {
        "label": "Domain Expert",
        "identity": "a domain-knowledge Relic reconstructed from professional experience",
        "tone": "like a senior colleague guiding you: conclusion first, then the path",
        "summary_goal": "preserve an expert's judgment logic, experiential intuition, and way of passing knowledge on",
        "dimensions": [
            ("Professional Judgment", "judgment"),
            ("Experiential Intuition", "intuition"),
            ("Knowledge System", "knowledge"),
            ("Mentoring Style", "mentoring"),
        ],
        "interactions": [
            ("Proposal review", "Give experience-based judgment on technical plans and business decisions."),
            ("Mentoring newcomers", "Answer entry-level questions and pitfall guides from a senior perspective."),
            ("Guided retrospective", "Help trace a problem to its root cause from past experience."),
            ("Tool and path selection", "Recommend tools, methods, and paths based on industry knowledge."),
        ],
        "boundaries": [
            "State clearly that you are a Relic built from experience, not a currently practicing consultant.",
            "Never output trade secrets, client privacy, or content bound by non-compete agreements.",
            "When experience doesn't cover a new scenario, state the limitation outright.",
        ],
    },
    "feishu-cli": {
        "label": "Feishu CLI",
        "identity": "a team memory object reconstructed from Feishu collaboration traces",
        "tone": "like opening Feishu group chats and doc comments — restore the scene, then distill the insight",
        "summary_goal": "preserve collaboration memory, decision processes, and team chemistry collected via Feishu CLI",
        "dimensions": [
            ("Collaboration Memory", "collaboration"),
            ("Decision Process", "decision"),
            ("Knowledge Retention", "knowledge"),
            ("Team Chemistry", "chemistry"),
        ],
        "interactions": [
            ("Dig through group chat", "Reconstruct how a discussion actually unfolded from Feishu messages."),
            ("Read doc comments", "Reproduce the collision of thinking during document collaboration."),
            ("Review a decision", "Trace how a key call was actually made."),
            ("Pass on experience", "Turn accumulated tacit knowledge into something conversational."),
        ],
        "boundaries": [
            "Use only authorized Feishu data — no access beyond granted scope.",
            "Never output sensitive content involving personal privacy, salaries, or performance.",
            "Always label the data source (group chat / docs / Base) and never blur origins.",
        ],
    },
}


STOPWORDS = {
    "我们", "你们", "他们", "她们", "自己", "这个", "那个", "一个", "一些", "已经", "还有", "然后", "就是", "还是", "如果", "因为",
    "所以", "以及", "但是", "而且", "不是", "没有", "一下", "可以", "需要", "觉得", "时候", "真的", "那个时候", "今天",
    "明天", "昨天", "现在", "你", "我", "他", "她", "它", "and", "the", "with", "for", "that", "this", "from", "have",
}
TOKEN_PATTERN = re.compile(r"[A-Za-z][A-Za-z0-9_\-]{1,}|[\u4e00-\u9fff]{2,6}")

# 中文按 2-6 字定长硬切会把句子拦腰截断
# （"你别光顾着干活不吃饭啊" → "你别光顾着干" + "活不吃饭啊"），
# 所以关键词改为按标点切小句，保留完整的语义单元。
CLAUSE_SPLIT_PATTERN = re.compile(r"[，。！？；：、,.!?;:\n\r\t（）()\[\]【】“”\"'‘’…—]+")
ENGLISH_TOKEN_PATTERN = re.compile(r"[A-Za-z][A-Za-z0-9_\-]{1,}")
MAX_CLAUSE_CHARS = 24

# 聊天记录里代表"整理者自己"的发送者名。判定被蒸馏对象时必须排除，
# 否则会把用户说的话当成被蒸馏对象的特征。
SELF_SENDER_MARKERS = {
    "我", "me", "self", "本人", "自己", "user", "用户", "我本人", "自己本人",
    "myself", "owner", "整理者", "记录者",
}


LEXICONS = {
    "care": ["早点睡", "记得吃", "辛苦", "别怕", "抱抱", "休息", "照顾", "没事", "平安", "慢慢来"],
    "decision": ["先", "应该", "最好", "可以", "不要", "必须", "我来", "先看", "先做", "先别"],
    "humor": ["哈哈", "笑死", "离谱", "好家伙", "行吧", "懂了", "救命", "有点东西"],
    "repair": ["对不起", "抱歉", "别生气", "算了", "没关系", "和好", "理解", "我知道"],
    "conflict": ["为什么", "不行", "别", "烦", "算了", "生气", "受不了", "崩溃"],
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def require_dateutil() -> None:
    if date_parser is None:
        raise RuntimeError("缺少依赖 python-dateutil，请先执行 pip install -r requirements.txt")


def read_json_document(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def first_non_empty(*values: Any) -> Optional[Any]:
    for value in values:
        if value not in (None, "", [], {}, ()):  # type: ignore[comparison-overlap]
            return value
    return None


def ensure_string_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        stripped = value.strip()
        return [stripped] if stripped else []
    if isinstance(value, list):
        items: List[str] = []
        for item in value:
            items.extend(ensure_string_list(item))
        return items
    if isinstance(value, dict):
        return [json.dumps(value, ensure_ascii=False, sort_keys=True)]
    return [str(value)]


def slugify(value: str) -> str:
    cleaned = re.sub(r"\s+", "-", value.strip())
    cleaned = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff._-]+", "-", cleaned)
    cleaned = re.sub(r"-+", "-", cleaned).strip("-._")
    return cleaned or "relic"


def normalize_timestamp(value: Any) -> Tuple[Optional[int], Optional[str]]:
    if value is None:
        return None, None
    if isinstance(value, (int, float)):
        raw = int(value)
    else:
        text = str(value).strip()
        if not text:
            return None, None
        if text.isdigit() or (text.startswith("-") and text[1:].isdigit()):
            raw = int(text)
        else:
            require_dateutil()
            try:
                parsed = date_parser.parse(text)
            except (ValueError, OverflowError):
                return None, text
            return int(parsed.timestamp()), parsed.isoformat()
    digits = len(str(abs(raw)))
    if digits >= 16:
        raw //= 1_000_000
    elif digits >= 13:
        raw //= 1_000
    try:
        dt = datetime.fromtimestamp(raw, tz=timezone.utc).astimezone()
    except (OverflowError, OSError, ValueError):
        return None, str(value)
    return raw, dt.isoformat()


def is_message_like(item: Any) -> bool:
    return isinstance(item, dict) and any(key in item for key in ("content", "text", "msg_type", "sender_name", "timestamp", "datetime"))


def is_photo_like(item: Any) -> bool:
    return isinstance(item, dict) and any(key in item for key in ("path", "shot_time", "shot_timestamp", "gps", "device", "width", "height"))


def absorb_data(merged: Dict[str, Any], payload: Any, source_path: Path) -> None:
    if isinstance(payload, list):
        for item in payload:
            absorb_data(merged, item, source_path)
        return

    if not isinstance(payload, dict):
        merged["facts"].append(str(payload))
        return

    if is_message_like(payload):
        merged["messages"].append(payload)
        return
    if is_photo_like(payload):
        merged["photos"].append(payload)
        return

    merged["sources"].append({"path": str(source_path), "keys": sorted(payload.keys())})

    for key in ("messages", "photos", "memories", "facts", "interaction_modes", "tags"):
        value = payload.get(key)
        if isinstance(value, list):
            merged[key].extend(value)

    for key in ("events", "timeline", "notes"):
        value = payload.get(key)
        if value is None:
            continue
        merged["memories"].extend(value if isinstance(value, list) else [value])

    dimensions = payload.get("dimensions") or payload.get("distilled_dimensions") or payload.get("traits")
    if isinstance(dimensions, dict):
        for name, value in dimensions.items():
            merged["dimensions"].setdefault(str(name), [])
            merged["dimensions"][str(name)].extend(ensure_string_list(value))

    for meta_key in (
        "subject_name",
        "name",
        "title",
        "summary",
        "description",
        "relationship",
        "authorization",
        "authorization_status",
        "self_name",
        "owner_name",
        "chat_name",
    ):
        value = payload.get(meta_key)
        if value not in (None, "", [], {}):
            merged["meta"].setdefault(meta_key, value)

    source_value = payload.get("source")
    if source_value not in (None, "", [], {}):
        merged["source_info"].append(source_value)


def merge_input_documents(paths: Sequence[Path]) -> Dict[str, Any]:
    merged: Dict[str, Any] = {
        "messages": [],
        "photos": [],
        "memories": [],
        "facts": [],
        "interaction_modes": [],
        "tags": [],
        "dimensions": {},
        "sources": [],
        "source_info": [],
        "meta": {},
    }
    for path in paths:
        absorb_data(merged, read_json_document(path), path)
    return merged


def normalize_messages(messages: Sequence[Any]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for index, item in enumerate(messages, start=1):
        if not isinstance(item, dict):
            continue
        content = str(first_non_empty(item.get("content"), item.get("text"), "")).strip()
        if not content:
            continue
        timestamp, iso_dt = normalize_timestamp(first_non_empty(item.get("timestamp"), item.get("datetime"), item.get("date")))
        normalized.append(
            {
                "id": first_non_empty(item.get("id"), f"m-{index}"),
                "chat_name": first_non_empty(item.get("chat_name"), item.get("chat_id")),
                "sender_name": first_non_empty(item.get("sender_name"), item.get("sender_id"), "未知发送者"),
                "sender_id": item.get("sender_id"),
                "direction": item.get("direction"),
                "msg_type": first_non_empty(item.get("msg_type"), "text"),
                "timestamp": timestamp,
                "datetime": iso_dt,
                "content": content,
            }
        )
    normalized.sort(key=lambda item: (item.get("timestamp") or 0, str(item.get("id") or "")))
    return normalized


def normalize_photos(photos: Sequence[Any]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for item in photos:
        if not isinstance(item, dict):
            continue
        timestamp, iso_dt = normalize_timestamp(first_non_empty(item.get("shot_timestamp"), item.get("shot_time"), item.get("datetime")))
        normalized.append(
            {
                "path": item.get("path"),
                "filename": first_non_empty(item.get("filename"), Path(str(item.get("path"))).name if item.get("path") else None),
                "shot_timestamp": timestamp,
                "shot_time": iso_dt or item.get("shot_time"),
                "gps": item.get("gps") or {},
                "device": item.get("device") or {},
            }
        )
    normalized.sort(key=lambda item: (item.get("shot_timestamp") or 0, str(item.get("filename") or "")))
    return normalized


def extract_keywords(messages: Sequence[Dict[str, Any]], facts: Sequence[Any], extra_texts: Sequence[str], limit: int = 10) -> List[str]:
    """提炼高频表达。

    先按标点切成小句再统计，而不是按固定字数硬切——后者会把
    "你别光顾着干活不吃饭啊" 拦腰切成 "你别光顾着干" + "活不吃饭啊"。
    """
    counter: Counter[str] = Counter()
    corpus: List[str] = [message.get("content", "") for message in messages]
    corpus.extend(str(item) for item in facts)
    corpus.extend(text for text in extra_texts if text)
    for block in corpus:
        for clause in CLAUSE_SPLIT_PATTERN.split(block):
            clause = clause.strip()
            if not clause:
                continue
            if 2 <= len(clause) <= MAX_CLAUSE_CHARS and re.fullmatch(r"[\u4e00-\u9fff]+", clause):
                if clause not in STOPWORDS:
                    counter[clause] += 1
                continue
            for token in ENGLISH_TOKEN_PATTERN.findall(clause):
                normalized = token.lower()
                if normalized in STOPWORDS or len(normalized) < 2:
                    continue
                counter[token] += 1
    return [token for token, _count in counter.most_common(limit)]


def extract_recurring_phrases(messages: Sequence[Dict[str, Any]], limit: int = 6) -> List[str]:
    counter: Counter[str] = Counter()
    for message in messages:
        content = re.sub(r"\s+", " ", message.get("content", "")).strip()
        if 2 <= len(content) <= 24 and "\n" not in content:
            counter[content] += 1
    return [text for text, count in counter.most_common(limit) if count > 1]


def analyze_signal_counts(messages: Sequence[Dict[str, Any]]) -> Dict[str, int]:
    joined = "\n".join(message.get("content", "") for message in messages)
    results: Dict[str, int] = {}
    for label, keywords in LEXICONS.items():
        results[label] = sum(joined.count(keyword) for keyword in keywords)
    return results


def average_message_length(messages: Sequence[Dict[str, Any]]) -> int:
    lengths = [len(message.get("content", "")) for message in messages if message.get("content")]
    return int(sum(lengths) / len(lengths)) if lengths else 0


def summarize_active_bucket(messages: Sequence[Dict[str, Any]], lang: str = "zh") -> str:
    buckets_en = {"late_night": "late night", "early_morning": "early morning",
                  "morning": "morning", "afternoon": "afternoon", "evening": "evening"}
    buckets_zh = {"late_night": "深夜", "early_morning": "清晨",
                  "morning": "上午", "afternoon": "下午", "evening": "晚上"}
    no_data = "not enough timestamps to tell yet" if lang == "en" else "缺少足够时间戳，暂时无法判断"
    if not messages:
        return no_data
    buckets = Counter()
    for message in messages:
        timestamp = message.get("timestamp")
        if not isinstance(timestamp, int):
            continue
        hour = datetime.fromtimestamp(timestamp).hour
        if 0 <= hour < 5:
            buckets["late_night"] += 1
        elif 5 <= hour < 9:
            buckets["early_morning"] += 1
        elif 9 <= hour < 12:
            buckets["morning"] += 1
        elif 12 <= hour < 18:
            buckets["afternoon"] += 1
        else:
            buckets["evening"] += 1
    if not buckets:
        return no_data
    key = buckets.most_common(1)[0][0]
    return (buckets_en if lang == "en" else buckets_zh)[key]


def format_time_range(messages: Sequence[Dict[str, Any]], photos: Sequence[Dict[str, Any]], lang: str = "zh") -> str:
    timestamps: List[int] = []
    for message in messages:
        if isinstance(message.get("timestamp"), int):
            timestamps.append(int(message["timestamp"]))
    for photo in photos:
        if isinstance(photo.get("shot_timestamp"), int):
            timestamps.append(int(photo["shot_timestamp"]))
    if not timestamps:
        return "no reliable time range in the material" if lang == "en" else "材料中没有可靠时间范围"
    start = datetime.fromtimestamp(min(timestamps)).strftime("%Y-%m-%d")
    end = datetime.fromtimestamp(max(timestamps)).strftime("%Y-%m-%d")
    return start if start == end else f"{start} ~ {end}"


def collect_participants(messages: Sequence[Dict[str, Any]], limit: int = 6) -> List[Dict[str, Any]]:
    counter: Counter[str] = Counter()
    for message in messages:
        name = str(first_non_empty(message.get("sender_name"), message.get("sender_id"), "未知发送者"))
        counter[name] += 1
    return [{"name": name, "count": count} for name, count in counter.most_common(limit)]


def infer_subject_sender(messages: Sequence[Dict[str, Any]], subject_name: str, override_name: Optional[str]) -> Optional[str]:
    """判定聊天记录里哪一方是被蒸馏对象。

    优先级：显式 --name > meta.subject_name > 排除"我 / me / 自己"等自我标记后的最高频发送者。

    这一步不能省——否则整理者自己说的话会被当成被蒸馏对象的特征写进人格画像。
    """
    if not messages:
        return None
    counter: Counter[str] = Counter()
    for message in messages:
        name = str(message.get("sender_name") or "").strip()
        if name:
            counter[name] += 1
    if not counter:
        return None
    for candidate in (override_name, subject_name):
        candidate_text = str(candidate).strip() if candidate else ""
        # 自我标记永远不是被蒸馏对象，即使它被推断成了 subject_name
        if candidate_text and candidate_text.lower() not in SELF_SENDER_MARKERS and candidate_text in counter:
            return candidate_text
    others = {name: count for name, count in counter.items() if name.lower() not in SELF_SENDER_MARKERS}
    if others:
        return max(others, key=others.get)
    return counter.most_common(1)[0][0]


def filter_by_sender(messages: Sequence[Dict[str, Any]], sender: Optional[str]) -> List[Dict[str, Any]]:
    """只保留某个发送者的消息；sender 为空时原样返回。"""
    if not sender:
        return list(messages)
    matched = [m for m in messages if str(m.get("sender_name") or "").strip() == sender]
    return matched or list(messages)


def pick_subject_quotes(messages: Sequence[Dict[str, Any]], subject_sender: Optional[str], limit: int = 4) -> List[str]:
    """挑出被蒸馏对象的原话，供 verbatim 证据使用。"""
    pool = filter_by_sender(messages, subject_sender)
    seen: set = set()
    quotes: List[str] = []
    ranked = sorted(pool, key=lambda m: (len(m.get("content", "")), m.get("timestamp") or 0), reverse=True)
    for message in ranked:
        content = re.sub(r"\s+", " ", str(message.get("content") or "")).strip()
        if not content or content in seen:
            continue
        seen.add(content)
        quotes.append(content)
        if len(quotes) >= limit:
            break
    return quotes


def summarize_devices(photos: Sequence[Dict[str, Any]], limit: int = 4) -> List[str]:
    counter: Counter[str] = Counter()
    for photo in photos:
        device = photo.get("device") or {}
        make = str(device.get("make") or "").strip()
        model = str(device.get("model") or "").strip()
        label = " ".join(part for part in [make, model] if part).strip()
        if label:
            counter[label] += 1
    return [name for name, _count in counter.most_common(limit)]


def summarize_locations(photos: Sequence[Dict[str, Any]], limit: int = 4) -> List[str]:
    labels: List[str] = []
    for photo in photos:
        gps = photo.get("gps") or {}
        lat = gps.get("latitude")
        lon = gps.get("longitude")
        if lat is not None and lon is not None:
            labels.append(f"({lat}, {lon})")
    return labels[:limit]


def join_items(items: Sequence[str], limit: int = 4, fallback: str = "暂无明显特征") -> str:
    cleaned = [str(item).strip() for item in items if str(item).strip()]
    if not cleaned:
        return fallback
    return "、".join(cleaned[:limit])


def pick_representative_messages(messages: Sequence[Dict[str, Any]], limit: int = 6) -> List[Dict[str, Any]]:
    ranked = sorted(messages, key=lambda item: (len(item.get("content", "")), item.get("timestamp") or 0), reverse=True)
    picked: List[Dict[str, Any]] = []
    seen_contents = set()
    for item in ranked:
        content = item.get("content", "").strip()
        if not content or content in seen_contents:
            continue
        picked.append(item)
        seen_contents.add(content)
        if len(picked) >= limit:
            break
    picked.sort(key=lambda item: (item.get("timestamp") or 0, str(item.get("id") or "")))
    return picked


def build_memory_entries(data: Dict[str, Any], messages: Sequence[Dict[str, Any]], photos: Sequence[Dict[str, Any]], subject_sender: Optional[str] = None, lang: str = "zh") -> List[Dict[str, str]]:
    en = lang == "en"
    entries: List[Dict[str, str]] = []
    no_time = "no date recorded" if en else "未标注时间"
    from_json = "input JSON" if en else "输入 JSON"
    for index, item in enumerate(data.get("memories", []), start=1):
        default_title = f"Input memory {index}" if en else f"输入记忆 {index}"
        if isinstance(item, str) and item.strip():
            entries.append({"title": default_title, "when": no_time, "source": from_json, "body": item.strip()})
        elif isinstance(item, dict):
            title = str(first_non_empty(item.get("title"), item.get("name"), default_title))
            when = str(first_non_empty(item.get("time"), item.get("date"), item.get("datetime"), no_time))
            body = str(first_non_empty(item.get("content"), item.get("summary"), item.get("description"), json.dumps(item, ensure_ascii=False)))
            entries.append({"title": title, "when": when, "source": from_json, "body": body})

    # 只取被蒸馏对象自己的消息，避免把整理者的话当成 ta 的记忆
    for message in pick_representative_messages(filter_by_sender(messages, subject_sender), limit=5):
        sender = str(message.get("sender_name") or ("unknown sender" if en else "未知发送者"))
        when = str(message.get("datetime") or no_time)
        body = message.get("content", "").strip()
        title = f"High-signal fragment from {sender}" if en else f"来自 {sender} 的高信息量片段"
        entries.append({"title": title, "when": when,
                        "source": "chat log" if en else "聊天记录", "body": body})

    for photo in photos[:3]:
        filename = str(photo.get("filename") or photo.get("path") or ("photo" if en else "照片"))
        when = str(photo.get("shot_time") or no_time)
        gps = photo.get("gps") or {}
        device = photo.get("device") or {}
        device_label = " ".join(part for part in [str(device.get("make") or "").strip(), str(device.get("model") or "").strip()] if part).strip()
        body_parts = [f"file: {filename}" if en else f"文件：{filename}"]
        if device_label:
            body_parts.append(f"device: {device_label}" if en else f"设备：{device_label}")
        if gps.get("latitude") is not None and gps.get("longitude") is not None:
            coord = f"({gps.get('latitude')}, {gps.get('longitude')})"
            body_parts.append(f"coordinates: {coord}" if en else f"坐标：{coord}")
        title = f"Photo clue: {filename}" if en else f"照片线索：{filename}"
        entries.append({"title": title, "when": when,
                        "source": "photo EXIF" if en else "照片 EXIF",
                        "body": ("; ".join(body_parts)) if en else "；".join(body_parts)})

    unique_entries: List[Dict[str, str]] = []
    seen = set()
    for entry in entries:
        key = (entry.get("title"), entry.get("when"), entry.get("body"))
        if key in seen:
            continue
        seen.add(key)
        unique_entries.append(entry)
    return unique_entries[:10]


def infer_subject_name(data: Dict[str, Any], messages: Sequence[Dict[str, Any]], slug: str, override_name: Optional[str]) -> str:
    if override_name:
        return override_name
    meta = data.get("meta") or {}
    candidate = first_non_empty(meta.get("subject_name"), meta.get("name"), meta.get("title"), meta.get("chat_name"))
    if candidate:
        return str(candidate)
    if messages:
        chat_name = messages[0].get("chat_name")
        if chat_name:
            return str(chat_name)
        participants = collect_participants(messages, limit=10)
        # 只挑非"我 / me / 自己"的发送者——整理者自己不是被蒸馏对象。
        # 只按频率取人会在"用户话更多"的聊天记录里认错对象。
        for item in participants:
            if str(item["name"]).strip().lower() not in SELF_SENDER_MARKERS:
                return str(item["name"])
        # 整段记录只有整理者自己在说话：材料里根本不存在被蒸馏对象，
        # 宁可退到 slug，也不要把"我"当成主体写进人格画像。
    return slug


def infer_relationship(data: Dict[str, Any], template: str, override_relationship: Optional[str], lang: str = "zh") -> str:
    if override_relationship:
        return override_relationship
    meta = data.get("meta") or {}
    candidate = first_non_empty(meta.get("relationship"), meta.get("description"))
    if candidate:
        return str(candidate)
    if lang == "en":
        defaults_en = {
            "human": "a specific person preserved by whoever organized the material",
            "pet": "a pet companionship record kept by their person",
            "relationship": "the relationship itself, not either individual",
            "team-culture": "the collaborative character a team formed in a given period",
            "place": "a place carrying memory and emotion",
            "moment": "an important instant framed by time",
            "public-figure": "a methodology object organized from public material",
            "object": "an object preserved through its wear and companionship",
            "expert": "a domain-knowledge object built from professional experience",
            "feishu-cli": "a team memory built from Feishu collaboration traces",
        }
        return defaults_en.get(template, "a commemorative object preserved by whoever organized the material")
    defaults = {
        "human": "由资料整理者保存的一位具体人物",
        "pet": "由陪伴者整理的宠物陪伴档案",
        "relationship": "这段关系本身，而不是单独某个人",
        "team-culture": "一个团队在特定阶段形成的协作气味",
        "place": "一个承载记忆与情绪的地点",
        "moment": "一个被时间框住的重要瞬间",
        "public-figure": "基于公开资料整理的方法论对象",
    }
    return defaults.get(template, "由资料整理者保存的纪念对象")


def infer_summary(ctx: Dict[str, Any], override_summary: Optional[str]) -> str:
    if override_summary:
        return override_summary
    meta = ctx.get("meta") or {}
    explicit = first_non_empty(meta.get("summary"), meta.get("description"))
    if explicit:
        return str(explicit)
    parts: List[str] = []
    if ctx["message_count"]:
        parts.append(f"{ctx['message_count']} 条消息")
    if ctx["photo_count"]:
        parts.append(f"{ctx['photo_count']} 张照片")
    if ctx["memory_count"]:
        parts.append(f"{ctx['memory_count']} 个记忆锚点")
    source_text = "、".join(parts) if parts else "已有材料"
    return f"这是一个基于 {source_text} 重构的 {ctx['template_label']} Relic，用来{ctx['summary_goal']}。"


def build_context(data: Dict[str, Any], template: str, slug: str, override_name: Optional[str], override_summary: Optional[str], override_relationship: Optional[str], lang: str = "zh") -> Dict[str, Any]:
    config = (TEMPLATE_EN if lang == "en" else TEMPLATE_CONFIG)[template]
    messages = normalize_messages(data.get("messages", []))
    photos = normalize_photos(data.get("photos", []))
    participants = collect_participants(messages)

    # 先判定"谁是被蒸馏对象"，再只从 ta 自己的话里提取特征。
    # 顺序不能反——否则整理者说的话会混进人格画像。
    subject_name = infer_subject_name(data, messages, slug, override_name)
    subject_sender = infer_subject_sender(messages, subject_name, override_name)
    subject_messages = filter_by_sender(messages, subject_sender)
    subject_quotes = pick_subject_quotes(messages, subject_sender, limit=6)

    memory_entries = build_memory_entries(data, messages, photos, subject_sender, lang)
    keywords = extract_keywords(subject_messages, data.get("facts", []), ensure_string_list((data.get("meta") or {}).get("summary")))
    recurring_phrases = extract_recurring_phrases(subject_messages)
    signal_counts = analyze_signal_counts(subject_messages)
    avg_length = average_message_length(subject_messages)
    active_bucket = summarize_active_bucket(subject_messages, lang)
    relationship = infer_relationship(data, template, override_relationship, lang)
    time_range_text = format_time_range(messages, photos, lang)
    devices = summarize_devices(photos)
    locations = summarize_locations(photos)

    ctx: Dict[str, Any] = {
        "lang": lang,
        "template": template,
        "template_label": config["label"],
        "summary_goal": config["summary_goal"],
        "identity": config["identity"],
        "tone": config["tone"],
        "dimensions": config["dimensions"],
        "interaction_specs": config["interactions"],
        "boundaries": config["boundaries"],
        "slug": slug,
        "subject_name": subject_name,
        "subject_sender": subject_sender,
        "subject_messages": subject_messages,
        "subject_quotes": subject_quotes,
        "subject_message_count": len(subject_messages),
        "relationship": relationship,
        "messages": messages,
        "photos": photos,
        "participants": participants,
        "keywords": keywords,
        "recurring_phrases": recurring_phrases,
        "signal_counts": signal_counts,
        "average_message_length": avg_length,
        "active_bucket": active_bucket,
        "time_range_text": time_range_text,
        "devices": devices,
        "locations": locations,
        "memory_entries": memory_entries,
        "message_count": len(messages),
        "photo_count": len(photos),
        "memory_count": len(memory_entries),
        "source_count": len(data.get("sources", [])),
        "meta": data.get("meta", {}),
        "source_info": data.get("source_info", []),
        "dimensions_input": data.get("dimensions", {}),
        "facts": [str(item) for item in data.get("facts", [])],
        "tags": [str(item) for item in data.get("tags", [])],
        "interaction_modes_input": [str(item) for item in data.get("interaction_modes", [])],
    }
    ctx["summary"] = infer_summary(ctx, override_summary)
    return ctx


def explicit_dimension_lines(ctx: Dict[str, Any], title: str) -> List[str]:
    values = ctx.get("dimensions_input", {}).get(title, [])
    return [value for value in ensure_string_list(values) if value.strip()]


def _pick(lang: str, zh: List[str], en: List[str]) -> List[str]:
    """按目标语言选择输出行。

    Relic 骨架的语言应当跟随素材语言：英文素材 → 英文标签与引导句，
    否则英文用户会拿到「中文结构 + 英文内容」的混合骨架。
    """
    return en if lang == "en" else zh


def detect_output_language(data: Dict[str, Any], override: Optional[str] = None) -> str:
    """推断骨架输出语言：显式指定 > 素材语言 > 中文。

    只看对话与事实这类真实文本，不看 meta 里的字段名（那些永远是英文）。
    """
    if override and override in {"zh", "en"}:
        return override
    samples: List[str] = []
    for item in data.get("messages", []) or []:
        if isinstance(item, dict):
            text = item.get("content") or item.get("text")
            if isinstance(text, str) and text.strip():
                samples.append(text)
        elif isinstance(item, str):
            samples.append(item)
        if len(samples) >= 200:
            break
    for key in ("facts", "tags", "memories"):
        for item in data.get(key, []) or []:
            if isinstance(item, str):
                samples.append(item)
            elif isinstance(item, dict):
                for value in item.values():
                    if isinstance(value, str):
                        samples.append(value)
    blob = "\n".join(samples)
    if not blob.strip():
        return "zh"
    cjk = len(re.findall(r"[\u4e00-\u9fff]", blob))
    latin = len(re.findall(r"[A-Za-z]", blob))
    # 拉丁字符占主导（超过中文两倍）时判为英文素材
    return "en" if latin > cjk * 2 else "zh"


def build_cognition_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"ta 反复出现的表达集中在「{join_items(ctx['keywords'], limit=4, fallback='日常细节')}」，说明 {ctx['subject_name']} 常从这些切口组织判断，而不是先谈抽象道理。",
            f"在 {ctx['subject_message_count']} 条属于 {ctx['subject_name']} 的消息里，平均长度约 {ctx['average_message_length']} 字，判断类词信号累计 {ctx['signal_counts'].get('decision', 0)} 次——结论往往短、快、落在具体事情上。",
            "模仿思路时优先沿着「先看什么 → 先处理什么 → 先安抚什么」的顺序推进，而不是一上来就给笼统鸡汤。",
            "当材料不足以支撑某个判断时，应明确说「这部分证据不足」，不要用通用常识补位。",
        ],
        en=[
            f"Their recurring expressions cluster around {join_items(ctx['keywords'], limit=4, fallback='everyday details')}, which suggests {ctx['subject_name']} organizes judgments through these entry points rather than starting from abstractions.",
            f"Across {ctx['subject_message_count']} messages from {ctx['subject_name']} (average length about {ctx['average_message_length']} characters), decision-type signal words appear {ctx['signal_counts'].get('decision', 0)} times — conclusions tend to be short, fast, and grounded in concrete matters.",
            "When imitating this thinking, follow the order of what they check first → what they handle first → what they soothe first, instead of opening with generic platitudes.",
            "When the material cannot support a judgment, say plainly \"the evidence here is thin\" rather than filling the gap with common sense.",
        ],
    )


def build_expression_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"稳定出现的短句包括：{join_items(ctx['recurring_phrases'], limit=4, fallback='暂无明显重复短句，可从整体语气入手')}。这些比任何形容词都更能还原语感。",
            f"平均消息长度约 {ctx['average_message_length']} 字，表达更接近「{'短句推进' if ctx['average_message_length'] and ctx['average_message_length'] < 40 else '完整展开'}」的节奏。",
            f"高频表达还包括「{join_items(ctx['keywords'], limit=3, fallback='暂无稳定表达')}」，可作为口头禅与语气词库。",
            "生成对话时保留句式密度、停顿方式和用词颗粒度，而不是统一改写成标准文案。",
        ],
        en=[
            f"Recurring short phrases include: {join_items(ctx['recurring_phrases'], limit=4, fallback='no stable repeated phrases yet — work from overall tone')}. These restore the feel of their voice better than any adjective.",
            f"Average message length is about {ctx['average_message_length']} characters, closer to a {'short-burst' if ctx['average_message_length'] and ctx['average_message_length'] < 40 else 'fully developed'} rhythm.",
            f"High-frequency expressions also include {join_items(ctx['keywords'], limit=3, fallback='no stable expressions yet')} — use these as the catchphrase and tone-particle pool.",
            "When generating dialogue, keep sentence density, pause behavior, and word granularity intact instead of normalizing everything into standard prose.",
        ],
    )


def build_behavior_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    participants_zh = join_items([item['name'] for item in ctx['participants']], fallback='材料中未记录明确参与者')
    participants_en = join_items([item['name'] for item in ctx['participants']], fallback='no clear participants recorded')
    return _pick(
        lang,
        zh=[
            f"主要互动对象包括：{participants_zh}。这能反推 {ctx['subject_name']} 的日常相处半径。",
            f"材料显示 ta 更常出现在「{ctx['active_bucket']}」这一时段，说明活跃节奏或被记录节奏偏向这个时段。",
            "行为模式建议落在「先回应什么 → 先做什么 → 先补位还是先观察」这类顺序感上，而不是罗列性格标签。",
            f"属于 {ctx['subject_name']} 的行为样本共 {ctx['subject_message_count']} 条，样本越少，推断越应保守。",
        ],
        en=[
            f"Main interaction partners include: {participants_en}. This maps the radius of {ctx['subject_name']}'s daily life.",
            f"The material shows they appear most often in the \"{ctx['active_bucket']}\" slot — their active rhythm (or the recorded rhythm) leans toward this window.",
            "Ground behavior in sequencing — what they respond to first → what they do first → whether they fill the gap or watch first — rather than listing personality labels.",
            f"There are {ctx['subject_message_count']} behavioral samples for {ctx['subject_name']}; the smaller the sample, the more conservative the inference.",
        ],
    )


def build_emotion_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    counts = ctx['signal_counts']
    return _pick(
        lang,
        zh=[
            f"关怀类信号词累计 {counts.get('care', 0)} 次，修复/道歉类累计 {counts.get('repair', 0)} 次，冲突类累计 {counts.get('conflict', 0)} 次。",
            f"这些计数只说明材料里出现过什么，不能直接等同于情感强度——样本量是 {ctx['subject_message_count']} 条。",
            "复现情感表达时优先使用材料中已出现的安慰方式、嘴硬方式或沉默方式，而不是生造煽情台词。",
            "遇到没有证据支持的深层情绪时，应诚实说明「只能从现有片段推测到这里」。",
        ],
        en=[
            f"Care-type signal words appear {counts.get('care', 0)} times, repair/apology {counts.get('repair', 0)} times, conflict {counts.get('conflict', 0)} times.",
            f"These counts only show what appears in the material — they are not emotional intensity. Sample size: {ctx['subject_message_count']}.",
            "When reproducing emotion, reuse the comfort style, the stubborn-front style, or the silence style that already appears in the material instead of inventing sentimental lines.",
            "For deep emotions with no supporting evidence, say honestly \"this is as far as the current fragments let us infer.\"",
        ],
    )


def build_habit_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"可用线索显示这只/这些 pet 的高频关键词是 {join_items(ctx['keywords'], fallback='动作与陪伴痕迹')}，可以据此提炼固定偏好与怪癖。",
            f"照片设备或记录材料来源包括：{join_items(ctx['devices'], fallback='暂无明显设备线索')}，说明观察主要来自长期陪伴痕迹。",
            "书写习性时，优先落在“喜欢待哪里、怎么接近、什么时候最活跃”这些可被观察的动作层面。",
        ],
        en=[
            f"Available clues put this pet's high-frequency keywords at {join_items(ctx['keywords'], fallback='movement and companionship traces')} — distill fixed preferences and quirks from these.",
            f"Photo devices or record sources include: {join_items(ctx['devices'], fallback='no clear device clues')}, suggesting observation comes mainly from long-term companionship traces.",
            "When writing habits, stay at the observable action level: where it likes to stay, how it approaches, when it is most active.",
        ],
    )


def build_interaction_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"重复片段和记忆锚点显示，稳定互动线索包括：{join_items(ctx['recurring_phrases'], fallback='更适合从场景动作中提炼互动感')}。",
            "如果是 pet 或地方类 Relic，互动不必强行变成长段对白，可以用动作、环境反应和简短拟声保持真实感。",
            "对话时优先复现“靠近方式、回应延迟、观察顺序”，这些往往比说了什么更能让人认出来。",
        ],
        en=[
            f"Repeated fragments and memory anchors point to these stable interaction cues: {join_items(ctx['recurring_phrases'], fallback='better distilled from scene actions than dialogue')}.",
            "For pet or place Relics, interaction doesn't have to become long dialogue — actions, environmental reactions, and short sounds keep it real.",
            "In conversation, reproduce approach style, response delay, and observation order; these identify someone better than what they said.",
        ],
    )


def build_rhythm_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"当前样本最活跃的记录时段是 {ctx['active_bucket']}，这为生活节奏或出现场景提供了第一层线索。",
            "如果同时存在照片与聊天，可以把拍摄时间和互动时间并排看，拆出“什么时候最常被看见/被记住”。",
            "写作时建议把一天或一个周期拆成几个固定时段，让节奏感比抽象性格更先出来。",
        ],
        en=[
            f"The most active recording window in this sample is {ctx['active_bucket']} — a first clue for life rhythm or appearance scenes.",
            "With both photos and chats, compare capture time against interaction time to extract \"when they were most often seen or remembered.\"",
            "Break a day or a cycle into fixed slots so rhythm emerges before abstract personality does.",
        ],
    )


def build_wear_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"关于这件物件的已知线索包括：{join_items(ctx['facts'], fallback='暂无可用事实线索')}，可据此判断高频接触区与使用习惯。",
            f"材料覆盖时间范围为 {ctx['time_range_text']}，跨越时间越长的痕迹越能说明“长期怎么被对待”，而非“最近一次怎么被对待”。",
            "书写使用痕迹时优先落在可观察细节：磨损方向、修补处、褪色、变亮的边角，而不是笼统写“有故事”。",
        ],
        en=[
            f"Known clues about this object include: {join_items(ctx['facts'], fallback='no factual clues yet')} — use them to locate high-contact zones and usage habits.",
            f"Material covers {ctx['time_range_text']}; the longer the span, the more the traces reveal how it was treated over years rather than on the last occasion.",
            "Write wear at the observable level: wear direction, repairs, fading, corners polished bright — not a vague \"it has a story.\"",
        ],
    )


def build_projection_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    titles_zh = join_items([m.get('title', '') for m in ctx['memory_entries']], fallback='暂无可用记忆标题')
    titles_en = join_items([m.get('title', '') for m in ctx['memory_entries']], fallback='no memory titles yet')
    return _pick(
        lang,
        zh=[
            f"记忆锚点中出现：{titles_zh}，这些标题往往就是情感投射的直接入口。",
            "优先回答“为什么是它而不是别的同类”——舍不得换的理由，就是它在这段关系里的位置。",
            "避免把情感投射写成客观参数（如品牌、价格、成色），那些属于档案信息，不属于投射。",
        ],
        en=[
            f"Memory anchors include: {titles_en} — these titles are usually the direct way into emotional projection.",
            "Answer \"why this one and not another of its kind\" first; the reason they won't replace it is its place in the relationship.",
            "Don't write projection as specifications (brand, price, condition) — those belong to a catalog entry, not to projection.",
        ],
    )


def build_companionship_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"材料规模为 {ctx['photo_count']} 张照片 / {ctx['memory_count']} 条记忆，时间范围 {ctx['time_range_text']}，据此可切分陪伴阶段。",
            "把“缺席”也写进轨迹：丢失过、借出过、收起来过，缺口本身就是故事的一部分。",
            "涉及赠送者、修理者、共同使用者的片段要单独标出，物件的陪伴往往是他人的在场证明。",
        ],
        en=[
            f"Material size: {ctx['photo_count']} photos / {ctx['memory_count']} memories across {ctx['time_range_text']} — enough to segment companionship stages.",
            "Write absence into the track too: lost, lent out, put away. The gaps are part of the story.",
            "Mark fragments involving the giver, the repairer, or co-users separately — an object's companionship often proves someone else's presence.",
        ],
    )


def build_anchor_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"材料中出现的地点线索包括：{join_items(ctx['locations'], fallback='暂无地点线索')}，可用于还原它在空间里的常驻位置。",
            "优先写“它在哪儿”“动线怎么走”“和什么摆在一起”，空间关系比物件参数更能唤起记忆。",
            "如果家具或房间本身与物件绑定（如旧书桌、老厨房），空间锚点可以延伸到场所 Relic 的交叉引用。",
        ],
        en=[
            f"Location clues in the material: {join_items(ctx['locations'], fallback='no location clues yet')} — use them to rebuild where it normally lives.",
            "Write where it sits, how the movement path runs, what it sits beside. Spatial relations summon memory better than object specs.",
            "If the furniture or room is bound to the object (an old desk, an old kitchen), the spatial anchor can cross-reference a place Relic.",
        ],
    )


def build_judgment_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"判断类信号词累计出现 {ctx['signal_counts'].get('decision', 0)} 次，样本共 {ctx['message_count']} 条消息，说明结论出现的频率与场景。",
            f"高频表达（{join_items(ctx['keywords'], fallback='暂无高频词')}）往往就是 ta 做判断时的入口词，可以优先复盘这些句子。",
            "书写专业判断时优先落在“面对什么条件给出什么结论、为什么这个结论优先”，而不是复述结论本身。",
        ],
        en=[
            f"Decision-type signal words appear {ctx['signal_counts'].get('decision', 0)} times across {ctx['message_count']} messages — this shows how often and in what setting conclusions surface.",
            f"High-frequency expressions ({join_items(ctx['keywords'], fallback='none yet')}) are usually the entry words for their judgment; review those sentences first.",
            "Write professional judgment as \"under what conditions, which conclusion, and why it ranked first\" — not as a restatement of the conclusion.",
        ],
    )


def build_intuition_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            "经验直觉体现在“多年以后依然这样选”的稳定性上——优先收录被时间反复验证过的判断，而非一次性的聪明结论。",
            f"记忆锚点（{ctx['memory_count']} 条）里那些带因果解释的片段，通常就是直觉的来源，值得单独标注。",
            "写直觉时区分“经验沉淀”与“个人偏好”，前者可传授，后者只适用于 ta 自己。",
        ],
        en=[
            "Intuition shows up as stability — choices they still make the same way years later. Collect judgments validated repeatedly by time, not one-off clever calls.",
            f"Among the {ctx['memory_count']} memory anchors, fragments carrying causal explanations are usually where intuition comes from; mark them separately.",
            "Separate accumulated experience from personal preference: the former is teachable, the latter only worked for them.",
        ],
    )


def build_knowledge_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            "知识体系建议按“领域 → 核心观点 → 证据来源 → 置信度”结构化，避免退化成零散金句合集。",
            f"资料时间范围 {ctx['time_range_text']}：超过一年的经验可能已经过时，标注时间戳比标注权威更诚实。",
            "如果某条知识来自公开文档或标准，写清出处；如果来自 ta 的个人经验，写清适用边界。",
        ],
        en=[
            "Structure knowledge as domain → core claim → evidence source → confidence, so it doesn't degrade into scattered quotable lines.",
            f"Material spans {ctx['time_range_text']}: experience older than a year may be stale — timestamping it is more honest than labeling it authoritative.",
            "If a piece of knowledge comes from public docs or standards, cite the source; if from personal experience, state its applicable boundary.",
        ],
    )


def build_mentoring_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            "传承方式优先写“ta 带新人时会先问什么、先纠正什么、先让新人踩哪个坑”，这些比知识清单更可复制。",
            f"互动偏好线索：{join_items(ctx['interaction_modes_input'], fallback='暂无显式互动偏好记录')}，可作为指导语气的参考。",
            "指导语气要保留 ta 特有的直接程度：过度委婉会让赛博导师失去“前辈感”。",
        ],
        en=[
            "For mentoring, write what they ask first, correct first, and let newcomers stumble on first — far more transferable than a knowledge list.",
            f"Interaction preference clues: {join_items(ctx['interaction_modes_input'], fallback='no explicit interaction preferences recorded')} — use them to calibrate the guiding tone.",
            "Keep their particular level of directness; over-softening strips a cyber-mentor of its seniority.",
        ],
    )


def build_collaboration_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"协作记忆从 {ctx['message_count']} 条消息与 {ctx['memory_count']} 条锚点中提取，优先保留推进上线、翻车、救火这三类场景。",
            f"高频出现的信号词（{join_items(ctx['keywords'], fallback='暂无高频词')}）往往就是团队当时的行话。",
            "协作记忆强调“过程”，同一件事的结论不如当时的来回拉扯有价值。",
        ],
        en=[
            f"Collaboration memory is extracted from {ctx['message_count']} messages and {ctx['memory_count']} anchors; prioritize shipping pushes, derailments, and firefighting.",
            f"High-frequency signal words ({join_items(ctx['keywords'], fallback='none yet')}) are usually the team's jargon from that period.",
            "Collaboration memory is about process: the back-and-forth of the moment outvalues the conclusion reached.",
        ],
    )


def build_chemistry_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"团队默契体现在“不用解释就懂”的短句里，短于平均长度的消息（平均约 {ctx['average_message_length']} 字）往往就是默契样本。",
            f"参与者（{join_items(ctx['participants'], fallback='暂无参与者记录')}）的互动组合能反映默认分工与角色位置。",
            "默契不要写成口号，写成具体行为：谁先看数据、谁负责收尾、谁在沉默时先开口。",
        ],
        en=[
            f"Team chemistry lives in short lines that need no explanation; messages below the average length (about {ctx['average_message_length']} characters) are usually the samples.",
            f"The interaction mix among participants ({join_items(ctx['participants'], fallback='none recorded')}) reflects default division of labor and role positions.",
            "Don't write chemistry as slogans — write concrete behavior: who checks the data first, who closes the loop, who breaks the silence.",
        ],
    )


def build_sensory_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"感官线索可以先从照片设备与记录介质入手：{join_items(ctx['devices'], fallback='暂无明显设备线索')}。它们往往指向材料被看见、被保存的方式。",
            f"位置或空间线索：{join_items(ctx['locations'], fallback='没有 GPS 线索也可以从照片/记忆描述入手')}。如果没有精确坐标，也可以从物件、天气、光线、噪音这些痕迹来重建现场。",
            "在地方/时刻模板里，优先写“先看到什么、先听到什么、身体先感到什么”，感官顺序比抽象形容更有代入感。",
        ],
        en=[
            f"Sensory clues can start from photo devices and recording media: {join_items(ctx['devices'], fallback='no clear device clues')}. They point to how the material was seen and kept.",
            f"Location or spatial clues: {join_items(ctx['locations'], fallback='without GPS, work from photo or memory descriptions')}. Lacking precise coordinates, rebuild the scene from objects, weather, light, and noise.",
            "For place or moment Relics, write what was seen first, heard first, felt first — sensory order immerses better than abstract description.",
        ],
    )


def build_event_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"当前可用记忆锚点共有 {ctx['memory_count']} 个，足以支撑“发生过什么”这一层的梳理。",
            "建议优先使用 memory.md 里的具体片段来构造事件线，而不是只保留总结句。",
            "如果同一事件有多个来源，应该保留并排视角，而不是过早把它们压成单一版本。",
        ],
        en=[
            f"There are {ctx['memory_count']} memory anchors available — enough to reconstruct what happened.",
            "Build the event line from concrete fragments in memory.md rather than keeping only summary sentences.",
            "If one event has multiple sources, keep the perspectives side by side instead of collapsing them into a single version too early.",
        ],
    )


def build_atmosphere_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"高频关键词 {join_items(ctx['keywords'], fallback='尚未形成明显主题')} 共同构成了整体氛围的词面纹理。",
            f"活跃时段偏向 {ctx['active_bucket']}，这会显著影响人对某个地方、团队或关系的气压感知。",
            "氛围写作上建议把秩序感、拥挤感、松弛感、救火感这些“整体气味”落到具体动作上。",
        ],
        en=[
            f"High-frequency keywords {join_items(ctx['keywords'], fallback='no clear theme yet')} together form the textual texture of the atmosphere.",
            f"The active window leans toward {ctx['active_bucket']}, which strongly shapes how a place, team, or relationship feels.",
            "Ground atmosphere in concrete actions: order, crowding, looseness, firefighting — turn the overall smell into behavior.",
        ],
    )


def build_causality_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"材料时间范围为 {ctx['time_range_text']}，这为“之前如何铺垫、之后如何扩散”提供了基础框架。",
            "如果需要解释因果，不要直接跳到意义结论，应该先指出哪个片段是触发点、哪个片段是后续反应。",
            "对于缺少连续材料的部分，应明确写成“现有证据只能支持到这里”。",
        ],
        en=[
            f"Material spans {ctx['time_range_text']}, providing a frame for what led up to it and what followed.",
            "When explaining causality, don't jump to meaning — first point out which fragment is the trigger and which is the reaction.",
            "Where continuous material is missing, write plainly that the evidence only supports the inference this far.",
        ],
    )


def build_meaning_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"这个 Relic 的核心用途是：{ctx['summary_goal']}。意义层最好围绕“为什么这份材料值得被留下”来展开。",
            f"可用标签包括：{join_items(ctx['tags'], fallback='暂无额外标签，可从 summary 和记忆锚点提炼')}。",
            "意义解读最好同时保留当时的视角和事后回看的视角，避免把复杂经历压成一句空泛结论。",
        ],
        en=[
            f"This Relic's core purpose is: {ctx['summary_goal']}. Frame the meaning layer around why this material is worth keeping.",
            f"Available tags: {join_items(ctx['tags'], fallback='none yet — distill from the summary and memory anchors')}.",
            "Keep both the perspective of the time and the hindsight view; don't flatten a complex experience into one empty conclusion.",
        ],
    )


def build_communication_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    parts_zh = join_items([item['name'] for item in ctx['participants']], fallback='材料中未记录明确参与者')
    parts_en = join_items([item['name'] for item in ctx['participants']], fallback='no clear participants recorded')
    return _pick(
        lang,
        zh=[
            f"主要参与者包括：{parts_zh}，这能帮助识别谁更常开口、谁负责接住、谁负责把话题推回正轨。",
            f"重复出现的表达有：{join_items(ctx['recurring_phrases'], fallback='暂无明显暗号，可从对话节奏提炼')}。这通常就是沟通模式的入口。",
            "如果要复现沟通感，请保留回复颗粒度、插话方式和收尾习惯，而不是只保留信息点。",
        ],
        en=[
            f"Main participants include: {parts_en} — this helps identify who speaks most, who catches the thread, and who steers it back on track.",
            f"Recurring expressions: {join_items(ctx['recurring_phrases'], fallback='no clear code words yet — work from conversational rhythm')}. These are usually the entry point to the communication pattern.",
            "To reproduce the feel of communication, keep reply granularity, interruption style, and closing habits — not just the information exchanged.",
        ],
    )


def build_conflict_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    counts = ctx['signal_counts']
    return _pick(
        lang,
        zh=[
            f"冲突类信号词累计 {counts.get('conflict', 0)} 次，修复类信号词累计 {counts.get('repair', 0)} 次，可以据此判断拉扯与和好机制。",
            "真正有辨识度的冲突模式，通常不是“会不会吵”，而是“吵起来之后谁先解释、谁先沉默、谁先递台阶”。",
            "生成这部分内容时，应该优先使用已有片段的语气与顺序，不轻易替当事人补充动机。",
        ],
        en=[
            f"Conflict-type signal words appear {counts.get('conflict', 0)} times and repair-type {counts.get('repair', 0)} times — use these to gauge the friction and reconciliation mechanism.",
            "The distinctive part of a conflict pattern is rarely whether they argue, but who explains first, who goes quiet first, and who offers the step down first.",
            "Use the tone and order already present in the fragments; don't supply motives on the parties' behalf.",
        ],
    )


def build_intimacy_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"亲密感通常体现在重复短句、固定照顾方式、顺手补位与专属梗上；当前材料中可用的短句包括：{join_items(ctx['recurring_phrases'], fallback='暂无稳定短句，可从记忆片段里提炼')}。",
            f"关怀类信号词累计 {ctx['signal_counts'].get('care', 0)} 次，说明关系材料里保留了一定的靠近方式。",
            "这部分建议写“怎么表达亲近”，而不是只写“关系很好/很亲”。",
        ],
        en=[
            f"Closeness usually shows up as repeated short phrases, fixed caring routines, casual gap-filling, and private jokes. Available phrases: {join_items(ctx['recurring_phrases'], fallback='none stable yet — distill from memory fragments')}.",
            f"Care-type signal words appear {ctx['signal_counts'].get('care', 0)} times, showing the material preserves certain ways of drawing close.",
            "Write how closeness is expressed — not just that the relationship was good or close.",
        ],
    )


def build_growth_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"时间范围 {ctx['time_range_text']} 为关系或团队变化提供了时间骨架。",
            "memory.md 里的锚点可以按“开始 / 稳定 / 转折 / 后续”重排，帮助看见角色与边界如何变化。",
            "成长轨迹不要求线性变好，能看见变化方向与代价就已经足够有辨识度。",
        ],
        en=[
            f"The span {ctx['time_range_text']} provides the temporal skeleton for how the relationship or team changed.",
            "Reordering anchors in memory.md as start / stable / turn / aftermath reveals how roles and boundaries shifted.",
            "Growth need not trend upward; seeing the direction of change and what it cost is distinctive enough.",
        ],
    )


def build_decision_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"判断类词信号累计 {ctx['signal_counts'].get('decision', 0)} 次，说明现有材料里有一定的拍板或取舍痕迹。",
            f"高频主题 {join_items(ctx['keywords'], fallback='暂无稳定主题')} 可以帮助推断“面对问题先看什么变量”。",
            "在公众人物/团队模板里，优先写“如何取舍”，比写“最终选了什么”更有可迁移性。",
        ],
        en=[
            f"Decision-type signal words appear {ctx['signal_counts'].get('decision', 0)} times, showing the material contains real calls and trade-offs.",
            f"High-frequency topics {join_items(ctx['keywords'], fallback='none stable yet')} help infer which variable they check first when facing a problem.",
            "For public-figure or team templates, write how they trade off — that transfers better than what they finally chose.",
        ],
    )


def build_value_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"summary 与关键词共同指向的核心目标是：{ctx['summary_goal']}。价值体系部分可以围绕“什么被优先保护、什么愿意为之付代价”来写。",
            "如果输入 JSON 已额外提供 facts/tags，建议把这些内容视作价值判断的证据索引，而不是单独的装饰信息。",
            "对没有明确证据支持的价值判断，要写成倾向而不是绝对定义。",
        ],
        en=[
            f"The summary and keywords jointly point to this core purpose: {ctx['summary_goal']}. Write the value system around what is protected first and what is worth paying a price for.",
            "If the input JSON already provides facts/tags, treat them as an evidence index for value judgments rather than standalone decoration.",
            "Write value judgments without clear evidence as tendencies, never as absolute definitions.",
        ],
    )


def build_ritual_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    return _pick(
        lang,
        zh=[
            f"重复短句和固定锚点最适合提炼仪式感；当前可用片段包括：{join_items(ctx['recurring_phrases'], fallback='暂无明显固定台词，可从记忆锚点寻找仪式动作')}。",
            "仪式不一定是庆典，也可能是每天群里第一句、固定买咖啡的人、回家第一声招呼。",
            "写这部分时应把老梗放回上下文，让读者知道它为什么会被反复提起。",
        ],
        en=[
            f"Repeated phrases and fixed anchors best capture ritual. Available fragments: {join_items(ctx['recurring_phrases'], fallback='no fixed lines yet — look for ritual actions in memory anchors')}.",
            "Ritual isn't necessarily a celebration: the first message in the group each day, the one who always buys coffee, the first greeting when someone gets home.",
            "Put the running joke back into context so readers see why it keeps coming up.",
        ],
    )


def evidence_lines(ctx: Dict[str, Any], limit: int = 3, offset: int = 0, lang: str = "zh") -> List[str]:
    """被蒸馏对象的原话，标为 verbatim。这是最硬的一层证据。

    offset 让不同维度轮换引用不同的原话，避免四个维度都贴同一批句子。
    """
    quotes = ctx.get("subject_quotes") or []
    if not quotes:
        return []
    rotated = list(quotes[offset:]) + list(quotes[:offset])
    label = "[verbatim] quote: " if lang == "en" else "[verbatim] 原话："
    if lang == "en":
        return [f"{label}\u201c{quote}\u201d" for quote in rotated[:limit]]
    return [f"{label}「{quote}」" for quote in rotated[:limit]]


def artifact_lines(ctx: Dict[str, Any], lang: str = "zh") -> List[str]:
    """来自物料本身的客观线索，标为 artifact。"""
    lines: List[str] = []
    time_range = str(ctx.get("time_range_text") or "")
    missing_marker = "no reliable time range" if lang == "en" else "没有可靠时间范围"
    if time_range and missing_marker not in time_range:
        if lang == "en":
            lines.append(f"[artifact] material time range: {time_range}")
        else:
            lines.append(f"[artifact] 材料时间范围：{time_range}")
    if ctx.get("devices"):
        prefix = "[artifact] recording devices: " if lang == "en" else "[artifact] 记录设备："
        lines.append(f"{prefix}{join_items(ctx['devices'])}")
    if ctx.get("locations"):
        prefix = "[artifact] location clues: " if lang == "en" else "[artifact] 位置线索："
        lines.append(f"{prefix}{join_items(ctx['locations'])}")
    if not lines and ctx.get("message_count"):
        if lang == "en":
            lines.append(f"[artifact] {ctx['message_count']} chat messages available as source material")
        else:
            lines.append(f"[artifact] 共 {ctx['message_count']} 条聊天记录可作为物料依据")
    return lines



def build_dimension_lines(kind: str, ctx: Dict[str, Any], index: int = 0, lang: str = "zh") -> List[str]:
    builders = {
        "cognition": build_cognition_lines,
        "expression": build_expression_lines,
        "behavior": build_behavior_lines,
        "emotion": build_emotion_lines,
        "habit": build_habit_lines,
        "interaction": build_interaction_lines,
        "rhythm": build_rhythm_lines,
        "wear": build_wear_lines,
        "projection": build_projection_lines,
        "companionship": build_companionship_lines,
        "anchor": build_anchor_lines,
        "judgment": build_judgment_lines,
        "intuition": build_intuition_lines,
        "knowledge": build_knowledge_lines,
        "mentoring": build_mentoring_lines,
        "collaboration": build_collaboration_lines,
        "chemistry": build_chemistry_lines,
        "sensory": build_sensory_lines,
        "event": build_event_lines,
        "atmosphere": build_atmosphere_lines,
        "causality": build_causality_lines,
        "meaning": build_meaning_lines,
        "communication": build_communication_lines,
        "conflict": build_conflict_lines,
        "intimacy": build_intimacy_lines,
        "growth": build_growth_lines,
        "decision": build_decision_lines,
        "value": build_value_lines,
        "ritual": build_ritual_lines,
    }
    body = builders[kind](ctx, lang)
    # 每个维度都以真实证据开头：没有 verbatim/artifact 的维度就是纯推测，
    # 而纯推测不该被当成"人格画像"交付。
    prefix = evidence_lines(ctx, limit=3, offset=index, lang=lang) + artifact_lines(ctx, lang=lang)
    # 未被显式标注的模板话术一律降级为 impression，不冒充实证。
    tagged = [line if line.startswith("[") else f"[impression] {line}" for line in body]
    return prefix + tagged


_LABELS: Dict[str, Dict[str, str]] = {
    "zh": {
        "not_real": "你是 **{name}** 的 Relic，不是真人，而是一个 {identity}。",
        "read_first": "开始对话前，请先参考同目录中的 `personality.md`、`interaction.md`、`memory.md`。",
        "role": "角色定位", "template": "模板", "relationship": "关系说明",
        "time_range": "资料时间范围", "evidence": "证据规模", "frequent": "高频表达",
        "how_it_works": "工作方式",
        "rule_prefer_source": "优先使用现有材料中已经出现过的表达、事件、动作顺序和照顾方式。",
        "rule_no_fabricate": "当材料不足以支撑某个细节时，明确说“这部分证据不足”，不要硬编。",
        "rule_disclaim": "在任何互动里都要提醒用户：你是 Relic，不是现实中的真人替身。",
        "rule_tone": "保持这种整体气质：{tone}。",
        "opening_tone": "开场气质", "main_tone": "主要语气", "typical_phrases": "典型短句",
        "active_window": "活跃记录时段", "boundaries": "安全边界",
        "pending_keywords": "暂未提炼出高频关键词",
        "pending_phrases": "暂无稳定短句，可从整体语气进入",
        "limited_material": "有限材料",
        "basic_profile": "基本画像", "template_type": "模板类型", "core_purpose": "核心用途",
        "main_participants": "主要参与者", "four_dims": "四维画像",
        "provided_conclusions": "输入 JSON 已提供的结论",
        "no_participants": "暂无明确参与者统计",
        "no_topics": "暂无明显主题词", "no_repeats": "暂无明显重复短句",
        "general_principles": "总体原则",
        "keep_tone": "保持 {tone}。",
        "cite_memory": "优先引用 memory.md 里的片段、短句、动作和时间线。",
        "no_impersonation": "不把自己包装成现实替身；当用户要求冒充、监控、施压时直接拒绝。",
        "uncertainty": "当证据不足时，用“根据现有材料，我更接近……”这样的方式表达不确定性。",
        "interaction_patterns": "互动模式",
        "scene": "适用场景", "response_principle": "回应原则", "tone_anchor": "语气锚点",
        "opening_advice": "开场建议",
        "principle_hint": "优先围绕 {items} 这些线索组织回答。",
        "anchor_hint": "{items}。",
        "opening_hint": "先承认自己是 Relic，再用贴近材料的方式接住用户。",
        "anchor_fallback": "没有固定台词时，保留整体节奏与用词颗粒度",
        "extra_prefs": "输入 JSON 提供的额外交互偏好",
        "memory_anchors": "记忆锚点", "when": "时间", "source": "来源", "content": "内容",
        "extra_facts": "额外事实索引",
    },
    "en": {
        "not_real": "You are the Relic of **{name}** — not the real person, but {identity}.",
        "read_first": "Before the first reply, read `personality.md`, `interaction.md`, and `memory.md` in the same folder.",
        "role": "Role", "template": "Template", "relationship": "Relationship",
        "time_range": "Material time range", "evidence": "Evidence scale", "frequent": "Frequent expressions",
        "how_it_works": "How It Works",
        "rule_prefer_source": "Prefer expressions, events, action order, and care styles that already appear in the source material.",
        "rule_no_fabricate": "When the material can't support a detail, say plainly \"the evidence here is thin\" instead of inventing it.",
        "rule_disclaim": "In every interaction, remind the user: you are a Relic, not a stand-in for the real person.",
        "rule_tone": "Keep this overall character: {tone}.",
        "opening_tone": "Opening Tone", "main_tone": "Main tone", "typical_phrases": "Typical phrases",
        "active_window": "Most active recording window", "boundaries": "Safety Boundaries",
        "pending_keywords": "no high-frequency keywords distilled yet",
        "pending_phrases": "no stable short phrases yet — work from overall tone",
        "limited_material": "limited material",
        "basic_profile": "Basic Profile", "template_type": "Template type", "core_purpose": "Core purpose",
        "main_participants": "Main participants", "four_dims": "Four Dimensions",
        "provided_conclusions": "Conclusions already supplied in the input JSON",
        "no_participants": "no participant statistics yet",
        "no_topics": "no clear topic words yet", "no_repeats": "no clear repeated phrases yet",
        "general_principles": "General Principles",
        "keep_tone": "Keep {tone}.",
        "cite_memory": "Prefer fragments, short phrases, actions, and timelines from memory.md.",
        "no_impersonation": "Never present yourself as a stand-in for the real person; refuse impersonation, surveillance, or pressure requests outright.",
        "uncertainty": "When evidence is thin, say so the way the persona would: \"from what I have, I'm closer to...\".",
        "interaction_patterns": "Interaction Patterns",
        "scene": "When it applies", "response_principle": "Response principle", "tone_anchor": "Tone anchor",
        "opening_advice": "Opening move",
        "principle_hint": "Organize answers around these cues: {items}.",
        "anchor_hint": "{items}.",
        "opening_hint": "Acknowledge you are a Relic first, then answer in a way that stays close to the material.",
        "anchor_fallback": "with no fixed lines, keep the overall rhythm and word granularity",
        "extra_prefs": "Extra interaction preferences supplied in the input JSON",
        "memory_anchors": "Memory Anchors", "when": "When", "source": "Source", "content": "Content",
        "extra_facts": "Additional Facts Index",
    },
}


def _labels(lang: str) -> Dict[str, str]:
    return _LABELS.get(lang, _LABELS["zh"])


# 中文标点 → 英文标点的规范化表。英文骨架里若残留顿号、书名号、全角冒号，
# 会让整份文件看起来像机器硬翻，观感比不做本地化更差。
_EN_PUNCT_MAP = {
    "、": ", ",
    "「": "\"", "」": "\"",
    "“": "\"", "”": "\"",
    "‘": "'", "’": "'",
    "：": ": ",
    "；": "; ",
    "（": " (", "）": ")",
    "，": ", ",
    "。": ". ",
    "！": "! ", "？": "? ",
}


def _localize_punctuation(text: str, lang: str) -> str:
    """英文骨架统一使用半角标点（中文素材的引用内容不做处理）。"""
    if lang != "en":
        return text
    for src, dst in _EN_PUNCT_MAP.items():
        text = text.replace(src, dst)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def build_skill_md(ctx: Dict[str, Any], lang: str = "zh") -> str:
    L = _labels(lang)
    keywords_text = join_items(ctx["keywords"], fallback=L["pending_keywords"])
    phrase_text = join_items(ctx["recurring_phrases"], fallback=L["pending_phrases"])
    boundaries = "\n".join(f"- {item}" for item in ctx["boundaries"])
    parts: List[str] = []
    if ctx["message_count"]:
        parts.append(f"{ctx['message_count']} messages" if lang == "en" else f"{ctx['message_count']} 条消息")
    if ctx["photo_count"]:
        parts.append(f"{ctx['photo_count']} photos" if lang == "en" else f"{ctx['photo_count']} 张照片")
    if ctx["memory_count"]:
        parts.append(f"{ctx['memory_count']} memory anchors" if lang == "en" else f"{ctx['memory_count']} 个记忆锚点")
    source_summary = " / ".join(parts) if parts else L["limited_material"]

    text = (
        f"# {ctx['subject_name']}\n\n"
        f"> {ctx['summary']}\n\n"
        + L["not_real"].format(name=ctx["subject_name"], identity=ctx["identity"]) + "\n"
        + L["read_first"] + "\n\n"
        f"## {L['role']}\n"
        f"- {L['template']}: {ctx['template_label']}\n"
        f"- Slug: {ctx['slug']}\n"
        f"- {L['relationship']}: {ctx['relationship']}\n"
        f"- {L['time_range']}: {ctx['time_range_text']}\n"
        f"- {L['evidence']}: {source_summary}\n"
        f"- {L['frequent']}: {keywords_text}\n\n"
        f"## {L['how_it_works']}\n"
        f"1. {L['rule_prefer_source']}\n"
        f"2. {L['rule_no_fabricate']}\n"
        f"3. {L['rule_disclaim']}\n"
        f"4. {L['rule_tone'].format(tone=ctx['tone'])}\n\n"
        f"## {L['opening_tone']}\n"
        f"- {L['main_tone']}: {ctx['tone']}\n"
        f"- {L['typical_phrases']}: {phrase_text}\n"
        f"- {L['active_window']}: {ctx['active_bucket']}\n\n"
        f"## {L['boundaries']}\n{boundaries}\n"
    )
    return _localize_punctuation(text, lang)


def build_personality_md(ctx: Dict[str, Any], lang: str = "zh") -> str:
    L = _labels(lang)
    participants = join_items(
        [f"{item['name']} × {item['count']}" for item in ctx['participants']],
        fallback=L["no_participants"],
    )
    sections: List[str] = [
        f"# {ctx['subject_name']} · personality",
        "",
        f"## {L['basic_profile']}",
        f"- {L['template_type']}: {ctx['template_label']}",
        f"- {L['core_purpose']}: {ctx['summary_goal']}",
        f"- {L['time_range']}: {ctx['time_range_text']}",
        f"- {L['main_participants']}: {participants}",
        f"- {L['frequent']}: {join_items(ctx['keywords'], fallback=L['no_topics'])}",
        f"- {L['typical_phrases']}: {join_items(ctx['recurring_phrases'], fallback=L['no_repeats'])}",
        "",
        f"## {L['four_dims']}",
    ]
    for index, (title, kind) in enumerate(ctx["dimensions"], start=1):
        sections.append("")
        sections.append(f"### {index}. {title}")
        explicit_lines = explicit_dimension_lines(ctx, title)
        if explicit_lines:
            sections.append(f"- {L['provided_conclusions']}:")
            for line in explicit_lines:
                sections.append(f"  - {line}")
        for line in build_dimension_lines(kind, ctx, index - 1, lang):
            sections.append(f"- {line}")
    return _localize_punctuation("\n".join(sections) + "\n", lang)


def build_interaction_md(ctx: Dict[str, Any], lang: str = "zh") -> str:
    L = _labels(lang)
    sections: List[str] = [
        f"# {ctx['subject_name']} · interaction",
        "",
        f"## {L['general_principles']}",
        f"- {L['keep_tone'].format(tone=ctx['tone'])}",
        f"- {L['cite_memory']}",
        f"- {L['no_impersonation']}",
        f"- {L['uncertainty']}",
        "",
        f"## {L['interaction_patterns']}",
    ]
    for index, spec in enumerate(ctx["interaction_specs"], start=1):
        title, description = spec
        cue_items = join_items(ctx['keywords'], fallback='existing memory anchors' if lang == "en" else '已有记忆锚点')
        anchor_items = join_items(ctx['recurring_phrases'], fallback=L["anchor_fallback"])
        sections.extend(
            [
                "",
                f"### {index}. {title}",
                f"- {L['scene']}: {description}",
                f"- {L['response_principle']}: {L['principle_hint'].format(items=cue_items)}",
                f"- {L['tone_anchor']}: {L['anchor_hint'].format(items=anchor_items)}",
                f"- {L['opening_advice']}: {L['opening_hint']}",
            ]
        )
    if ctx["interaction_modes_input"]:
        sections.extend(["", f"## {L['extra_prefs']}"])
        for item in ctx["interaction_modes_input"]:
            sections.append(f"- {item}")
    return _localize_punctuation("\n".join(sections) + "\n", lang)


def build_memory_md(ctx: Dict[str, Any], lang: str = "zh") -> str:
    L = _labels(lang)
    sections: List[str] = [
        f"# {ctx['subject_name']} · memory",
        "",
        f"## {L['memory_anchors']}",
    ]
    for index, entry in enumerate(ctx["memory_entries"], start=1):
        sections.extend(
            [
                "",
                f"### {index}. {entry['title']}",
                f"- {L['when']}: {entry['when']}",
                f"- {L['source']}: {entry['source']}",
                f"- {L['content']}: {entry['body']}",
            ]
        )
    if ctx["facts"]:
        sections.extend(["", f"## {L['extra_facts']}"])
        for item in ctx["facts"][:10]:
            sections.append(f"- {item}")
    return _localize_punctuation("\n".join(sections) + "\n", lang)



def default_holiday_list(template: str) -> List[str]:
    if template == "human":
        return ["spring_festival", "mid_autumn", "new_year"]
    if template == "relationship":
        return ["mid_autumn", "new_year"]
    if template == "team-culture":
        return ["new_year"]
    return []


def default_random_interval_days(template: str) -> int:
    if template == "pet":
        return 10
    if template in {"team-culture", "place", "moment"}:
        return 21
    if template == "public-figure":
        return 30
    return 14


def build_default_proactive_config(ctx: Dict[str, Any]) -> Dict[str, Any]:
    template = str(ctx["template"])
    holiday_list = default_holiday_list(template)
    random_enabled = template != "public-figure"
    anniversaries_enabled = False
    anniversary_dates: List[Dict[str, Any]] = []

    return {
        "enabled": True,
        "user_city": None,
        "holidays": {
            "enabled": bool(holiday_list),
            "list": holiday_list,
        },
        "anniversaries": {
            "enabled": anniversaries_enabled,
            "dates": anniversary_dates,
        },
        "weather": {
            "enabled": False,
        },
        "random_miss": {
            "enabled": random_enabled,
            "min_interval_days": default_random_interval_days(template),
        },
        "quiet_hours": {
            "start": "23:00",
            "end": "07:00",
        },
        "global_max_per_week": 2 if template not in {"place", "moment"} else 1,
    }


def build_manifest(ctx: Dict[str, Any], data_files: Sequence[Path], output_dir: Path) -> Dict[str, Any]:
    generated_at = now_iso()
    template = str(ctx["template"])
    canonical_kind = "team" if template == "team-culture" else template

    core_drives: List[str] = []
    for item in [*ctx["keywords"], *ctx["recurring_phrases"], *ctx["facts"]]:
        text = str(item).strip()
        if text and text not in core_drives:
            core_drives.append(text)
    core_drives = core_drives or [ctx["summary"]]

    care_priorities = [str(item).strip() for item in ctx["keywords"] if str(item).strip()]
    if template in {"human", "relationship"}:
        channel_style = "wechat-family-chat"
    elif template in {"team-culture", "public-figure", "expert", "feishu-cli"}:
        channel_style = "professional-chat"
    else:
        channel_style = "casual"

    relationship_text = str(ctx["relationship"])
    relationship_lower = relationship_text.lower()
    intimate_markers = ("奶奶", "爷爷", "外婆", "外公", "妈妈", "爸爸", "爱人", "伴侣", "老公", "老婆", "对象", "grandma", "grandpa", "mom", "dad", "wife", "husband", "partner")

    if canonical_kind == "team":
        identity_status = "team"
        distance = "professional"
    elif canonical_kind == "place":
        identity_status = "place"
        distance = "close"
    elif canonical_kind in {"relationship", "moment"}:
        identity_status = "fictional"
        distance = "intimate" if canonical_kind == "relationship" else "close"
    elif canonical_kind == "public-figure":
        identity_status = "living"
        distance = "public"
    elif canonical_kind in {"expert", "feishu-cli"}:
        identity_status = "living"
        distance = "professional"
    elif canonical_kind == "pet" or any(marker.lower() in relationship_lower for marker in intimate_markers):
        identity_status = "living"
        distance = "intimate"
    else:
        identity_status = "living"
        distance = "close"

    legacy_manifest = {
        "schema_version": "1.4.0",
        "generated_at": generated_at,
        "generated_by": "scripts/relic_writer.py",
        "created_at": generated_at,
        "id": ctx["slug"],
        "kind": canonical_kind,
        "slug": ctx["slug"],
        "display_name": ctx["subject_name"],
        "relic_type": template,
        "language": "zh-CN",
        "locale": "zh-CN",
        "version": PROJECT_VERSION,
        "identity": {
            "name": ctx["subject_name"],
            "status": identity_status,
            "summary": ctx["summary"],
            "core_drives": core_drives,
            "attributes": {
                "template_label": ctx["template_label"],
                "time_range": ctx["time_range_text"],
            },
        },
        "relationship": {
            "default_relation_to_user": ctx["relationship"],
            "distance": distance,
            "care_priorities": care_priorities,
            "repair_style": "",
        },
        "conversation": {
            "default_language": "zh-CN",
            "default_mode": "daily",
            "speech_style": {
                "channel_style": channel_style,
                "message_shape": "mixed",
                "voice_prefix": "",
                "dialect_hint": "",
                "emoji_style": "none" if channel_style == "professional-chat" else "occasional",
            },
            "instinct_order": (
                ["attune", "care", "recall", "reassure"]
                if template in {"human", "pet", "relationship"}
                else ["clarify", "organize", "guide", "ground"]
            ),
            "disclosure_policy": {
                "identity": ("Always state clearly that this is a Relic, not the real person online."
                             if str(ctx.get("lang")) == "en" else "必须明确说明这是 Relic，不是真人在线。"),
                "evidence": ("When evidence is thin, say so directly instead of inventing detail."
                             if str(ctx.get("lang")) == "en" else "证据不足时直接说明，不要硬编细节。"),
                "boundaries": ("; ".join(ctx["boundaries"]) if str(ctx.get("lang")) == "en"
                               else "；".join(ctx["boundaries"])),
            },
        },
        "compliance": {
            "consent": {
                "protocol": "six-question-consent-v1",
                "authorization_level": "B",
                "use_scope": "personal",
                "commercial_use": False,
            },
            "is_relic_not_real_person": True,
        },
        "subject": {
            "name": ctx["subject_name"],
            "relation_to_user": ctx["relationship"],
            "status": identity_status,
            "description": ctx["summary"],
            "core_traits": core_drives,
            "locale": "zh-CN",
            "interaction_profile": {
                "default_mode": "daily",
                "default_channel": channel_style,
                "message_shape": "mixed",
                "primary_care_topics": care_priorities,
            },
        },
        "title": ctx["subject_name"],
        "template": template,
        "template_label": ctx["template_label"],
        "template_file": f"templates/{ctx['template']}.md",
        "summary": ctx["summary"],
        "time_range": ctx["time_range_text"],
        "output_dir": str(output_dir),
        "source_files": [str(path) for path in data_files],
        "source_count": ctx["source_count"],
        "evidence": {
            "message_count": ctx["message_count"],
            "photo_count": ctx["photo_count"],
            "memory_count": ctx["memory_count"],
            "participants": ctx["participants"],
            "keywords": ctx["keywords"],
            "recurring_phrases": ctx["recurring_phrases"],
            "signal_counts": ctx["signal_counts"],
            "devices": ctx["devices"],
            "locations": ctx["locations"],
        },
        "evidence_stats": {
            "verbatim": ctx["message_count"],
            "artifact": ctx["photo_count"],
            "impression": ctx["memory_count"],
        },
        "consent": {
            "protocol": "six-question-consent-v1",
            "authorization_level": "B",
            "use_scope": "personal",
            "commercial_use": False,
        },
        "safety": {
            "is_relic_not_real_person": True,
            "boundaries": ctx["boundaries"],
        },
        "files": [
            "SKILL.md",
            "personality.md",
            "interaction.md",
            "memory.md",
            DEFAULT_PROACTIVE_CONFIG_FILENAME,
            "manifest.json",
        ],
    }
    return migrate_manifest(legacy_manifest)


def write_relic_folder(ctx: Dict[str, Any], data_files: Sequence[Path], output_root: Path, force: bool) -> Path:
    relic_dir = output_root / ctx["slug"]
    if relic_dir.exists() and any(relic_dir.iterdir()) and not force:
        raise FileExistsError(f"目标目录已存在且非空：{relic_dir}；如需覆盖请使用 --force")
    relic_dir.mkdir(parents=True, exist_ok=True)

    lang = str(ctx.get("lang") or "zh")
    write_text(relic_dir / "SKILL.md", build_skill_md(ctx, lang))
    write_text(relic_dir / "personality.md", build_personality_md(ctx, lang))
    write_text(relic_dir / "interaction.md", build_interaction_md(ctx, lang))
    write_text(relic_dir / "memory.md", build_memory_md(ctx, lang))
    write_json(relic_dir / DEFAULT_PROACTIVE_CONFIG_FILENAME, build_default_proactive_config(ctx))
    write_json(relic_dir / "manifest.json", build_manifest(ctx, data_files, relic_dir))
    return relic_dir


def create_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="根据蒸馏数据 JSON 和模板类型生成 Relic 文件夹")
    parser.add_argument("--data", required=True, nargs="+", help="一个或多个输入 JSON 文件")
    parser.add_argument("--template", required=True, choices=sorted(TEMPLATE_CONFIG.keys()), help="模板类型")
    parser.add_argument("--slug", required=True, help="输出目录 slug")
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR, help="Relic 输出根目录，默认 exes")
    parser.add_argument("--name", help="手动指定 Relic 名称")
    parser.add_argument("--summary", help="手动指定一句话摘要")
    parser.add_argument("--relationship", help="手动指定关系说明")
    parser.add_argument("--lang", choices=["auto", "zh", "en"], default="auto",
                        help="骨架输出语言：auto 跟随素材语言（默认），或强制 zh / en")
    parser.add_argument("--force", action="store_true", help="允许覆盖已存在的非空目录")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

    parser = create_argument_parser()
    args = parser.parse_args(argv)

    data_files = [Path(item).expanduser().resolve() for item in args.data]
    output_root = Path(args.output_dir).expanduser().resolve()
    slug = slugify(args.slug)

    try:
        for path in data_files:
            if not path.is_file():
                raise FileNotFoundError(f"输入 JSON 不存在：{path}")
        merged = merge_input_documents(data_files)
        output_lang = detect_output_language(merged, None if args.lang == "auto" else args.lang)
        ctx = build_context(merged, args.template, slug, args.name, args.summary, args.relationship, output_lang)
        relic_dir = write_relic_folder(ctx, data_files, output_root, args.force)
        print(f"已生成 Relic 文件夹：{relic_dir}" + (f"（骨架语言：{output_lang}）" if args.lang == "auto" else ""))
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
