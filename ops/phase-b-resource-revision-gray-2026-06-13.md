# Phase B 资源库 Revision 灰度发布记录

日期：`2026-06-13`

## 发布目标

- 将资源库分类与资源条目接入和画布一致的 revision 冲突防护
- 修正本地 file-mode 下 `/api/canvas/:id/auto-save` 的快照行为，避免旧 revision 回写

## 代码与迁移

- 新增迁移：`apps/api/db/010_resource_revision.sql`
- 新增验收脚本：`scripts/verify-resource-revision-conflict.mjs`
- 相关发布包：`20260613-phase-b-resource-revision-gray-r1`

## 灰度部署结果

- release 目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260613-phase-b-resource-revision-gray-r1`
- current 指向：
  - `/opt/apps/xinghuan-canvas-next/releases/20260613-phase-b-resource-revision-gray-r1`
- 数据库迁移：
  - `010_resource_revision.sql` 已应用
- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 健康检查：
  - `GET http://127.0.0.1:18200/api/status => success=true, environment=gray`

## 验收结果

- `verify-resource-revision-conflict`
  - `ok = true`
  - 分类/资源初始 revision 正确为 `1`
  - 首次更新后 revision 正确递增为 `2`
  - stale update/delete 全部返回 `409 RESOURCE_REVISION_CONFLICT`
- `verify-canvas-revision-conflict`
  - `ok = true`
  - `postAutoSaveRevision = 2`
  - stale save 返回 `409 CANVAS_REVISION_CONFLICT`
- `verify-multi-user-isolation`
  - `ok = true`
  - 管理员/成员双登录成功
  - 画布列表隔离成功
  - 资源列表隔离成功
  - 跨用户 `GET/PUT/auto-save /api/canvas/:id` 拒绝成功
  - 成员后台 Provider 访问被拒绝

## 结论

- 资源库的并发保护已和画布主保存链路保持一致
- 本轮没有破坏 Phase A 的多用户隔离能力
- 本地 file-mode 的 auto-save 行为已与灰度 Postgres 模式对齐
