# Phase 3 画布 / 素材 PostgreSQL repository 灰度热修复记录

日期：2026-06-07
发布号：`20260607-0115-phase3-canvas-pg-hotfix-gray`

## 范围

- 修复画布 PostgreSQL repository 对 `xh_canvases` 的错误列名引用。
- 补充画布 / 素材 API 灰度验收脚本。
- 确认首次读取后画布数据真正导入 PostgreSQL。

## 发布结果

- `current` 已切到：
  - `/opt/apps/xinghuan-canvas-next/releases/20260607-0115-phase3-canvas-pg-hotfix-gray`
- 服务状态：
  - `xinghuan-canvas-next.service`: `active`
  - `xinghuan-canvas-next-worker.service`: `active`

## 根因

- 灰度登录后 `GET /api/canvas` 返回：
  - `500`
  - `{"ok":false,"success":false,"error":"column \"title\" does not exist"}`
- PostgreSQL `xh_canvases` 实际字段为 `name`，不是 `title`。
- 素材链路已能命中 PostgreSQL，因此问题限定在画布 repository SQL 与 schema 不一致。

## 验收

- `npm run verify:postgres-canvas-resource-contract`
  - 返回全部 `PASS`
- `npm run verify:canvas-resource-api`
  - 返回 `ok=true`
  - `canvasCount=13`
  - 首个画布 `nodeCount=4`
  - 首个画布 `edgeCount=2`
  - `imageResourceCount=2`
- PostgreSQL 计数：
  - `xh_canvases=13`
  - `xh_assets=2`
  - `xh_resource_categories=0`

## 说明

- 本次只重启 `xinghuan-canvas-next.service` 与 `xinghuan-canvas-next-worker.service`，未修改内部代理相关服务或路由。
- `xh_resource_categories=0` 属于当前真实数据状态，并非异常。
