<!-- AUTO-GENERATED: do not edit directly. Source: F:/Azure Glance/.agent/rules/shared/05-workflow-and-governance.md -->

# 工作流、代码质量与规则治理

## Git 与多仓库边界

- 根目录是统筹仓库；`apps/*` 和 `luelan-portal/` 多数是独立子仓库
- 修改哪个仓库，就在对应仓库内单独审查 `git status` 和 `git diff`
- **每完成一个独立步骤就 commit**，让历史可追溯、可回滚
  - 独立步骤：能用一句话说清"做了什么"且不与下一步耦合
  - 不要把多个不相关改动塞进同一个 commit
  - 半成品也可以用 `wip:` 前缀提交
- 不自动 push，除非用户明确要求
- 不执行破坏性命令：`git reset --hard` / `git clean -fd` / 强制 push / 批量删除
- 重写 git 历史前必须先 `git branch backup/<name> HEAD` 打备份
- 根仓库忽略子项目目录是有意为之，避免跨仓误提交

## 文件修改原则

- 修改前先读
- 大文件优先局部替换，避免整体覆盖
- 重做模块前先参考旧文件，不得先删后补
- 整理合并文件时先完成新版，再清理旧文件
- 用户已有改动不得还原，除非明确要求

## 规则治理（4 层结构）

| 层 | 路径 | 性质 |
|---|---|---|
| 共享公共规则 canonical | 根 `.agent/rules/shared/` | 唯一权威源 |
| 根本地规则 | 根 `.agent/rules/workspace/` | 工作区独有 |
| 私有运维层 | 根 `.agent/private/` | 凭据 / 真实账号 |
| 项目局部规则 | 根 `.agent/rules/projects/<项目名>.md` | 项目独有坑点（2026-06 起统一上收，各项目 `.claude/rules/project/` 已空） |
| **生成副本（不得手改）** | 各项目 `.claude/rules/shared/`、`.kiro/`、`.cursor/`、`.codebuddy/` 等 | 由 sync-rules 生成 |

**编辑规则**：改 canonical → validate → sync → propagate。不要在 generated shared 或 IDE 适配层手改。

`python .agent/adapters/propagate-rules.py "<msg>"` 负责 sync + 把副本逐仓 commit/push，两条保护是硬要求，
不要图省事自己写 `sync --write` + `git add -A`：

- 子仓常年混着并行会话未提交的工作，全量 `git add` / `git reset` 会把别人的 WIP 裹进治理提交，
  或悄悄改掉别人的暂存区（2026-09-20 两次实测踩到）。该脚本只按规则路径 pathspec 提交，
  仓里有非规则改动就整仓跳过。
- 项目自带 prettier/lint-staged 时会重排生成的 markdown 表格，导致根 sync 永远报 UPDATE，
  真实漂移被噪声淹没 —— 解法是把生成路径写进该项目 `.prettierignore`（已按此法处理 `apps/AI-Concept`）。

## 不作为权威规则源的目录

即使存在规则样式文件也只当参考 / 历史 / 临时副本：

- `.deploy-tmp/` / `.narrafork/`
- `**/_reference/` / `**/backup/` / `**/archived/` / `**/node_modules/`
- `governance/archive/2026-05-27-apps-cleanup/_legacy-shells/`（已归档）
- `apps/renpy-8.5.0-sdk/` 与 `apps/renpy-8.5.0-sdk-clean/`
- 外部参考仓库 / 样板仓库 / 第三方子项目

## 清理与迁移原则

- 不得因为"看起来重复"就直接删规则
- 每条旧规则都必须有去向：上收 shared / 留 project / 移入 private / 归档 audit / 标记 legacy
- 完成迁移前不得粗暴清空旧规则
- 每个项目都应能通过自身 `AGENTS.md` 被默认读取（`CLAUDE.md` 已于 2026-09-20 退役，不要再建）
- 公共常量只保留一个 canonical 来源

## 质量与验证

- 新脚本 TDD（先写失败测试再实现）
- 规则同步默认 dry-run
- 写入前后都要 validate
- validate/sync 必须识别 Git 仓库边界
- validate/sync 默认排除 Ren'Py 原目录与 clean worktree
- sync 不碰 private、project-local、业务代码、`.env`、数据库、构建产物

