# Unified Protocol Runtime And RunningHub Key Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有多协议任务执行链路补齐统一失败分类、轮询容错、双向取消同步，并修复 RunningHub 多 Key 池在默认 Key 满载后不能自动切换其他可用 Key 的问题。

**Architecture:** 本轮不推翻现有 RunningHub、GRSAI、APIMart、ModelScope、OpenAI-like 的提交与轮询实现，而是在 `apps/worker/src/worker.ts` 和 `apps/api/src/server.ts` 外围增加统一运行时字段与协调逻辑。RunningHub 保留现有 Key 池管理结构，但把调度从“入队时静态绑定”改成“默认偏好写入 + Worker 执行前实时择优 + 结果落库记录实际使用 Key”。

**Tech Stack:** TypeScript, React, Node.js, PostgreSQL, Redis, shared package contracts, RTK, CodeGraph

---

### Task 1: 固化统一运行时与 RH 动态调度的失败契约

**Files:**
- Create: `scripts/verify-unified-protocol-runtime-contract.mjs`
- Create: `scripts/verify-runninghub-dynamic-key-selection-contract.mjs`
- Modify: `scripts/verify-gray-release-prepare-contract.mjs`
- Modify: `scripts/verify-local-acceptance-chain.mjs`
- Test: `node scripts/verify-unified-protocol-runtime-contract.mjs`

- [ ] **Step 1: 写统一运行时契约脚本**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const shared = await readFile(new URL("../packages/shared/src/index.ts", import.meta.url), "utf8");

assert.match(shared, /failureCategory/);
assert.match(shared, /cancelState/);
assert.match(worker, /cancel_requested/);
assert.match(worker, /providerDiagnostic/);
assert.match(worker, /upstreamHttpStatus/);
assert.match(worker, /upstream_poll_gateway_failed/);
assert.match(server, /queueHint/);

console.log("PASS unified protocol runtime contract");
```

- [ ] **Step 2: 写 RunningHub 动态选 Key 契约脚本**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");

assert.match(server, /inspectRunningHubKeyPoolAvailability/);
assert.match(server, /preferredRhKeyId/);
assert.match(worker, /selectExecutableRunningHubKey/);
assert.match(worker, /all_keys_busy/);
assert.match(worker, /assignedRhKeyId/);

console.log("PASS runninghub dynamic key selection contract");
```

- [ ] **Step 3: 把新契约加入灰度准备链**

在 `scripts/verify-gray-release-prepare-contract.mjs` 中加入：

```js
"node scripts/verify-unified-protocol-runtime-contract.mjs",
"node scripts/verify-runninghub-dynamic-key-selection-contract.mjs",
```

在 `scripts/verify-local-acceptance-chain.mjs` 中加入：

```js
"node scripts/verify-unified-protocol-runtime-contract.mjs",
"node scripts/verify-runninghub-dynamic-key-selection-contract.mjs",
```

- [ ] **Step 4: 运行契约确认 Red**

Run:

```bash
node scripts/verify-unified-protocol-runtime-contract.mjs
node scripts/verify-runninghub-dynamic-key-selection-contract.mjs
node scripts/verify-gray-release-prepare-contract.mjs
node scripts/verify-local-acceptance-chain.mjs
```

Expected:
- 前两个新契约失败
- 准备链脚本在加入新断言后失败

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-unified-protocol-runtime-contract.mjs scripts/verify-runninghub-dynamic-key-selection-contract.mjs scripts/verify-gray-release-prepare-contract.mjs scripts/verify-local-acceptance-chain.mjs
git commit -m "test: add unified runtime and runninghub dispatch contracts"
```

### Task 2: 扩展共享任务结果类型，定义统一失败与取消字段

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/provider-generation-task-service.ts`
- Modify: `apps/api/src/server.ts`
- Test: `node scripts/verify-unified-protocol-runtime-contract.mjs`

