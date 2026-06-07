# Phase 3 全节点验收链路灰度记录 - 2026-06-07

## 目标

- 将本机已通过的全节点验收矩阵、浏览器渲染烟测和 AI watermark API 兜底推上灰度。
- 确认灰度 `canvas-next.hhh2121.xyz` 仍保持核心链路可用。
- 不恢复 RunningHub 真实工作流卡片录入、字段展开和预览运行测试。

## Release

- Release ID：`20260607-1545-node-acceptance-gray`
- 目标目录：`/opt/apps/xinghuan-canvas-next/releases/20260607-1545-node-acceptance-gray`
- 当前指针：`/opt/apps/xinghuan-canvas-next/current`
- 灰度入口：`https://canvas-next.hhh2121.xyz`
- 本机端口：`127.0.0.1:18200`

## 发布动作

- 从当前 worktree 打包 release，排除 `.git`、`.env*`、`.tmp`、`.codegraph`、依赖目录、构建产物、运行数据和输出目录。
- 上传 `/tmp/20260607-1545-node-acceptance-gray.tgz`。
- 服务器执行 `npm ci`，结果 `0 vulnerabilities`。
- 服务器执行 `npm run build:single-port`，Web/Admin 构建通过；仍存在大 chunk 和空 `vendor-react` chunk 警告。
- 切换 `current` 到新 release。
- 重启 `xinghuan-canvas-next.service` 和 `xinghuan-canvas-next-worker.service`。

## 验收结果

- `readlink -f /opt/apps/xinghuan-canvas-next/current` 返回新 release。
- `systemctl is-active xinghuan-canvas-next` 返回 `active`。
- `systemctl is-active xinghuan-canvas-next-worker` 返回 `active`。
- `curl http://127.0.0.1:18200/api/status` 返回 `environment=gray`。
- 服务器灰度已通过：
  - `npm run verify:single-port`
  - `npm run verify:node-acceptance-matrix`
  - `npm run verify:ai-watermark-api`
  - `npm run verify:generic-node-catalog`
  - `npm run verify:model-catalog`
  - `npm run verify:external-image-proxy`
  - `npm run verify:external-video-proxy`
  - `npm run verify:external-chat-proxy`
  - `npm run verify:task-payload-api`
  - `npm run verify:task-lifecycle`
  - `npm run verify:canvas-resource-api`
  - `npm run verify:output-node-preview-layout`
  - `npm run verify:runninghub-workflow-contract`
  - `npm run verify:runninghub-workflow-api`
  - `npm run verify:worker-adapter-contract`
  - `npm run verify:worker-grsai-contract`
  - `npm run verify:worker-output-materializer`
  - `npm run verify:output-material-prune`
- 公网灰度浏览器烟测已通过：`XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz npm run verify:canvas-node-render-smoke`
  - `expectedNodeCount=46`
  - `renderedNodeCount=46`
  - `missingIds=[]`
  - `classMismatches=[]`
  - `legacyFound=[]`
  - `runtimeErrors=[]`

## 调试记录

- 首次远端验收未加载 `canvas-next.env`，登录使用默认测试密码导致 `INVALID_CREDENTIALS`；重新加载服务器环境后 `verify:single-port` 通过。
- `verify:worker-output-materializer` 在 PostgreSQL 环境下最初使用固定 `usr-test`，触发 `xh_assets.owner_id` 外键约束；已修复脚本为 PostgreSQL 模式读取一个真实未禁用用户作为测试 owner，文件模式仍使用 `usr-test`。
- 同一脚本在 PostgreSQL 模式下原先继续读取文件型 `resource-library.json`；已改为 PostgreSQL 模式查 `xh_assets`，文件模式查 JSON。
- 服务器未安装 Chrome，无法在服务器本机执行浏览器烟测；已使用本机 Chrome 对公网灰度域名完成同一脚本验证。

## 结论

灰度 release `20260607-1545-node-acceptance-gray` 已上线并通过核心验收。当前非 RH 真实运行项已具备灰度证据；RunningHub 真实工作流测试仍按用户要求暂缓。
