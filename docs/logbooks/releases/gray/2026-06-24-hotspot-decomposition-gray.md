# Hotspot Superfile Decomposition Gray Release - 2026-06-24

## 发布目标

- 将热点超级文件治理从“只有限制线”继续推进到真实结构收口。
- 把 `apps/worker/src/worker.ts` 的 RunningHub dispatch / key 调度 glue 下沉到独立模块。
- 把 `apps/api/src/server.ts` 的后台 RunningHub 管理路由分发层下沉到独立模块。
- 以新版本 `v0.4.16` 完成一轮 gray 放行，为后续继续拆 `cancel-sync / diagnostics / system settings handlers` 留出安全余量。

## 发布信息

- 环境：`gray`
- 版本：`v0.4.16`
- release：`20260624-hotspot-decomposition-gray-r1-v0416`
- 上一灰度 release：`20260624-engineering-governance-guardrails-gray-r1-v0415`

## Agent 已验证

### 本地代码与 contract

- `npm run type-check -w @xinghuan/worker`
- `npm run type-check -w @xinghuan/api`
- `node scripts/verify-worker-runninghub-dispatch-split-contract.mjs`
- `node scripts/verify-api-admin-runninghub-route-split-contract.mjs`
- `node scripts/verify-runninghub-dynamic-key-selection-contract.mjs`
- `node scripts/verify-runninghub-key-acquire-fallback.mjs`
- `node scripts/verify-runninghub-queue-governance-contract.mjs`
- `node scripts/verify-user-queue-governance-contract.mjs`
- `node scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs`
- `node scripts/verify-file-hotspot-budgets.mjs`
- `node scripts/verify-engineering-governance-contract.mjs`

### 结构收口结果

- `apps/worker/src/worker.ts`
  - 行数：`1765 -> 1673`
  - 下沉到：`apps/worker/src/worker-runninghub-dispatch.ts`
- `apps/api/src/server.ts`
  - 行数：`11910 -> 11834`
  - 下沉到：`apps/api/src/admin-runninghub-routes.ts`

### 发布前收口

- `codegraph sync`
- `npm run verify:release-worktree-clean`

## 本次实际放行证据

- prepare：
  - `npm run release:gray:prepare:runninghub -- --release=20260624-hotspot-decomposition-gray-r1-v0416`
  - 归档包：`D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\dist-release\20260624-hotspot-decomposition-gray-r1-v0416.tar.gz`
  - 包大小：`5.36 MB`
  - 临时 staging：`C:\Users\Administrator\AppData\Local\Temp\xinghuan-release-yJVu7q`
- deploy：
  - `npm run release:gray:deploy -- --release=20260624-hotspot-decomposition-gray-r1-v0416 --archive="D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\dist-release\20260624-hotspot-decomposition-gray-r1-v0416.tar.gz" --ssh-key="D:\codex\服务器\Tencent_Cloud_Server.pem"`
- verify：
  - `npm run release:gray:verify -- --ssh-key="D:\codex\服务器\Tencent_Cloud_Server.pem" --expected-version=0.4.16 --expected-environment=gray`
- 远端 current release：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-hotspot-decomposition-gray-r1-v0416`
- 远端服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 远端状态接口：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - `http://127.0.0.1:18200/api/status`
  - 两者均返回：
    - `version = 0.4.16`
    - `environment = gray`
    - `dataDir = /opt/apps/xinghuan-canvas-next/shared/data`

## 本轮额外收口

- 发现 gray prepare 末段阻塞不是业务回归，而是 release contract 仍盯旧结构：
  - `scripts/verify-runninghub-output-reset-contract.mjs`
  - `scripts/verify-runninghub-worker-and-label-contract.mjs`
- 已同步收口到 helper-split 后的真实边界，并独立提交：
  - `fc66128` `test: align runninghub release contracts after helper split`

## 待用户验收

### 视觉验收

- 画布与后台页面视觉层不需要 Agent 代替验收，继续由用户实机检查。

### 真实业务链路

- RH 节点、RH 后台工作台、真实任务链路在 gray 环境中的交互与体验由用户复核。

## 风险与残留问题

- 当前只是第二批真实拆分，不代表 `server.ts` / `worker.ts` 已经完全健康。
- `worker.ts` 下一步优先仍是：
  - cancel-sync helper
  - unified diagnostics / failure normalization glue
- `server.ts` 下一步优先仍是：
  - system settings / queue settings handlers
  - public RunningHub proxy handlers

## 回滚信息

- `current` 回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-engineering-governance-guardrails-gray-r1-v0415`
- 需要重启的服务：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后需复查的接口：
  - `/api/status`
  - `/api/admin/runninghub/items`
  - `/api/proxy/runninghub/task/:id`