- [ ] **Step 1: 先给共享结果结构补类型**

在 `packages/shared/src/index.ts` 中新增：

```ts
export type UnifiedFailureCategory =
  | "auth"
  | "quota_or_credits"
  | "model_config"
  | "upstream_business_failed"
  | "upstream_poll_gateway_failed"
  | "upstream_poll_timeout"
  | "local_cancelled"
  | "remote_cancel_failed"
  | "unknown";

export type UnifiedCancelState =
  | "cancelled"
  | "cancelled_local_only"
  | "cancel_failed_remote_but_closed_local";

export interface UnifiedRuntimeDiagnostic {
  failureCategory?: UnifiedFailureCategory;
  providerDiagnostic?: string;
  upstreamHttpStatus?: number;
  upstreamResponseSnippet?: string;
  submitDiagnostic?: string;
  pollDiagnostic?: string;
  cancelState?: UnifiedCancelState;
}
```

- [ ] **Step 2: 给任务结果聚合结构补兼容字段**

在 `apps/api/src/provider-generation-task-service.ts` 的任务结果组装处追加：

```ts
const runtimeDiagnostic = {
  failureCategory: safeText(task.result?.failureCategory),
  providerDiagnostic: safeText(task.result?.providerDiagnostic),
  upstreamHttpStatus: toOptionalNumber(task.result?.upstreamHttpStatus),
  upstreamResponseSnippet: safeText(task.result?.upstreamResponseSnippet),
  submitDiagnostic: safeText(task.result?.submitDiagnostic),
  pollDiagnostic: safeText(task.result?.pollDiagnostic),
  cancelState: safeText(task.result?.cancelState),
};
```

并继续保留：

```ts
failureReason: safeText(task.result?.failureReason),
```

- [ ] **Step 3: 给 API 对外任务查询响应补字段**

在 `apps/api/src/server.ts` 的任务详情与轮询响应中追加：

```ts
failureCategory,
providerDiagnostic,
upstreamHttpStatus,
upstreamResponseSnippet,
submitDiagnostic,
pollDiagnostic,
cancelState,
```

不要删除现有：

```ts
status,
progress,
failureReason,
```

- [ ] **Step 4: 运行共享契约**

Run:

```bash
node scripts/verify-unified-protocol-runtime-contract.mjs
npm run typecheck -- --filter shared
```

