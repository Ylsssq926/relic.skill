<!-- AUTO-GENERATED: do not edit directly. Source: F:/Azure Glance/.agent/rules/shared/02-runtime-and-operations.md -->

# 运行、部署与运维公共规则

## 双服务器双域名总览

| 服务器 | IP | 角色 | 域名 |
|---|---|---|---|
| 香港（luelan-ai） | `43.132.228.195` | 付费业务（用户支付/AI/JWT） | `*.luelanai.com` |
| 上海（luelan-main） | `121.4.98.150` | 演示站 + 旧域 301 入口 | `*.luelan.online`（演示站）+ 旧付费域 301 |
| 新加坡（hermes） | `43.133.60.168` | Agent / Telegram Bot | `*.luelan.online`（hermes 子域）|

> 付费业务**全部在香港**；演示站继续在上海；Hermes 在新加坡跟登录系统隔离。
> 旧 `*.luelan.online` 付费业务子域 nginx 301 → `*.luelanai.com`。
> 新 `*.luelanai.com` 演示站子域（gengwang/2048maomao/ai-love/cat-planet/coplay/clawclip/relic）nginx 301 → `*.luelan.online`，用户笔误兼容。

## 端口注册表

### 香港 43.132.228.195（付费业务）

| PM2 进程名 | 端口 | 域名 / 入口 |
|---|---:|---|
| `auth` | 3008 | `auth.luelanai.com` |
| `writing-pro` | 3001 | `writing.luelanai.com` |
| `resume` | 3006 | `resume.luelanai.com` |
| `ruxi` | 3004 | `ruxi.luelanai.com`（前台 Next.js）|
| `ruxi-api` | 3007 | `ruxi.luelanai.com/api`（后端 Express）|

> 注：ruxi 后台 admin 原端口 3005 已停（2026-06 内存治理），改为静态导出 + nginx alias 托管 `/luelan`（`/opt/apps/services/luelan-ruxi/admin-dist/`），`/api/` 仍反代 3007。
> ruxi-admin 不再作为 PM2 进程运行，**已从 deploy/ecosystem.config.js 移除**。线上只有 ruxi(3004) + ruxi-api(3007) 两个 PM2 进程。
> 根目录旧 `ecosystem.config.js`（非 deploy/ 下）已于 2026-08 清理，如再出现直接删除。
>
> **2026-06-20 PM2 配置修复**：
> - ruxi-api / ruxi 此前被手动 `pm2 start` 启动，max_memory_restart=250M，导致 ruxi-api 频繁触顶重启（148 次）。
> - 已改用 `pm2 start deploy/ecosystem.config.js --env production`，max_memory_restart=1G，重启归零。
> - ⚠️ 上面这个 `deploy/ecosystem.config.js` 是**服务器侧路径**，根工作区里并没有这个文件
>   （`git log --all -- '*ecosystem.config.js'` 为空，本地也无副本）。改 PM2 配置前先在服务器上
>   `pm2 describe <name>` / `pm2 export` 取回现状，不要假设本地有一份可以直接编辑。
>
> **2026-08-28 全量部署修复**：
> - ruxi-api errored（16 次重启失败），根因是新增 `runtimeSafety.js` 要求 `.env` 配置 `AUTH_INTROSPECTION_URL`/`AUTH_INTERNAL_SERVICE_AUDIENCE`/`CORS_ORIGINS`/`LISTEN_HOST`/`RUNTIME_ENV`/`E2E_LOCAL_MODE` 等变量，服务器 `.env` 缺失。
> - 已补充缺失变量，全量重新部署，ruxi-api + ruxi 均正常启动。
> - 服务器残留清理：删除 5 个 .bak 目录 + admin/node_modules + admin/.next + 根目录旧 ecosystem.config.js，释放约 620M。
>
> **2026-08-28 nginx 配置统一与 admin 缓存策略**：
> - 发现 `sites-enabled/default`（symlink → `sites-available/default`）与 `sites-enabled/default.new`（独立文件）双份配置共存，`default` 按字母序先加载，`default.new` 的 server blocks 被 ignored 导致修改不生效。
> - 已将 `default.new` 内容合并到 `sites-available/default`，删除 `default.new`。conflicting server name 警告基本消除。
> - ruxi admin 静态资源缓存策略：
>   - `/luelan/_next/static/`（JS/CSS 带 content hash）→ `Cache-Control: public, max-age=31536000, immutable`
>   - `/luelan` HTML → `Cache-Control: no-cache`（确保更新即时生效）
>
> **2026-06-20 auth 服务调用优化（部分失败，已回退）**：
> - 尝试在 `/etc/hosts` 添加 `127.0.0.1 auth.luelanai.com` 让 ruxi-api 走本机 nginx 绕过 Cloudflare。
> - **失败**：ruxi-api 的 `assertAuthServiceUrlResolvesPublicly`（SSRF 防护）会拒绝解析到 127.0.0.1 的域名，报错 `AUTH_SERVICE_URL 域名解析到内网或 localhost`。
> - 已回退 /etc/hosts，恢复 Cloudflare 解析。deleted-users-sync 的 `fetch failed` 仍会偶发，但不致命（5 分钟一次，失败等下次）。
> - **不要**再尝试用 /etc/hosts 把 auth.luelanai.com 指向 127.0.0.1，除非同时修改 `providerUrlSafety.js` 的 SSRF 防护逻辑。

