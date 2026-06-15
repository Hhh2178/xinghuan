# Phase C 第三批登录限流本地验收记录（2026-06-15）

## 范围

- 登录失败计数
- 基于 `scope(member/admin) + email + ip` 的限流
- 成功登录后清除失败计数
- 后台与前台登录提示收口

## 本轮改动

- 新增数据库迁移：
  - `apps/api/db/013_login_rate_limit.sql`
- 新增验收脚本：
  - `scripts/verify-login-rate-limit.mjs`
- 后端实现：
  - `apps/api/src/server.ts`
- 后台提示：
  - `apps/admin/src/admin-api-client.ts`
  - `apps/admin/src/main.tsx`
- 前台提示：
  - `apps/web/src/components/LoginGate.tsx`

## 限流策略

- 统计维度：`scope(member/admin) + email + ip`
- 失败统计窗口：`10 分钟`
- 连续失败阈值：`5 次`
- 封禁时长：`15 分钟`
- 达到阈值后的下一次尝试返回：
  - `429 LOGIN_RATE_LIMITED`
  - `retryAfterSec`

## 本地验收

- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/web`
- `npm run build:single-port`
- `node scripts/verify-login-rate-limit.mjs`
- `node scripts/verify-csrf-origin-guard.mjs`
- `node scripts/verify-admin-session-governance.mjs`

## 结果

- 登录限流脚本通过：
  - 成员登录错误 5 次后，第 6 次返回 `429 LOGIN_RATE_LIMITED`
  - 后台登录错误 5 次后，第 6 次返回 `429 LOGIN_RATE_LIMITED`
  - 正确管理员登录不受影响
- CSRF 同源防护复验通过
- 会话治理复验通过

## 待下一步

- 灰度执行 `db:migrate` 应用 `013_login_rate_limit.sql`
- 灰度复验：
  - `verify-login-rate-limit`
  - `verify-csrf-origin-guard`
  - `verify-admin-session-governance`
  - `verify-multi-user-isolation`
- 灰度通过后再推生产
