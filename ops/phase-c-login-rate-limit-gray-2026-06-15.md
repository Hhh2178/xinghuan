# Phase C 第三批登录限流灰度发布记录（2026-06-15）

## 发布目标

- 为成员登录与后台登录补齐失败计数与基础限流。
- 保持已有会话治理与 CSRF 同源防护链路不回退。

## 发布内容

- release: `20260615-phase-c-login-rate-limit-gray-r1`
- 路径：
  - `/opt/apps/xinghuan-canvas-next/releases/20260615-phase-c-login-rate-limit-gray-r1`
- 当前指针：
  - `/opt/apps/xinghuan-canvas-next/current`

## 迁移

- 执行：
  - `node scripts/db-migrate.mjs`
- 结果：
  - `applied = ["013_login_rate_limit.sql"]`
  - `skipped = 12`

## 服务状态

- `xinghuan-canvas-next.service = active`
- `xinghuan-canvas-next-worker.service = active`
- `curl http://127.0.0.1:18200/api/status = ok`

## 灰度本机验收

- CSRF 登录校验：
  - 伪造 `Origin=https://evil.example` 登录 => `403`
  - 同源登录继续成功
- 成员登录限流：
  - 连续 5 次错误密码 => `401 INVALID_CREDENTIALS`
  - 第 6 次 => `429 LOGIN_RATE_LIMITED`
- 后台登录限流：
  - 连续 5 次错误密码 => `401 INVALID_CREDENTIALS`
  - 第 6 次 => `429 LOGIN_RATE_LIMITED`
- 会话治理回归：
  - 管理员可读取 `/api/admin/sessions`
  - 管理员可撤销成员会话
  - 成员被撤销后 `/api/auth/me` 立即返回未登录

## 当前结论

- Phase C 第三批“登录限流与失败计数”已在灰度上线并通过实链验收。
- 当前待办只剩生产发布与公网复验。
