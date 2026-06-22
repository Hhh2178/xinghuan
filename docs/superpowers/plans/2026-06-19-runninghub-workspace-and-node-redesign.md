# RunningHub Workspace And Node Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the RH admin workspace and RH canvas node so RunningHub entries are maintained through a clean backend-managed catalog flow, while the node only exposes business inputs and runtime state.

**Architecture:** The admin side keeps RunningHub as a dedicated workspace domain with API-settings-style layout, explicit management actions, and structured AI analysis entry points. The canvas side consumes normalized catalog entries and execution descriptors from the backend, removing manual runtime identifiers from node UI and relying on catalog-driven schema rendering. Supporting API endpoints are extended only where required to support CRUD, AI draft generation, and safer catalog persistence.

**Tech Stack:** React, TypeScript, Vite, existing admin/api/web workspace modules, lucide-react, local verification scripts, CodeGraph.

---

### Task 1: Freeze the RH workspace contract and add failing API/admin tests

**Files:**
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `scripts/verify-runninghub-workflow-api.mjs`
- Test: `scripts/verify-runninghub-workflow-api.mjs`

- [ ] **Step 1: Write the failing contract assertions for RH workspace actions**

```js
assertIncludes(source, "/api/admin/runninghub/items");
assertIncludes(source, "request.method === \"POST\"");
assertIncludes(source, "request.method === \"DELETE\"");
assertIncludes(source, "/api/admin/runninghub/analyze");
assertIncludes(source, "runninghub.item.create");
assertIncludes(source, "runninghub.item.delete");
assertIncludes(source, "runninghub.item.analyze");
```

- [ ] **Step 2: Run the contract script to verify it fails before code changes**

Run: `node scripts/verify-runninghub-workflow-api.mjs`

Expected: failure because create/delete/analyze RH workspace routes are not asserted or implemented yet.

- [ ] **Step 3: Extend admin client/types for create, delete, and analyze actions**

```ts
export interface RunningHubAnalyzePayload {
  providerId: string;
  kind: "workflow" | "app";
  sourceUrl?: string;
  pageId?: string;
  runTargetId?: string;
  docUrl?: string;
  requestExample?: string;
  responseExample?: string;
  notes?: string;
}

export interface RunningHubAnalyzeDraft {
  summary: string;
  sections: Array<{
    key: string;
    title: string;
    description: string;
    payload: Record<string, unknown>;
  }>;
  warnings: string[];
}
```

- [ ] **Step 4: Implement backend RH workspace endpoints with narrow scope**

```ts
if (url.pathname === "/api/admin/runninghub/items" && request.method === "POST") {
  const body = await readJsonBody(request);
  const created = await createAdminRunningHubCatalogItem(body);
  await appendAudit(adminUser, "runninghub.item.create", "runninghub", created.catalogId, `新建 RunningHub 条目 ${created.title}`, requestContext);
  sendT8(response, created, 201);
  return;
}

if (runningHubItemMatch && request.method === "DELETE") {
  const catalogId = decodeURIComponent(runningHubItemMatch[1] || "");
  const deleted = await deleteAdminRunningHubCatalogItem(catalogId);
  await appendAudit(adminUser, "runninghub.item.delete", "runninghub", catalogId, `删除 RunningHub 条目 ${deleted.title}`, requestContext);
  sendT8(response, { catalogId, deleted: true });
  return;
}

if (url.pathname === "/api/admin/runninghub/analyze" && request.method === "POST") {
  const body = await readJsonBody(request);
  const draft = await analyzeRunningHubCatalogDraft(body, requestContext);
  await appendAudit(adminUser, "runninghub.item.analyze", "runninghub", safeText(body.kind || "workflow"), "分析 RunningHub 条目草案", requestContext);
  sendT8(response, draft);
  return;
}
```

- [ ] **Step 5: Re-run the RH API contract script**

Run: `node scripts/verify-runninghub-workflow-api.mjs`

Expected: PASS / `{ "ok": true }`

### Task 2: Rebuild the RH workspace page into API-settings-style management layout

