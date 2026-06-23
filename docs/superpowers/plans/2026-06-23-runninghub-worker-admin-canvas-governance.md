# RunningHub Worker Admin Canvas Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以 `Phase A -> Phase B -> Phase C` 的顺序完成 RunningHub / Worker / Admin / Canvas 的治理工程，先修真实运行时问题，再收口结构热点，最后完成 production 与 gray 的环境隔离和运行态可观测补全。

**Architecture:** 当前治理工程不做一次性大重构，而是分三阶段推进。`Phase A` 只修真实业务问题；`Phase B` 把 `worker.ts`、RunningHub 和 RH 节点族拆回清晰边界；`Phase C` 才做 production 分库分队列和前端完整消费统一运行态诊断。整个过程以共享契约脚本、gray 放行和用户人工验收为主线。

**Tech Stack:** TypeScript, React, Node.js, PostgreSQL, Redis, RunningHub provider chain, shared runtime diagnostics, CodeGraph, RTK

---

### Task 1: 建立治理工程基线与契约入口

**Files:**
- Modify: `docs/superpowers/specs/2026-06-23-runninghub-worker-admin-canvas-governance-design.md`
- Modify: `docs/records/runninghub/2026-06-23-cross-layer-audit.md`
- Create: `scripts/verify-runninghub-governance-phase-a-contract.mjs`
- Create: `scripts/verify-runninghub-governance-phase-c-contract.mjs`
- Test: `node scripts/verify-runninghub-governance-phase-a-contract.mjs`

- [ ] **Step 1: 写 Phase A contract 脚本**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const runningHubNode = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
const rhToolsNode = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNode.tsx", import.meta.url), "utf8");

assert.match(worker, /all_keys_busy/);
assert.match(worker, /cancelState/);
assert.match(runningHubNode, /handleStop/);
assert.match(rhToolsNode, /handleStop/);

console.log("PASS runninghub governance phase-a contract");
```

- [ ] **Step 2: 写 Phase C contract 脚本**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const shared = await readFile(new URL("../packages/shared/src/provider-generation-task.ts", import.meta.url), "utf8");

assert.match(server, /failureCategory/);
assert.match(server, /cancelState/);
assert.match(shared, /UnifiedFailureCategory/);
assert.match(shared, /UnifiedCancelState/);

console.log("PASS runninghub governance phase-c contract");
```

- [ ] **Step 3: 运行 contract 确认基线**

Run:

```bash
node scripts/verify-runninghub-governance-phase-a-contract.mjs
node scripts/verify-runninghub-governance-phase-c-contract.mjs
```

Expected:
- 两个脚本都通过，作为治理工程的初始护栏

- [ ] **Step 4: 同步设计与审查文档中的入口引用**

更新：
- 设计文档加入实施计划路径
- 审查文档加入本计划路径

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-06-23-runninghub-worker-admin-canvas-governance-design.md docs/records/runninghub/2026-06-23-cross-layer-audit.md scripts/verify-runninghub-governance-phase-a-contract.mjs scripts/verify-runninghub-governance-phase-c-contract.mjs
git commit -m "test: add runninghub governance phase contracts"
```

### Task 2: Phase A.1 修复 RunningHub 多 Key 抢占逻辑

**Files:**
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `scripts/verify-runninghub-dynamic-key-selection-contract.mjs`
- Create: `scripts/verify-runninghub-key-acquire-fallback.ts`
- Test: `npx tsx scripts/verify-runninghub-key-acquire-fallback.ts`

- [ ] **Step 1: 写多 Key 抢占回归脚本**

覆盖场景：
- 默认 Key 可用时直接占位
- 默认 Key 占位失败时继续尝试第二把 Key
- 所有 Key 满载时才返回 `all_keys_busy`

- [ ] **Step 2: 将 `selectExecutableRunningHubKey` 与占位逻辑收口**

实现目标：
- 单把 Key 竞争失败后继续尝试后续 Key
- 只有全部失败才返回 busy
- 保持对外字段不变：
  - `preferredRhKeyId`
  - `assignedRhKeyId`
  - `assignedRhKeyNoteSnapshot`
  - `assignedRhKeyMaxConcurrency`
  - `rhQueueReason`

- [ ] **Step 3: API 保持入队兼容**

确认：
- 只写 `preferredRhKeyId`
- 不提前写死 `assignedRhKeyId`
- `rhQueueReason` 仅在所有 Key 满载时保留为 `all_keys_busy`

- [ ] **Step 4: 跑验证**

Run:

```bash
npx tsx scripts/verify-runninghub-key-acquire-fallback.ts
node scripts/verify-runninghub-dynamic-key-selection-contract.mjs
node scripts/verify-runninghub-key-pool-contract.mjs
npm run type-check -w @xinghuan/worker
npm run type-check -w @xinghuan/api
```

Expected:
- 新增脚本通过
- dynamic selection contract 继续通过
- type-check 通过

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/worker.ts apps/api/src/server.ts scripts/verify-runninghub-dynamic-key-selection-contract.mjs scripts/verify-runninghub-key-acquire-fallback.ts
git commit -m "fix: retry runninghub key acquisition across pool"
```

