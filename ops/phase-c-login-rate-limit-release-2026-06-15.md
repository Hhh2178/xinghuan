# Phase C 第三批登录限流灰度/生产发布记录（2026-06-15）

## 发布目标

- 为成员登录与后台登录补齐失败计数与基础限流。
- 保持既有会话治理与 CSRF 同源防护不回退。

## 灰度发布

- release: `20260615-phase-c-login-rate-limit-gray-r1`
- current:
  - `/opt/apps/xinghuan-canvas-next/releases/20260615-phase-c-login-rate-limit-gray-r1`
- `db:migrate`:
  - `applied = ["013_login_rate_limit.sql"]`
  - `skipped = 12`
- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 验收：
  - CSRF 登录同源校验 = `ok`
  - 成员登录限流 = `ok`
  - 后台登录限流 = `ok`
  - 会话撤销链路 = `ok`

## 生产发布

- release: `20260615-phase-c-login-rate-limit-prod-r1`
- current:
  - `/opt/apps/xinghuan-canvas/releases/20260615-phase-c-login-rate-limit-prod-r1`
- `db:migrate`:
  - `applied = ["013_login_rate_limit.sql"]`
  - `skipped = 12`
- 服务状态：
  - `xinghuan-canvas.service = active`
  - `xinghuan-canvas-worker.service = active`
- 验收：
  - CSRF 登录同源校验 = `ok`
  - 成员登录限流 = `ok`
  - 后台登录限流 = `ok`
  - 会话撤销链路 = `ok`

## 当前结论

- Phase C 已完整上线：
  - 会话治理
  - CSRF 同源防护
  - 登录限流与失败计数
- 多用户正式化加固可进入 Phase D。
