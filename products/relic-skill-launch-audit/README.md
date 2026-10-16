# relic-skill-launch-audit

帮助独立 Skill 作者在发布和售卖前检查：触发条件、权限声明、兼容性、测试、压缩包卫生、许可证和商品交付说明。

## 当前状态

产品骨架阶段。第一版检查项将从本仓库已经验证过的演示站构建、商业包打包、敏感内容扫描和销售清单中抽取，后续再拆成可执行的检查脚本。

## 不是什么

不是法律意见、渗透测试、平台审核承诺，也不是把一个不成熟的 Skill 包装成“生产就绪”。

`TODO(image): add a redacted PASS/REVISE/BLOCKED report preview.`

## 可执行验收

运行 `python tools/audit_skill.py path/to/skill --report audit-report.md`。审计器返回 `PASS`、`REVISE` 或 `BLOCKED`，并输出文件及行号；退出码分别为 0、1、2。报告仅用于发布准备，不构成法律、安全或平台认证。