### Task 3: Phase A.2 让 RH 节点与 RH Tools 节点接入真实取消

**Files:**
- Modify: `apps/web/src/services/generation.ts`
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/web/src/components/nodes/RHToolsNode.tsx`
- Modify: `apps/api/src/task-cancellation-service.ts`
- Modify: `apps/api/src/server.ts`
- Test: `scripts/verify-runninghub-node-progress-contract.mjs`

- [ ] **Step 1: 在前端 generation service 增加任务取消接口**

新增一个可复用方法：

```ts
export async function cancelProviderTask(taskId: string) {
  const r = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/cancel`, { method: "POST" });
  const data = await readJsonResponse(r, "任务取消接口");
  if (!r.ok || !data.success) throw new Error(data?.error || `HTTP ${r.status}`);
  return data.data || {};
}
```

- [ ] **Step 2: RH 节点把“停止轮询”和“真实取消”分清**

行为要求：
- 当前仅停止轮询的路径改成显式文案
- “取消任务”走真实 cancel API
- 成功后回写：
  - `status = cancelled`
  - `error = null`
  - 清空继续轮询状态

- [ ] **Step 3: RH Tools 节点同步同一逻辑**

要求：
- 不允许 RunningHubNode 和 RHToolsNode 两边各自发明取消语义
- 两者都接入真实 cancel API

- [ ] **Step 4: 后端确认取消返回结构稳定**

确认取消返回至少包含：
- `cancelled`
- `upstream`
- `cancelScope`
- `upstreamSupported`
- `upstreamAttempted`
- `message`

- [ ] **Step 5: 跑验证**

Run:

```bash
node scripts/verify-runninghub-node-progress-contract.mjs
npm run type-check -w @xinghuan/web
npm run type-check -w @xinghuan/api
```

Expected:
- RH node progress contract 继续通过
- web/api type-check 通过

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/services/generation.ts apps/web/src/components/nodes/RunningHubNode.tsx apps/web/src/components/nodes/RHToolsNode.tsx apps/api/src/task-cancellation-service.ts apps/api/src/server.ts
git commit -m "fix: wire runninghub nodes to real task cancellation"
```

### Task 4: Phase A.3 补 RunningHub poll 非 JSON 容错

**Files:**
- Modify: `apps/worker/src/worker.ts`
- Modify: `scripts/verify-worker-grsai-image-adapter.ts`
- Create: `scripts/verify-runninghub-poll-non-json-contract.ts`
- Test: `npx tsx scripts/verify-runninghub-poll-non-json-contract.ts`

- [ ] **Step 1: 写 RunningHub poll 非 JSON 回归脚本**

覆盖场景：
- poll 返回 200 但 body 为 HTML
- poll 返回 200 但 body 为非 JSON 纯文本
- poll 返回空响应

预期：
- 均映射为统一失败诊断，而不是普通未归类异常

- [ ] **Step 2: 在 `executeRunningHubTask` 的 poll 分支加 JSON 保护**

要求：
- `JSON.parse(pollText)` 进入 `try/catch`
- 失败时写：
  - `failureCategory`
  - `providerDiagnostic`
  - `upstreamHttpStatus`
  - `upstreamResponseSnippet`

- [ ] **Step 3: 跑验证**

Run:

```bash
npx tsx scripts/verify-runninghub-poll-non-json-contract.ts
npm run type-check -w @xinghuan/worker
node scripts/verify-unified-protocol-runtime-contract.mjs
```

Expected:
- 新回归脚本通过
- unified runtime contract 继续通过

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/worker.ts scripts/verify-runninghub-poll-non-json-contract.ts scripts/verify-worker-grsai-image-adapter.ts
git commit -m "fix: normalize non-json runninghub poll failures"
```

### Task 5: Phase A gray 放行与审查同步

**Files:**
- Modify: `docs/records/runninghub/2026-06-23-cross-layer-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-06/2026-06-23.md`
- Modify: `ops/current/gray.md`
- Test: `npm run release:gray:prepare:runninghub`

- [ ] **Step 1: 跑 Phase A 汇总验证**

Run:

```bash
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/worker
npm run type-check -w @xinghuan/web
node scripts/verify-runninghub-dynamic-key-selection-contract.mjs
node scripts/verify-runninghub-key-pool-contract.mjs
node scripts/verify-runninghub-node-progress-contract.mjs
node scripts/verify-unified-protocol-runtime-contract.mjs
npx tsx scripts/verify-runninghub-key-acquire-fallback.ts
npx tsx scripts/verify-runninghub-poll-non-json-contract.ts
```

- [ ] **Step 2: 生成 gray 包**

Run:

```bash
npm run release:gray:prepare:runninghub -- --release=<phase-a-release-id> --verify="npx tsx scripts/verify-runninghub-key-acquire-fallback.ts" --verify="npx tsx scripts/verify-runninghub-poll-non-json-contract.ts"
```

- [ ] **Step 3: 灰度发布并验证**

Run:

```bash
npm run release:gray:deploy -- --release=<phase-a-release-id> --archive=dist-release/<phase-a-release-id>.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem
npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --expected-version=<current-version> --expected-environment=gray
```

- [ ] **Step 4: 同步审查记录**

更新：
- 已确认问题的状态
- Phase A 已完成项
- 仍待 Phase B / C 的问题

- [ ] **Step 5: Commit**

```bash
git add docs/records/runninghub/2026-06-23-cross-layer-audit.md docs/logbooks/daily/2026/2026-06/2026-06-23.md ops/current/gray.md
git commit -m "docs: record phase-a runninghub governance rollout"
```

### Task 6: Phase B 结构收口

**Files:**
- Reference: `docs/superpowers/plans/2026-06-23-worker-runninghub-runtime-second-stage.md`
- Modify: `apps/worker/src/worker.ts`
- Create: `apps/worker/src/worker-runninghub-client.ts`
- Create: `apps/worker/src/worker-runninghub-dispatch.ts`
- Create: `apps/worker/src/worker-runtime-diagnostics.ts`
- Create: `apps/worker/src/worker-cancel-sync.ts`
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/web/src/components/nodes/RHToolsNode.tsx`
- Create: `apps/web/src/components/nodes/hooks/use-runninghub-task-runtime.ts`

- [ ] **Step 1: 执行既有 Worker 第二阶段计划**

执行顺序采用现有详细计划：
- `Task 1` 固化 contract
- `Task 2` 抽 RunningHub client
- `Task 3` 抽 RunningHub dispatch
- `Task 4` 抽 runtime diagnostics / cancel sync
- `Task 5` 文档同步

- [ ] **Step 2: 补 RH 节点共享 runtime hook**

共享内容至少包括：
- submit
- poll / resume
- cancel
- output reset
- displayLabel 策略
- queueHint / progress 映射

- [ ] **Step 3: 跑验证**

Run:

```bash
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/worker
npm run type-check -w @xinghuan/web
node scripts/verify-runninghub-dynamic-key-selection-contract.mjs
node scripts/verify-unified-protocol-runtime-contract.mjs
node scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs
node scripts/verify-runninghub-node-progress-contract.mjs
```

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src apps/web/src/components/nodes docs/systems/worker/README.md docs/systems/runninghub/README.md
git commit -m "refactor: complete runninghub governance phase-b"
```

### Task 7: Phase C 完成 production / gray 环境隔离

**Files:**
- Modify: `ops/current/production.md`
- Modify: `ops/production-deploy-runbook.md`
- Modify: `ops/production-acceptance-checklist.md`
- Modify: `scripts/release/*`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/worker/src/worker.ts`
- Test: `npm run verify:system-observability`

- [ ] **Step 1: 建立 production 独立目标**

需要单独完成：
- production 独立数据库名
- production 独立 Redis 队列前缀
- 更新环境文件与 runbook

- [ ] **Step 2: 加 release gate 硬阻断**

要求：
- production 不允许继续指向 gray 库
- production 队列名不允许与 gray 相同

- [ ] **Step 3: 跑只读验证与快照**

Run:

```bash
npm run verify:system-observability
```

并确认：
- `database.current`
- `database.expected`
- `targetMatched`

- [ ] **Step 4: Commit**

```bash
git add ops/current/production.md ops/production-deploy-runbook.md ops/production-acceptance-checklist.md scripts/release apps/api/src/server.ts apps/worker/src/worker.ts
git commit -m "ops: isolate production runninghub governance runtime"
```

### Task 8: Phase C 前端完整消费统一运行态诊断与 drift 状态

**Files:**
- Modify: `apps/web/src/services/generation.ts`
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/web/src/components/nodes/RHToolsNode.tsx`
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
- Modify: `apps/admin/src/admin-runninghub-item-editor.tsx`
- Test: `npm run type-check -w @xinghuan/web`

- [ ] **Step 1: 前端任务查询结果补齐 richer 诊断字段**

至少接入：
- `failureCategory`
- `providerDiagnostic`
- `cancelState`
- `upstreamHttpStatus`

- [ ] **Step 2: RH 节点与 RH Tools 节点展示 richer 错误信息**

要求：
- 默认展示简化错误
- 调试视角可看完整 provider diagnostic

- [ ] **Step 3: 后台分析草案补 drift 状态**

至少提示：
- 分析字段 vs fetchInfo 字段漂移
- outputDraft vs 实际输出类型漂移

- [ ] **Step 4: 跑验证**

Run:

```bash
npm run type-check -w @xinghuan/web
npm run type-check -w @xinghuan/admin
npm run type-check -w @xinghuan/api
node scripts/verify-runninghub-node-progress-contract.mjs
node scripts/verify-admin-assistant-structured-analysis-contract.mjs
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/generation.ts apps/web/src/components/nodes/RunningHubNode.tsx apps/web/src/components/nodes/RHToolsNode.tsx apps/admin/src/admin-runninghub-workspace.tsx apps/admin/src/admin-runninghub-item-editor.tsx
git commit -m "feat: surface runtime diagnostics and runninghub drift state"
```

### Task 9: 最终文档、gray / production 记录与总验证

**Files:**
- Modify: `README.md`
- Modify: `docs/memory/current-state.md`
- Modify: `docs/memory/recent-release-index.md`
- Modify: `docs/prd/README.md`
- Modify: `docs/records/runninghub/2026-06-23-cross-layer-audit.md`
- Modify: `docs/logbooks/daily/2026/2026-06/2026-06-23.md`

- [ ] **Step 1: 更新文档入口**

同步：
- 当前阶段进展
- 当前 release 指针
- 已解决问题
- 仍存 residual risks

- [ ] **Step 2: 跑最终验证**

Run:

```bash
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/worker
npm run type-check -w @xinghuan/web
npm run type-check -w @xinghuan/admin
node scripts/verify-runninghub-governance-phase-a-contract.mjs
node scripts/verify-runninghub-governance-phase-c-contract.mjs
node scripts/verify-runninghub-dynamic-key-selection-contract.mjs
node scripts/verify-unified-protocol-runtime-contract.mjs
node scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs
node scripts/verify-runninghub-node-progress-contract.mjs
codegraph sync
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/memory/current-state.md docs/memory/recent-release-index.md docs/prd/README.md docs/records/runninghub/2026-06-23-cross-layer-audit.md docs/logbooks/daily/2026/2026-06/2026-06-23.md
git commit -m "docs: close runninghub governance execution record"
```

## 执行建议

### 推荐执行方式

优先采用：

1. `Phase A` 单独灰度与验收
2. `Phase B` 结构收口单独灰度与验收
3. `Phase C` 环境隔离与运行态补全单独推进

### 并行边界

允许并行：

- Phase A.1 与 Phase A.3
- Phase B 的 Worker 拆分与 RH 节点共享 hook 设计准备
- 文档整理与契约脚本补充

不建议并行：

- Phase B 结构拆分 与 Phase C production 切库
- RH 前端共享 runtime 大改 与 production 正式切换

### 关键风险提示

- production 分库必须单独做快照与回滚预案
- RH 节点取消接入真实后端任务取消时，必须确认不会把“仅停轮询”误报成“真实取消成功”
- RunningHub 多 Key 抢占逻辑修正后，要重点关注 Redis 并发窗口释放是否有泄漏
