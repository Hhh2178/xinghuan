# Phase B 后台配置 Revision 冲突防护灰度记录

日期: `2026-06-13`

## 目标

- 为后台 AI 助手配置增加版本化保存。
- 为后台任务并发配置增加版本化保存。
- 保证 stale 页面保存时返回明确冲突，而不是静默覆盖新配置。
- 回归验证画布 revision、资源 revision、多用户隔离没有被破坏。

## 本轮发布

- release: `20260613-phase-b-admin-settings-revision-gray-r1`
- gray current:
  - `/opt/apps/xinghuan-canvas-next/releases/20260613-phase-b-admin-settings-revision-gray-r1`
- 环境:
  - `https://canvas-next.hhh2121.xyz`
  - `http://127.0.0.1:18200`

## 代码与迁移

- 新增迁移:
  - `apps/api/db/011_admin_settings_revision.sql`
- 后端:
  - `/api/admin/assistant/settings` PATCH 支持 `revision`
  - `/api/admin/system` GET 返回 `taskQueueSettingsRevision` / `taskQueueSettingsUpdatedAt`
  - `/api/admin/system` PATCH 支持 `revision`
  - stale 写入统一返回 `409 ADMIN_SETTINGS_REVISION_CONFLICT`
- 后台:
  - AI 助手配置保存附带 `revision`
  - 系统并发配置保存附带 `revision`
  - 冲突时自动刷新最新配置并提示管理员重新确认后再保存
- 验收:
  - 新增 `scripts/verify-admin-settings-revision-conflict.mjs`
  - 新增 package 入口 `verify:admin-settings-revision-conflict`

## 灰度部署结果

- `npm ci` 完成
- `db:migrate`:
  - `applied = ["011_admin_settings_revision.sql"]`
- 服务状态:
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- `GET /api/status = ok`

## 实际验收

执行:

- `npm run verify:admin-settings-revision-conflict`
- `npm run verify:resource-revision-conflict`
- `npm run verify:canvas-revision-conflict`
- `npm run verify:multi-user-isolation`

结果:

- `verify:admin-settings-revision-conflict`
  - `ok = true`
  - AI 助手配置 stale save => `409 ADMIN_SETTINGS_REVISION_CONFLICT`
  - 任务并发配置 stale save => `409 ADMIN_SETTINGS_REVISION_CONFLICT`
- `verify:resource-revision-conflict`
  - `ok = true`
- `verify:canvas-revision-conflict`
  - `ok = true`
- `verify:multi-user-isolation`
  - `ok = true`

## 当前结论

- Phase B 的后台关键设置版本化保存已在灰度完成真实验收。
- 当前 Phase B 已覆盖:
  - 画布 revision
  - 资源 revision
  - 后台 AI 助手配置 revision
  - 后台任务并发配置 revision
- 本轮没有破坏 Phase A 的多用户隔离基线。