### 上海 121.4.98.150（演示站）

| PM2 进程名 | 端口 | 域名 |
|---|---:|---|
| `2048maomao` | 3002 | `2048maomao.luelan.online` |
| `ai-love` | 3003 | `ai-love.luelan.online` |
| `clawclip` | 8080 | `clawclip.luelan.online` |

静态演示站（gengwang / cat-planet / coplay / relic）由 nginx 直接服务静态文件，不经 PM2。

### 新加坡 43.133.60.168（Hermes / Agent）

跟用户登录系统隔离，按 `apps/openclaw-relics`（如有）独立维护。

## 后台入口标准

- 后台路径默认：`https://<域名>/luelan`
- 后台凭据见 `.agent/private/operations-private.md`
- 后台账号 ≠ 前台用户账号，严禁混淆

## 统一认证服务（SSO）

- 源码：`apps/luelan-auth/`
- 部署：香港 PM2 `auth`（3008）
- 已接入：writing-pro / ruxi / resume / company / portal
- 详细架构（cookie 三件套、路由表、env 矩阵、secret 旋转流程）见 `shared/07-sso-architecture.md`

## 服务器诊断脚本（按真实能力分清，别再统称"只读"）

| 脚本 | 实际能力 | 认证方式 | 默认目标 |
|---|---|---|---|
| `deploy/remote-main.py` | 有 `DENY_PATTERNS` 拒绝写操作，接近只读（`:34,:58`） | **仅密码**（`:73`） | hk `43.132.228.195`（`:29`） |
| `deploy/remote-hermes.py` | **任意命令、零护栏**（`:28-29` 直接 exec argv） | 仅密码 | 新加坡 |
| `deploy/inspect-prod-env.py` | 只读线上 `.env` 的 key 名；按自身 SERVICES 表选机器 | **仅密钥**（`:97`） | 按服务路由表 |
| `deploy/upload.py` | **写生产**：原子替换远端目录、可 `pm2 reload` | 密钥优先（`:295-297`）+ 密码兜底（`:304`） | hk（`:63`） |

三条实测结论（2026-09-20）：

1. **hk 的只读诊断链路是断的**：hk 已 `PasswordAuthentication no`（见"已知线上风险"），
   而 `remote-main.py` 只会用密码认证 → 它对默认目标 hk 连不上。在给它加 `key_filename`
   支持之前，不要把 `remote-main.py` 当作 hk 可用的诊断入口；hk 诊断走
   `inspect-prod-env.py`（密钥）或在 `upload.py` 的密钥通道里跑只读命令。
