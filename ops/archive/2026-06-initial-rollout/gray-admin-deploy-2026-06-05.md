# 灰度统一后台部署记录 - 2026-06-05

## 目标

- 在灰度域名 `canvas-next.hhh2121.xyz` 上开放统一后台 `/admin`。
- 后台采用星幻科技风。
- 后台数据接口必须管理员登录后访问，普通成员返回 403。

## Release

- release id：`20260605-1215-xinghuan-admin-gray`
- 服务器 release 目录：`/opt/apps/xinghuan-canvas-next/releases/20260605-1215-xinghuan-admin-gray`
- 当前指针：`/opt/apps/xinghuan-canvas-next/current`
- systemd：`xinghuan-canvas-next.service`
- 灰度域名：`https://canvas-next.hhh2121.xyz/`

## 变更范围

- `apps/api` 新增 `/api/admin/*`：
  - `/api/admin/summary`
  - `/api/admin/users`
  - `/api/admin/providers`
  - `/api/admin/models`
  - `/api/admin/tasks`
  - `/api/admin/system`
- 后台接口增加管理员守卫：
  - 未登录返回 401。
  - 成员登录返回 403。
  - 管理员登录返回数据。
- 新增文件型后台数据：`shared/data/admin/admin.json`。
- `apps/admin` 从占位页升级为真实后台：
  - 登录页。
  - 总览。
  - 用户管理。
  - Provider 管理。
  - 模型目录。
  - 任务监控。
  - 系统状态。
- 单端口服务新增 `/admin` 和 `/admin/assets/*` 静态托管。
- `build:single-port` 纳入 `@xinghuan/admin`。

## 验收证据

- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机 `npm run verify:single-port` 通过，包含后台验收：
  - `GET /admin`
  - `Unauthenticated admin rejected`
  - `GET /api/admin/summary`
  - `GET /api/admin/users`
  - `GET /api/admin/providers`
  - `GET /api/admin/models`
  - `GET /api/admin/tasks`
  - `Member admin rejected`
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- `xinghuan-canvas-next.service` 为 `active`。
- `/opt/apps/xinghuan-canvas-next/current` 指向新 release。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 公网未登录 `/admin` 显示后台登录页。
- 公网登录后 `/admin` 显示后台总览。
- 公网后台截图：`output/playwright/gray-admin-dashboard-https.png`。

## 影响

- 灰度后台已经可通过同域名 `/admin` 使用。
- 管理员可以查看用户、Provider、模型、任务和系统状态。
- 管理员可以新增用户、Provider、模型、任务，并启停用户/Provider/模型/任务。
- 后台仍使用文件型存储，后续迁移 PostgreSQL 时保留 API 形态。

## 后续

- 补充用户密码重置的正式交互和审计日志。
- Provider Key 后续需要加密存储。
- 模型 schema 后续需要升级为结构化编辑器。
- 任务系统后续接入 Redis/worker 和真实 Provider Adapter。
