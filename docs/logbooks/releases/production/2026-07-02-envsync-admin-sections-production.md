# 2026-07-02 Environment Sync Admin Sections Production

## 目标

- 记录 production 当前已运行在 `v0.5.22` 的事实状态。
- 对齐 `canvas.hhh2121.xyz` 的 release 指针、版本号与主入口文档。
- 修复此前主入口仍显示 `v0.5.20`、`v0.5.18`、`v0.5.1` 的状态漂移。

## Release

- 环境：`production`
- 域名：`canvas.hhh2121.xyz`
- 端口：`127.0.0.1:18100`
- 版本：`v0.5.22`
- release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 状态：`2026-07-02 已完成 production deploy + runtime verify`

## 运行态证据

- `readlink /opt/apps/xinghuan-canvas/current`
  - `/opt/apps/xinghuan-canvas/releases/20260702-envsync-admin-sections-prod-r1-v0522`
- `https://canvas.hhh2121.xyz/api/status`
  - `status = ok`
  - `service = xinghuan-api`
  - `version = 0.5.22`
  - `environment = production`
  - `dataDir = /opt/apps/xinghuan-canvas/shared/data`

## 影响

- Production 与 gray 当前都暴露 `v0.5.22`。
- 主入口后续应以 `docs/logbooks/releases/current-release-index.md`、`ops/current/production.md` 和线上 `/api/status` 为当前运行态证据。

## 待用户验收

- ComfyUI 相关后台页面和画布节点体验仍需重新设计与人工验收。
- 本记录只证明 production 运行态和版本号对齐，不代表 ComfyUI 管理体验已经合格。