Expected:
- 契约从缺字段失败变为通过或只剩 worker/server 断言失败
- shared 类型检查通过

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/index.ts apps/api/src/provider-generation-task-service.ts apps/api/src/server.ts
git commit -m "feat: add unified runtime diagnostic fields"
```

### Task 3: 在 Worker 中实现统一失败归一化与落库

**Files:**
- Modify: `apps/worker/src/worker.ts`
- Test: `node scripts/verify-unified-protocol-runtime-contract.mjs`

- [ ] **Step 1: 先写最小失败归一化函数**

在 `apps/worker/src/worker.ts` 新增：

```ts
function normalizeUnifiedFailure(error: unknown): {
  failureReason: string;
  failureCategory: UnifiedFailureCategory;
  providerDiagnostic: string;
  upstreamHttpStatus?: number;
  upstreamResponseSnippet?: string;
} {
  const message = error instanceof Error ? error.message : String(error || "unknown error");
  const httpStatus = toOptionalHttpStatus(error);
  const responseSnippet = toOptionalResponseSnippet(error);

  if (/apikey|unauthorized|forbidden|auth/i.test(message)) {
    return { failureReason: message, failureCategory: "auth", providerDiagnostic: message, upstreamHttpStatus: httpStatus, upstreamResponseSnippet: responseSnippet };
  }
  if (/credits|quota|balance|consume/i.test(message)) {
    return { failureReason: message, failureCategory: "quota_or_credits", providerDiagnostic: message, upstreamHttpStatus: httpStatus, upstreamResponseSnippet: responseSnippet };
  }
  if (/model not found|workflow not found|app not found|invalid/i.test(message)) {
    return { failureReason: message, failureCategory: "model_config", providerDiagnostic: message, upstreamHttpStatus: httpStatus, upstreamResponseSnippet: responseSnippet };
  }
  if (/502|503|504|bad gateway|fetch failed/i.test(message)) {
    return { failureReason: message, failureCategory: "upstream_poll_gateway_failed", providerDiagnostic: message, upstreamHttpStatus: httpStatus, upstreamResponseSnippet: responseSnippet };
  }
  return { failureReason: message, failureCategory: "unknown", providerDiagnostic: message, upstreamHttpStatus: httpStatus, upstreamResponseSnippet: responseSnippet };
}
```

- [ ] **Step 2: 在 `processTask()` catch 分支中改为写结构化诊断**

把只写：

```ts
failureReason: error.message
```

改成：

```ts
const normalized = normalizeUnifiedFailure(error);
...
failureReason: normalized.failureReason,
failureCategory: normalized.failureCategory,
providerDiagnostic: normalized.providerDiagnostic,
upstreamHttpStatus: normalized.upstreamHttpStatus,
upstreamResponseSnippet: normalized.upstreamResponseSnippet,
```

并继续保留现有：

```ts
failedAt,
workerId,
runtimeStage,
```

- [ ] **Step 3: 给协议级显式业务失败补分类覆盖**

在 `executeGrsaiImageTask()`、`executeRunningHubTask()` 和其他已有明确 `status=failed` 的位置，把：

```ts
throw new Error(failureMessage)
```

改成：

```ts
throw buildProviderBusinessFailure({
  message: failureMessage,
  category: "upstream_business_failed",
  upstreamHttpStatus,
  upstreamResponseSnippet,
});
```

- [ ] **Step 4: 运行 worker 契约**

Run:

```bash
node scripts/verify-unified-protocol-runtime-contract.mjs
npm run typecheck -- --filter worker
```

Expected:
- 契约中的 `failureCategory/providerDiagnostic/upstreamHttpStatus` 断言通过
- worker 类型检查通过

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/worker.ts
git commit -m "feat: normalize worker runtime failures"
```

### Task 4: 为 GRSAI 轮询补短退避重试，不再把网关抖动立刻判死

**Files:**
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/api/src/grsai-image-adapter.ts`
- Test: `node scripts/verify-unified-protocol-runtime-contract.mjs`

- [ ] **Step 1: 抽一个轮询网关类错误判断函数**

在 `apps/worker/src/worker.ts` 新增：

```ts
function isRetryablePollGatewayFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /502|503|504|bad gateway|fetch failed/i.test(message);
}
```

- [ ] **Step 2: 在 `executeGrsaiImageTask()` 轮询循环中加入重试**

把原先的单次失败即退出，改为：

```ts
let gatewayRetryCount = 0;
const maxGatewayRetries = 4;

try {
  const polled = await client.query(taskId);
  gatewayRetryCount = 0;
  ...
} catch (error) {
  if (isRetryablePollGatewayFailure(error) && gatewayRetryCount < maxGatewayRetries) {
    gatewayRetryCount += 1;
    await sleep(1200 * gatewayRetryCount);
    continue;
  }
  throw error;
}
```

- [ ] **Step 3: 保留上游明确失败原文**

当 `normalizeGrsaiState(polled.payload)` 返回失败时，确保抛出的错误带上：

```ts
providerDiagnostic: JSON.stringify(polled.payload).slice(0, 500),
failureCategory: "upstream_business_failed",
```

- [ ] **Step 4: 如果 `apps/api/src/grsai-image-adapter.ts` 也有轮询辅助逻辑，同步用同口径错误分类**

至少补：

```ts
throw new Error(`GRSAI poll failed: ${message}`);
```

改为带 `status/body` 摘要的错误对象或统一辅助函数。

- [ ] **Step 5: 运行验证**

Run:

```bash
node scripts/verify-unified-protocol-runtime-contract.mjs
npm run typecheck -- --filter worker
npm run typecheck -- --filter api
```

Expected:
- 契约中的 `upstream_poll_gateway_failed` 断言通过
- `api/worker` 类型检查通过

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/worker.ts apps/api/src/grsai-image-adapter.ts
git commit -m "feat: retry grsai poll gateway failures"
```

