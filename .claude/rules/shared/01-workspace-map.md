<!-- AUTO-GENERATED: do not edit directly. Source: F:/Azure Glance/.agent/rules/shared/01-workspace-map.md -->

# 工作区全局地图

> 身份 / 品牌主体见 `04-brand-and-admin.md`，本文件只放工作区结构和位置信息。

## 工作区结构

- 工作区根：`F:\Azure Glance`
- 根目录有自己的 `.git`
- `apps/` 下 26 个一级项目目录（另有 `.vscode/` 是 IDE 配置，不算项目）中 **22 个有有效 `.git`**，
  4 个没有：`CoPlay`（门户站时代残骸，只剩 frontend 两文件）、`godot-game`（容器目录，真正的仓在其子目录）、
  `luelan-gengwang-mp`（小程序壳）、`renpy-8.5.0-sdk`（见下一条）
- `apps/catpaw books/` 与 `apps/luelan-EndPoint/` 原本是原创内容却零版本控制，**2026-09-20 已各自 `git init` 入库**；
  两仓都**还没有 remote**，内容仍只在这块盘上（待你定备份方式，见决策清单 D8/D9）
- ⚠️ `apps/renpy-8.5.0-sdk/.git` 是**空壳**（目录内只有 `info/` 与 `mimocode-project-id`，`git --git-dir` 判定 not a git repository）→ 该 Ren'Py 项目当前**没有任何版本控制**，剧本等原创内容为本地唯一副本
- `luelan-portal/` 在工作区根目录下，也有独立 `.git`
- 根仓库通过 `.gitignore` 忽略 `apps/`、`luelan-portal/` 等子项目目录，防止跨仓误提交
- 但 `.gitignore` 管不住"已经被跟踪"的路径：2026-09-20 前根仓仍残留 2 个 `apps/CoPlay/` 文件与 4 个 `server-portal/` 索引项（均为门户站时代遗骸，已清理并由 `coplay-h5-rescue` 分支保住完整副本）。该边界现由 `validate-rules.js` 的 `apps-tracked-in-root-repo` 断言守住

## 站点与源码目录映射

> 双域名结构：付费业务用 `*.luelanai.com`（香港），演示站继续用 `*.luelan.online`（上海）。
> 旧 `*.luelan.online` 付费业务子域全部 nginx 301 → 新域。
> `*.luelanai.com` 演示站子域 nginx 301 → 旧域（用户笔误兼容）。

| 站点 | 主域名（生产） | 旧域名（保留 301） | 源码目录 | 线上位置 | 类型 |
|---|---|---|---|---|---|
| 个人主站 | `luelanai.com` | `luelan.online` | `luelan-portal/` | `/opt/apps/static/luelan-portal/dist` (香港) | 静态站 |
| 企业站 | `company.luelanai.com` | `company.luelan.online` | `apps/luelan-company/` | `/opt/apps/static/luelan-company/dist` (香港) | 静态站 |
| 写作 Pro | `writing.luelanai.com` | `writing.luelan.online` | `apps/luelan-writing-pro/` | `/opt/apps/services/luelan-writing-pro` (香港 PM2:3001) | PM2 服务 |
| 入戏 | `ruxi.luelanai.com` | `ruxi.luelan.online` | `apps/luelan-ruxi/` | `/opt/apps/services/luelan-ruxi` (香港 PM2:3007 ruxi-api) | PM2 服务 |
| 简历工坊 | `resume.luelanai.com` | `resume.luelan.online` | `apps/luelan-resume/` | `/opt/apps/services/luelan-resume` (香港 PM2:3006) | PM2 服务 |
| 统一认证 | `auth.luelanai.com` | `auth.luelan.online` | `apps/luelan-auth/` | `/opt/apps/services/luelan-auth` (香港 PM2:3008) | PM2 服务 |
| 2048 猫猫 | `2048maomao.luelan.online` | — | `apps/luelan-2048maomao/` | `/opt/apps/services/luelan-2048maomao` (上海 PM2) | PM2 服务（演示站） |
| AI Love | `ai-love.luelan.online` | — | `apps/luelan-ai-love/` | `/opt/apps/services/luelan-ai-love` (上海 PM2) | PM2 服务（演示站） |
| CoPlay | `coplay.luelan.online` | — | `apps/luelan-coplay/` | `/opt/apps/static/luelan-coplay` (上海) | 静态站（演示站） |
| ClawClip | `clawclip.luelan.online` | — | `apps/luelan-Clawclip/` | `/opt/apps/services/clawclip` (上海 PM2) | PM2 服务（演示站） |
| 梗王冒险 | `gengwang.luelan.online` | — | `apps/luelan-gengwang/` | `/opt/apps/static/luelan-gengwang/dist` (上海) | 静态站（演示站） |
| 江湖牌局 | `jianghu.luelan.online` | — | `apps/game-jinyong/` | `/opt/apps/static/luelan-jianghu/dist` (上海) | 静态站（演示站） |
| 深渊猎手 | `abyss.luelan.online` | — | `apps/Game-Diablo/` | `/opt/apps/static/luelan-abyss/dist` (上海) | 静态站（演示站） |
| 猫星球 | `cat-planet.luelan.online` | — | `apps/luelan-cat-planet/` | `/opt/apps/static/luelan-cat-planet/dist` (上海；路径仍需与项目规则复核) | 静态站（演示站） |
| Relic Demo | `relic.luelan.online` | — | `apps/luelan-Relic.skill/` | `/opt/apps/static/relic-demo` (上海) | 静态站（演示站） |
| Hermes | `hermes.luelan.online` | — | Hermes 服务器 | 新加坡 43.133.60.168 | PM2 服务 |