2. **`main` 这个别名在不同脚本里指向相反的两台机器**：`upload.py:63`、`remote-main.py:29`
   的 main = hk；`upload-authorized-key.py:21`、`setup-xray-reality.py:31` 的 main = 上海
   （那边 overseas 才是 hk）。新代码不要用 `main`，显式写 `hk` / `sh` / `sg`。
3. `inspect-prod-env.py` **不认** `DEPLOY_MAIN_HOST` 的通用语义（它有自己的 per-service 路由，
   只有 `DEPLOY_DEMO_HOST` 会影响它），照搬"上海调用必须显式传 DEPLOY_MAIN_HOST"那条对它无效。

## ⚠️ deploy.env 配置陷阱（铁律）

**绝对不要在 `.agent/private/deploy.env` 里写 `export DEPLOY_MAIN_HOST=...`**！

deploy.env **只**设：
- `DEPLOY_SSH_KEY`
- `DEPLOY_MAIN_PASSWORD`
- `DEPLOY_HERMES_PASSWORD`

历史教训（2026-05-27）：之前会话在 deploy.env 写过 `DEPLOY_MAIN_HOST=121.4.98.150`（上海），后续所有 SSH 都被静默路由到上海 demo，导致一连串 P0 误判（"PM2 全 stopped""nginx 配置丢失"实际是连错服务器）。

## ⚠️ 服务目录上传铁律

- **生产上传前先跑 `--dry-run`**：只打印目标主机/目录/排除/保留/reload/备份策略，不连服务器。
- **容器目录会被直接拒绝**：`/opt/apps`、`/opt/apps/static`、`/opt/apps/services` 与
  `/opt/apps/services/<service>` 都不是合法目标（2026-09-20 前只拦后两类）。
- `deploy/upload.py` 会原子替换远端目标目录：先解压到临时目录，再把旧目录移到 `.bak`，最后把临时目录切成正式目录。
- `--exclude` 只是不上传本地文件，**不是**保留远端文件；服务目录同步时必须同时使用 `--preserve-remote`。
- 任何 PM2 服务根目录或 `server/` 目录部署，若排除 `.env` / `data` / `data.db*` / `server-config.json` / `node_modules`，必须 preserve 对应远端路径，否则会导致后台登录、SSO、SQLite 数据或依赖目录从当前线上目录消失。
- 典型安全模板：`--exclude data --exclude .env --preserve-remote data --preserve-remote .env --preserve-remote node_modules --reload-pm2 <name>`。

## 已知线上风险

- `/opt/apps/ecosystem.config.js` 过时不完整，仍含旧 `story/story-admin` 命名；PM2 权威以 `pm2 jlist` 为准
- `clawclip` 上海 .env 0 keys 风险仍在（演示站影响小）
- hk 服务器 sshd-hardening 后已禁用密码登录（`PasswordAuthentication no`）—— 必须用密钥部署

## 浏览器自动化与登录态

- 公共 Playwright MCP（微软官方 `@playwright/mcp`）：`npx -y @playwright/mcp@latest`
- 系统 Chrome：`C:\Program Files\Google\Chrome\Application\chrome.exe`
- 公共持久化 profile：`C:\Users\Jonathan\.playwright-shared\user-data\`（不进 git）
- 一平台一 profile，账号映射见 `.agent/private/browser-profiles.md`
- 不动各项目 `.playwright/user-data`；清理前必须备份

## 详细操作流程

部署 4 个场景（纯前端 / server / admin / 诊断）+ 静态站部署 + upload.py 用法 + 生产 env 安全变更流程 + 只读审计模板，全部见：

→ `governance/playbooks/deployment.md`（路径相对**工作区根**；shared 是逐字复制进各项目的
`.claude/rules/shared/`，所以这里不能写成 `../../../` 那种只在 canonical 位置成立的相对链接）

## 运维边界

- 默认只读检查
- 部署、重启、reload、写服务器需用户明确要求
- shared 记录非敏感运维事实（IP/域名/端口/PM2 名）
- 密码、私钥、token、cookie、profile 路径放 `.agent/private/`
