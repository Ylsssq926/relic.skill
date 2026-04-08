# Contributing to relic.skill

> 来都来了，顺手给记忆拧一颗螺丝。  
> If you brought a bug report, a clean PR, or a new template, you are in the right place.

感谢你愿意为 relic.skill 贡献内容、代码和想法。  
Thank you for helping relic.skill remember a little more of the world.

## 如何贡献 / Ways to Contribute

### 1. 报告 Bug / Report Bugs
- 使用 GitHub 的 `Bug Report` 模板提交 issue。
- 尽量写清问题描述、复现步骤、期望行为、运行环境，以及截图或日志。
- 如果问题与数据解析或模板有关，请附上最小可复现片段，并先移除隐私信息。

Use the `Bug Report` issue form.
Include the bug description, reproduction steps, expected behavior, environment, and screenshots or logs when possible.
If the issue involves data parsing or templates, share a minimal reproducible example with private details removed.

### 2. 功能建议 / Suggest Features
- 使用 `Feature Request` 模板说明你想解决什么问题、适合什么场景、为什么值得做。
- 讨论接口、模板结构或伦理边界时，请尽量具体。

Use the `Feature Request` form to explain the problem, the use case, and why the change matters.
Be concrete when discussing APIs, template structure, or safety boundaries.

### 3. 提交代码 / Submit Code
1. Fork 仓库并创建分支。
2. 阅读 `FOR_AI.md`、`SKILL.md` 以及你要改动的目录。
3. 保持改动聚焦；一次 PR 只解决一类问题。
4. 提交前自查文档、命名、格式、示例与安全边界。

1. Fork the repository and create a branch.
2. Read `FOR_AI.md`, `SKILL.md`, and the directory you plan to change.
3. Keep the change focused; one PR should solve one kind of problem.
4. Before opening a PR, review docs, naming, formatting, examples, and safety boundaries.

### 4. 提交新 Relic 模板 / Submit a New Relic Template
- 先用 `New Relic Template` issue 模板说明对象类型、四维定义和数据来源。
- 在 `templates/` 下新增模板文件，文件名使用 kebab-case，例如 `grandparent.md`、`college-roommate.md`。
- 模板必须说清楚：适用对象、四维提取方式、推荐数据来源、不适用场景、安全边界。
- 如果模板涉及公众人物，只能讨论非政治人物，并且只能基于公开资料的方法论，不接收骚扰、冒充或未经授权的蒸馏。

Open a `New Relic Template` issue first.
Add the template file under `templates/` using kebab-case names such as `grandparent.md` or `college-roommate.md`.
A good template clearly defines the target object, the four-dimensional extraction model, recommended data sources, out-of-scope cases, and safety boundaries.
For public figures, only non-political figures and only public-source methodology are allowed; no harassment, impersonation, or unauthorized distillation.

## 开发环境设置 / Development Setup

### 基础要求 / Requirements
- Claude Code 或 Kiro
- Node.js 18+
- Python 3.9+（仅在运行解析脚本时需要）
- Git

- Claude Code or Kiro
- Node.js 18+
- Python 3.9+ (only needed for parser scripts)
- Git

### 快速开始 / Quick Start
```bash
git clone https://github.com/Ylsssq926/relic.skill
cd relic.skill
```

可选：如果你需要运行 Python 脚本，可以创建虚拟环境：  
Optional: create a virtual environment if you plan to run Python scripts:

```bash
python -m venv .venv
```

建议先阅读这些文件：  
Recommended reading before you start:
- `FOR_AI.md`
- `SKILL.md`
- `soul-shield/consent-protocol.md`
- `soul-shield/ethics.md`
- `templates/` 与相关目录

## 提交规范 / Commit Convention

本项目使用 Conventional Commits：  
This project uses Conventional Commits:

| 类型 Type | 说明 Description | 示例 Example |
| --- | --- | --- |
| `feat` | 新功能 / new feature | `feat: add place template guidelines` |
| `fix` | 修复问题 / bug fix | `fix: correct issue form field ids` |
| `docs` | 文档改动 / documentation | `docs: add bilingual contributing guide` |
| `style` | 代码风格调整，不改逻辑 / formatting only | `style: normalize markdown tables` |
| `refactor` | 重构，不新增功能 / refactor | `refactor: simplify template instructions` |
| `test` | 测试相关 / tests | `test: cover issue form validation` |
| `chore` | 杂项维护 / maintenance | `chore: update repo metadata` |

规则建议 / Tips:
- 标题简短，使用祈使语气。
- 一次提交尽量只做一件事。
- 如果改动影响行为，请在正文解释原因。

Keep the subject short and imperative.
Try to make each commit do one thing.
If behavior changes, explain why in the body.

## PR 流程 / Pull Request Process

1. 先同步你的分支，再开始改动。
2. 确保改动范围清晰，必要时补上文档或示例。
3. 按 PR 模板填写变更描述、类型、测试说明与截图。
4. 确认没有隐私数据、占位文本、涉政内容或无授权蒸馏内容。
5. 等待 review，并根据反馈继续完善。

1. Sync your branch before making changes.
2. Keep the scope clear and update docs or examples when needed.
3. Fill in the PR template with the summary, change type, test notes, and screenshots.
4. Make sure there is no private data, filler text, political content, or unauthorized distillation.
5. Wait for review and iterate on feedback.

## 如何提交新的万物永生模板 / How to Submit a New Relic Template

这是最重要的一类贡献。  
This is one of the most valuable kinds of contribution.

提交模板时，请重点检查：  
When you submit a template, please make sure it does all of the following:

1. **对象边界清楚 / Clear target boundary**  
   说明这个模板蒸馏的到底是什么：一个人、一只宠物、一段关系、一个团队、一个地方，还是一个时刻。  
   Define exactly what the template distills: a person, pet, relationship, team, place, or moment.

2. **四维定义具体 / Specific four-dimensional model**  
   认知、表达、行为、情感四个维度都要说明“提取什么”，不要只写抽象名词。  
   For cognition, expression, behavior, and emotion, specify what should be extracted instead of vague labels.

3. **数据来源可信 / Credible data sources**  
   标明适合的数据来源，例如聊天记录、照片、语音、文档、共同经历或公开资料。  
   List suitable sources such as chats, photos, voice notes, documents, shared experiences, or public materials.

4. **安全边界明确 / Clear safety boundaries**  
   写明哪些情况不适用，例如未获授权、资料过少、涉及隐私伤害、用于骚扰或冒充。  
   State when the template must not be used, such as missing consent, insufficient evidence, privacy harm, harassment, or impersonation.

5. **示例片段有辨识度 / Useful example snippets**  
   给出能体现风格的短片段，让维护者快速判断模板是否成立。  
   Include short but distinctive sample fragments so reviewers can quickly judge whether the template works.

6. **不碰红线 / Stay inside the red lines**  
   不蒸馏政治人物，不提交真实私密数据，不上传未经授权的可识别内容。  
   Do not distill political figures, upload real private data, or submit identifiable content without permission.

如果你不确定一个模板是否合适，先开 `New Relic Template` issue 讨论，通常比直接开 PR 更快。  
If you are unsure whether a template fits the project, open a `New Relic Template` issue first. That is usually faster than opening a PR directly.

---

**掠蓝 | relic.skill**  
GitHub: https://github.com/Ylsssq926/relic.skill  
QQ 群 / QQ Group: **1098169092**