### 未登记在上面表里的 apps/ 目录（26 个里占 12 个）

> 2026-09-20 补登。此前地图只覆盖 14 个目录，AI 进到未登记目录只能靠猜，
> 容易把活跃项目当垃圾（也容易被旧 audit 反向误导）。**新增目录必须先登记在这里。**

| 目录 | 状态 | 事实 |
|---|---|---|
| `apps/luelan-course/` | **活跃，单机风险** | 全栈项目（frontend/server/deploy + `DEPLOY.md` + `ecosystem.config.js`，端口 **3009**），引用 `auth.luelanai.com` 走 SSO。最后 commit 2026-09-19；**无 remote、无上游**。线上域名待用户确认后再写入本表 |
| `apps/luelan-OneHub/` | 活跃 | 多应用容器（`apps/`、`data/`、`docs/`、`collect.sh`），有 `AGENTS.md`/`BRAND.md`/canonical 规则；4 个本地 worktree；最后 commit 2026-07-05 |
| `apps/AI-Concept/` | 未上线 | 一站式 AI 综合服务平台，待评估（见 shared/08「工具/内部/周边」） |
| `apps/Game-IAA ALL/` | 立项期 | 猫咪小游戏量产线母项目。⚠️ 目录名带空格，canonical 规则文件名却是 `Game-IAA-ALL.md` |
| `apps/game-wzmx/` | 有仓无入口 | 有 `.git`/`.codebuddy/`，但**没有 `CLAUDE.md`/`AGENTS.md`** → 不被 `discoverProjects` 发现，validate 不检查；canonical `game-wzmx.md` 成了无人认领的规则 |
| `apps/godot-game/` | 容器目录 | 本身无 `.git`；真实项目是子目录 `BulletRoguelite/`（有 remote）与 `party/`（**无 remote**）。工具的项目发现只扫 `apps/<一层>`，这两个子仓永远不进 validate |
| `apps/luelan-gengwang-mp/` | 小程序壳 | 梗王的 webview 包装，8 文件，无 `.git`（描述与 shared/08 一致） |
| `apps/catpaw books/` | 原创内容，**2026-09-20 起有仓无 remote** | 两部小说章节 + `projects/REGISTRY.md` 断点续作协议；已建 canonical `.agent/rules/projects/catpaw-books.md`，`AGENTS.md` 与 `.claude/rules/shared/` 副本已入本仓，正式被 `discoverProjects` 接管 |
| `apps/luelan-EndPoint/` | 原创文档，**2026-09-20 起有仓无 remote** | 只有 `docs/`（出海方案/产品架构）；没有 `AGENTS.md` → 仍不被 `discoverProjects` 发现，canonical 规则也还没建（同 `game-wzmx` 那类"有仓无入口"） |
| `apps/novel-translator/` | 自用 CLI | 中文网文出海翻译，见 shared/08 |
| `apps/CoPlay/` | **残骸，勿当第二个 coplay** | 只剩 `frontend/`，其 `dist/index.html` 是 Vue 产物；现役 CoPlay 是 `apps/luelan-coplay/`（React）。旧 H5 完整副本在 `coplay-h5-rescue` 分支 |
| `apps/renpy-8.5.0-sdk/` | 保护目录 | 见下文「Ren'Py 特例」 |

