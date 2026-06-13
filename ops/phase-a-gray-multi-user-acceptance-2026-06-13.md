# Phase A 灰度多用户隔离真实验收（2026-06-13）

## 目标

- 对 `20260613-phase-a-hardening-gray-r3-6293798` 做一轮真实公网灰度多用户隔离验收。
- 把此前临时命令式验收，固化为仓库内可复跑脚本。

## 当前灰度运行态

- 域名：`https://canvas-next.hhh2121.xyz`
- 本机端口：`127.0.0.1:18200`
- 当前 release：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260613-phase-a-hardening-gray-r3-6293798`
- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 状态接口：
  - `GET /api/status => environment=gray`
- 数据库：
  - `current_database() = xinghuan_canvas_gray`

## 新增标准脚本

- 脚本：`scripts/verify-multi-user-isolation.mjs`
- package 入口：`npm run verify:multi-user-isolation`

用途：

- 管理员与成员双登录
- 双方各自创建画布
- 校验画布列表隔离
- 校验跨用户读取/写入/自动保存被 `403 CANVAS_OWNERSHIP_MISMATCH` 拒绝
- 双方各自创建资源条目
- 校验资源列表隔离
- 校验成员后台访问被拒绝
- 校验临时验收数据清理完成

## 真实灰度公网验收结果

执行结果：

```json
{
  "ok": true,
  "baseUrl": "https://canvas-next.hhh2121.xyz",
  "verified": [
    "admin login ok",
    "member login ok",
    "canvas list isolation ok",
    "foreign canvas read/write rejection ok",
    "resource list isolation ok",
    "member admin access blocked",
    "temporary acceptance data cleaned"
  ],
  "before": {
    "adminCanvasCount": 13,
    "memberCanvasCount": 0,
    "adminImageResourceCount": 6,
    "memberImageResourceCount": 0
  },
  "afterCleanup": {
    "adminCanvasCount": 13,
    "memberCanvasCount": 0,
    "adminImageResourceCount": 6,
    "memberImageResourceCount": 0
  }
}
```

结论：

- 真实公网灰度下，管理员与成员的画布和资源列表已经按用户隔离。
- 跨用户读取、`PUT /api/canvas/:id`、`POST /api/canvas/:id/auto-save` 都已被明确拒绝。
- 验收前后的画布与素材数量完全回到原值，没有出现被清空或残留测试数据的情况。

## 迁移标记复核

服务器复核结果：

- `usr-admin/canvases/.postgres-migration-complete = 1`
- `usr-member/canvases/.postgres-migration-complete = 1`
- `usr-admin/resources/.postgres-migration-complete = 1`
- `usr-member/resources/.postgres-migration-complete = 1`

说明：

- 当前灰度已经进入 Postgres 主路径后的“只认数据库、不回退旧文件复活”的状态。

## 数据快照

- `xh_users = 6`
- `xh_canvases = 13`
- `xh_assets = 6`
- `xh_tasks = 99`

## 下一步

- 继续推进剩余冷路径整库写入边界梳理。
- 补齐生产环境的数据备份、回滚和放行前快照流程。
- 在进入正式放行前，再补一轮“同账号双标签/双设备”的版本冲突验收。