### Task 5: 把 RunningHub 调度从静态绑定改成执行前实时择优

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/worker/src/worker.ts`
- Modify: `packages/shared/src/task-queue-settings.ts`
- Test: `node scripts/verify-runninghub-dynamic-key-selection-contract.mjs`

- [ ] **Step 1: API 入队阶段只写默认偏好，不写最终绑定**

在 `apps/api/src/server.ts` 的 RH 入队逻辑里，把：

```ts
const assignedRhKey = runningHubKeyAvailability.selected || runningHubKeyAvailability.pool[0] || null;
```

改成：

```ts
const preferredRhKey = runningHubKeyAvailability.selectedDefault || runningHubKeyAvailability.firstEnabled || null;
```

写入 payload/result：

```ts
preferredRhKeyId: preferredRhKey?.id || "",
preferredRhKeyNoteSnapshot: preferredRhKey?.note || "",
rhQueueReason: runningHubKeyAvailability.allBusy ? "all_keys_busy" : "",
```

不要在这里把 `assignedRhKeyId` 当成最终分配结果写死。

- [ ] **Step 2: 在 Worker 中新增最终选 Key 函数**

在 `apps/worker/src/worker.ts` 新增：

```ts
async function selectExecutableRunningHubKey(task: TaskRow, settings: TaskQueueSettings) {
  const pool = normalizeRunningHubKeyPool(task.rhKeyPool);
  const preferredRhKeyId = safeText(task.payload.preferredRhKeyId || task.result.preferredRhKeyId);
  const ordered = orderRunningHubKeysForExecution(pool, preferredRhKeyId);

  for (const item of ordered) {
    const current = await getRunningHubWindowUsage(task.providerId, item.id);
    if (current < item.maxConcurrency) return item;
  }
  return null;
}
```

- [ ] **Step 3: 在 `acquireRunningHubExecutionWindow()` 中基于最终 Key 占位**

把依赖：

```ts
const assignedRhKeyId = safeText(task.payload.assignedRhKeyId || task.result.assignedRhKeyId) || "legacy-default";
```

改成：

```ts
const selectedRhKey = await selectExecutableRunningHubKey(task, settings);
if (!selectedRhKey) return { acquired: false, reason: "RunningHub 所有 Key 并发已满", rhQueueReason: "all_keys_busy" };
```

并把最终选中的 Key 写回任务结果：

```ts
assignedRhKeyId: selectedRhKey.id,
assignedRhKeyNoteSnapshot: selectedRhKey.note,
assignedRhKeyMaxConcurrency: selectedRhKey.maxConcurrency,
```

- [ ] **Step 4: 兼容 legacy 单 Key**

如果 `task.rhKeyPool` 为空但 `task.apiKeyCipher` 存在，回退：

```ts
{ id: "legacy-default", note: "兼容单 Key", maxConcurrency: settings.runninghub.concurrency, enabled: true }
```

- [ ] **Step 5: 总并发只读汇总保持不变**

在 `packages/shared/src/task-queue-settings.ts` 保留现有：

```ts
runninghub: { concurrency: 2, enabled: true }
```

但在 RH 运行态与后台展示逻辑中继续使用：

```ts
sum(enabled rhKey.maxConcurrency)
```

不要再把 `settings.runninghub.concurrency` 当作多 Key 模式下的真实总并发。

- [ ] **Step 6: 运行 RH 调度契约**

Run:

```bash
node scripts/verify-runninghub-dynamic-key-selection-contract.mjs
npm run typecheck -- --filter worker
npm run typecheck -- --filter api
```

Expected:
- 契约通过
- `api/worker` 类型检查通过

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/server.ts apps/worker/src/worker.ts packages/shared/src/task-queue-settings.ts
git commit -m "feat: select runninghub key at execution time"
```