## 服务器分布

| 服务器 | IP | 角色 | 跑什么 |
|---|---|---|---|
| 香港（luelan-ai） | `43.132.228.195` | 付费业务主战场 | portal/company/auth/writing/resume/ruxi-api + nginx 301 演示站新域 → 旧域 |
| 上海（luelan-main） | `121.4.98.150` | 演示站 + 旧域 301 入口 | 7 个演示站 + 6 个付费业务旧域 nginx 301 → 新域 |
| 新加坡（hermes） | `43.133.60.168` | Agent / Telegram Bot | Hermes 业务，跟用户登录系统隔离 |

## 域名 DNS 配置事实（DNSPod）

- `luelan.online` zone：所有 A 记录 → 上海 `121.4.98.150`
- `luelanai.com` zone：所有 A 记录 → 香港 `43.132.228.195`（**包括演示站子域**，用户笔误时香港 nginx 会 301 跳回旧域）
- `hermes.luelanai.com` 不应该加（Hermes 在新加坡，不在香港）；用户访问应走 `hermes.luelan.online`

## 术语与歧义映射

- “个人站 / 个人主站 / luelanai.com” → `luelan-portal/`
- “企业站 / 公司站 / company.luelanai.com” → `apps/luelan-company/`
- “主站 / 官网 / 首页” 默认视为歧义词；未确认前不得自行假定是个人站还是企业站
- 若用户同时提到“站点 + 后台 / API”，必须继续拆清是前端、后台还是接口服务
- 注意：个人主站不在 `apps/` 里；企业站在 `apps/` 里；两者是不同站点

## 当前核心上线项目

- 核心上线产品：`luelan-writing-pro`、`luelan-ruxi`、`luelan-resume`
- 统一认证中心：`luelan-auth`
- 开发工具重点项目：`luelan-Clawclip`

## 根目录非上线项目与残留

> 2026-09-20 重写。原小节标题写「无独立 .git，由根仓库跟踪」，但列出的 `ai-course-factory/`
> 实际自带 `.git` 且有 remote，根仓也从没跟踪它——按"谁真正跟踪它"重新分类。

### 根仓库直接跟踪（确实无独立 .git）

- `roguelike_survivor/`：Godot 4 肉鸽幸存者原型，含 `docs/` 设计文档（根仓跟踪 165 个文件）。
  ⚠️ 与 `apps/godot-game/BulletRoguelite/roguelike_survivor/` **已分叉**：内层那份多出 `locales/`、
  `.godot/`（说明 Godot 编辑器实际打开的是内层那份），根这份独有 `docs/`。两份都有独有内容，
  合并或删除前必须人工比对，不要按"看起来重复"处理。

### 自身是独立 Git 仓（根仓已忽略；改动必须在各自仓内 commit）

- `ai-course-factory/`：AI 课程内容工厂（多模块 Markdown + HTML 内容站），3.8G，
  remote `github.com/Ylsssq926/kecheng2026`。2026-09-20 实测 **ahead 59 + 212 个未提交文件**，
  最后 commit 停在 2026-06-05，而工作树一直改到当天 —— 三个月的内容只在本地一块盘上。

### 含真实隐私，刻意不入任何仓库（本地唯一副本，需要单独加密备份）

- `resume-workspace/`：掠蓝个人简历制作与求职资料工作区，含个人信息档案、简历 HTML/PDF 成品、打招呼话术。**不进 git**
- `profile/`：个人信息全局总控台（SSOT），含个人主档、6 段职业经历战绩库、10+ 独立产品矩阵、开源证据链、一人公司创始人画像与数字资产台账。**不进 git**

> "不进 git"只解决泄露风险，不解决丢盘风险。这两个目录 + `.agent/private/`（含 SSH 私钥、
> prod env 快照）目前**零副本**，备份策略见 `governance/`，需用户定方案。

