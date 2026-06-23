# Engineering Governance Guardrails Gray Release - 2026-06-24

## 发布目标

- 将“工程治理规则”从文档约束提升为可执行护栏。
- 给 gray prepare 接入热点大文件预算与工程治理 contract。
- 给 gray deploy 接入工作树清洁检查，阻断脏工作树直接发版。
- 在不改动当前 `v0.4.15` 业务版本号的前提下，完成一轮新的 gray 放行。

## 发布信息

- 环境：`gray`
- 版本：`v0.4.15`
- release：`20260624-engineering-governance-guardrails-gray-r1-v0415`
- 上一灰度 release：`20260623-runninghub-worker-second-stage-gray-r1-v0415`

## Agent 已验证

### 本地治理与发布前 gate

- `npm run verify:file-hotspot-budgets`
- `npm run verify:engineering-governance-contract`
- `npm run verify:release-worktree-clean`
- `codegraph sync`

### gray prepare 实际执行

- `npm run release:gray:prepare:runninghub -- --release=20260624-engineering-governance-guardrails-gray-r1-v0415`
- base preset 已实际执行：
  - `npm install --package-lock-only`
  - `npm run verify:file-hotspot-budgets`
  - `npm run verify:engineering-governance-contract`
  - `npm run build:single-port`
  - `node scripts/verify-release-version-alignment.mjs`
  - `npm run verify:release-package-contract`
- runninghub preset 已实际执行：
  - `node scripts/verify-runninghub-draft-and-summary-contract.mjs`
  - `node scripts/verify-runninghub-output-reset-contract.mjs`
  - `node scripts/verify-runninghub-worker-and-label-contract.mjs`
  - `node scripts/verify-runninghub-admin-empty-input-contract.mjs`
  - `node scripts/verify-runninghub-key-pool-contract.mjs`
  - `node scripts/verify-runninghub-node-progress-contract.mjs`

### 生成产物

- archive：
  - `dist-release/20260624-engineering-governance-guardrails-gray-r1-v0415.tar.gz`
- size：
  - `5.36 MB`

## 实际部署结果

- gray 部署：
  - `npm run release:gray:deploy -- --release=20260624-engineering-governance-guardrails-gray-r1-v0415 --archive=D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\dist-release\20260624-engineering-governance-guardrails-gray-r1-v0415.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem`
- gray 运行态验证：
  - `npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --expected-version=0.4.15 --expected-environment=gray`
- 远端实际状态：
  - `currentRelease = /opt/apps/xinghuan-canvas-next/releases/20260624-engineering-governance-guardrails-gray-r1-v0415`
  - `appService = active`
  - `workerService = active`
  - `http://127.0.0.1:18200/api/status`
    - `version = 0.4.15`
    - `environment = gray`
  - `https://canvas-next.hhh2121.xyz/api/status`
    - `version = 0.4.15`
    - `environment = gray`

## 本轮落成的护栏

- 热点大文件预算脚本：
  - `scripts/verify-file-hotspot-budgets.mjs`
- gray / release 工作树清洁脚本：
  - `scripts/verify-release-worktree-clean.mjs`
- 治理接线 contract：
  - `scripts/verify-engineering-governance-contract.mjs`
- 治理正文：
  - `docs/governance/engineering-guardrails.md`

## 待用户验收

- 视觉和交互层面的实际体验验收继续由用户执行。
- 本轮 Agent 不代替用户做页面观感与业务体验验收。

## 风险与后续

- 当前热点预算采用仓库实态基线，目的是先阻止继续膨胀，不代表这些大文件已经完成结构拆分。
- `apps/api/src/server.ts`
- `apps/worker/src/worker.ts`
- `apps/web/src/components/nodes/RunningHubNode.tsx`
- `apps/admin/src/admin-runninghub-workspace.tsx`
  - 后续仍需要继续按模块拆出。
- 当前 release gate 已经能阻断脏工作树发布，但还没有覆盖“灰度记录是否已补齐”的强制检查，后续可以继续补。

## 回滚信息

- 回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260623-runninghub-worker-second-stage-gray-r1-v0415`
- 需要重启的服务：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
