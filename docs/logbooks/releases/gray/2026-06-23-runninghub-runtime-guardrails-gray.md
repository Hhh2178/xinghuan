# RunningHub Runtime Guardrails Gray Release - 2026-06-23

## 发布目标

- 发布 RunningHub 治理护栏与 Worker 运行时止血修复。
- 为后续 `worker.ts` 第二阶段继续拆分补齐可回退、可验证的边界。
- 将当前 gray 版本推进到 `v0.4.14`。

## 发布信息

- 环境：`gray`
- 版本：`v0.4.14`
- release：`20260623-runninghub-runtime-guardrails-gray-r1-v0414`
- 上一灰度 release：`20260623-runninghub-grsai-worker-key-pool-gray-r1-v0413`

## Agent 已验证

### 本地代码与产物

- 类型检查：
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/worker`
  - `npm run type-check -w @xinghuan/web`
  - `npm run type-check -w @xinghuan/admin`
- RunningHub 治理 / 运行态契约：
  - `node scripts/verify-runninghub-governance-phase-a-contract.mjs`
  - `node scripts/verify-runninghub-governance-phase-c-contract.mjs`
  - `node scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs`
  - `node scripts/verify-runninghub-dynamic-key-selection-contract.mjs`
  - `node scripts/verify-runninghub-key-pool-contract.mjs`
  - `node scripts/verify-runninghub-node-progress-contract.mjs`
  - `node scripts/verify-unified-protocol-runtime-contract.mjs`
- RunningHub poll 非 JSON 回归：
  - `npx tsx scripts/verify-runninghub-poll-non-json-contract.ts`
  - 覆盖：
    - HTML 网关页
    - 纯文本响应
    - 空响应
    - 合法 JSON 继续通过
- 兼容 worker 相关回归：
  - `npm run verify:provider-generation-worker`
  - `npm run verify:worker-grsai-contract`
- 版本对齐：
  - `npm install --package-lock-only`
  - `npm run build -w @xinghuan/shared`
  - `npm run build -w @xinghuan/api`
  - `node scripts/verify-release-version-alignment.mjs`

### 本轮代码边界

- 新增治理护栏：
  - `scripts/verify-runninghub-governance-phase-a-contract.mjs`
  - `scripts/verify-runninghub-governance-phase-c-contract.mjs`
  - `scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs`
- Worker 止血修复：
  - `apps/worker/src/worker-runninghub-response.ts`
  - `apps/worker/src/worker-runtime-diagnostics.ts`
  - `apps/worker/src/worker.ts`
  - `scripts/verify-runninghub-poll-non-json-contract.ts`

### 远端部署与运行态

- gray 打包：
  - `npm run release:gray:prepare:runninghub -- --release=20260623-runninghub-runtime-guardrails-gray-r1-v0414 --verify="npx tsx scripts/verify-runninghub-poll-non-json-contract.ts" --verify="node scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs"`
  - 产物：
    - `dist-release/20260623-runninghub-runtime-guardrails-gray-r1-v0414.tar.gz`
    - `size = 5.35 MB`
- gray 部署：
  - `npm run release:gray:deploy -- --release=20260623-runninghub-runtime-guardrails-gray-r1-v0414 --archive=dist-release/20260623-runninghub-runtime-guardrails-gray-r1-v0414.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem`
- gray 运行态验证：
  - `npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --expected-version=0.4.14 --expected-environment=gray`
  - `currentRelease = /opt/apps/xinghuan-canvas-next/releases/20260623-runninghub-runtime-guardrails-gray-r1-v0414`
  - `appService = active`
  - `workerService = active`
  - `http://127.0.0.1:18200/api/status`
    - `version = 0.4.14`
    - `environment = gray`
  - `https://canvas-next.hhh2121.xyz/api/status`
    - `version = 0.4.14`
    - `environment = gray`

## 待用户验收

### 视觉验收

- RH 节点与 RH Tools 节点在 gray 页面上的进度、排队提示、错误提示与结果回填观感。
- 后台 RH 工作台与画布 RH 节点的视觉和交互细节。

### 真实业务链路

- RunningHub 真实任务在 poll 返回异常页、文本页或短时网关波动时，是否仍能给出更稳定的一致错误表现。
- 多 Key、真实排队、真实取消、真实输出回填是否符合业务预期。

## 风险与残留问题

- 当前只完成了代码层、契约层、构建层与运行态层验证。
- 真实上游返回异常页的线上业务样本，当前仍以本地回归脚本证明为主，尚未独立获取 gray 实网新样本。
- production 当前仍在 `v0.4.13`，且继续指向 `xinghuan_canvas_next`，本轮不改变正式库边界。

## 回滚信息

- `current` 回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260623-runninghub-grsai-worker-key-pool-gray-r1-v0413`
- 需要重启的服务：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后需复查的接口：
  - `http://127.0.0.1:18200/api/status`
  - `https://canvas-next.hhh2121.xyz/api/status`
