# AI 助手 Hermes 灰度回归修复记录

日期: 2026-06-10

灰度域名: `canvas-next.hhh2121.xyz`

灰度端口: `127.0.0.1:18200`

新增 release:

- 本机包: `dist-release/20260610-hermes-webui-stream-fix-gray-r2.tar.gz`
- 服务器目录: `/opt/apps/xinghuan-canvas-next/releases/20260610-hermes-webui-stream-fix-gray-r2`
- 当前指针: `/opt/apps/xinghuan-canvas-next/current`

## 问题现象

- 灰度助手请求再次退回 `fallback`，与 `2026-06-09` 已验证通过的 `mode=hermes` 状态不一致。
- 手工探测 Hermes 时还出现了同步 `/api/chat` 长时间挂起，用户侧表现为“无上下文 / 像死锁一样卡住”。

## 根因结论

本轮不是密码、Profile 或环境变量缺失问题，真实根因有两层：

1. Hermes WebUI `/api/session/new` 返回结构发生漂移。
   - 当前返回形态是顶层：
     - `session.session_id`
   - 旧桥接只兼容：
     - `data.session.session_id`
     - `data.session_id`
   - 结果是 session 实际创建成功，但无限画布桥接误判为“未返回 session_id”。

2. 无限画布助手聊天链路错误依赖了 Hermes WebUI 的同步 `POST /api/chat`。
   - Hermes WebUI 源码中该接口标注为：
     - `Fallback synchronous chat endpoint (POST /api/chat). Not used by frontend.`
   - 当前真实前端主链路是：
     - `POST /api/chat/start`
     - `GET /api/chat/stream?stream_id=...`
   - 灰度实测中，同步 `/api/chat` 会长时间挂起，而 `chat/start + stream` 能稳定返回 `token / done / stream_end`。

## 修复点

- `apps/api/src/server.ts`
  - 新增 `extractHermesSessionId()`：
    - 兼容 `data.session.session_id`
    - 兼容 `data.session_id`
    - 兼容顶层 `session.session_id`
    - 兼容 `session.id`
  - 助手 Hermes 聊天桥接从同步 `/api/chat` 改为：
    - `POST /api/auth/login`
    - `POST /api/session/new`
    - `POST /api/chat/start`
    - `GET /api/chat/stream?stream_id=...`
  - 新增 `readHermesAssistantStream()`：
    - 解析 SSE 中的 `token`
    - 如无 `token` 再回退解析 `done`
    - 如收到 `apperror / error` 则显式抛错
  - `rawHttpRequest()` 增加 `timeoutMs` 参数，Hermes SSE 读取窗口提升到 `180000ms`。

- `scripts/verify-admin-assistant-chat.mjs`
  - 新增静态契约，要求后台助手桥接包含：
    - `/api/chat/start`
    - `extractHermesSessionId`
    - `readHermesAssistantStream`

- `scripts/verify-canvas-assistant-chat.mjs`
  - 新增静态契约，要求画布助手桥接包含：
    - `/api/chat/start`
    - `extractHermesSessionId`
    - `readHermesAssistantStream`

## 本机验证

- `npm run type-check`
- `npm run build -w @xinghuan/api`
- `npm run build:single-port`
- `npm run package:release -- 20260610-hermes-webui-stream-fix-gray-r2`

说明:

- 本机 `127.0.0.1:18200` 轻量环境没有加载 Hermes 配置，admin smoke 仍可能回 `fallback`，这不是本轮回归判断依据。

## 关键灰度取证

Hermes WebUI 主链路实测:

- `POST /api/session/new`
  - 成功返回顶层 `session.session_id`
- `POST /api/chat/start`
  - 成功返回 `stream_id`
- `GET /api/chat/stream?stream_id=...`
  - 稳定收到：
    - `reasoning`
    - `token`
    - `done`
    - `stream_end`

同步 `/api/chat` 实测:

- 在灰度环境中会长时间挂起，不适合作为无限画布助手桥接主链路。

## 服务器部署验证

- `npm ci`
  - `found 0 vulnerabilities`
- `npm run db:migrate`
  - `applied=[]`
  - `skipped=6`
- `systemctl is-active xinghuan-canvas-next.service`
  - `active`
- `systemctl is-active xinghuan-canvas-next-worker.service`
  - `active`
- `curl -fsS http://127.0.0.1:18200/api/status`
  - 返回 `environment=gray`

## 灰度最终验收

画布助手:

- 登录成功
- `POST /api/assistant/chat`
  - `mode=hermes`
- 连续两轮同一 `conversationId`：
  - 第一轮让助手记住短语 `星轨草图`
  - 第二轮成功返回 `星轨草图`

后台助手:

- 管理员登录成功
- `POST /api/admin/assistant/chat`
  - `mode=hermes`
- 连续两轮同一 `conversationId`：
  - 第一轮让助手记住暗号 `海蓝节点`
  - 第二轮成功返回 `海蓝节点`

## 结论

- 灰度 Hermes 助手回归已修复。
- AI 助手上下文连续性已恢复。
- 当前灰度不再依赖 Hermes WebUI 的同步 fallback `/api/chat`。

## 收尾补记

- 本地最终验收日期：
  - `2026-06-10`
- 本地补充验证：
  - `npm run verify:admin-assistant-ui-contract`
  - `npm run verify:canvas-assistant-ui-contract`
  - `npm run verify:admin-assistant-workbench`
  - `npm run verify:admin-assistant-settings-save-contract`
  - `npm run verify:admin-assistant-chat`
  - `npm run verify:canvas-assistant-chat`
  - `npm run verify:node-runtime-card-contract`
- 本地入口状态说明：
  - 当前有效单端口入口仍是 `http://127.0.0.1:18200/`
  - `http://localhost:8200/` 当次无法访问，是因为本机没有监听该端口，不应作为本轮 UI 回归判断依据
  - `http://127.0.0.1:18200/admin` 本机可正常进入后台登录页，浏览器控制台未发现新的 `error` / `warn`
- 验收脚本入口补齐：
  - `package.json` 已新增：
    - `verify:node-runtime-card-contract`
- 本地认证补充修复：
  - `apps/api/src/server.ts`
    - `loginUser()` 不再在同一用户重新登录时清空旧 session，避免前台与后台或并行验收时互相挤掉登录态
  - 新增：
    - `scripts/verify-auth-session-concurrency.mjs`
    - `package.json -> verify:auth-session-concurrency`
  - 本地串行验证通过：
    - `npm run verify:auth-session-concurrency`
    - `npm run verify:admin-assistant-chat`
    - `npm run verify:canvas-assistant-chat`

## 回滚

若需要回滚，可将 `current` 指回上一 release，例如：

```bash
ln -sfn /opt/apps/xinghuan-canvas-next/releases/20260610-assistant-media-chain-gray-r1 /opt/apps/xinghuan-canvas-next/current
sudo systemctl restart xinghuan-canvas-next.service
sudo systemctl restart xinghuan-canvas-next-worker.service
```
