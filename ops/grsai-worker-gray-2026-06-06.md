# GRSAI Worker 灰度部署记录 - 2026-06-06

## 目标

- 将 `grsai_draw` 从同步图像代理继续下沉到 Worker 图像 Adapter。
- 固化 GRSAI 的本机回归和灰度真实双链路验收。
- 清理灰度环境残留的测试 Provider 与任务记录。

## Release

- Release ID: `20260606-2335-grsai-worker-gray`
- 灰度域名: `https://canvas-next.hhh2121.xyz`
- 服务端口: `127.0.0.1:18200`
- API 服务: `xinghuan-canvas-next.service`
- Worker 服务: `xinghuan-canvas-next-worker.service`
- 当前 release 路径: `/opt/apps/xinghuan-canvas-next/releases/20260606-2335-grsai-worker-gray`

## 变更范围

- `apps/worker/src/worker.ts`
  - 新增 `grsai_draw` 协议识别。
  - 新增 GRSAI Draw 提交与轮询逻辑。
  - 任务结果写回 `adapter: "grsai-image"`、`taskId`、`remoteImageUrls`。
- `scripts/verify-worker-grsai-contract.mjs`
  - 验证 Worker 是否识别 `grsai_draw`、是否包含 GRSAI draw 提交/轮询分支。
- `scripts/verify-worker-grsai-image-adapter.mjs`
  - 使用 mock GRSAI 上游验证 Worker 端到端任务执行。
- `scripts/verify-grsai-draw-gray.mjs`
  - 登录灰度后台，自动验证同步 `/api/proxy/external/image` 和异步 Worker 任务。

## 本机验证

- `npm run verify:worker-grsai-contract` 先 FAIL 后 PASS。
- `npm run verify:grsai-draw` 通过。
- `npm run type-check -w @xinghuan/worker` 通过。
- `npm run build -w @xinghuan/worker` 通过。
- `npm run build:single-port` 通过。

## 服务器部署动作

- 上传 release 包 `releases/20260606-2335-grsai-worker-gray.tar.gz` 到 `/tmp/20260606-2335-grsai-worker-gray.tar.gz`。
- 解压到 `/opt/apps/xinghuan-canvas-next/releases/20260606-2335-grsai-worker-gray`。
- 在 release 目录执行 `npm ci`。
- 执行 `npm run build:single-port`。
- 将 `/opt/apps/xinghuan-canvas-next/current` 切到新 release。
- 重启 `xinghuan-canvas-next.service` 和 `xinghuan-canvas-next-worker.service`。

## 服务器验收

- `readlink /opt/apps/xinghuan-canvas-next/current` 返回新 release。
- `systemctl is-active xinghuan-canvas-next.service` 返回 `active`。
- `systemctl is-active xinghuan-canvas-next-worker.service` 返回 `active`。
- `npm run verify:grsai-draw-gray` 通过。
- `npm run verify:worker-grsai-image-adapter` 通过。
- `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment=gray`。

## 清理动作

- 删除灰度残留测试 Provider：
  - `verify-provider-1780710845625`
  - `verify-provider-1780709992313`
  - `phase2-e2e-provider`
  - `verify-provider-1780708758163`
  - `verify-provider-1780703154559`
- 删除临时 GRSAI 验收任务：
  - `task-1780716417768-9d3ful`
  - `task-1780716364365-nc7v5u`

## 当前结论

GRSAI `grsai_draw` 已在灰度环境完成同步图像代理和 Worker 异步任务双链路验收。当前灰度已具备可重复执行的 GRSAI 回归脚本与更干净的后台测试面。
