# 灰度认证版部署记录 - 2026-06-05

## 目标

- 将本机完成的登录、退出、用户隔离和科技风登录门禁部署到灰度域名。
- 保持灰度域名 `canvas-next.hhh2121.xyz` 和单端口 `127.0.0.1:18200`。
- 不切换生产域名，不修改内部代理服务。

## Release

- release id：`20260605-1135-xinghuan-auth-gray`
- 服务器 release 目录：`/opt/apps/xinghuan-canvas-next/releases/20260605-1135-xinghuan-auth-gray`
- 当前指针：`/opt/apps/xinghuan-canvas-next/current`
- systemd：`xinghuan-canvas-next.service`
- Nginx：`canvas-next.hhh2121.xyz`

## 环境与密钥

- 灰度环境文件：`/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
- 已配置管理员 bootstrap 账号和成员 bootstrap 账号。
- 已配置真实 bootstrap 密码，未写入仓库、文档或聊天。
- 已验证环境文件不再包含 `change-me`。
- 一次 SSH stdin 包装错误产生的临时值未写入服务器环境；随后已由服务器本地重新生成 secret 覆盖。

## 部署步骤

- 本机执行 `npm run build:single-port` 通过。
- 打包 `releases/20260605-1135-xinghuan-auth-gray.tar.gz`。
- 上传到服务器 `/tmp/20260605-1135-xinghuan-auth-gray.tar.gz`。
- 解包到新 release 目录。
- 服务器执行 `npm ci` 通过，0 vulnerabilities。
- 服务器执行 `npm run build:single-port` 通过。
- 切换 `current` 指向新 release。
- 重启 `xinghuan-canvas-next.service`。

## 验收证据

- `systemctl is-active xinghuan-canvas-next.service` 返回 `active`。
- `readlink /opt/apps/xinghuan-canvas-next/current` 返回新 release 目录。
- `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment: gray`。
- 服务器执行 `npm run verify:single-port` 全部 PASS：
  - `GET /`
  - `GET /api/status`
  - `Unauthenticated canvas rejected`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/canvas`
  - `PUT /api/canvas/:id`
  - `GET /api/canvas/:id`
  - `POST /api/auth/login member`
  - `Member cannot see admin canvas`
  - `POST /api/files/upload`
  - `GET uploaded file`
  - `SPA fallback`
- `sudo nginx -t` 通过。
- `systemctl is-active nginx` 返回 `active`。
- `https://canvas-next.hhh2121.xyz/api/status` 返回 200。
- `https://canvas-next.hhh2121.xyz/api/canvas` 未登录返回 401 `AUTH_REQUIRED`。
- `https://canvas-next.hhh2121.xyz/` 返回 200，页面 HTML 不包含旧开发端口。
- Chrome headless 公网未登录截图：`output/playwright/gray-auth-login-gate-https-cdp.png`。
- Chrome headless 公网登录后截图：`output/playwright/gray-auth-logged-canvas-https.png`。
- DOM 验收确认：
  - 未登录展示 `星幻无限画布`、`进入工作区`。
  - 未登录不渲染 ReactFlow。
  - 登录后展示 `星幻无限画布`、`后端已连接`、ReactFlow。
  - 登录后不展示登录门禁。

## 影响

- 灰度域名已进入认证版。
- 画布、素材和资源库按账号隔离。
- T8 画板主体 UI 保持原成熟形态。
- 新增登录门禁采用星幻科技风。

## 风险与后续

- 当前认证仍是文件型最小实现，后续需要迁移 PostgreSQL。
- 服务器 bootstrap 密码后续应改为正式管理流程，不应长期依赖初始化环境变量。
- Web bundle 仍存在大 chunk 警告，后续需要分包。
- 下一步进入统一后台骨架、管理员权限守卫、数据库模型和任务队列。

## 账号重置记录

- 时间：2026-06-05
- 灰度管理员账号已重置为 `1161964493@qq.com`。
- 灰度管理员密码已按用户要求重置到服务器认证数据和服务器环境文件。
- 密码明文不写入仓库、文档、日志或聊天输出。
- 已清空旧管理员 session。
- 验收：
  - 新管理员账号登录返回 200，并返回 session header。
  - 旧管理员账号 `admin@xinghuan.local` 登录返回 401。
  - `xinghuan-canvas-next.service` 重启后为 `active`。