**Files:**
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/styles.css`
- Test: `apps/admin/src/admin-runninghub-workspace.tsx`

- [ ] **Step 1: Add a failing static verification for the new workspace structure**

```js
assertIncludes(workspaceSource, "新建工作流");
assertIncludes(workspaceSource, "新建 AI 应用");
assertIncludes(workspaceSource, "AI 分析并填写");
assertIncludes(workspaceSource, "全部");
assertIncludes(workspaceSource, "启用");
assertIncludes(workspaceSource, "停用");
assertIncludes(workspaceSource, "admin-runninghub-workspace__toolbar");
assertIncludes(workspaceSource, "admin-runninghub-workspace__filters");
```

- [ ] **Step 2: Run the verification to confirm the current page is missing the new management layout**

Run: `node scripts/verify-runninghub-workflow-api.mjs`

Expected: FAIL because the workspace still only has refresh, tabs, and a simple list.

- [ ] **Step 3: Rework RH workspace state to support search, filters, creation, deletion, and analyze drawer entry**

```tsx
const [keyword, setKeyword] = useState("");
const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all");
const [analyzeOpen, setAnalyzeOpen] = useState(false);
const [analyzing, setAnalyzing] = useState(false);
const [analyzeDraft, setAnalyzeDraft] = useState<RunningHubAnalyzeDraft | null>(null);
```

- [ ] **Step 4: Replace the hero/list layout with toolbar + left catalog + right editor layout**

```tsx
<div className="admin-runninghub-workspace__toolbar">
  <button type="button" className="ghost-action" onClick={() => void loadItems()}>刷新目录</button>
  <button type="button" className="ghost-action" onClick={() => void handleCreate("workflow")}>新建工作流</button>
  <button type="button" className="ghost-action" onClick={() => void handleCreate("app")}>新建 AI 应用</button>
  <button type="button" className="ghost-action" onClick={() => setAnalyzeOpen(true)}>AI 分析并填写</button>
</div>
```

- [ ] **Step 5: Add RH workspace-specific CSS for balanced left catalog and stable right editor**

```css
.admin-runninghub-workspace__layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.admin-runninghub-workspace__list-body {
  max-height: calc(100vh - 320px);
  overflow: auto;
}

.admin-runninghub-workspace__toolbar,
.admin-runninghub-workspace__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
```

- [ ] **Step 6: Re-run the verification script after the layout rewrite**

Run: `node scripts/verify-runninghub-workflow-api.mjs`

Expected: PASS on new RH workspace structure assertions.

### Task 3: Rebuild the RH item editor with explicit actions and structured sections

**Files:**
- Modify: `apps/admin/src/admin-runninghub-item-editor.tsx`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/styles.css`
- Test: `apps/admin/src/admin-runninghub-item-editor.tsx`

- [ ] **Step 1: Add failing assertions for explicit editor actions and section labels**

```js
assertIncludes(editorSource, "另存为");
assertIncludes(editorSource, "删除");
assertIncludes(editorSource, "启用条目");
assertIncludes(editorSource, "停用条目");
assertIncludes(editorSource, "输入槽定义");
assertIncludes(editorSource, "参数 Schema");
assertIncludes(editorSource, "输出定义");
assertIncludes(editorSource, "执行规则");
assertIncludes(editorSource, "测试与调试");
```

- [ ] **Step 2: Run the verification and confirm the old editor is missing the new action surface**

Run: `node scripts/verify-runninghub-workflow-api.mjs`

Expected: FAIL because current editor only exposes save/test and a long flat form.

- [ ] **Step 3: Add editor callbacks for duplicate, delete, toggle-enable, and apply-analyze-card**

```ts
onDuplicate: (catalogId: string) => Promise<void>;
onDelete: (catalogId: string) => Promise<void>;
onToggleEnabled: (catalogId: string, enabled: boolean) => Promise<void>;
onApplyAnalyzeSection?: (sectionKey: string) => void;
```

- [ ] **Step 4: Refactor the editor head into a fixed action bar with grouped sections**

```tsx
<header className="admin-runninghub-editor__head">
  <div className="admin-runninghub-editor__copy">
    <span>{item.kind === "workflow" ? "工作流" : "AI 应用"}</span>
    <strong>{title || item.catalogId}</strong>
    <p>{note || "维护条目标题、运行目标、输入输出和执行规则。"}</p>
  </div>
  <div className="admin-runninghub-editor__actions">
    <button type="button" className="ghost-action" onClick={() => void onDuplicate(item.catalogId)}>另存为</button>
    <button type="button" className="ghost-action danger" onClick={() => void onDelete(item.catalogId)}>删除</button>
    <button type="button" className="ghost-action" onClick={() => void onToggleEnabled(item.catalogId, !enabled)}>{enabled ? "停用条目" : "启用条目"}</button>
    <button type="button" className="ghost-action" onClick={() => void handleTest()}>测试运行</button>
    <button type="button" className="primary-action" onClick={() => void handleSave()}>保存</button>
  </div>
</header>
```

