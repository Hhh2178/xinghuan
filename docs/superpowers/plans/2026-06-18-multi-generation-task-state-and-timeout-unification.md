# Multi-Generation Task State And Timeout Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep multi-image and multi-video generation on async multi-task submission while making child-task state visible, appending all successful outputs, unifying timeout behavior, and fixing upstream material loss in processing nodes.

**Architecture:** Extend image/video nodes with per-task runtime state, keep upstream-facing media fields backward compatible, and unify timeout sourcing across web/API/worker layers so task payload and model config drive behavior consistently. Fix material loss by tightening the upstream material aggregation and image-op input path instead of layering node-specific workarounds.

**Tech Stack:** React, TypeScript, Vite, Node.js worker, repository contract scripts, CodeGraph

---

### Task 1: Lock child-task runtime and append-output contracts

**Files:**
- Create: `scripts/verify-image-node-multi-task-contract.mjs`
- Create: `scripts/verify-video-node-multi-task-contract.mjs`
- Modify: `apps/web/src/components/nodes/ImageNode.tsx`
- Modify: `apps/web/src/components/nodes/VideoNode.tsx`

- [ ] **Step 1: Write the failing image-node contract test**

```javascript
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const source = await readFile(new URL("../apps/web/src/components/nodes/ImageNode.tsx", import.meta.url), "utf8");

assert.match(source, /taskRuns/, "ImageNode should track per-task runtime state");
assert.match(source, /appendImageGenerationResult/, "ImageNode should append generation results incrementally");
assert.match(source, /outputCount/, "ImageNode task run state should record output count");
assert.match(source, /Promise\.allSettled/, "ImageNode should preserve concurrent multi-task execution");
assert.match(source, /imageUrls:\s*\[\.\.\.aggregatedImageUrls\]/, "ImageNode should persist aggregated images");

console.log("PASS image node multi-task contract present");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-image-node-multi-task-contract.mjs`
Expected: FAIL because `taskRuns` / `outputCount` contract is not implemented yet.

- [ ] **Step 3: Write the failing video-node contract test**

```javascript
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const source = await readFile(new URL("../apps/web/src/components/nodes/VideoNode.tsx", import.meta.url), "utf8");

assert.match(source, /taskRuns/, "VideoNode should track per-task runtime state");
assert.match(source, /outputCount/, "VideoNode task run state should record output count");
assert.match(source, /Promise\.allSettled/, "VideoNode should preserve concurrent multi-task execution");
assert.match(source, /videoUrls:\s*aggregatedVideoUrls/, "VideoNode should persist aggregated videos");

console.log("PASS video node multi-task contract present");
```

- [ ] **Step 4: Run test to verify it fails**

Run: `node scripts/verify-video-node-multi-task-contract.mjs`
Expected: FAIL because `taskRuns` / `outputCount` contract is not implemented yet.

- [ ] **Step 5: Implement minimal node runtime structures**

Code to add in `apps/web/src/components/nodes/ImageNode.tsx` and `apps/web/src/components/nodes/VideoNode.tsx`:

```ts
type TaskRunState = {
  taskId?: string;
  batchIndex: number;
  kind: "image" | "video";
  status: "queued" | "submitting" | "polling" | "running" | "success" | "error" | "cancelled";
  progress: string;
  error?: string;
  outputCount: number;
  startedAt?: number | null;
  finishedAt?: number | null;
};
```

And initialize before parallel submission:

```ts
const initialTaskRuns: TaskRunState[] = Array.from({ length: generationCount }, (_, batchIndex) => ({
  batchIndex,
  kind: "image",
  status: "queued",
  progress: "0%",
  outputCount: 0,
  startedAt: Date.now(),
  finishedAt: null,
}));
update({ taskRuns: initialTaskRuns });
```

- [ ] **Step 6: Run contract tests to verify they pass**

