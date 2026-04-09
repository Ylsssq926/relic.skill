# FOR_AI.md — AI 一键入口

> 工作目录设为仓库根。请先读本文件，再按用户意图打开对应 SKILL.md 并执行。

## 快速导航

根据用户的意图，读取对应的入口文件：

### 1. 用户想锻造新 Relic

```text
请读取 soul-forge/SKILL.md，然后按流程引导用户完成锻造。
锻造前必须先读取 soul-shield/consent-protocol.md 完成授权。
根据蒸馏对象类型，从 templates/ 选择合适的模板。
```

### 2. 用户想跟已有 Relic 聊天

```text
请读取 soul-engine/SKILL.md，然后加载目标 Relic 的文件夹。
需要读取的文件：{relic}/SKILL.md, {relic}/personality.md, {relic}/memory.md
交互规则见 soul-engine/interaction.md
```

### 3. 用户想保护 Relic

```text
请读取 soul-shield/SKILL.md。
灵魂指纹：soul-shield/fingerprint.md
授权协议：soul-shield/consent-protocol.md
伦理红线：soul-shield/ethics.md
```

### 4. 用户想查看可用模板

```text
请列出 templates/ 目录下的所有模板文件，并简要介绍每个模板的用途。
```

### 5. 用户想用 CLI 工具

```text
数据解析脚本在 scripts/ 目录下：
- python scripts/wechat_parser.py --help
- python scripts/qq_parser.py --help
- python scripts/telegram_parser.py --help
- python scripts/photo_analyzer.py --help
- python scripts/relic_writer.py --help
- python scripts/version_manager.py --help
```

## 项目结构速览

```text
relic.skill/
├── SKILL.md              ← 主入口（你现在应该先读这个）
├── soul-forge/           ← 灵魂锻造炉（蒸馏引擎）
├── soul-engine/          ← 灵魂引擎（交互系统）
├── soul-shield/          ← 灵魂护盾（保护与伦理）
├── templates/            ← 万物永生模板 x7
├── examples/             ← 示例 Relics x3
├── scripts/              ← Python 工具脚本
└── docs/                 ← 深度文档
```