- [ ] **Step 5: Replace free-form JSON-first editing with structured cards first, JSON advanced second**

```tsx
<section className="admin-runninghub-editor__section">
  <div className="admin-runninghub-editor__section-head">
    <strong>输入槽定义</strong>
    <button type="button" className="ghost-action" onClick={() => setFields((current) => [...current, createField()])}>添加输入槽</button>
  </div>
  <div className="admin-runninghub-editor__slot-list">{/* structured slot editors */}</div>
</section>
```

- [ ] **Step 6: Re-run verification after the editor rebuild**

Run: `node scripts/verify-runninghub-workflow-api.mjs`

Expected: PASS on editor action/section assertions.

### Task 4: Add RH-specific structured AI analysis output and partial apply flow

**Files:**
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
- Modify: `apps/admin/src/admin-runninghub-item-editor.tsx`
- Modify: `apps/admin/src/styles.css`
- Modify: `apps/api/src/server.ts`
- Test: `scripts/verify-runninghub-workflow-api.mjs`

- [ ] **Step 1: Add failing checks for RH analyze cards and partial apply controls**

```js
assertIncludes(workspaceSource, "基础信息草案");
assertIncludes(workspaceSource, "输入槽草案");
assertIncludes(workspaceSource, "参数 Schema 草案");
assertIncludes(workspaceSource, "应用全部");
assertIncludes(workspaceSource, "只应用本卡");
assertIncludes(workspaceSource, "插入为新条目");
```

- [ ] **Step 2: Run the verification and confirm the current RH page still lacks structured analyze output**

Run: `node scripts/verify-runninghub-workflow-api.mjs`

Expected: FAIL because there is no RH-specific analyze card rendering yet.

- [ ] **Step 3: Implement a structured draft panel instead of plain chat-like text**

```tsx
{analyzeDraft?.sections.map((section) => (
  <article key={section.key} className="admin-runninghub-analyze-card">
    <header>
      <strong>{section.title}</strong>
      <p>{section.description}</p>
    </header>
    <pre>{JSON.stringify(section.payload, null, 2)}</pre>
    <div className="admin-runninghub-analyze-card__actions">
      <button type="button" className="ghost-action" onClick={() => applyAnalyzeSection(section.key)}>只应用本卡</button>
      <button type="button" className="ghost-action" onClick={() => insertDraftAsNewItem(section.key)}>插入为新条目</button>
    </div>
  </article>
))}
```

- [ ] **Step 4: Keep backend output constrained to deterministic draft sections**

```ts
return {
  summary,
  sections: [
    { key: "base", title: "基础信息草案", description: "...", payload: baseDraft },
    { key: "inputs", title: "输入槽草案", description: "...", payload: inputDraft },
    { key: "params", title: "参数 Schema 草案", description: "...", payload: parameterDraft },
    { key: "outputs", title: "输出定义草案", description: "...", payload: outputDraft },
    { key: "execution", title: "执行规则草案", description: "...", payload: executionDraft },
  ],
  warnings,
};
```

- [ ] **Step 5: Re-run verification for RH analyze card output**

Run: `node scripts/verify-runninghub-workflow-api.mjs`

Expected: PASS on analyze-card structure assertions.

### Task 5: Remove runtime IDs from RH node UI and make node consume catalog-only runtime descriptors

**Files:**
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/web/src/services/runninghubCatalog.ts`
- Modify: `apps/web/src/utils/runninghubNodeSchema.ts`
- Modify: `apps/web/src/config/nodeRegistry.ts`
- Test: `apps/web/src/components/nodes/RunningHubNode.tsx`

- [ ] **Step 1: Add failing checks that the RH node no longer renders raw runtime-id fields**

```js
assertNotIncludes(nodeSource, "Webapp ID");
assertNotIncludes(nodeSource, "workflowId");
assertNotIncludes(nodeSource, "runTargetId");
assertIncludes(nodeSource, "输入摘要");
assertIncludes(nodeSource, "进行中");
assertIncludes(nodeSource, "成功");
assertIncludes(nodeSource, "失败");
```

- [ ] **Step 2: Run the verification and confirm the current node still exposes raw RH runtime identifiers**

Run: `node scripts/verify-runninghub-workflow-api.mjs`

Expected: FAIL because `RunningHubNode.tsx` still contains `webappId`-driven UI.

- [ ] **Step 3: Introduce catalog-derived runtime state and keep legacy mapping only as fallback**

```ts
const runtimeCatalogId = d?.rhWorkflowPresetId || "";
const selectedEntry = useMemo(
  () => workflowCatalog.find((item) => item.catalogId === runtimeCatalogId) || null,
  [workflowCatalog, runtimeCatalogId],
);

