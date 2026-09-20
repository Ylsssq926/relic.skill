<!-- AUTO-GENERATED: do not edit directly. Source: F:/Azure Glance/.agent/rules/shared/07-sso-architecture.md -->

# 07. SSO 架构与协议规范

> 状态：2026-05-30 根治 cookie 链路断裂，三业务（writing/resume/ruxi）前端直连 auth 已上线。
> 适用：所有付费业务（writing-pro / ruxi / resume / company / 主站）。
> 不适用：演示站（gengwang / 2048 / ai-love / cat-planet / coplay / clawclip / relic）继续无 SSO。

## 总览

掠蓝 SSO = **cookie 三件套（同 eTLD+1 子域共享）+ 各业务自己的登录页 UI + 业务前端直连 auth 中央验签**。

```
浏览器                                                    服务器
─────────────────────────────────────────────────────────────────────
用户访问 writing.luelanai.com
  ├─ 业务前端 fetch /api/auth/me 带 cookie → 业务后端验 lue_at JWT → 已登录
  └─ 没 cookie → 业务前端跳本地 #/auth → 业务自己的登录页（保留各自 BRAND 调性）
       │
       ├─ 用户填邮箱密码 → 业务前端【直连】 auth.luelanai.com/api/auth/login
       │      （credentials:include, body 带 {email, password, project}）
       │      ↓
       │      auth 验密码 + Set-Cookie（lue_at/lue_rt/lue_csrf）到 .luelanai.com（浏览器收到！）
       │      ↓
       │      业务前端立即调业务后端 /api/auth/me（带 cookie）
       │      ↓
       │      业务后端 ssoAuthMiddleware 解 cookie → 首次自动建本地用户 + 发欢迎积分（bootstrap）
       │      ↓
       │      业务前端跳 #/dashboard，me 返回的 user 为最终态
       │
       └─ 用户点"忘记密码" → 跳 auth.luelanai.com/reset-password（中央邮件验证）
                          → 重置成功后回业务原域
```

> **关键架构决策（2026-05-30 根治）**：业务前端**直连** auth 登录，不经业务后端中转。
> 原因：旧设计让业务后端 server-to-server fetch auth，auth 的 Set-Cookie 到不了浏览器
> → cookie jar 空 → 跨子域 SSO 全废（详见 audit 2026-05-30-sso-cookie-link-fix）。
>
> - 用户**不会在登录场景**被跳到 auth.luelanai.com（直连是 fetch，UI 仍在业务自己登录页）
> - 各业务保留自己的 BRAND 调性登录页（writing 暗色 hero / resume 简历调性 / ruxi 沉浸文学）
> - 注册仍走业务后端（含验证码 + 邀请码 + 防薅），注册成功后自动直连 auth 登录落 cookie
> - 业务后端登录路由（/api/auth/login 等）保留作降级兜底（auth 不可用时本地验证）
> - 本地开发：localhost 写不进 .luelanai.com cookie，靠 Bearer 兼容路径（中间件 Authorization 优先）

## 职责边界：auth 管身份，积分/会员/签到归各业务

**这是架构红线，别越界**：

| 归属 | 内容 | 在哪 |
|---|---|---|
| **auth 账号系统统一管** | 身份（你是谁）、登录态、cookie 三件套、global_user_id、session 管理 | `apps/luelan-auth/` |
| **每个业务自己管** | 积分、会员等级、签到、消费、活动赠送、积分流水、业务内通知 | 各业务 server |

为什么积分不能塞进 auth：每个业务的积分概念完全不同——
- writing-pro：`balance`（按字数/章节消费）
- ruxi：`credits` + `daily_free_plays`（每日免费游玩次数）
- resume：**无积分**（公益免费工具）

auth 一旦去理解这些业务细节，就不再是干净的认证中心。auth 只提供 `global_user_id`，业务拿它管自己的积分。

**首登欢迎积分**由各业务后端的 `activatePlatformUserOnLogin`（在各业务 server，幂等，只首次发）负责，不在 auth。

### 关于"SSO 登录后首登积分 toast 缺失"

现状：方案 B（前端直连 auth）登录后调 me 不返积分增量，所以新用户首次进某业务时少一个"获得 N 积分"toast。