### 本机工具链与门户站时代残留（已加入根 `.gitignore`，不得 `git add`）

- `flutter/`（822M，自带 `.git`，官方 stable 裸克隆）+ `.pub-cache/`（123M）：某次把 Flutter SDK
  直接装在统筹根目录；治理层（`governance`/`docs`/`deploy`/`tools`/`.agent`）**没有任何脚本引用**
  `flutter/bin` 或 `FLUTTER_ROOT`。建议移到 `F:\dev-sdk\` 之类位置 —— **待用户决定，未动**。
- `server-portal/`：门户站时代残骸，只剩 `src/components/{Hero,Projects}.tsx`；与现役 `luelan-portal/`
  无对应关系。完整副本已固化在根仓 `coplay-h5-rescue` 分支。
- `.server-backups/`（269M）：Hermes 生产机 `/root/.hermes` 的 2026-06-09 完整状态转储，
  **明文未加密、仅此一份副本**，内含生产 `.env`(24KB)、`auth.json`、`config.yaml`、两个 SQLite、
  `pairing/*.json` 与 170M 的 `credential-scanner.tgz`；包内唯一的 `manifest.txt` 实测是 **0 字节**。
  逐项清单、恢复注意点与留删取舍见 `.server-backups/README.md`（该目录不入仓，说明只写在本地）。
- `quarantine-luelan-resume/`（112M）：2026-06-11 旧简历快照，**自带 README** 写明"当前唯一入口是
  `apps/luelan-resume/`、禁止合并回去"，属有意隔离，不要当垃圾删。
- `governance/archive/`（778M）：其中 726M 是 2026-05-27 整治归档的项目副本（含约 435M `node_modules`
  与 5 份重复的 `d12.mp4`）。逐项构成、归档规范与可回收量见 `governance/archive/README.md`。

> 这些目录都不是线上站点，不接 SSO，不进 `apps/`；如需独立 git 仓请先 `git init` 并加入根 `.gitignore`。

## Ren'Py 特例

- `apps/renpy-8.5.0-sdk/` 是活动 Ren'Py 工作区，用户仍有任务在跑，禁止批量清理、移动、重置或同步规则。
- ⚠️ 它的 `.git` 是**空壳**（见「工作区结构」），即该目录下的剧本等原创内容目前**没有版本控制**。
  是否补 `git init` 需用户决定；在决定前，任何"整理"都不得触碰此目录。
- 🚨 **对它会静默操作根仓**：因为 `.git` 无效，`git -C apps/renpy-8.5.0-sdk <任何命令>` 会**向上
  回落到 `F:/Azure Glance/.git`**，于是你在"renpy 目录"里跑的 `git add` / `git reset` / `git status`
  其实作用在**根仓**上。2026-09-20 一个批量提交脚本就因此把根仓索引整个 reset 掉（未丢内容）。
  写任何遍历 `apps/*/` 的 git 脚本时，必须先用 `(dir/'.git'/HEAD').exists()` 之类判据确认它是真仓，
  或直接跳过 renpy。`discoverProjects()` 本身已排除 renpy，受影响的只有临时脚本。
- `apps/renpy-8.5.0-sdk-clean/` **现已不存在**（2026-09-20 实测）。它曾经是分支
  `split-gui-studio-from-sdk` 的 worktree；相关历史审计保留在
  `governance/audits/2026-05-11-renpy-clean-worktree-audit.md`。
- 处理 Ren'Py 前先读上面那份审计（旧引用名 `RENPY-CLEAN-WORKTREE-AUDIT.md` 已失效）。
- validate/sync 仍默认排除两个 Ren'Py 路径（`rules-utils.js` 的 `isRenpyPath` 保留 `-clean`
  分支判断，以防该目录重新出现），除非显式白名单并再次确认。
- 注意别漏保护**真实存在**的 worktree：根仓有一个外部 worktree 在
  `C:/Users/Jonathan/.config/superpowers/worktrees/Azure-Glance/deploy-static-governance`
  （分支 `deploy/static-governance`，已推 origin）；各子仓另有若干指向已消失路径的陈旧
  worktree 注册（`C:/Users/黑受/.cursor/worktrees/...` 等），`worktree prune` 属写操作，需用户确认。
