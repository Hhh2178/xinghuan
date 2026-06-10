# 画布助手 UI 与可见文案清理灰度记录 - 2026-06-09

## 目标

- 将本机已确认通过的画布 AI 助手 UI 自适应修复、模型注意事项移除和可见测试/验收文案清理发布到灰度环境。
- 保持灰度入口 `canvas-next.hhh2121.xyz`、单端口 `127.0.0.1:18200` 和 Worker 服务继续正常运行。
- 用服务器本机验收和公网灰度验收确认这次更新已真实生效。

## Release

- Release ID: `20260609-152648-canvas-assistant-ui-gray`
- 灰度域名: `https://canvas-next.hhh2121.xyz`
- 服务端口: `127.0.0.1:18200`
- API 服务: `xinghuan-canvas-next.service`
- Worker 服务: `xinghuan-canvas-next-worker.service`
- 当前 release 路径: `/opt/apps/xinghuan-canvas-next/releases/20260609-152648-canvas-assistant-ui-gray`

## 变更范围

- `apps/web/src/styles/index.css`
  - 画布 AI 助手面板改为明确的四行 grid 布局，避免空上下文状态把输入区错误撑大。
  - 助手顶部上下文按钮、附件卡片、消息区和输入区补齐自适应布局与溢出保护。
  - 清理遗留的模型注意事项帮助按钮和相关样式残留。
- `apps/web/src/components/Canvas.tsx`
  - 移除画布中的模型注意事项入口。
- `apps/web/src/components/CanvasAssistant.tsx`
  - 保持助手浮层可拖动、可缩放、上下文卡片紧凑显示。
  - 保留前台助手标题/占位文案清理结果，不再显示测试性提示语。
- `apps/api/src/server.ts`
  - 对返回给界面的画布名、节点提示词/标题、Provider/模型/任务等可见字段做运行时中性化清洗，避免继续显示“测试 / 验收 / smoke / Verify”等残留。
- `apps/api/data/canvases/*.json`
- `apps/api/data/users/usr-admin/canvases/*.json`
  - 将首页和默认画布中直接可见的测试/验收命名改为中性名称。

## 服务器部署动作

- 本机先执行：
  - `npm run verify:single-port`
  - `npm run build:single-port`
- 本机生成源码灰度包：
  - `releases/20260609-152648-canvas-assistant-ui-gray.tar.gz`
- 上传到服务器：
  - `/tmp/20260609-152648-canvas-assistant-ui-gray.tar.gz`
- 解压到：
  - `/opt/apps/xinghuan-canvas-next/releases/20260609-152648-canvas-assistant-ui-gray`
- 在 release 目录执行：
  - `npm ci`
  - `npm run build:single-port`
  - `set -a; . /opt/apps/xinghuan-canvas-next/shared/canvas-next.env; set +a; npm run db:migrate`
- 切换 `/opt/apps/xinghuan-canvas-next/current` 指向新 release。
- 重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`

## 验收结果

本机通过：

- `npm run verify:single-port`
- `npm run build:single-port`
- `node scripts/verify-canvas-assistant-ui-contract.mjs`
- `node scripts/verify-canvas-model-help-removal.mjs`

服务器本机通过：

- `npm run verify:single-port`
- `curl -fsS http://127.0.0.1:18200/api/status`
  - 返回 `environment=gray`

公网灰度通过：

- `curl -fsS https://canvas-next.hhh2121.xyz/api/status`
  - 返回 `environment=gray`
- `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz npm run verify:single-port`
  - 全部 PASS

浏览器现场复验结论：

- 当前 bundle 为：
  - Web JS: `/assets/index-GdU9SDud.js`
  - Web CSS: `/assets/index-BE6LaMzV.css`
- 画布 AI 助手空状态下输入框和发送按钮已恢复正常尺寸。
- 选中节点后，“发送选中工作流 / 发送当前节点”上下文按钮正常显示。
- 点击“发送当前节点”后，节点附件卡片保持紧凑，消息区和输入区不再消失。
- 首页可见画布名称已清理为中性文案，不再显示“测试 / 验收 / smoke”等残留。

## 说明

- 本轮服务器验收以 `GET` 和脚本化单端口验收为准；对 `/` 和 `/admin` 的 `HEAD` 请求返回 `404`，不作为灰度首页故障判断依据。
- 当前灰度与生产仍共用同一 PostgreSQL 数据底座；本轮未改动内部代理服务、路由和端口。

## 当前结论

本轮画布助手 UI 自适应修复、模型注意事项移除和可见测试文案清理已经发布到灰度环境。当前灰度 release 已切换为 `20260609-152648-canvas-assistant-ui-gray`，服务器本机与公网灰度核心验收均通过。