**这不是 bug，不需要在 SSO/auth 层修**：
- 老用户日常登录本来 +0，无 toast 正确
- 新用户注册时注册 toast 已显示积分（注册走业务后端）
- 唯一缝隙（跨业务首次 bootstrap 那次少个提示）是**各业务自己的体验细节**，积分照发不影响功能
- 要补的话在**那个业务内部**做，不要往 SSO 响应里塞增量（那是给烂架构打补丁）

**未来做签到/积分活动**：在对应业务内部做"积分流水 + 通知"机制（任何积分变动写一条流水+通知，前端统一消费），让加新积分玩法时前端零改动。**不要往 auth 塞，不要用"动作 API 响应顺便带增量"这种散落逻辑。**

## Cookie 三件套

| Cookie | Domain | Path | HttpOnly | TTL | 用途 |
|---|---|---|:---:|---|---|
| `lue_at` | `.luelanai.com` | `/` | ✓ | 15 min | access JWT，所有付费子域共享，业务后端验签 |
| `lue_rt` | `auth.luelanai.com`（host-only） | `/api/auth` | ✓ | 30 day | refresh session ID（不透明 UUID，DB 存 SHA-256 hash） |
| `lue_csrf` | `.luelanai.com` | `/` | ✗（前端要读） | 1 h | CSRF token（双提交，已在写操作中校验） |

所有 cookie：`Secure=✓` `SameSite=Lax`。

### 设计权衡
- **不用 localStorage**：跨子域读不到 + XSS 防护差
- **refresh cookie host-only**：业务子域读不到 refresh token（限制暴露面）
- **CSRF token 非 HttpOnly**：前端需要 JS 读出来塞 `X-CSRF-Token` header（双提交模式）

## 必需 env 矩阵

| 项目 | JWT_SECRET | SSO_JWT_SECRET | AUTH_INTERNAL_SECRET | AUTH_SERVICE_URL | COOKIE_DOMAIN |
|---|:---:|:---:|:---:|:---:|:---:|
| `luelan-auth` | ✓ | — | ✓ | — | ✓ |
| `luelan-writing-pro` | ✓ | ✓ | ✓ | ✓ | — |
| `luelan-resume` | ✓ | ✓ | ✓ | ✓ | — |
| `luelan-ruxi` | ✓ | ✓ | ✓ | ✓ | — |

**关键约束**：
1. **auth 的 `JWT_SECRET` = 业务的 `SSO_JWT_SECRET`**（业务用此 secret 验 auth 签的 JWT）
2. **业务的 `JWT_SECRET` ≠ `SSO_JWT_SECRET`**（本地用户登录用本地 secret，跟 SSO 隔离）
3. **`AUTH_INTERNAL_SECRET` 所有服务统一**

## auth 路由表（核心）

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/auth/login` | 登录（Set-Cookie + 返回 user）|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/refresh` | 旋转 access cookie（从 lue_rt 拿 session id）|
| POST | `/api/auth/logout` | 登出（撤销 session + 清 3 cookie）|
| GET | `/api/auth/session` | 探测当前登录态 `{authenticated: bool, user?}` |
| PUT | `/api/auth/password` | 修改密码（revokeAllUserSessions + clearAuthCookies）|
| GET | `/login` | 统一登录页 HTML（return_to 白名单） |
| GET | `/reset-password` | 重置密码页（中央邮件验证）|

业务后端 `ssoAuthMiddleware` 优先级：`Authorization: Bearer` > `Cookie: lue_at`（本地开发用 Bearer）。

## 详细操作 / 内部细节

| 主题 | 位置 |
|---|---|
| **SSO_JWT_SECRET 旋转流程** | `governance/playbooks/sso-secret-rotation.md` |
| **return_to 白名单详细规则** | `governance/playbooks/sso-internals.md` |
| **多 tab 并发 refresh 处理** | `governance/playbooks/sso-internals.md` |
| **Session 表 schema + cleanup cron** | `governance/playbooks/sso-internals.md` |
| **已知风险 + 参考代码位置** | `governance/playbooks/sso-internals.md` |