### Task 6: 统一画布取消与后台取消的双向同步

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/web/src/services/generation.ts`
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/web/src/components/nodes/RHToolsNode.tsx`
- Test: `node scripts/verify-unified-protocol-runtime-contract.mjs`

- [ ] **Step 1: 在 API 取消入口统一写 `cancel_requested`**

在 `apps/api/src/server.ts` 所有任务取消入口中统一写入：

```ts
status: "cancel_requested",
cancelRequestedAt: Date.now(),
result: {
  ...existingResult,
  runtimeStage: "cancel_requested",
}
```

不要再直接把状态短路成 `cancelled`。

- [ ] **Step 2: Worker 领取前与轮询中都检查取消**

在 `apps/worker/src/worker.ts` 的领取、提交前、轮询循环内增加：

```ts
if (isTaskCancelRequested(task)) {
  return closeTaskAsCancelled(task, { cancelState: "cancelled_local_only" });
}
```

如果协议支持取消，再额外调用：

```ts
await attemptProviderCancel(task);
```

- [ ] **Step 3: 封装本地关闭取消函数**

新增：

```ts
async function closeTaskAsCancelled(task: TaskRow, payload: { cancelState: UnifiedCancelState }) {
  return updateTaskResult(task.id, {
    status: "cancelled",
    cancelState: payload.cancelState,
    failureCategory: "local_cancelled",
    failureReason: "任务已取消",
    finishedAt: Date.now(),
  });
}
```

- [ ] **Step 4: 前端节点消费取消终态**

在 `apps/web/src/services/generation.ts` 的任务查询返回结构中补：

```ts
cancelState?: string;
failureCategory?: string;
```

在 `RunningHubNode.tsx` 与 `RHToolsNode.tsx` 轮询中加入：

```ts
if (r.status === "cancelled" || r.failureCategory === "local_cancelled") {
  update({ status: "idle", progress: "", error: "任务已取消", rhQueueHint: "" });
  return;
}
```

- [ ] **Step 5: 运行验证**

Run:

```bash
node scripts/verify-unified-protocol-runtime-contract.mjs
npm run typecheck -- --filter web
npm run typecheck -- --filter api
npm run typecheck -- --filter worker
```

Expected:
- 契约中的 `cancel_requested` 断言通过
- Web/API/Worker 类型检查通过

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/server.ts apps/worker/src/worker.ts apps/web/src/services/generation.ts apps/web/src/components/nodes/RunningHubNode.tsx apps/web/src/components/nodes/RHToolsNode.tsx
git commit -m "feat: sync task cancellation across api worker and canvas"
```

### Task 7: 对外状态口径与 RH 节点运行态消费收口

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/web/src/services/generation.ts`
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/web/src/components/nodes/RHToolsNode.tsx`
- Test: `node scripts/verify-runninghub-node-progress-contract.mjs`

- [ ] **Step 1: API 查询结果补统一 queueHint/progress 派生**

在 `apps/api/src/server.ts` 的 RH 查询结果组装中统一：

```ts
queueHint:
  task.status === "queued" || safeText(task.result?.rhQueueReason) === "all_keys_busy"
    ? "任务队列排队中"
    : "",
progress:
  task.status === "running"
    ? "45%"
    : task.status === "queued" || task.status === "submitting"
      ? "5%"
      : task.status === "succeeded"
        ? "100%"
        : "",
