# RunningHub Key Pool And Node Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 RunningHub 补齐多 Key 号池、单 Key 并发分配、节点阶段进度条、参数描述收口，以及仓库级 RTK 协作规则。

**Architecture:** 本轮改动分为四层：共享类型与后台 Provider 数据模型承载 RH Key 池，API/Worker 负责 Key 选择与状态口径，Admin Workspace 负责折叠式 Key 池管理卡片，Canvas RH 节点负责阶段进度与参数显示策略。实现坚持 TDD，先补契约脚本锁定行为，再做最小实现并逐层放行。

**Tech Stack:** TypeScript, React, Node.js, PostgreSQL, shared package contracts, RTK, CodeGraph

---

### Task 1: 固化 RH Key 池与节点进度的失败契约

**Files:**
- Create: `scripts/verify-runninghub-key-pool-contract.mjs`
- Create: `scripts/verify-runninghub-node-progress-contract.mjs`
- Modify: `scripts/verify-runninghub-worker-and-label-contract.mjs`
- Modify: `scripts/verify-gray-release-prepare-contract.mjs`
- Test: `node scripts/verify-runninghub-key-pool-contract.mjs`

- [ ] **Step 1: 写 RH Key 池契约脚本**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const adminTypes = await readFile(new URL("../apps/admin/src/admin-types.ts", import.meta.url), "utf8");
const workspace = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace.tsx", import.meta.url), "utf8");

