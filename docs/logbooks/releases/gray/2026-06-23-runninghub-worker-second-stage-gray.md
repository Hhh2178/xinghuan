# RunningHub Worker Second-Stage Gray Release - 2026-06-23

## 发布目标

- 发布 RunningHub worker second-stage 第一批收口。
- 将 RunningHub submit / poll / 输出提取从 `worker.ts` 下沉到独立 client。
- 将“避免继续制造超级文件”和“发布前主动收紧工作树”的工程规则正式写入仓库约束。
- 将当前 gray 版本推进到 `v0.4.15`。

## 发布信息

- 环境：`gray`
- 版本：`v0.4.15`
- release：`20260623-runninghub-worker-second-stage-gray-r1-v0415`
- 上一灰度 release：`20260623-runninghub-runtime-guardrails-gray-r1-v0414`

## Agent 已验证

### 本地代码与契约

- 类型检查：
  - `npm run type-check -w @xinghuan/worker`
  - `npm run type-check -w @xinghuan/api`
- RunningHub second-stage 与统一运行态契约：
  - `npx tsx scripts/verify-worker-runninghub-client.ts`
  - `node scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs`
  - `node scripts/verify-unified-protocol-runtime-contract.mjs`
  - `node scripts/verify-runninghub-dynamic-key-selection-contract.mjs`
  - `node scripts/verify-runninghub-key-pool-contract.mjs`
  - `node scripts/verify-runninghub-node-progress-contract.mjs`
- Worker 兼容回归：
  - `npm run verify:provider-generation-worker`
- 索引同步：
  - `codegraph sync`

### 本轮代码边界

- RunningHub worker second-stage：
  - `apps/worker/src/worker-runninghub-client.ts`
  - `apps/worker/src/worker.ts`
  - `scripts/verify-worker-runninghub-client.ts`
  - `scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs`
  - `scripts/verify-unified-protocol-runtime-contract.mjs`
- 工程治理与系统入口：
  - `AGENTS.md`
  - `docs/governance/documentation-governance-standard.md`
  - `docs/systems/worker/README.md`
  - `docs/systems/runninghub/README.md`
  - `docs/memory/current-state.md`
  - `docs/records/runninghub/2026-06-23-cross-layer-audit.md`
  - `docs/logbooks/daily/2026/2026-06/2026-06-23.md`

## 待用户验收

### 视觉与体验

- gray 页面上的 RH 节点、RH Tools 节点、后台 RH 工作台视觉与交互体验。
- 真实业务使用中对错误提示、进度、结果回填的主观感受。

### 真实业务链路

- 多 Key、排队、取消、输出回填在真实 RunningHub 业务样本下的表现。
- 继续观察 RH worker second-stage 收口后是否还有新的上游边界样本暴露。

## 风险与残留问题

- 本轮完成的是 worker second-stage 第一批收口，不代表 `dispatch / cancel-sync` 已全部独立。
- `server.ts`、`RunningHubNode.tsx`、后台 RH 工作台仍是热点大文件，后续还要继续拆。
- gray 发布后的视觉层与真实业务体验仍由用户验收，不由 Agent 代替。

## 回滚信息

- `current` 回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260623-runninghub-runtime-guardrails-gray-r1-v0414`
- 需要重启的服务：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
