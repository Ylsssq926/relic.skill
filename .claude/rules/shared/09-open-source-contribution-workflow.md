<!-- AUTO-GENERATED: do not edit directly. Source: F:/Azure Glance/.agent/rules/shared/09-open-source-contribution-workflow.md -->

# 开源贡献 PR 工作流（外部仓库）

> 这是给我们工作区**之外的开源仓库**提 PR 的专用流程。
> 工作区内部子项目（apps/* / luelan-portal）按 shared/05 处理。

## 适用范围

- **是**：给 microsoft/markitdown、Pipelex/pipelex、QuantumNous/new-api 等外部仓库提 PR
- **否**：工作区内自己的 luelan-* / 子项目（按 05-workflow 规则）
- **否**：fork 后不上游的私人改造（普通 git 流程）

外部仓库 clone 位置统一在 `F:/Project/<repo-name>/`，**不入工作区根仓库**。

## 不可破的 7 条铁律

1. **筛选只看"爆发潜力"**：50-3000 stars / 维护者活跃 / contributor 少 / 项目年龄 3-12 月。**禁止**用"我熟不熟领域"做加权。
2. **价值审查是主模型亲自做**，不能直接拿侦察 subagent 排序。reviewer 第一反应是"这有什么用"就不做。
3. **七阶段流程不跳**：调研 → 实施 → 交叉审查 → 修复 → commit 拆分 → PR 材料 → 提交执行。
4. **代码用强模型，对外文字用表达模型**：Opus 4.7 / GPT-5.5 写代码，Opus 4.6 写 PR 描述 / commit body / reviewer 回复。
5. **禁止编造个人使用场景**：PR 描述里 "我用 X 时遇到 Y" 全部默认是编的，要改成代码事实陈述。
6. **PR 提交后默认沉默**，不主动找维护者搭话。AI bot 反馈 push 修复，不回 thread。
7. **CI 真命令做本地验证**：本地 lint/typecheck 必须覆盖**所有改动目录包括测试**，优先用项目自己的 `make check` 等命令而不是手挑目录。

## 详细流程 / 模板 / 历史 PR 记录

完整操作手册（调研报告必须覆盖什么、subagent 提示词要写什么、CLA 怎么签、gh CLI 命令、AI bot 监控、commit 拆分模板、备份分支、装机授权、历史 PR 复盘）见：

→ `governance/playbooks/opensource-pr.md`（路径相对**工作区根**；shared 会被逐字复制进各项目
`.claude/rules/shared/`，不要写成 `../../../` 那种只在 canonical 位置成立的相对链接）

**做开源 PR 时必读这份 playbook**。本规则只是入口和铁律快查。

## 不再询问的事

用户已明确表态后续不需要逐项确认：
- 提 PR 的方向选择（用户授权"分析清楚直接提"）
- commit 拆分策略（按 playbook 4 段式）
- PR 描述模板
- 一次提多个 PR / 不到 issue 占坑 / 保留 QQ 邮箱

仍需问的事：
- 装系统级工具链
- PR 提到 upstream 之前的最终确认
- 工作流偏离本规则时
