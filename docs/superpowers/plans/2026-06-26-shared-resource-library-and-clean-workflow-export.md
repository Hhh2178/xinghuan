# Shared Resource Library And Clean Workflow Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让工作流保存/导出/输出统一生成干净模板，新增公共资源库并接入前台双库浏览与管理员轻编辑，同时把生成库的卡片与完整预览交互收口到资源库风格。

**Architecture:** 本轮按三条边界推进：一条是模板导出清理器，统一在前端资源工作流入口清掉运行态并保留资源索引；一条是共享资源数据域，在后端新增独立 shared-resource 存储与管理员写权限；一条是前台资源交互壳，把公共资源库与生成库尽量建立在资源卡片/预览共用组件之上。整个改动优先增量下沉 helper/service，不继续把全部逻辑堆进 `server.ts` 和两个 Drawer 主文件。

**Tech Stack:** TypeScript, React, Node HTTP server, file/Postgres dual storage compatibility, existing contract scripts under `scripts/`, CodeGraph, RTK.

---

## File Structure

### Existing files to modify

- `apps/web/src/utils/workflowResource.ts`
  - 统一资源工作流 manifest 的清理语义，并保留共享资源引用索引。
- `apps/web/src/utils/nodeMigration.ts`
  - 复用现有导入清理规则，必要时抽出共享的“运行态字段清理” helper。
- `apps/web/src/components/canvas/useCanvasSendFlow.ts`
  - 让保存工作流到资源库走新的干净模板生成逻辑。
- `apps/web/src/components/ResourceLibraryDrawer.tsx`
  - 加入 `我的资源库 / 公共资源库` 浏览切换、管理员上传按钮、共享资源轻编辑、另存为我的资源。
- `apps/web/src/components/GenerationLibraryDrawer.tsx`
  - 生成库卡片动作对齐资源库，接入共用卡片/预览壳。
- `apps/web/src/components/GenerationLibraryPreviewOverlay.tsx`
  - 调整为共用完整预览语义，确保图片/视频完整展示。
- `apps/web/src/services/api.ts`
  - 增加共享资源接口、前端共享资源类型、复制为个人资源接口。
- `apps/api/src/server.ts`
  - 接共享资源列表/写接口，复用现有资源库与生成库链路，挂接权限校验和独立存储。
- `apps/api/src/resource-workflow-helpers.ts`
  - 统一服务端对工作流资源片段和 enrich 逻辑的共享资源索引处理。
- `DEVLOG.md`
  - 记录本轮实现与验证结果。

### New files to create

- `apps/web/src/utils/workflowRuntimeCleanup.ts`
  - 工作流模板导出前的统一运行态清理 helper。
- `apps/web/src/components/resource-library/ResourceMediaCard.tsx`
  - 资源库与生成库复用的媒体卡片壳。
- `apps/web/src/components/resource-library/ResourcePreviewOverlay.tsx`
  - 资源库与生成库复用的完整预览层。
- `apps/api/src/shared-resource-library.ts`
  - 共享资源库的独立数据访问、读写、权限辅助与复制逻辑。
- `scripts/verify-clean-workflow-export-contract.ts`
  - 验证干净模板导出语义。
- `scripts/verify-shared-resource-library-contract.mjs`
  - 验证共享资源接口、权限与复制入口。
- `scripts/verify-generation-library-resource-card-contract.mjs`
  - 验证生成库与资源库的交互收口。

### Existing verification files to run

- `scripts/verify-workflow-resource-resolver-contract.ts`
- `scripts/verify-generation-library-preview-contract.mjs`
- `scripts/verify-generation-library-and-admin-assistant-layout.mjs`
- `scripts/verify-resource-revision-conflict.mjs`

---

### Task 1: Add failing contracts for clean workflow export and shared-resource surface