const resolvedRunTargetId = selectedEntry?.runTargetId || d?.runTargetId || d?.webappId || "";
```

- [ ] **Step 4: Replace raw ID form controls with entry summary, parameter form, and compact runtime status**

```tsx
<div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
  <div className="text-[11px] font-medium text-cyan-100">输入摘要</div>
  <div className="mt-1 text-[10px] text-cyan-200/70">
    文本 {textInputCount} / 图片 {imageInputCount} / 视频 {videoInputCount} / 音频 {audioInputCount}
  </div>
</div>
```

- [ ] **Step 5: Re-run verification after the node cleanup**

Run: `node scripts/verify-runninghub-workflow-api.mjs`

Expected: PASS on node UI assertions.

### Task 6: Rebuild RH concurrency governance UI into a clear system panel

**Files:**
- Modify: `apps/admin/src/main.tsx`
- Modify: `apps/admin/src/styles.css`
- Test: `apps/admin/src/main.tsx`

- [ ] **Step 1: Add failing checks for separated ordinary queue and RH queue governance sections**

```js
assertIncludes(mainSource, "普通任务并发");
assertIncludes(mainSource, "RunningHub 平台并发治理");
assertIncludes(mainSource, "RH 平台总并发");
assertIncludes(mainSource, "启用 RH 平台并发治理");
```

- [ ] **Step 2: Run the verification and confirm the current system settings still squeeze RH controls inline**

Run: `node scripts/verify-runninghub-workflow-api.mjs`

Expected: FAIL because the current system page still mixes RH concurrency with ordinary queue inputs.

- [ ] **Step 3: Split the system UI into two cards with stable labels and explanatory copy**

```tsx
<section className="api-card admin-system-queue-card">
  <div className="admin-system-queue-card__head">
    <strong>普通任务并发</strong>
    <span>按图片 / 音频 / 视频区分类别总窗口和单用户窗口。</span>
  </div>
  {/* ordinary queue inputs */}
</section>

<section className="api-card admin-system-queue-card">
  <div className="admin-system-queue-card__head">
    <strong>RunningHub 平台并发治理</strong>
    <span>RH 任务在普通类别窗口之外，还会受平台共享窗口限制。</span>
  </div>
  {/* rh queue inputs */}
</section>
```

- [ ] **Step 4: Re-run verification after system-page concurrency refactor**

Run: `node scripts/verify-runninghub-workflow-api.mjs`

Expected: PASS on queue-governance layout assertions.

### Task 7: Full verification, docs touch-up, and CodeGraph sync

**Files:**
- Modify: `DEVLOG.md`
- Modify: `MEMORY.md`
- Modify: `docs/project-atlas/interfaces-and-dataflow.md`
- Modify: `docs/project-atlas/worker-execution-chain.md`
- Modify: `docs/documentation-governance.md`
- Test: `scripts/verify-runninghub-workflow-api.mjs`

- [ ] **Step 1: Run focused verification for admin/API/RH contract**

Run: `node scripts/verify-runninghub-workflow-api.mjs`

Expected: PASS / `{ "ok": true }`

- [ ] **Step 2: Run API build**

Run: `npm run build -w @xinghuan/api`

Expected: build succeeds.

- [ ] **Step 3: Run single-port full build**

Run: `npm run build:single-port`

Expected: build succeeds.

- [ ] **Step 4: Update docs with the shipped RH workspace/node governance model**

```md
- RH 工作台现已采用“目录管理 + 详情编辑 + 结构化 AI 草案”模式。
- RH 节点不再暴露 webappId / workflowId / runTargetId。
- RH 条目执行链由后台 catalog + execution descriptor 统一收口。
```

- [ ] **Step 5: Sync CodeGraph**

Run: `codegraph sync`

Expected: index updated without pending changes.
