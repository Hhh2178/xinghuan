# 后台 AI 助手 Hermes 灰度联调记录 - 2026-06-08

## 目标

- 打通后台 AI 助手到服务器 Hermes 的真实分析链路。
- 将最小后台助手工作台推上灰度环境并完成验证。
- 保留本轮根因、修复点和验收结果，作为后续继续扩展前端创作助手的基线。

## 最终灰度 Release

- Release ID: `20260608-2312-assistant-hermes-csrf-fix-gray`
- 灰度目录: `/opt/apps/xinghuan-canvas-next/releases/20260608-2312-assistant-hermes-csrf-fix-gray`
- 灰度入口: `https://canvas-next.hhh2121.xyz`
- 本机端口: `127.0.0.1:18200`
- API 服务: `xinghuan-canvas-next.service`
- Worker 服务: `xinghuan-canvas-next-worker.service`

## 根因结论

本轮 Hermes 桥接失败不是密码错误，真实根因有三层：

1. Hermes `/api/chat` 成功字段为 `answer`，桥接最初未读取该字段。
2. 服务器环境下 Node 原生 `http.request` 与 Hermes `8787` 端口存在报文级不兼容，桥接会报：
   - `Parse Error: Expected HTTP/, RTSP/ or ICE/`
3. 当前 Hermes WebUI 实际不强制要求页面 CSRF token，但桥接代码把“未提取到 CSRF token”当成了致命失败。

## 修复点

- `apps/api/src/server.ts`
  - Hermes 聊天响应补读 `answer` 字段。
  - Hermes HTTP 桥接底层从原生 `http/https.request` 切换到 `fetch`。
  - CSRF token 改为“有则带上，无则继续”，不再把缺失视为失败。
- `scripts/verify-admin-assistant-workbench.mjs`
  - 登录链路统一到管理员可用的 `/api/auth/login`。
  - 增加 `XINGHUAN_VERIFY_REQUIRE_HERMES=1` 开关，用于灰度强校验 `mode=hermes`。
  - Cookie 捕获兼容 Node `fetch` 的 `headers.getSetCookie()`。

## 验证结果

灰度环境已确认：

- `systemctl is-active xinghuan-canvas-next.service` -> `active`
- `systemctl is-active xinghuan-canvas-next-worker.service` -> `active`
- `curl -fsS http://127.0.0.1:18200/api/status` -> `environment=gray`
- `curl -fsS https://canvas-next.hhh2121.xyz/api/status` -> `environment=gray`

后台助手定向验收已确认：

- 管理员登录成功。
- `POST /api/admin/assistant/analyze-provider` 返回：
  - `mode = hermes`
  - `protocol = apimart`
  - `recommendedLayer = adapter`
- `rawAssistant` 已为 Hermes 返回的真实结构化结果，不再是 fallback 兜底文本。

## 当前说明

- 后台 AI 助手最小链路已经推上灰度并可用。
- 当前仍只落地了后台审计/配置助手最小闭环，前端创作助手尚未进入实现。
- `scripts/verify-admin-assistant-workbench.mjs` 已支持灰度强校验 Hermes，但服务器 current release 中的脚本是否同步更新，取决于后续是否再次随代码发布。