Run:
- `node scripts/verify-image-node-multi-task-contract.mjs`
- `node scripts/verify-video-node-multi-task-contract.mjs`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/verify-image-node-multi-task-contract.mjs scripts/verify-video-node-multi-task-contract.mjs apps/web/src/components/nodes/ImageNode.tsx apps/web/src/components/nodes/VideoNode.tsx
git commit -m "test: lock multi-generation node runtime contracts"
```

### Task 2: Implement image/video child-task state updates and incremental output append

**Files:**
- Modify: `apps/web/src/components/nodes/ImageNode.tsx`
- Modify: `apps/web/src/components/nodes/VideoNode.tsx`
- Modify: `apps/web/src/components/nodes/NodeRuntimeCard.tsx`
- Test: `scripts/verify-image-node-multi-task-contract.mjs`
- Test: `scripts/verify-video-node-multi-task-contract.mjs`

- [ ] **Step 1: Write a failing runtime card contract**

Create `scripts/verify-node-runtime-card-task-runs-contract.mjs`:

```javascript
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const source = await readFile(new URL("../apps/web/src/components/nodes/NodeRuntimeCard.tsx", import.meta.url), "utf8");

assert.match(source, /taskRuns/, "NodeRuntimeCard should read child task runs");
assert.match(source, /outputCount/, "NodeRuntimeCard should render output count");
assert.match(source, /batchIndex/, "NodeRuntimeCard should identify each child task");

console.log("PASS runtime card child-task contract present");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-node-runtime-card-task-runs-contract.mjs`
Expected: FAIL before runtime card gains child-task rendering.

- [ ] **Step 3: Implement minimal append-and-state-update logic**

In `apps/web/src/components/nodes/ImageNode.tsx`, add a focused helper:

```ts
const patchTaskRun = (batchIndex: number, patch: Partial<TaskRunState>) => {
  const current = Array.isArray((d as any)?.taskRuns) ? (d as any).taskRuns : [];
  const next = current.map((item: TaskRunState) =>
    item.batchIndex === batchIndex ? { ...item, ...patch } : item
  );
  update({ taskRuns: next });
};
```

On submit:

```ts
patchTaskRun(batchIndex, {
  status: "polling",
  taskId: submit.taskId,
  progress: submit.progress || "5%",
});
```

On success:

```ts
patchTaskRun(batchIndex, {
  status: "success",
  progress: "100%",
  outputCount: urls.length,
  finishedAt: Date.now(),
});
```

On failure:

```ts
patchTaskRun(batchIndex, {
  status: "error",
  error: imageGenerationErrorMessage(error),
  finishedAt: Date.now(),
});
```

- [ ] **Step 4: Implement runtime-card child-task rendering**

Add a compact section in `apps/web/src/components/nodes/NodeRuntimeCard.tsx` that renders:

```tsx
{Array.isArray(data?.taskRuns) && data.taskRuns.length > 0 ? (
  <div className="node-runtime-task-runs">
    {data.taskRuns.map((run: any) => (
      <div key={`${run.batchIndex}-${run.taskId || "pending"}`} className="node-runtime-task-run">
        <strong>#{run.batchIndex + 1}</strong>
        <span>{run.status}</span>
        <span>{run.progress || "-"}</span>
        <span>{run.outputCount || 0} 项</span>
        {run.error ? <small>{run.error}</small> : null}
      </div>
    ))}
  </div>
) : null}
```

- [ ] **Step 5: Run contract tests to verify they pass**

Run:
- `node scripts/verify-image-node-multi-task-contract.mjs`
- `node scripts/verify-video-node-multi-task-contract.mjs`
- `node scripts/verify-node-runtime-card-task-runs-contract.mjs`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/nodes/ImageNode.tsx apps/web/src/components/nodes/VideoNode.tsx apps/web/src/components/nodes/NodeRuntimeCard.tsx scripts/verify-node-runtime-card-task-runs-contract.mjs
git commit -m "feat: show child task state for multi-generation nodes"
```

### Task 3: Unify timeout sourcing across web, API, and worker adapters

