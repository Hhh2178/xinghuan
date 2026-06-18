# 多生成任务状态与超时统一灰度发布记录 - 2026-06-18

## 目标

- 将多图 / 多视频异步拆单任务的状态展示、输出追加、超时统一和上游素材透传修复发布到 gray。
- 保持当前对外版本号为 `v0.3.1`，仅推进 gray release 目录，不擅自提升 major 版本。

## Release 信息

- 对外版本号：
  - `v0.3.1`
- gray release：
  - `20260618-multi-generation-timeout-gray-r1-b8534f2`
- 本地基线 commit：
  - `b8534f2`
- gray current：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260618-multi-generation-timeout-gray-r1-b8534f2`
- 上一灰度 release：
  - `20260617-environment-sync-layout-v031-gray-r1-dfd5f37`

## 变更范围

- 图片 / 视频节点新增 `taskRuns` 轻量运行态，支持多子任务状态展示。
- 多任务成功结果改为追加到 `imageUrls` / `videoUrls`，不再被后一个结果覆盖。
- `NodeRuntimeCard` 支持展示多子任务批次、状态、进度、错误与结束时间。
- `GRSAI` 图像任务轮询超时改为跟随节点配置，不再回退到隐藏默认值。
- `ImageOpFrame` 改为复用统一 `useUpstreamMaterials(id)`，修复上传素材后下游偶发收不到的问题。

## 本地发布前验证

- `npm run build:single-port`
- `node scripts/verify-release-package-contract.mjs`
- `node scripts/verify-release-preflight-contract.mjs`
- `node scripts/verify-image-node-multi-task-contract.mjs`
- `node scripts/verify-video-node-multi-task-contract.mjs`
- `node scripts/verify-node-runtime-card-task-runs-contract.mjs`
- `node scripts/verify-generation-timeout-unification.mjs`
- `node scripts/verify-image-op-upstream-material-contract.mjs`
- `npm run package:release -- 20260618-multi-generation-timeout-gray-r1-b8534f2`

结果：

- 全部通过。
- release 包：
  - `dist-release/20260618-multi-generation-timeout-gray-r1-b8534f2.tar.gz`
  - `sizeMB = 5.41`

## 实际发布步骤

1. 上传 release 包到：
   - `/tmp/20260618-multi-generation-timeout-gray-r1-b8534f2.tar.gz`
2. 解包到：
   - `/opt/apps/xinghuan-canvas-next/releases/20260618-multi-generation-timeout-gray-r1-b8534f2`
3. 在新 release 目录执行：
   - `npm ci`
   - 加载 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
   - `npm run db:migrate`
4. 切换 `current` 并重启：
   - `xinghuan-canvas-next.service`
   - `xinghuan-canvas-next-worker.service`

## 发布结果

- migration：
  - `015_user_groups_and_user_notes.sql`
- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- `/api/status`：
  - `environment = gray`
  - `version = 0.3.1`

## Gray Gate

- `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200 npm run verify:release-preflight`
  - `ok = true`
  - `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260618-multi-generation-timeout-gray-r1-b8534f2`
  - `database.name = xinghuan_canvas_gray`
- `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200 npm run verify:request-chain-observability`
  - `ok = true`
- `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200 npm run verify:system-observability`
  - `ok = true`
  - `database.targetMatched = true`

## 备注

- 本轮部署过程中，首次未显式指定 SSH key，连接被 `Permission denied (publickey)` 拒绝；改回既有 `-i D:\codex\服务器\Tencent_Cloud_Server.pem` 方式后恢复正常。
- shell 中直接 `curl http://127.0.0.1:18200/api/status` 出现过一次 URL 解析异常；随后改用 `wget -qO-` 与标准 gate 脚本复验，确认不是服务异常。
