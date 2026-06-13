# 数据库目标防呆发布记录

日期：`2026-06-13`

## 发布目标

- 防止灰度/正式环境在后续发布中静默连错 PostgreSQL 数据库。
- 防止画布列表被空列表整表替换，降低用户画布被误清空风险。

## 涉及版本

- 灰度 release：
  - `20260613-db-target-guard-gray-r1`
- 正式 release：
  - `20260613-db-target-guard-prod-r1`

## 发布内容

- `apps/api/src/server.ts`
  - API 启动前新增 `XINGHUAN_EXPECTED_DATABASE_NAME` 校验。
  - 默认拒绝空画布列表整表替换；只有明确删除最后一个画布时才允许。
- `apps/worker/src/worker.ts`
  - Worker 启动前新增 `XINGHUAN_EXPECTED_DATABASE_NAME` 校验。
- `config/canvas-next.env.example`
- `config/canvas-production.env.example`
  - 新增 `XINGHUAN_EXPECTED_DATABASE_NAME` 模板项。
- `ops/gray-deploy-runbook.md`
- `ops/production-deploy-runbook.md`
- `ops/production-acceptance-checklist.md`
  - 新增数据库目标校验步骤。

## 环境锁定值

- 灰度：
  - env: `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
  - `XINGHUAN_EXPECTED_DATABASE_NAME=xinghuan_canvas_gray`
- 正式：
  - env: `/opt/apps/xinghuan-canvas/shared/canvas.env`
  - `XINGHUAN_EXPECTED_DATABASE_NAME=xinghuan_canvas_next`

## 灰度验收

- `readlink -f /opt/apps/xinghuan-canvas-next/current`
  - `/opt/apps/xinghuan-canvas-next/releases/20260613-db-target-guard-gray-r1`
- `systemctl is-active xinghuan-canvas-next.service`
  - `active`
- `systemctl is-active xinghuan-canvas-next-worker.service`
  - `active`
- `curl http://127.0.0.1:18200/api/status`
  - `environment=gray`
- API 启动日志：
  - `databaseTargetCheck=passed`
  - `currentDatabase=xinghuan_canvas_gray`
- Worker 启动日志：
  - `databaseTargetCheck=passed`
  - `currentDatabase=xinghuan_canvas_gray`

## 正式验收

- `readlink -f /opt/apps/xinghuan-canvas/current`
  - `/opt/apps/xinghuan-canvas/releases/20260613-db-target-guard-prod-r1`
- `systemctl is-active xinghuan-canvas.service`
  - `active`
- `systemctl is-active xinghuan-canvas-worker.service`
  - `active`
- `curl http://127.0.0.1:18100/api/status`
  - `environment=production`
- API 启动日志：
  - `databaseTargetCheck=passed`
  - `currentDatabase=xinghuan_canvas_next`
- Worker 启动日志：
  - `databaseTargetCheck=passed`
  - `currentDatabase=xinghuan_canvas_next`

## 结论

- 从本次发布开始，若后续 env 配错、数据库目标漂移、灰度/正式互串，API 和 Worker 都会在启动阶段直接报错，而不是继续提供一个“能打开但数据错位或像被清空”的运行态。
- 当前这次发布只做“未来不再静默清空”的防护，不包含历史画布恢复。
