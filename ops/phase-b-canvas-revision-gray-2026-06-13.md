# Phase B 画布 Revision 冲突防护灰度发布记录（2026-06-13）

## 目标

- 为画布保存补齐 `revision` 乐观锁，阻止同账号双标签/双设备静默互相覆盖。
- 修正 Postgres 模式下 `/api/canvas/:id/auto-save` 的双写问题，避免“主保存成功后 auto-save 再把自己撞成冲突”。
- 保持上一轮多用户隔离与 owner 校验不回退。

## 本轮变更

- 数据库迁移：
  - `apps/api/db/009_canvas_revision.sql`
  - 为 `xh_canvases` 新增 `revision integer not null default 1`
- 后端：
  - `apps/api/src/server.ts`
  - `GET /api/canvas/:id` 返回当前 revision
  - `PUT /api/canvas/:id` 按 `expected revision` 校验并在成功后自增 revision
  - 冲突时返回 `409 CANVAS_REVISION_CONFLICT` 和 `currentRevision`
  - `PATCH /api/canvas/:id/name` 同步提升 revision
  - Postgres 模式下 `/api/canvas/:id/auto-save` 改为只落本地快照，不再重复写库
  - 同时保留 owner 校验，避免跨用户 auto-save 绕过权限
- 前端：
  - `apps/web/src/services/api.ts`
  - 新增 `ApiError`
  - 画布保存接口消费 revision 返回值
  - `apps/web/src/components/Canvas.tsx`
  - 当前画布保存链路跟踪 revision
  - 发生 `CANVAS_REVISION_CONFLICT` 后阻断继续自动保存，并提示刷新后再编辑
  - 跨画布“发送节点/素材”也带上目标画布 revision
- 验收脚本：
  - `scripts/verify-canvas-revision-conflict.mjs`

## 灰度发布

- release `r1`：
  - `/opt/apps/xinghuan-canvas-next/releases/20260613-phase-b-canvas-revision-gray-r1`
  - 迁移成功：`009_canvas_revision.sql`
  - 真实 revision 验收通过
  - 同时发现回归：跨用户 `auto-save` 丢失 owner 校验
- release `r2`：
  - `/opt/apps/xinghuan-canvas-next/releases/20260613-phase-b-canvas-revision-gray-r2`
  - 补回 `/auto-save` 的 owner 校验
  - 当前灰度 `current -> /opt/apps/xinghuan-canvas-next/releases/20260613-phase-b-canvas-revision-gray-r2`

## 真实灰度验收

### 1. Revision 冲突验收

执行：

- `npm run verify:canvas-revision-conflict`

结果：

```json
{
  "ok": true,
  "initialRevision": 1,
  "savedRevision": 2,
  "postAutoSaveRevision": 2,
  "staleWriteStatus": 409,
  "staleWriteError": "CANVAS_REVISION_CONFLICT",
  "currentRevision": 2
}
```

结论：

- 主保存成功后 revision 从 `1 -> 2`
- Postgres 模式下 auto-save 不再把 revision 再次推进
- 使用旧 revision 的再次写入会明确返回 `409`

### 2. 多用户隔离回归验收

执行：

- `npm run verify:multi-user-isolation`

结果：

- `ok = true`
- 画布列表隔离成功
- 资源列表隔离成功
- 跨用户 `GET / PUT / auto-save` 都返回 owner mismatch
- 临时验收数据清理完成

### 3. 发布后快照

执行：

- `verify:release-preflight`

结果：

- `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260613-phase-b-canvas-revision-gray-r2`
- `database = xinghuan_canvas_gray`
- `counts = users:6 / canvases:13 / assets:6 / tasks:99 / sessions:63`
- `api = active`
- `worker = active`

## 当前结论

- Phase B 第一批“画布 revision 冲突防护”已经在灰度公网真实通过。
- 上一轮 Phase A 的多用户隔离和跨用户 owner 拒绝，在本轮后仍然保持通过。

## 下一步

- 把同类 revision 机制继续推广到资源库和后台关键配置。
- 增加“同账号双标签真实并发保存”的前端可视验收步骤。
- 在正式放行前，先补生产快照，再做精简版 revision + isolation 冒烟。