---

## 5 条诊断/操作铁律（绝对不能破）

每条都来自实测踩过的坑，详细教训沉淀在末尾"历史教训"章节。

### 1. 看到反例先质疑前提

诊断时如果"现状"跟"已知配置"严重矛盾（PM2 全 stopped 但用户说在跑、nginx 配置丢失但用户说线上正常），**先回头核实"我连的是不是预期那台服务器"**。

具体动作：`hostname && curl ifconfig.me` 确认服务器身份；`curl --resolve` 强制走预期 IP；看 access log 真实流量。

### 2. 子代理"修复声明"必须主模型 grep 反查

子代理"已 grep 0 处 / 已修复 X 处"**主模型必须自己 Grep 验证**。常见误判：把 `:root` 默认值当实际渲染色 / 把 CSS @property fallback 当生效色 / 把有意保留的色阶系统当"主色不统一"。

### 3. BRAND.md 是给 AI 看的速记，不是反向改代码的依据

`BRAND.md` 是**用户简易扫视后的速记总结**，帮 AI 快速理解项目调性。**不是**设计圣经 / 强制标准。

❌ 不要拿 BRAND 一句"主色 #X"就 grep 全仓换色
❌ 不要拿 BRAND "避免 emoji" 就一刀切删代码里 emoji（业务语义 ≠ 装饰）
❌ 不要拿 BRAND 描述"修正"代码精心设计的色阶 / icon / token

✅ BRAND 跟代码不一致时，**先怀疑 BRAND 速记不准**
✅ **修文档比修代码安全 100 倍** ——默认改 BRAND.md 对齐代码
✅ 真要改代码必须先问用户

### 4. deploy.env 不要覆盖默认 HOST

deploy.env **只**设 `DEPLOY_SSH_KEY` + `DEPLOY_MAIN_PASSWORD` + `DEPLOY_HERMES_PASSWORD`。**禁止**写 `DEPLOY_MAIN_HOST`。

详见 `02-runtime-and-operations.md` "deploy.env 配置陷阱"。

### 5. 敬畏用户活动工作区，禁止"分类驱动"批量动

用户说"整治 / 清理"指的是**已废弃 / 命名混乱 / 私钥隔离**。**绝对不包括**：
- 用户最近还在跑代码的活动工作区
- 含用户原创内容（剧本 / 模板 / 角色设定）的目录
- 体量大 + .git 完整的子项目

❌ 不要拿 audit "分类 D 工具/SDK" 就塞进迁移列表
❌ 不要 `shutil.move` 跨卷迁移大目录 + .git
✅ 计划里"迁移/改名/归档"涉及活动项目时**单独问用户**
✅ 子代理迁移完，主模型核查源 vs 目标文件数+大小（不是看 .git 在就算成功）

---

## 历史教训（来源审计）

| 事件 | 来源 | 影响 |
|---|---|---|
| RenPy SDK 误迁致数据物理丢失（galgame 项目内容 + .git 历史）| 2026-05-27 综合大整治 | **本轮最严重错误**。详 `governance/audits/2026-05-27-comprehensive-validation-and-cleanup-audit.md` |
| 2048 紫罗兰 fallback 被多次 audit 反复"误判" | 累犯 | commit 7d12970 已纠正过一次"不动代码生效色"，本轮 audit 又来一遍。详 `governance/audits/2026-05-27-comprehensive-validation-and-cleanup-audit.md` |
| writing-pro `codex.js` event 语义图标 ⏱ 被一刀切删 | 同上 | 业务语义图标 ≠ 装饰 emoji |
| resume 简历模板 Tailwind blue 色阶差点被 grep 替换 | 同上 | 幸亏子代理识别出"色阶系统"才没改 |
| 连错服务器误判 P0（实际是 deploy.env 覆盖了 HOST 路由到上海） | 同上 | shared/02 deploy.env 陷阱由此沉淀 |
| writing-pro 部署"看不到改动"长期痛点（upload.py 不 reload PM2）| 同上 | upload.py v3.1 加 `--reload-pm2` 解决 |