```

- [ ] **Step 2: 前端 RH 节点只消费后端进度**

把 `RunningHubNode.tsx` 和 `RHToolsNode.tsx` 内的默认猜测逻辑收口为：

```ts
rhProgress: r.progress || "",
rhQueueHint: r.queueHint || "",
```

保留兜底文本，但不要继续把 `"QUEUED" ? "5%" : "45%"` 到处散落复制。

- [ ] **Step 3: 节点错误展示兼容新分类**

在两个节点中加入：

```ts
const runtimeError = r.failureReason || r.providerDiagnostic || "";
```

优先展示用户可理解的摘要，不直接把长 JSON 原文塞进节点面板。

- [ ] **Step 4: 运行 RH 节点契约**

Run:

```bash
node scripts/verify-runninghub-node-progress-contract.mjs
npm run typecheck -- --filter web
```

Expected:
- 契约通过
- web 类型检查通过

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/server.ts apps/web/src/services/generation.ts apps/web/src/components/nodes/RunningHubNode.tsx apps/web/src/components/nodes/RHToolsNode.tsx
git commit -m "feat: unify runninghub runtime status consumption"
```

### Task 8: 更新系统文档与验证入口

**Files:**
- Modify: `docs/systems/runninghub/README.md`
- Modify: `docs/systems/api/README.md`
- Modify: `docs/systems/worker/README.md`
- Modify: `DEVLOG.md`
- Modify: `docs/logbooks/daily/2026/2026-06/2026-06-23.md`

- [ ] **Step 1: 更新 RunningHub 系统文档**

在 `docs/systems/runninghub/README.md` 补充：

```md
- RH Key 池调度只按多 Key 池进行，不再区分个人/企业语义
- 默认 Key 只代表优先级，不代表唯一执行 Key
- Worker 执行前会按实时占用重新择优分配最终 Key
```

- [ ] **Step 2: 更新 API / Worker 系统文档**

在 `docs/systems/api/README.md` 与 `docs/systems/worker/README.md` 补充：

```md
- 统一失败分类字段
- 网关类轮询错误短退避重试
- cancel_requested -> cancelled 双向同步链路
```

- [ ] **Step 3: 记录当日日志**

在 `DEVLOG.md` 与当日日志中记录：
- 统一执行运行时字段
- GRSAI 网关轮询重试
- RH 执行前动态选 Key
- 取消双向同步

- [ ] **Step 4: Commit**

```bash
git add docs/systems/runninghub/README.md docs/systems/api/README.md docs/systems/worker/README.md DEVLOG.md docs/logbooks/daily/2026/2026-06/2026-06-23.md
git commit -m "docs: record unified runtime and runninghub dispatch changes"
```

### Task 9: 完整验证、同步 CodeGraph、准备进入实现执行

**Files:**
- Modify: `ops/current/gray.md`
- Modify: `ops/current/release-entrypoints.md`

- [ ] **Step 1: 运行完整验证**

Run:

```bash
node scripts/verify-unified-protocol-runtime-contract.mjs
node scripts/verify-runninghub-dynamic-key-selection-contract.mjs
node scripts/verify-runninghub-key-pool-contract.mjs
node scripts/verify-runninghub-node-progress-contract.mjs
node scripts/verify-runninghub-worker-and-label-contract.mjs
npm run typecheck
```

Expected:
- 所有 RH 与统一运行时契约通过
- 全仓类型检查通过

- [ ] **Step 2: 同步 CodeGraph**

Run:

```bash
codegraph sync
```

Expected:
- 索引同步成功

- [ ] **Step 3: 更新当前放行入口说明**

在 `ops/current/gray.md` 与 `ops/current/release-entrypoints.md` 补充：

```md
- Agent 已验证：统一失败分类、GRSAI 轮询重试、RH 动态选 Key、取消状态同步
- 待用户验收：真实多 Key 账号资源下的排队与切 Key体验、灰度视觉交互观感
```

- [ ] **Step 4: Commit**

```bash
git add ops/current/gray.md ops/current/release-entrypoints.md
git commit -m "chore: update release verification notes for unified runtime"
```