**Files:**
- Create: `scripts/verify-clean-workflow-export-contract.ts`
- Create: `scripts/verify-shared-resource-library-contract.mjs`
- Create: `scripts/verify-generation-library-resource-card-contract.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing workflow-export contract**

```ts
import assert from "node:assert/strict";

const workflowResource = await import("../apps/web/src/utils/workflowResource.ts");

const manifest = workflowResource.createWorkflowResourceManifest({
  sourceCanvasId: "canvas-a",
  nodes: [
    {
      id: "llm-1",
      type: "llm",
      position: { x: 0, y: 0 },
      data: {
        prompt: "keep me",
        history: [{ role: "user", content: "old" }],
        reply: "stale",
        generatedImages: [{ url: "/old.png" }],
        taskRuns: [{ id: "task-1" }],
      },
    },
  ],
  edges: [],
});

const llm = manifest.nodes[0] as any;
assert.equal(llm.data.prompt, "keep me");
assert.equal(Array.isArray(llm.data.history), false, "history should be stripped from saved workflow");
assert.equal("reply" in llm.data, false, "reply should be stripped from saved workflow");
assert.equal("generatedImages" in llm.data, false, "generatedImages should be stripped from saved workflow");
assert.equal("taskRuns" in llm.data, false, "taskRuns should be stripped from saved workflow");

console.log("PASS clean workflow export contract");
```

- [ ] **Step 2: Run the new workflow-export contract and verify it fails**

Run: `npx tsx scripts/verify-clean-workflow-export-contract.ts`

Expected: FAIL because `createWorkflowResourceManifest()` still preserves stale runtime fields.

- [ ] **Step 3: Write the failing shared-resource contract**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const apiSource = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const webApiSource = await readFile(new URL("../apps/web/src/services/api.ts", import.meta.url), "utf8");

assert.match(apiSource, /\/api\/shared-resources\/items/, "server should expose shared resource item routes");
assert.match(apiSource, /ADMIN_REQUIRED|currentUser\.role !== "admin"/, "shared resource writes must require admin");
assert.match(apiSource, /copySharedResourceToPersonal|cloneSharedResourceToPersonal/, "server should support save-to-personal flow");

assert.match(webApiSource, /getSharedResourceItems/, "web api should expose shared resource listing");
assert.match(webApiSource, /addSharedResourceItem|addSharedResourceWorkflow/, "web api should expose shared resource upload entry");
assert.match(webApiSource, /copySharedResourceToPersonal/, "web api should expose copy-to-personal entry");

console.log("PASS shared resource library contract");
```

- [ ] **Step 4: Run the shared-resource contract and verify it fails**

Run: `node scripts/verify-shared-resource-library-contract.mjs`

Expected: FAIL because the shared-resource surface does not exist yet.

- [ ] **Step 5: Write the failing generation-library card contract**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const drawer = await readFile(new URL("../apps/web/src/components/GenerationLibraryDrawer.tsx", import.meta.url), "utf8");

assert.match(drawer, /ResourceMediaCard/, "generation library should reuse the shared resource media card");
assert.match(drawer, /ResourcePreviewOverlay/, "generation library should reuse the shared preview overlay");
assert.match(drawer, /预览|查看/, "generation library should preserve preview action");
assert.match(drawer, /下载/, "generation library should preserve download action");

