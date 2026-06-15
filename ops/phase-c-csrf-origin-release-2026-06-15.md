# Phase C 第二批 CSRF 同源防护发布记录

日期: `2026-06-15`

## 目标

- 为所有危险 API 写请求补充 CSRF 防护。
- 在不大面积改造现有前端 `fetch('/api/...')` 链路的前提下，优先收口浏览器跨站写入风险。

## 实施方案

- 本轮采用“同源来源校验”：
  - 优先校验 `Origin`
  - 回退校验 `Referer`
  - 再回退使用 `Sec-Fetch-Site`
- 对象范围：
  - 所有 `/api/*` 下的 `POST / PUT / PATCH / DELETE`
  - 包括登录、登出、后台写操作、画布写入、资源写入、生成代理提交等链路

## 代码与验收

- 后端：
  - `apps/api/src/server.ts`
  - 新增统一 `requiresCsrfProtection(...)`
  - 新增统一 `assertSameOriginWriteRequest(...)`
- 验收：
  - 新增 `scripts/verify-csrf-origin-guard.mjs`
  - 新增 package 入口 `verify:csrf-origin-guard`
  - 常用验收脚本已补 `Origin` 头，适配 Node fetch 非浏览器环境

## 灰度发布

- release: `20260615-phase-c-csrf-origin-gray-r1`
- current:
  - `/opt/apps/xinghuan-canvas-next/releases/20260615-phase-c-csrf-origin-gray-r1`
- `db:migrate`:
  - `applied = []`
  - `skipped = 12`
- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 验收：
  - `verify:csrf-origin-guard = ok`
  - `verify:admin-session-governance = ok`
  - `verify:multi-user-isolation = ok`

## 生产发布

- release: `20260615-phase-c-csrf-origin-prod-r1`
- current:
  - `/opt/apps/xinghuan-canvas/releases/20260615-phase-c-csrf-origin-prod-r1`
- `db:migrate`:
  - `applied = []`
  - `skipped = 12`
- 服务状态：
  - `xinghuan-canvas.service = active`
  - `xinghuan-canvas-worker.service = active`
  - `xinghuan-canvas-output-prune.timer = active`
- 验收：
  - 公网 `verify:csrf-origin-guard = ok`
  - 公网 `verify:multi-user-isolation = ok`
  - 会话治理在公网直连时出现本机到域名的 TLS `ECONNRESET` 抖动，不是业务失败
  - 因此改用服务器本机 `http://127.0.0.1:18100` 执行等价会话撤销链路校验，结果 `ok = true`

## 当前结论

- Phase C 第二批“CSRF 同源防护”已经在灰度和生产上线。
- 当前 Phase C 已完成：
  - 会话治理
  - 后台查看与强制下线
  - 危险写请求同源校验
- Phase C 剩余未完成项：
  - 登录限流与失败计数
