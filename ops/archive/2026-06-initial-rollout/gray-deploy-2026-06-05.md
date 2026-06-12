# 灰度部署记录 - 2026-06-05

## 目标

- 将星幻无限画布部署到灰度域名 `canvas-next.hhh2121.xyz`。
- 使用单端口服务 `127.0.0.1:18200`。
- 不修改内部代理项目。
- 不切换生产域名 `canvas.hhh2121.xyz`。

## Release

- Release ID：`20260605-0903-xinghuan-gray`
- 服务器目录：`/opt/apps/xinghuan-canvas-next/releases/20260605-0903-xinghuan-gray`
- 当前指针：`/opt/apps/xinghuan-canvas-next/current`
- 共享数据目录：`/opt/apps/xinghuan-canvas-next/shared/data`
- 环境文件：`/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`

## 部署动作

- 本机生成 release 包：`releases/20260605-0903-xinghuan-gray.tar.gz`。
- 上传到服务器 `/tmp/20260605-0903-xinghuan-gray.tar.gz`。
- 解压到新的 release 目录。
- 执行 `npm ci`。
- 执行 `npm run build:single-port`。
- 配置并启动 `xinghuan-canvas-next.service`。
- 配置 Nginx `canvas-next.hhh2121.xyz`，代理到 `127.0.0.1:18200`。
- 使用已有 Let’s Encrypt 证书启用 HTTPS。

## 修复记录

- 首次 systemd 启动失败，原因是 `build:single-port` 未构建 workspace 运行时依赖 `@xinghuan/shared`。
- 已修正本地 `package.json`，让 `build:single-port` 构建 `shared`、`canvas-core`、`model-core`、`ui`、`api` 和 `web`。
- 已同步修正后的 `package.json` 到服务器当前 release。
- 已重新完整构建并重启服务。

## 验收证据

- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- `systemctl is-active xinghuan-canvas-next` 返回 `active`。
- `systemctl is-active nginx` 返回 `active`。
- `sudo nginx -t` 通过。
- `127.0.0.1:18200` 监听。
- 服务器 `npm run verify:single-port` 8 项全部 PASS：
  - `GET /`
  - `GET /api/status`
  - `POST /api/canvas`
  - `PUT /api/canvas/:id`
  - `GET /api/canvas/:id`
  - `POST /api/files/upload`
  - `GET uploaded file`
  - `SPA fallback`
- `http://canvas-next.hhh2121.xyz/` 返回 200。
- `http://canvas-next.hhh2121.xyz/api/status` 返回 `xinghuan-api`。
- `https://canvas-next.hhh2121.xyz/` 返回 200。
- `https://canvas-next.hhh2121.xyz/api/status` 返回 `xinghuan-api`。
- Chrome headless 截图：`output/playwright/gray-canvas-next-https.png`。
- Chrome DOM dump 确认包含 `星幻无限画布`、`后端已连接` 和 `react-flow`，且不包含 `18300`、`18310`、`18766`。

## 当前结论

灰度部署已通过服务器、Nginx、HTTPS、API、Web、文件上传和浏览器视觉验收。

## 后续

- 不直接切生产域名。
- 下一步进入登录、用户隔离、数据库、任务队列和真实 Provider 调用。
- Web bundle 仍存在大 chunk 警告，后续需要分包优化。