console.log("PASS generation library resource card contract");
```

- [ ] **Step 6: Run the generation-library card contract and verify it fails**

Run: `node scripts/verify-generation-library-resource-card-contract.mjs`

Expected: FAIL because `GenerationLibraryDrawer.tsx` still uses its own card and overlay implementation.

- [ ] **Step 7: Add package scripts for the new contracts**

```json
{
  "scripts": {
    "verify:clean-workflow-export": "tsx scripts/verify-clean-workflow-export-contract.ts",
    "verify:shared-resource-library": "node scripts/verify-shared-resource-library-contract.mjs",
    "verify:generation-library-resource-card": "node scripts/verify-generation-library-resource-card-contract.mjs"
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/verify-clean-workflow-export-contract.ts scripts/verify-shared-resource-library-contract.mjs scripts/verify-generation-library-resource-card-contract.mjs
git commit -m "test: add contracts for clean workflow export and shared resources"
```

### Task 2: Implement the clean workflow-export runtime cleanup layer

**Files:**
- Create: `apps/web/src/utils/workflowRuntimeCleanup.ts`
- Modify: `apps/web/src/utils/workflowResource.ts`
- Modify: `apps/web/src/components/canvas/useCanvasSendFlow.ts`
- Test: `scripts/verify-clean-workflow-export-contract.ts`
- Test: `scripts/verify-workflow-resource-resolver-contract.ts`

- [ ] **Step 1: Add a focused runtime-cleanup helper with explicit stripped keys**

```ts
const RUNTIME_STRIP_KEYS = new Set([
  "history",
  "reply",
  "generatedImages",
  "imageUrls",
  "videoUrls",
  "audioUrls",
  "taskRuns",
  "taskId",
  "taskIds",
  "runId",
  "runTargetId",
  "polling",
  "progress",
  "errorMessage",
  "errorCode",
  "failedReason",
  "results",
  "generatedResult",
]);

export function cleanupNodeRuntimeForWorkflowTemplate(data: Record<string, unknown>) {
  const next = { ...data };
  for (const key of RUNTIME_STRIP_KEYS) delete next[key];
  return next;
}
```

- [ ] **Step 2: Run the workflow-export contract and keep it failing until the helper is wired**

Run: `npx tsx scripts/verify-clean-workflow-export-contract.ts`

Expected: FAIL because the helper exists but is not yet used by manifest creation.

- [ ] **Step 3: Wire `cleanNodes()` in `workflowResource.ts` through the new cleanup helper**

```ts
import { cleanupNodeRuntimeForWorkflowTemplate } from "./workflowRuntimeCleanup";

function cleanNodes(nodes: unknown): Node[] {
  if (!Array.isArray(nodes)) return [];
  const clonedNodes = nodes
    .filter((node): node is Node => !!node && typeof node === "object" && typeof (node as Node).id === "string")
    .map((node) => {
      const cloned = clonePlain(node) as Node & Record<string, any>;
      cloned.selected = false;
      cloned.dragging = false;
      delete cloned.resizing;
      delete cloned.positionAbsolute;
      delete cloned.measured;
      if (cloned.data && typeof cloned.data === "object") {
        cloned.data = cleanupNodeRuntimeForWorkflowTemplate(cloned.data as Record<string, unknown>);
      }
      return cloned as Node;
    });
  return migrateImportedNodes(clonedNodes);
}
```

- [ ] **Step 4: Preserve resource references instead of flattening shared assets**

```ts
function normalizeWorkflowResourceReference(data: Record<string, unknown>) {
  const resourceSource = typeof data.resourceSource === "string" ? data.resourceSource : undefined;
  const resourceItemId = typeof data.resourceItemId === "string" ? data.resourceItemId : undefined;
  const resourceKind = typeof data.resourceKind === "string" ? data.resourceKind : undefined;
  const fallbackUrl = typeof data.fallbackUrl === "string" ? data.fallbackUrl : undefined;
  return {
    ...data,
    ...(resourceSource ? { resourceSource } : {}),
    ...(resourceItemId ? { resourceItemId } : {}),
    ...(resourceKind ? { resourceKind } : {}),
    ...(fallbackUrl ? { fallbackUrl } : {}),
  };
}
```

- [ ] **Step 5: Ensure save-workflow flow uses the cleaned manifest**

```ts
const manifest = createWorkflowResourceManifest(fragment, { title: title.trim() });
const result = await api.addResourceWorkflow({
  workflowFragment: manifest,
  title: manifest.title,
  tags: ["工作流"],
  sourceCanvasId: activeId || fragment.sourceCanvasId,
});
```

- [ ] **Step 6: Run the workflow cleanup contracts**

Run: `npx tsx scripts/verify-clean-workflow-export-contract.ts`

Expected: PASS

Run: `npx tsx scripts/verify-workflow-resource-resolver-contract.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/utils/workflowRuntimeCleanup.ts apps/web/src/utils/workflowResource.ts apps/web/src/components/canvas/useCanvasSendFlow.ts
git commit -m "feat: clean workflow runtime state on save and export"
```

### Task 3: Add the shared-resource backend domain and admin-gated routes

**Files:**
- Create: `apps/api/src/shared-resource-library.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/web/src/services/api.ts`
- Test: `scripts/verify-shared-resource-library-contract.mjs`
- Test: `scripts/verify-resource-revision-conflict.mjs`

- [ ] **Step 1: Add a shared-resource library service with isolated storage and helpers**

```ts
export interface SharedResourceDb {
  categories: ResourceCategory[];
  items: ResourceItem[];
}

export async function readSharedResourceDb() {
  return readJsonFile<SharedResourceDb>(sharedResourceDbPath, { categories: [], items: [] });
}

export async function writeSharedResourceDb(db: SharedResourceDb) {
  await writeJsonFile(sharedResourceDbPath, db);
}
```

- [ ] **Step 2: Add admin-gated shared-resource routes in `server.ts`**

```ts
if (url.pathname === "/api/shared-resources/items") {
  if (request.method === "GET") {
    sendT8(response, await listSharedResourceItems(await readSharedResourceDb(), url.searchParams));
    return;
  }
  if (!currentUser || currentUser.role !== "admin") throw new HttpError(403, "ADMIN_REQUIRED");
  if (request.method === "POST") {
    sendT8(response, await addSharedResourceFromPayload(await readJsonBody(request), currentUser));
    return;
  }
}
```

- [ ] **Step 3: Add the copy-to-personal route**

```ts
if (url.pathname.match(/^\/api\/shared-resources\/items\/([^/]+)\/copy-to-personal$/) && request.method === "POST") {
  const id = decodeURIComponent(url.pathname.split("/")[4] || "");
  sendT8(response, await copySharedResourceToPersonal(id, currentUser!));
  return;
}
```

- [ ] **Step 4: Expose matching web API helpers**

```ts
export function getSharedResourceItems(params: { kind?: ResourceKind; categoryId?: string; q?: string } = {}) {
  const sp = new URLSearchParams();
  if (params.kind) sp.set("kind", params.kind);
  if (params.categoryId && params.categoryId !== "all") sp.set("categoryId", params.categoryId);
  if (params.q) sp.set("q", params.q);
  return safeRequest<ResourceItem[]>(`${BASE}/shared-resources/items${sp.toString() ? `?${sp}` : ""}`);
}

export function copySharedResourceToPersonal(id: string) {
  return safeRequest<ResourceItem>(`${BASE}/shared-resources/items/${encodeURIComponent(id)}/copy-to-personal`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
```

- [ ] **Step 5: Run the shared-resource contracts**

Run: `node scripts/verify-shared-resource-library-contract.mjs`

Expected: PASS

Run: `node scripts/verify-resource-revision-conflict.mjs`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/shared-resource-library.ts apps/api/src/server.ts apps/web/src/services/api.ts scripts/verify-shared-resource-library-contract.mjs
git commit -m "feat: add shared resource library domain and routes"
```

### Task 4: Add front-end shared-resource browsing, admin upload, and copy-to-personal

**Files:**
- Modify: `apps/web/src/components/ResourceLibraryDrawer.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/services/api.ts`
- Test: `scripts/verify-shared-resource-library-contract.mjs`

- [ ] **Step 1: Add source tabs for personal vs shared resources**

```tsx
type ResourceLibrarySource = "personal" | "shared";

const [source, setSource] = useState<ResourceLibrarySource>("personal");

const [catRes, itemRes] = await Promise.all([
  source === "shared" ? api.getSharedResourceCategories(kind) : api.getResourceCategories(kind),
  source === "shared"
    ? api.getSharedResourceItems({ kind, categoryId, q, favorite: favoriteOnly })
    : api.getResourceItems({ kind, categoryId, q, favorite: favoriteOnly }),
]);
```

- [ ] **Step 2: Add the admin-only upload button for shared resources**

```tsx
{source === "shared" && currentUser?.role === "admin" && (
  <button onClick={openSharedUploadDialog} className={itemBtn}>
    <FolderPlus size={12} /> 上传到公共资源库
  </button>
)}
```

- [ ] **Step 3: Add copy-to-personal action for shared items**

```tsx
{source === "shared" && (
  <button
    onClick={() => handleCopySharedToPersonal(item)}
    className="nodrag nopan t8-mini-icon-button resource-card-action"
    style={miniActionBase}
    title="另存为我的资源"
  >
    <Library size={13} />
  </button>
)}
```

- [ ] **Step 4: Keep admin light-edit actions limited to shared-resource cards**

```tsx
const canMutateShared = source === "shared" && currentUser?.role === "admin";
```

- [ ] **Step 5: Run the shared-resource contract after wiring the drawer**

Run: `node scripts/verify-shared-resource-library-contract.mjs`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ResourceLibraryDrawer.tsx apps/web/src/App.tsx apps/web/src/services/api.ts
git commit -m "feat: add shared resource browsing and copy-to-personal"
```

### Task 5: Unify generation-library cards and preview with the resource-library shell

**Files:**
- Create: `apps/web/src/components/resource-library/ResourceMediaCard.tsx`
- Create: `apps/web/src/components/resource-library/ResourcePreviewOverlay.tsx`
- Modify: `apps/web/src/components/GenerationLibraryDrawer.tsx`
- Modify: `apps/web/src/components/GenerationLibraryPreviewOverlay.tsx`
- Modify: `apps/web/src/components/ResourceLibraryDrawer.tsx`
- Test: `scripts/verify-generation-library-resource-card-contract.mjs`
- Test: `scripts/verify-generation-library-preview-contract.mjs`

- [ ] **Step 1: Extract the shared media card shell**

```tsx
export function ResourceMediaCard(props: {
  title: string;
  subtitle: string;
  media: React.ReactNode;
  actions: React.ReactNode;
  accent?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
      <div className="relative h-28 overflow-hidden bg-black/80">{props.media}</div>
      <div className="space-y-1.5 p-2">
        <div className="truncate text-xs font-medium">{props.title}</div>
        <div className="truncate text-[10px] text-white/55">{props.subtitle}</div>
        <div className="flex items-center justify-center gap-1.5 pt-0.5">{props.actions}</div>
        {props.children}
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Extract the shared full-preview overlay**

```tsx
export function ResourcePreviewOverlay(props: {
  title: string;
  filename?: string;
  media: React.ReactNode;
  downloadUrl?: string;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={props.onClose}>
      <div className="relative flex h-full max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950 text-white" onClick={(event) => event.stopPropagation()}>
        {/* header */}
        <div className="flex h-full w-full items-center justify-center p-4">{props.media}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewire `GenerationLibraryDrawer` to the shared card/overlay**

```tsx
import { ResourceMediaCard } from "./resource-library/ResourceMediaCard";
import { ResourcePreviewOverlay } from "./resource-library/ResourcePreviewOverlay";
```

- [ ] **Step 4: Ensure images/videos fully contain in preview**

```tsx
<img src={item.previewUrl || item.fileUrl} alt={item.title} className="max-h-full max-w-full object-contain" draggable={false} />

<LoopingVideo src={item.previewUrl || item.fileUrl} controls className="max-h-full max-w-full object-contain" />
```

- [ ] **Step 5: Run the generation-library verification scripts**

Run: `node scripts/verify-generation-library-resource-card-contract.mjs`

Expected: PASS

Run: `node scripts/verify-generation-library-preview-contract.mjs`

Expected: PASS

Run: `node scripts/verify-generation-library-and-admin-assistant-layout.mjs`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/resource-library/ResourceMediaCard.tsx apps/web/src/components/resource-library/ResourcePreviewOverlay.tsx apps/web/src/components/GenerationLibraryDrawer.tsx apps/web/src/components/GenerationLibraryPreviewOverlay.tsx apps/web/src/components/ResourceLibraryDrawer.tsx
git commit -m "feat: unify generation library cards with resource library shell"
```

### Task 6: Final verification, documentation, and release-prep notes

**Files:**
- Modify: `DEVLOG.md`
- Modify: `docs/systems/canvas/project-and-material-flow.md`
- Test: `npm run type-check -w @xinghuan/web`
- Test: `npm run type-check -w @xinghuan/api`
- Test: `npm run verify:clean-workflow-export`
- Test: `npm run verify:shared-resource-library`
- Test: `npm run verify:generation-library-resource-card`
- Test: `npx tsx scripts/verify-workflow-resource-resolver-contract.ts`
- Test: `node scripts/verify-generation-library-preview-contract.mjs`
- Test: `node scripts/verify-generation-library-and-admin-assistant-layout.mjs`
- Test: `codegraph sync`

- [ ] **Step 1: Add DEVLOG entries for template cleanup, shared resources, and generation-library UI convergence**

```md
## 2026-06-26

- 新增共享资源库设计与实现第一批
- 工作流保存/导出/输出统一切到干净模板语义
- 公共资源支持前台双库浏览、管理员上传与另存为我的资源
- 生成库卡片与完整预览开始收口到资源库交互壳
```

- [ ] **Step 2: Update system docs for material flow**

```md
- 资源域现已分为：个人资源库 / 公共资源库 / 生成库
- 工作流模板导出保留资源索引并清理运行态
```

- [ ] **Step 3: Run web type-check**

Run: `npm run type-check -w @xinghuan/web`

Expected: PASS

- [ ] **Step 4: Run api type-check**

Run: `npm run type-check -w @xinghuan/api`

Expected: PASS

- [ ] **Step 5: Run clean workflow export verification**

Run: `npm run verify:clean-workflow-export`

Expected: PASS

- [ ] **Step 6: Run shared-resource verification**

Run: `npm run verify:shared-resource-library`

Expected: PASS

- [ ] **Step 7: Run generation-library resource-card verification**

Run: `npm run verify:generation-library-resource-card`

Expected: PASS

- [ ] **Step 8: Re-run existing workflow/generation verifiers**

Run: `npx tsx scripts/verify-workflow-resource-resolver-contract.ts`

Expected: PASS

Run: `node scripts/verify-generation-library-preview-contract.mjs`

Expected: PASS

Run: `node scripts/verify-generation-library-and-admin-assistant-layout.mjs`

Expected: PASS

- [ ] **Step 9: Sync CodeGraph**

Run: `codegraph sync`

Expected: `Already up to date` or successful sync

- [ ] **Step 10: Commit**

```bash
git add DEVLOG.md docs/systems/canvas/project-and-material-flow.md package.json
git commit -m "docs: record shared resource library rollout"
```

## Self-Review

- Spec coverage:
  - 干净模板导出：Task 1-2
  - 公共资源独立域与管理员权限：Task 1, 3, 4
  - 公共资源另存为我的资源：Task 3-4
  - 生成库与资源库卡片/预览收口：Task 1, 5
  - 文档和验证：Task 6
- Placeholder scan:
  - 本计划未使用 `TODO`、`TBD`、`similar to` 这类占位语句。
- Type consistency:
  - 统一使用 `shared-resources` 路由前缀
  - 统一使用 `copySharedResourceToPersonal`
  - 统一使用 `cleanupNodeRuntimeForWorkflowTemplate`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-26-shared-resource-library-and-clean-workflow-export.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