assert.match(adminTypes, /export interface RunningHubKeyPoolItem \{/);
assert.match(adminTypes, /rhKeyPool\?: RunningHubKeyPoolItem\[\];/);
assert.match(server, /function normalizeRunningHubKeyPool\(/);
assert.match(server, /function summarizeRunningHubKeyPool\(/);
assert.match(workspace, /RH Key 池管理/);
assert.match(workspace, /新增 Key/);

console.log("PASS runninghub key pool contract");
```

- [ ] **Step 2: 写 RH 节点阶段进度契约脚本**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const runninghubNode = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
const generation = await readFile(new URL("../apps/web/src/services/generation.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");

assert.match(server, /task\.status === "running" \? "45%" : task\.status === "queued" \? "5%"/);
assert.match(generation, /queueHint\?: string;/);
assert.match(runninghubNode, /任务队列排队中/);
assert.match(runninghubNode, /45%/);
assert.match(runninghubNode, /5%/);

console.log("PASS runninghub node progress contract");
```

- [ ] **Step 3: 扩展已有 RH label 契约**

在 `scripts/verify-runninghub-worker-and-label-contract.mjs` 中增加断言：

```js
assert.doesNotMatch(runninghubNode, /来自 requestExample\.nodeInfoList 的/);
assert.doesNotMatch(rhToolsNode, /来自 requestExample\.nodeInfoList 的/);
assert.match(runninghubNode, /displayLabel \|\| it\.label \|\| it\.fieldName/);
assert.match(rhToolsNode, /displayLabel \|\| it\.label \|\| it\.fieldName/);
```

- [ ] **Step 4: 把新契约补进灰度准备契约**

在 `scripts/verify-gray-release-prepare-contract.mjs` 中要求 `runninghub` preset 包含：

```js
"node scripts/verify-runninghub-key-pool-contract.mjs"
"node scripts/verify-runninghub-node-progress-contract.mjs"
```

- [ ] **Step 5: 运行失败校验确认 Red**

Run:

```bash
node scripts/verify-runninghub-key-pool-contract.mjs
node scripts/verify-runninghub-node-progress-contract.mjs
node scripts/verify-runninghub-worker-and-label-contract.mjs
node scripts/verify-gray-release-prepare-contract.mjs
```

Expected:
- `verify-runninghub-key-pool-contract.mjs` 失败
- `verify-runninghub-node-progress-contract.mjs` 失败
- label 契约如果新增断言后失败，记录为预期 Red

### Task 2: 扩展共享类型与后台 Provider 数据模型

**Files:**
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/environment-sync-service.ts`
- Test: `node scripts/verify-runninghub-key-pool-contract.mjs`

- [ ] **Step 1: 先补前后台共享的最小类型**

在 `apps/admin/src/admin-types.ts` 中新增：

```ts
export interface RunningHubKeyPoolItem {
  id: string;
  note: string;
  apiKeyPreview: string;
  maxConcurrency: number;
  enabled: boolean;
  currentInFlight?: number;
  createdAt: number;
  updatedAt: number;
}
```

并补到：

```ts
export interface ProviderRecord {
  rhKeyPool?: RunningHubKeyPoolItem[];
}
```

- [ ] **Step 2: 在 API Provider 记录中加入 RH Key 池结构**

在 `apps/api/src/server.ts` 的 `AdminProviderRecord` 与相关 normalize / serialize 链路中补入：

```ts
rhKeyPool?: RunningHubKeyPoolItemRecord[];
```

并新增最小归一化函数：

```ts
function normalizeRunningHubKeyPool(value: unknown): RunningHubKeyPoolItemRecord[] {
  // 过滤非法项、修正 maxConcurrency、保留 preview
}
```

- [ ] **Step 3: 给旧单 Key 模式加兼容转换**

在读取 RH Provider 时，如果：

```ts
!normalized.rhKeyPool?.length && normalized.apiKey
```

则构造一个兼容单 Key 摘要项用于前台展示：

```ts
{
  id: "legacy-default",
  note: "兼容单 Key",
  apiKeyPreview: normalized.apiKeyPreview || "...",
  maxConcurrency: normalizedTaskQueue.runninghub.concurrency,
  enabled: true,
}
```

- [ ] **Step 4: 补环境同步与对外序列化字段**

确保 `environment-sync-service.ts` 和对外 Provider 序列化响应能带上：

```ts
rhKeyPool
```

但不泄露明文 Key。

- [ ] **Step 5: 运行 Key 池契约确认 Green**

Run:

```bash
node scripts/verify-runninghub-key-pool-contract.mjs
```

Expected: PASS

### Task 3: 先补 API 级 RH Key 池管理接口

**Files:**
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/admin/src/admin-types.ts`
- Test: `node scripts/verify-runninghub-key-pool-contract.mjs`

- [ ] **Step 1: 为后台 API 客户端补最小接口**

在 `apps/admin/src/admin-api-client.ts` 中新增：

```ts
listKeyPool: (providerId: string) =>
  adminFetch<RunningHubKeyPoolItem[]>(`/api/admin/providers/${providerId}/runninghub/key-pool`),
saveKeyPool: (providerId: string, payload: { rhKeyPool: RunningHubKeyPoolItemDraft[] }) =>
  adminFetch<RunningHubKeyPoolItem[]>(`/api/admin/providers/${providerId}/runninghub/key-pool`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }),
deleteKeyPoolItem: (providerId: string, keyId: string) =>
  adminFetch<RunningHubKeyPoolItem>(`/api/admin/providers/${providerId}/runninghub/key-pool/${keyId}`, {
    method: "DELETE",
  }),
```

- [ ] **Step 2: 在 server.ts 中增加 RH Key 池读写路由**

实现：

```ts
GET /api/admin/providers/:providerId/runninghub/key-pool
PUT /api/admin/providers/:providerId/runninghub/key-pool
DELETE /api/admin/providers/:providerId/runninghub/key-pool/:keyId
```

写入规则：
- `maxConcurrency` 至少 `1`
- 删除只删除单个 `keyId`
- 新 Key 明文仅在写入时出现，落库后仅保留密文与 preview

- [ ] **Step 3: 把 preview 与密文写入统一加密链**

沿用现有：

```ts
encryptSecret(...)
secretPreview(...)
```

不要引入第二套密钥机制。

- [ ] **Step 4: 运行契约与类型检查**

Run:

```bash
node scripts/verify-runninghub-key-pool-contract.mjs
npm run typecheck -- --filter admin
```

Expected:
- 契约通过
- Admin 相关类型无新增报错

### Task 4: 实现 RH Key 选择、总并发汇总与任务记录

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/worker/src/worker.ts`
- Modify: `packages/shared/src/task-queue-settings.ts`
- Test: `node scripts/verify-runninghub-node-progress-contract.mjs`

- [ ] **Step 1: 先写后端最小选择函数**

在 `apps/api/src/server.ts` 中新增：

```ts
function summarizeRunningHubKeyPool(items: RunningHubKeyPoolItemRecord[]) {
  return {
    enabledKeyCount: ...,
    totalConcurrency: ...,
  };
}

async function pickAvailableRunningHubKey(provider: AdminProviderRecord) {
  // 稳定顺序扫描，选择第一个有空余并发的 Key
}
```

- [ ] **Step 2: 在 RH 任务创建阶段绑定 Key**

修改 `createRunningHubQueuedTask(...)`，让任务 payload/result 至少记录：

```ts
assignedRhKeyId
assignedRhKeyNoteSnapshot
rhQueueReason
```

如果没有任何启用 Key：
- 直接抛错 `RunningHub 未配置可用 Key`

如果所有 Key 满：
- 任务进入 `queued`
- `rhQueueReason = "all_keys_busy"`

- [ ] **Step 3: Worker 执行 RH 时优先使用已分配 Key**

在 `apps/worker/src/worker.ts` 的 `executeRunningHubTask` 链路中：
- 优先读取任务绑定的 RH Key 密文
- 不再默认只取 provider 单 `apiKey`

- [ ] **Step 4: RH 平台总并发改为 Key 池汇总**

在系统页或相关运行态返回处，把 RH 总并发口径切到：

```ts
sum(enabled key.maxConcurrency)
```

若仍处于兼容单 Key 模式，再回退旧口径。

- [ ] **Step 5: 运行节点进度契约前置校验**

Run:

```bash
node scripts/verify-runninghub-node-progress-contract.mjs
```

Expected:
- 可能仍失败，因为前端节点未接进度条；但后端进度口径相关断言应逐步满足

### Task 5: 实现后台 RH Key 池折叠卡片

**Files:**
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-api-client.ts`
- Test: `node scripts/verify-runninghub-key-pool-contract.mjs`

- [ ] **Step 1: 在工作台中补本地状态**

新增：

```ts
const [keyPoolOpen, setKeyPoolOpen] = useState(false);
const [keyPoolSaving, setKeyPoolSaving] = useState(false);
const [keyPoolDraft, setKeyPoolDraft] = useState<RunningHubKeyPoolItemDraft[]>([]);
```

- [ ] **Step 2: 在右侧编辑区下方渲染折叠卡片**

要求可见文案：
- `RH Key 池管理`
- `新增 Key`
- `启用`
- `最大并发`
- `编辑`
- `删除`

默认折叠，摘要显示：

```tsx
{enabledKeyCount} 个启用 / 总并发 {totalConcurrency}
```

- [ ] **Step 3: 实现单 Key 新增、编辑、启停、删除交互**

只实现单项表单，不做批量编辑。

删除时调用：

```ts
await adminRunningHubApi.deleteKeyPoolItem(selectedProviderId, keyId);
```

- [ ] **Step 4: 运行 Key 池契约**

Run:

```bash
node scripts/verify-runninghub-key-pool-contract.mjs
```

Expected: PASS

### Task 6: 实现 RH 节点阶段进度条与排队提示

**Files:**
- Modify: `apps/web/src/services/generation.ts`
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/web/src/components/nodes/RHToolsNode.tsx`
- Test: `node scripts/verify-runninghub-node-progress-contract.mjs`

- [ ] **Step 1: 扩展前端 RH 查询结果类型**

在 `apps/web/src/services/generation.ts` 给 `RhQueryResult` 增加：

```ts
queueHint?: string;
progress?: string;
```

- [ ] **Step 2: 在 RunningHubNode 中消费阶段状态**

在轮询成功逻辑中把：

```ts
queued -> 5%
running -> 45%
success -> 100%
```

映射到节点顶部状态区，并显示：

```tsx
任务队列排队中
任务已提交，正在生成
```

- [ ] **Step 3: 在 RHToolsNode 中保持同口径**

RHToolsNode 和 RunningHubNode 保持相同的阶段口径，避免 RH 两类节点分叉。

- [ ] **Step 4: 运行节点进度契约**

Run:

```bash
node scripts/verify-runninghub-node-progress-contract.mjs
```

Expected: PASS

### Task 7: 收口 RH 参数区显示策略

**Files:**
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/web/src/components/nodes/RHToolsNode.tsx`
- Modify: `apps/api/src/server.ts`
- Modify: `scripts/verify-runninghub-worker-and-label-contract.mjs`
- Test: `node scripts/verify-runninghub-worker-and-label-contract.mjs`

- [ ] **Step 1: 后端保留描述但前台不默认展示**

不删 `buildRunningHubFieldsFromRequestExample()` 的来源描述生成逻辑，只调整前台渲染不输出该描述块。

- [ ] **Step 2: 前台统一显示名优先级**

在两个节点中统一：

```ts
const displayName = it.displayLabel || it.label || it.fieldName || "";
```

并确保 UI 中显示的就是这个 `displayName`。

- [ ] **Step 3: 运行 label 契约**

Run:

```bash
node scripts/verify-runninghub-worker-and-label-contract.mjs
node scripts/verify-runninghub-output-reset-contract.mjs
```

Expected: PASS

### Task 8: 更新 AGENTS RTK 规则与文档记录

**Files:**
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/systems/runninghub/README.md`
- Modify: `docs/systems/worker/queue-and-concurrency.md`

- [ ] **Step 1: 在 AGENTS 中加入 RTK 规则块**

新增明确条款：

```md
## RTK 命令约定

- shell 检索、读文件、git 状态、diff、脚本执行默认优先使用 RTK
- RTK 不支持、需要完整原始输出、需要交互式实时输出时才回退普通命令
```

- [ ] **Step 2: 补系统文档**

补 RH Key 池与节点阶段进度的系统说明，避免只写在 spec 与代码里。

- [ ] **Step 3: 补当日开发记录**

在 `DEVLOG.md` 中记录：
- RH Key 池管理
- RH 总并发自动汇总
- RH 节点阶段进度
- RTK 规则入仓

### Task 9: 完整验证与收尾

**Files:**
- Modify: `scripts/release/gray-prepare-presets.mjs`
- Modify: `scripts/verify-local-acceptance-chain.mjs`

- [ ] **Step 1: 把新契约接入 RunningHub 灰度 preset**

加入：

```js
"node scripts/verify-runninghub-key-pool-contract.mjs",
"node scripts/verify-runninghub-node-progress-contract.mjs",
```

- [ ] **Step 2: 运行完整验证**

Run:

```bash
node scripts/verify-runninghub-key-pool-contract.mjs
node scripts/verify-runninghub-node-progress-contract.mjs
node scripts/verify-runninghub-worker-and-label-contract.mjs
node scripts/verify-runninghub-output-reset-contract.mjs
npm run typecheck
```

Expected:
- 所有新增 RH 契约通过
- 类型检查通过

- [ ] **Step 3: codegraph sync**

Run:

```bash
codegraph sync
```

Expected: 索引同步成功，无错误。

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md apps/admin/src/admin-api-client.ts apps/admin/src/admin-runninghub-workspace.tsx apps/admin/src/admin-types.ts apps/api/src/server.ts apps/api/src/environment-sync-service.ts apps/worker/src/worker.ts apps/web/src/components/nodes/RunningHubNode.tsx apps/web/src/components/nodes/RHToolsNode.tsx apps/web/src/services/generation.ts docs/systems/runninghub/README.md docs/systems/worker/queue-and-concurrency.md DEVLOG.md packages/shared/src/task-queue-settings.ts scripts/verify-runninghub-key-pool-contract.mjs scripts/verify-runninghub-node-progress-contract.mjs scripts/verify-runninghub-worker-and-label-contract.mjs scripts/verify-gray-release-prepare-contract.mjs scripts/release/gray-prepare-presets.mjs scripts/verify-local-acceptance-chain.mjs
git commit -m "feat: add runninghub key pool and node progress"
```
