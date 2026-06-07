# Phase 3 全节点验收链路生产记录 - 2026-06-07

## 目标

- 将灰度已通过的全节点验收矩阵、浏览器渲染烟测、AI watermark API 兜底和验证脚本兼容修复同步到生产。
- 确认生产 `canvas.hhh2121.xyz` 仍保持核心链路可用。
- 不恢复 RunningHub 真实工作流卡片录入、字段展开和预览运行测试。

## Release

- Release ID：`20260607-1610-node-acceptance-prod`
- 目标目录：`/opt/apps/xinghuan-canvas/releases/20260607-1610-node-acceptance-prod`
- 当前指针：`/opt/apps/xinghuan-canvas/current`
- 生产入口：`https://canvas.hhh2121.xyz`
- 本机端口：`127.0.0.1:18100`

## 发布动作

- 从当前 worktree 打包 release，排除 `.git`、`.env*`、`.tmp`、`.codegraph`、依赖目录、构建产物、运行数据和输出目录。
- 上传 `/tmp/20260607-1610-node-acceptance-prod.tgz`。
- 服务器执行 `npm ci`，结果 `0 vulnerabilities`。
- 服务器执行 `npm run build:single-port`，Web/Admin 构建通过；仍存在大 chunk 和空 `vendor-react` chunk 警告。
- 切换 `current` 到新 release。
- 重启 `xinghuan-canvas.service` 和 `xinghuan-canvas-worker.service`。

## 验收结果

- `readlink -f /opt/apps/xinghuan-canvas/current` 返回新 release。
- `systemctl is-active xinghuan-canvas` 返回 `active`。
- `systemctl is-active xinghuan-canvas-worker` 返回 `active`。
- `curl http://127.0.0.1:18100/api/status` 和 `curl https://canvas.hhh2121.xyz/api/status` 均返回 `environment=production`。
- 服务器生产已通过：
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
  - `npm run verify:worker-output-materials`
  - `npm run verify:output-material-prune`
- 公网生产浏览器烟测已通过：`XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz npm run verify:canvas-node-render-smoke`
  - `expectedNodeCount=46`
  - `renderedNodeCount=46`
  - `missingIds=[]`
  - `classMismatches=[]`
  - `legacyFound=[]`
  - `runtimeErrors=[]`

## 调试记录

- 远端 heredoc 行尾会让 npm 脚本名带入回车字符；后续关键验收改为单行 SSH 命令执行。
- `verify:output-material-prune` 原先会受生产 `XINGHUAN_STORAGE_DRIVER=postgres` 影响而扫描真实数据；已修复为测试脚本导入清理模块前强制文件模式，并只操作临时 `dataDir`。
- 服务器未安装 Chrome，公网浏览器烟测继续使用本机 Chrome 指向生产域名完成。

## 结论

生产 release `20260607-1610-node-acceptance-prod` 已上线并通过核心验收。当前非 RH 真实运行项已具备生产证据；RunningHub 真实工作流测试仍按用户要求暂缓。