**Files:**
- Create: `scripts/verify-generation-timeout-unification.mjs`
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/api/src/external-proxy.ts`
- Modify: `apps/web/src/components/nodes/ImageNode.tsx`
- Modify: `apps/web/src/components/nodes/VideoNode.tsx`

- [ ] **Step 1: Write the failing timeout contract**

```javascript
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const workerSource = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const proxySource = await readFile(new URL("../apps/api/src/external-proxy.ts", import.meta.url), "utf8");

assert.match(workerSource, /timeoutMs:\s*clampNumber\(task\.payload\.timeoutMs \|\| task\.payload\.maxPollMs \|\| task\.payload\.pollTimeoutMs/, "worker GRSAI adapter should honor task timeout payload");
assert.match(proxySource, /pollTimeoutMs = deps\.clampInteger\(input\.advancedConfig\.pollTimeoutMs/, "external proxy should still honor advancedConfig pollTimeoutMs");

console.log("PASS timeout unification contract present");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-generation-timeout-unification.mjs`
Expected: FAIL because worker GRSAI adapter still uses implicit default timeout.

- [ ] **Step 3: Implement minimal timeout propagation**

In `apps/worker/src/worker.ts`, change:

```ts
const client = createGrsaiImageClient({
  apiKey,
  baseUrl: task.providerBaseUrl,
});
```

to:

```ts
const client = createGrsaiImageClient({
  apiKey,
  baseUrl: task.providerBaseUrl,
  pollIntervalMs: clampNumber(task.payload.pollIntervalMs, 1500, 500, 30000),
  timeoutMs: clampNumber(task.payload.timeoutMs || task.payload.maxPollMs || task.payload.pollTimeoutMs, 360000, 5000, 1800000),
});
```

- [ ] **Step 4: Align front-end polling timeout derivation**

In image/video nodes, add a small helper for backend task polling:

```ts
const backendPollTimeoutSeconds = Math.max(
  IMAGE_POLL_TIMEOUT_SECONDS,
  Math.ceil((Number(d?.providerParams?.timeoutMs || d?.providerParams?.maxPollMs || d?.providerParams?.pollTimeoutMs || 0) || 0) / 1000),
);
```

Then use `backendPollTimeoutSeconds` instead of only the static constant when waiting on backend task status.

- [ ] **Step 5: Run timeout contract test**

Run: `node scripts/verify-generation-timeout-unification.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-generation-timeout-unification.mjs apps/worker/src/worker.ts apps/api/src/external-proxy.ts apps/web/src/components/nodes/ImageNode.tsx apps/web/src/components/nodes/VideoNode.tsx
git commit -m "fix: unify generation timeout sourcing across adapters"
```

### Task 4: Fix upstream material loss in processing nodes

**Files:**
- Create: `scripts/verify-image-op-upstream-material-contract.mjs`
- Modify: `apps/web/src/components/nodes/ImageOpFrame.tsx`
- Modify: `apps/web/src/components/nodes/ResizeNode.tsx`
- Modify: `apps/web/src/components/nodes/useUpstreamMaterials.ts`

- [ ] **Step 1: Write the failing upstream-material contract**

```javascript
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const imageOpFrame = await readFile(new URL("../apps/web/src/components/nodes/ImageOpFrame.tsx", import.meta.url), "utf8");
const resizeNode = await readFile(new URL("../apps/web/src/components/nodes/ResizeNode.tsx", import.meta.url), "utf8");
const upstreamHook = await readFile(new URL("../apps/web/src/components/nodes/useUpstreamMaterials.ts", import.meta.url), "utf8");

assert.match(imageOpFrame, /useUpstreamMaterials/, "ImageOpFrame should consume upstream materials explicitly");
assert.match(imageOpFrame, /images\[0\]/, "ImageOpFrame should resolve first available upstream image");
assert.match(resizeNode, /runOp=\{async \(img\)/, "ResizeNode should still operate on resolved image input");
assert.match(upstreamHook, /const arrFields = \['imageUrls', 'urls', 'generatedImages'\]/, "upstream hook should preserve image array extraction");

console.log("PASS image op upstream material contract present");
```

- [ ] **Step 2: Run test to verify it fails or exposes current gap**

Run: `node scripts/verify-image-op-upstream-material-contract.mjs`
Expected: FAIL if ImageOpFrame does not explicitly resolve upstream images robustly enough for processing nodes.

- [ ] **Step 3: Implement a single-source image input resolver**

In `apps/web/src/components/nodes/ImageOpFrame.tsx`, add a helper like:

```ts
const upstream = useUpstreamMaterials(id);
const resolvedInputImage =
  Array.isArray(data?.imageUrls) && data.imageUrls[0]
    ? data.imageUrls[0]
    : typeof data?.imageUrl === "string" && data.imageUrl.trim()
      ? data.imageUrl.trim()
      : upstream.images[0]?.url || "";
```

And ensure run path fails with a specific message only if `resolvedInputImage` is empty:

```ts
if (!resolvedInputImage) throw new Error("UPSTREAM_IMAGE_NOT_FOUND");
```

- [ ] **Step 4: Run upstream-material contract test**

Run: `node scripts/verify-image-op-upstream-material-contract.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-image-op-upstream-material-contract.mjs apps/web/src/components/nodes/ImageOpFrame.tsx apps/web/src/components/nodes/ResizeNode.tsx apps/web/src/components/nodes/useUpstreamMaterials.ts
git commit -m "fix: preserve upstream material inputs for image ops"
```

### Task 5: Verification, CodeGraph sync, docs update, and gray release preparation

**Files:**
- Modify: `DEVLOG.md`
- Modify: `docs/prd/v0.1.0/progress.md`
- Test: `scripts/verify-image-node-multi-task-contract.mjs`
- Test: `scripts/verify-video-node-multi-task-contract.mjs`
- Test: `scripts/verify-node-runtime-card-task-runs-contract.mjs`
- Test: `scripts/verify-generation-timeout-unification.mjs`
- Test: `scripts/verify-image-op-upstream-material-contract.mjs`

- [ ] **Step 1: Update release/dev log records**

Add a new `2026-06-18` entry to `DEVLOG.md` recording:
- child-task state UI
- multi-output append behavior
- timeout unification
- upstream material input fix
- local verification results

Update `docs/prd/v0.1.0/progress.md` with a concise note under current progress for this bugfix batch.

- [ ] **Step 2: Run focused verification scripts**

Run:
- `node scripts/verify-image-node-multi-task-contract.mjs`
- `node scripts/verify-video-node-multi-task-contract.mjs`
- `node scripts/verify-node-runtime-card-task-runs-contract.mjs`
- `node scripts/verify-generation-timeout-unification.mjs`
- `node scripts/verify-image-op-upstream-material-contract.mjs`

Expected: PASS

- [ ] **Step 3: Run build verification**

Run:
- `npm run build -w @xinghuan/web`
- `npm run build -w @xinghuan/api`
- `npm run build -w @xinghuan/admin`

Expected: PASS

- [ ] **Step 4: Sync CodeGraph**

Run: `codegraph sync`
Expected: `Already up to date` or normal sync success output.

- [ ] **Step 5: Commit documentation and verification closure**

```bash
git add DEVLOG.md docs/prd/v0.1.0/progress.md scripts/verify-image-node-multi-task-contract.mjs scripts/verify-video-node-multi-task-contract.mjs scripts/verify-node-runtime-card-task-runs-contract.mjs scripts/verify-generation-timeout-unification.mjs scripts/verify-image-op-upstream-material-contract.mjs
git commit -m "docs: record multi-generation timeout and material-input fixes"
```

- [ ] **Step 6: Prepare gray release handoff**

Run:
- `git status --short`
- `git log --oneline -5`

Expected:
- clean worktree
- latest commits correspond to this bugfix batch

Document in handoff:
- gray migration needs no new SQL unless implementation introduces one
- gray acceptance cases:
  - image generation count > 1 appends all successful images
  - video generation count > 1 appends all successful videos
  - child task state visible on node
  - GRSAI timeout follows configured value
  - upload image -> resize node no longer fails with missing input
