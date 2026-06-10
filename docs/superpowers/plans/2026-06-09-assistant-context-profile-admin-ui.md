# Assistant Context Profile Admin UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore real AI assistant conversation context, isolate Hermes usage for the canvas assistant, reduce over-sent context payloads, improve admin API-configuration assistance, and clean up assistant/admin UI defects.

**Architecture:** Add a first-class assistant conversation protocol shared by web, admin, and API. The API owns Hermes session reuse, Profile/workspace selection, context sanitization, and database writes; the web/admin clients only send concise attachments and stable conversation IDs. Admin API configuration assistance remains admin-confirmed and never auto-saves provider/model changes.

**Tech Stack:** TypeScript, React 19, Vite, Node HTTP API, PostgreSQL repository path, existing verification scripts under `scripts/`.

---

## File Structure

- Modify `apps/api/src/server.ts`: assistant request types, Hermes session cache, Hermes Profile config, sanitized prompt building, assistant settings upsert, stream process filtering, provider-assistant response handling.
- Modify `apps/web/src/services/api.ts`: add `conversationId` to assistant chat payload types.
- Modify `apps/web/src/components/CanvasAssistant.tsx`: generate/reuse/reset `conversationId`, trim attachment payloads before send, keep UI labels clean.
- Modify `apps/admin/src/admin-types.ts`: add `conversationId`, optional assistant draft/apply types if needed.
- Modify `apps/admin/src/admin-assistant-panel.tsx`: generate/reuse/reset `conversationId`, call admin stream endpoint, remove implementation labels/process exposure by default, trim attachments.
- Modify `apps/admin/src/admin-assistant-settings-panel.tsx`: add Profile/memory fields only if backend supports them; clean misaligned toggle layout and remove debug/descriptive copy.
- Modify `apps/admin/src/admin-api-settings-panel.tsx`: add admin-confirmed AI provider configuration draft flow.
- Modify `apps/admin/src/styles.css`: repair assistant dock/settings layout, remove cramped/misaligned controls.
- Modify `apps/web/src/styles/index.css`: keep canvas assistant card adaptive and prevent raw process overflow.
- Add or modify `scripts/verify-admin-assistant-settings-save-contract.mjs`: assert settings save does not call whole-admin-db rewrite.
- Modify `scripts/verify-admin-assistant-chat.mjs`: assert conversation IDs are sent and implementation labels are not exposed.
- Modify `scripts/verify-canvas-assistant-chat.mjs`: assert conversation IDs are sent and payloads are summarized.
- Modify `scripts/verify-admin-assistant-ui-contract.mjs`: assert no Hermes/Fallback/test/debug copy is shown in admin assistant UI.
- Modify `scripts/verify-canvas-assistant-ui-contract.mjs`: assert no oversized raw payload/process UI leaks.

---

### Task 1: Fix Assistant Settings Deadlock Risk

**Files:**
- Modify: `apps/api/src/server.ts`
- Test: `scripts/verify-admin-assistant-settings-save-contract.mjs`

- [ ] **Step 1: Write a failing contract test for targeted settings persistence**

Add assertions to `scripts/verify-admin-assistant-settings-save-contract.mjs` that inspect `apps/api/src/server.ts` and fail unless the assistant settings PATCH route calls a dedicated settings writer instead of `writeAdminDb`.

Expected contract:

```js
const source = fs.readFileSync(apiServerPath, "utf8");
assert(
  /async function writeAssistantSettingsRecordPostgres\(/.test(source),
  "Expected dedicated PostgreSQL assistant settings writer",
);
assert(
  /async function writeAssistantSettingsRecord\(/.test(source),
  "Expected storage-agnostic assistant settings writer",
);
const route = source.slice(
  source.indexOf('if (url.pathname === "/api/admin/assistant/settings")'),
  source.indexOf('if (url.pathname === "/api/admin/assistant/chat"'),
);
assert(
  /await writeAssistantSettingsRecord\(settings\)/.test(route),
  "Assistant settings PATCH must use targeted settings writer",
);
assert(
  !/writeAdminDb\(/.test(route),
  "Assistant settings PATCH must not rewrite the full admin database",
);
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npm run verify:admin-assistant-settings-save-contract
```

Expected: FAIL because the route currently calls `writeAdminDb({ ...db, assistantSettings: settings })`.

- [ ] **Step 3: Implement targeted assistant settings write**

In `apps/api/src/server.ts`, add a storage-agnostic function:

```ts
async function writeAssistantSettingsRecord(settings: AssistantSettingsRecord) {
  const normalized = normalizeAssistantSettings(settings);
  if (usePostgresRepository()) {
    await writeAssistantSettingsRecordPostgres(normalized);
    return;
  }
  const db = await readAdminDb();
  await writeJsonFile(adminDbPath, {
    ...db,
    assistantSettings: normalized,
  });
}
```

Add PostgreSQL upsert:

```ts
async function writeAssistantSettingsRecordPostgres(settings: AssistantSettingsRecord) {
  const pool = await getPostgresPool();
  const normalized = normalizeAssistantSettings(settings);
  await pool.query(
    `insert into xh_assistant_settings (id, frontend, backend, integration, updated_at)
     values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5)
     on conflict (id) do update set
       frontend = excluded.frontend,
       backend = excluded.backend,
       integration = excluded.integration,
       updated_at = excluded.updated_at`,
    [
      "default",
      JSON.stringify(normalized.frontend),
      JSON.stringify(normalized.backend),
      JSON.stringify(normalized.integration),
      millisToDate(normalized.updatedAt),
    ],
  );
}
```

Update the PATCH route:

```ts
const body = await readJsonBody<Partial<AssistantSettingsRecord>>(request);
const db = await readAdminDb();
const settings = normalizeAssistantSettings(body, db.assistantSettings || defaultAssistantSettings());
await writeAssistantSettingsRecord(settings);
await appendAudit(adminUser, "assistant.settings.update", "assistant", "assistant-settings", "更新 AI 助手接入与显示设置");
sendT8(response, maskAssistantEndpoint(settings));
return true;
```

- [ ] **Step 4: Run targeted verification**

Run:

```powershell
npm run verify:admin-assistant-settings-save-contract
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/server.ts scripts/verify-admin-assistant-settings-save-contract.mjs
git commit -m "fix: persist assistant settings without full db rewrite"
```

---

### Task 2: Add Real Assistant Conversation Context

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/web/src/services/api.ts`
- Modify: `apps/web/src/components/CanvasAssistant.tsx`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-assistant-panel.tsx`
- Test: `scripts/verify-admin-assistant-chat.mjs`
- Test: `scripts/verify-canvas-assistant-chat.mjs`

- [ ] **Step 1: Write failing contract tests for conversation IDs**

In `scripts/verify-canvas-assistant-chat.mjs`, assert:

```js
assert(source.includes("conversationId"), "Canvas assistant must send conversationId");
assert(source.includes("useState(() => createAssistantConversationId("), "Canvas assistant must create a stable conversation id");
assert(source.includes("conversationId: conversationId"), "Canvas assistant stream payload must include conversationId");
```

In `scripts/verify-admin-assistant-chat.mjs`, assert:

```js
assert(source.includes("conversationId"), "Admin assistant must send conversationId");
assert(source.includes("useState(() => createAssistantConversationId("), "Admin assistant must create a stable conversation id");
assert(source.includes('fetch("/api/admin/assistant/chat/stream"'), "Admin assistant must use admin stream endpoint");
```

In API source assertions, require:

```js
assert(apiSource.includes("conversationId?: string"), "AssistantChatRequest must include conversationId");
assert(apiSource.includes("getHermesAssistantSessionId"), "API must reuse Hermes assistant sessions");
assert(apiSource.includes("assistantHermesSessionCache"), "API must cache Hermes sessions by conversation");
```

- [ ] **Step 2: Run tests and confirm they fail**

Run:

```powershell
npm run verify:canvas-assistant-chat
npm run verify:admin-assistant-chat
```

Expected: FAIL because the current clients do not send `conversationId` and API always creates a new Hermes session.

- [ ] **Step 3: Add request fields and client session IDs**

Update all assistant request interfaces:

```ts
conversationId?: string;
```

Add this helper to both assistant components:

```ts
function createAssistantConversationId(scope: "canvas" | "admin") {
  return `${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
```

In `CanvasAssistant.tsx`:

```ts
const [conversationId, setConversationId] = useState(() => createAssistantConversationId("canvas"));
```

Include it in `streamAssistantChat`:

```ts
conversationId: conversationId,
```

Reset it only in `resetSession()`:

```ts
setConversationId(createAssistantConversationId("canvas"));
```

In `admin-assistant-panel.tsx`, do the same with `"admin"` and send requests to:

```ts
fetch("/api/admin/assistant/chat/stream", ...)
```

- [ ] **Step 4: Add Hermes session cache and reuse**

In `apps/api/src/server.ts`, add:

```ts
const assistantHermesSessionCache = new Map<string, { sessionId: string; updatedAt: number }>();
const ASSISTANT_HERMES_SESSION_TTL_MS = 1000 * 60 * 60 * 6;

function assistantConversationKey(input: AssistantChatRequest, actor: CurrentUser, workspace: string) {
  const scope = input.scope === "admin" ? "admin" : "canvas";
  const conversationId = safeText(input.conversationId, "default");
  return [workspace, scope, actor.id || actor.email, conversationId].join("::");
}
```

Add:

```ts
async function getHermesAssistantSessionId(input: {
  baseUrl: string;
  cookie: string;
  csrf: string;
  workspace: string;
  conversationKey: string;
}) {
  const now = Date.now();
  const cached = assistantHermesSessionCache.get(input.conversationKey);
  if (cached && now - cached.updatedAt < ASSISTANT_HERMES_SESSION_TTL_MS) {
    cached.updatedAt = now;
    return cached.sessionId;
  }
  const sessionResp = await hermesRequestJson(input.baseUrl, "/api/session/new", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Cookie: input.cookie,
      ...(input.csrf ? { "X-Hermes-CSRF-Token": input.csrf, Origin: input.baseUrl } : {}),
    },
    body: JSON.stringify(buildHermesSessionPayload(input.workspace)),
  });
  const sessionId = safeText(sessionResp.data?.session?.session_id || sessionResp.data?.session_id || sessionResp.data?.session?.id);
  if (!sessionId) throw new Error("Hermes 未返回 session_id");
  assistantHermesSessionCache.set(input.conversationKey, { sessionId, updatedAt: now });
  return sessionId;
}
```

Change `runHermesAssistantChat` to accept `conversationKey` and call `getHermesAssistantSessionId` instead of always calling `/api/session/new`.

- [ ] **Step 5: Keep analysis sessions separate**

Do not reuse chat session cache for `runHermesAssistantAnalysis`. Provider analysis should remain an isolated task unless a later task explicitly adds a provider-analysis conversation.

- [ ] **Step 6: Run targeted verification**

Run:

```powershell
npm run verify:canvas-assistant-chat
npm run verify:admin-assistant-chat
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add apps/api/src/server.ts apps/web/src/services/api.ts apps/web/src/components/CanvasAssistant.tsx apps/admin/src/admin-types.ts apps/admin/src/admin-assistant-panel.tsx scripts/verify-admin-assistant-chat.mjs scripts/verify-canvas-assistant-chat.mjs
git commit -m "fix: preserve assistant conversation context"
```

---

### Task 3: Isolate Hermes Profile and Memory Policy

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-assistant-settings-panel.tsx`
- Test: `scripts/verify-admin-assistant-chat.mjs`
- Test: `scripts/verify-canvas-assistant-chat.mjs`

- [ ] **Step 1: Write failing Profile isolation assertions**

Add API source assertions:

```js
assert(apiSource.includes("XINGHUAN_HERMES_PROFILE"), "Hermes profile env must be supported");
assert(apiSource.includes("无限画布AI助手"), "Default Hermes profile name must be canvas-specific");
assert(apiSource.includes("buildHermesSessionPayload"), "Hermes session payload must be centralized");
assert(apiSource.includes("persistMemory"), "Assistant memory policy must be explicit");
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
npm run verify:admin-assistant-chat
npm run verify:canvas-assistant-chat
```

Expected: FAIL until Profile payload and policy are implemented.

- [ ] **Step 3: Add integration settings fields**

Extend assistant integration settings in API/admin types:

```ts
profile: string;
persistMemory: boolean;
```

Default:

```ts
profile: safeText(process.env.XINGHUAN_HERMES_PROFILE, "无限画布AI助手"),
persistMemory: false,
```

Normalization:

```ts
profile: safeText(integrationSource.profile, base.integration.profile || "无限画布AI助手"),
persistMemory: booleanValue(integrationSource.persistMemory, false),
```

- [ ] **Step 4: Centralize Hermes session/chat payload**

Add:

```ts
function hermesProfileName(settings?: AssistantSettingsRecord) {
  return safeText(
    process.env.XINGHUAN_HERMES_PROFILE || settings?.integration.profile,
    "无限画布AI助手",
  );
}

function buildHermesSessionPayload(workspace: string, settings?: AssistantSettingsRecord) {
  return {
    workspace,
    profile: hermesProfileName(settings),
    memory: Boolean(settings?.integration.persistMemory),
  };
}

function buildHermesChatPayload(sessionId: string, message: string, workspace: string, settings?: AssistantSettingsRecord) {
  return {
    session_id: sessionId,
    message,
    workspace,
    profile: hermesProfileName(settings),
    memory: Boolean(settings?.integration.persistMemory),
  };
}
```

Use these helpers in both Hermes chat and Hermes analysis.

- [ ] **Step 5: Apply conservative memory policy**

When `scope === "canvas"`, force memory off:

```ts
const memoryAllowed = input.scope === "admin" && Boolean(settings.integration.persistMemory);
```

If differentiating memory cannot be verified against Hermes behavior, keep `persistMemory` default false and do not expose a frontend memory toggle.

- [ ] **Step 6: Update settings UI**

In `AdminAssistantSettingsPanel`, expose Profile name as a simple text input under external service integration:

```tsx
<label>
  <span>助手 Profile</span>
  <input
    value={draft.integration.profile}
    onChange={(event) => updateIntegration("profile", event.target.value)}
  />
</label>
```

Expose memory as backend-only wording:

```tsx
<Toggle
  label="允许后台助手写入长期记忆"
  checked={draft.integration.persistMemory}
  onChange={(checked) => updateIntegration("persistMemory", checked)}
/>
```

- [ ] **Step 7: Verify**

Run:

```powershell
npm run verify:admin-assistant-chat
npm run verify:canvas-assistant-chat
npm run type-check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add apps/api/src/server.ts apps/admin/src/admin-types.ts apps/admin/src/admin-assistant-settings-panel.tsx scripts/verify-admin-assistant-chat.mjs scripts/verify-canvas-assistant-chat.mjs
git commit -m "feat: isolate assistant hermes profile"
```

---

### Task 4: Reduce Context Payload and Hide Debug Process

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/web/src/components/CanvasAssistant.tsx`
- Modify: `apps/admin/src/admin-assistant-panel.tsx`
- Modify: `apps/web/src/styles/index.css`
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-canvas-assistant-chat.mjs`
- Test: `scripts/verify-admin-assistant-chat.mjs`
- Test: `scripts/verify-canvas-assistant-ui-contract.mjs`
- Test: `scripts/verify-admin-assistant-ui-contract.mjs`

- [ ] **Step 1: Write failing payload and UI leak tests**

Assert API prompt builder does not include raw payload:

```js
assert(!/payload:\s*plainObject\(item\.payload\)/.test(apiSource), "Assistant prompts must not include full attachment payload");
assert(apiSource.includes("summarizeAssistantAttachment"), "Assistant attachments must be summarized");
assert(!apiSource.includes("当前回退回复:"), "Hermes prompt must not embed fallback raw reply");
```

Assert UI does not expose implementation labels:

```js
assert(!adminPanelSource.includes("Hermes"), "Admin assistant UI must not expose Hermes label");
assert(!adminPanelSource.includes("Fallback"), "Admin assistant UI must not expose fallback label");
assert(!adminPanelSource.includes("<summary>过程</summary>"), "Assistant process UI must not be shown by default");
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
npm run verify:canvas-assistant-chat
npm run verify:admin-assistant-chat
npm run verify:canvas-assistant-ui-contract
npm run verify:admin-assistant-ui-contract
```

Expected: FAIL until prompt and UI cleanup is complete.

- [ ] **Step 3: Add attachment summarizer**

In `apps/api/src/server.ts`:

```ts
function summarizeAssistantAttachment(item: AssistantChatAttachment) {
  const payload = plainObject(item.payload);
  const kind = safeText(item.kind || "context");
  const summary: Record<string, unknown> = {
    kind,
    title: safeText(item.title).slice(0, 120),
    summary: safeText(item.summary).slice(0, 240),
  };
  if (kind === "workflow") {
    const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    const edges = Array.isArray(payload.edges) ? payload.edges : [];
    summary.nodeCount = nodes.length;
    summary.edgeCount = edges.length;
    summary.nodeTypes = nodes.slice(0, 12).map((node) => safeText(plainObject(node).type)).filter(Boolean);
  }
  if (kind === "node") {
    summary.nodeId = safeText(payload.id).slice(0, 80);
    summary.nodeType = safeText(payload.type).slice(0, 80);
  }
  if (kind === "provider" || kind === "model" || kind === "task") {
    summary.id = safeText(payload.id).slice(0, 80);
    summary.status = safeText(payload.status).slice(0, 80);
    summary.capability = safeText(payload.capability).slice(0, 80);
    summary.protocol = safeText(payload.protocol).slice(0, 80);
  }
  if (kind === "image" || kind === "video" || kind === "audio") {
    summary.mediaKind = kind;
    summary.urlHost = safeText(payload.url).replace(/^https?:\/\//, "").split("/")[0].slice(0, 120);
  }
  return summary;
}
```

Use this in `buildHermesAssistantChatPrompt` and `buildFallbackAssistantChat`.

- [ ] **Step 4: Remove fallback/raw process leakage**

Make fallback raw safe:

```ts
rawAssistant: "",
```

Change `extractAssistantProcess` to return `[]` for fallback/empty raw and avoid JSON object expansion for user-visible streaming.

Do not send `process` events unless a future explicit debug flag is added.

- [ ] **Step 5: Clean frontend attachment payloads before sending**

In web/admin components, add:

```ts
function compactAssistantAttachment(item: AssistantChatAttachment): AssistantChatAttachment {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    summary: item.summary,
    payload: {},
  };
}
```

For canvas workflow/node, keep only key counts/type/id fields in payload rather than `node.data`.

- [ ] **Step 6: Remove implementation labels from UI**

Remove:

```tsx
{message.role === "assistant" ? <span>{message.mode === "hermes" ? "Hermes" : "Fallback"}</span> : null}
```

Remove default `<details className="assistant-process-block">` blocks from both assistant UIs, or guard behind a hardcoded `false`.

- [ ] **Step 7: Verify**

Run:

```powershell
npm run verify:canvas-assistant-chat
npm run verify:admin-assistant-chat
npm run verify:canvas-assistant-ui-contract
npm run verify:admin-assistant-ui-contract
npm run type-check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add apps/api/src/server.ts apps/web/src/components/CanvasAssistant.tsx apps/admin/src/admin-assistant-panel.tsx apps/web/src/styles/index.css apps/admin/src/styles.css scripts/verify-canvas-assistant-chat.mjs scripts/verify-admin-assistant-chat.mjs scripts/verify-canvas-assistant-ui-contract.mjs scripts/verify-admin-assistant-ui-contract.mjs
git commit -m "fix: summarize assistant context and hide debug output"
```

---

### Task 5: Add Admin-Confirmed API Provider Autofill Flow

**Files:**
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/admin/src/styles.css`
- Test: `scripts/verify-admin-assistant-workbench.mjs`
- Test: `scripts/verify-admin-api-layout-contract.mjs`

- [ ] **Step 1: Write failing UI workflow assertions**

Assert `admin-api-settings-panel.tsx` contains:

```js
assert(source.includes("AI 协助配置"), "Provider settings must expose AI assisted configuration");
assert(source.includes("applyAssistantProviderDraft"), "Provider draft must require explicit apply action");
assert(source.includes("/api/admin/assistant/analyze-provider"), "Provider assistant must call analyze-provider API");
assert(!source.includes("autoSaveAssistantDraft"), "Assistant draft must not auto-save");
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
npm run verify:admin-assistant-workbench
npm run verify:admin-api-layout-contract
```

Expected: FAIL until UI flow exists.

- [ ] **Step 3: Add assistant input and result state**

In `ApiSettingsPanel`:

```ts
const [assistantPrompt, setAssistantPrompt] = useState("");
const [assistantResult, setAssistantResult] = useState<AssistantAnalysisResult | null>(null);
const [assistantBusy, setAssistantBusy] = useState(false);
```

Ensure `AssistantAnalysisResult` is exported/imported from admin types.

- [ ] **Step 4: Add analysis action**

```ts
async function analyzeProviderWithAssistant() {
  setAssistantBusy(true);
  setStatus("正在分析服务商配置...");
  try {
    const result = await api<AssistantAnalysisResult>("/api/admin/assistant/analyze-provider", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        providerName: draft.name,
        baseUrl: draft.baseUrl,
        protocol: draft.protocol,
        modelId: selectedModels[0]?.modelId || "",
        notes: assistantPrompt,
      }),
    });
    setAssistantResult(result);
    setStatus(result.summary || "已生成配置草案，请确认后应用。");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    setAssistantBusy(false);
  }
}
```

- [ ] **Step 5: Add explicit apply action**

```ts
function applyAssistantProviderDraft() {
  if (!assistantResult) return;
  const providerDraft = assistantResult.drafts?.provider || {};
  setDraft((current) => ({
    ...current,
    name: typeof providerDraft.name === "string" && providerDraft.name ? providerDraft.name : current.name,
    baseUrl: typeof providerDraft.baseUrl === "string" && providerDraft.baseUrl ? providerDraft.baseUrl : current.baseUrl,
    protocol: typeof providerDraft.protocol === "string" ? (providerDraft.protocol as ProviderProtocol) : current.protocol,
    note: typeof providerDraft.note === "string" && providerDraft.note ? providerDraft.note : current.note,
  }));
  setStatus("AI 草案已应用到表单，仍需点击保存才会生效。");
}
```

- [ ] **Step 6: Render concise assistant workbench**

Add a card near the provider form actions:

```tsx
<div className="api-card api-assistant-card">
  <div className="fetch-result-head">
    <strong>AI 协助配置</strong>
    <span>生成草案后由管理员确认应用</span>
  </div>
  <textarea
    value={assistantPrompt}
    onChange={(event) => setAssistantPrompt(event.target.value)}
    placeholder="粘贴接口文档片段、请求样例、响应样例或配置目标"
  />
  <div className="provider-form-actions">
    <button type="button" className="ghost-action" onClick={analyzeProviderWithAssistant} disabled={busy || assistantBusy}>
      分析配置
    </button>
    <button type="button" className="primary-action" onClick={applyAssistantProviderDraft} disabled={!assistantResult || assistantBusy}>
      应用到表单
    </button>
  </div>
  {assistantResult ? <p>{assistantResult.summary}</p> : null}
</div>
```

- [ ] **Step 7: Keep backend safe**

Ensure `/api/admin/assistant/analyze-provider` never saves provider/model records. It should only return draft data and append audit.

- [ ] **Step 8: Verify**

Run:

```powershell
npm run verify:admin-assistant-workbench
npm run verify:admin-api-layout-contract
npm run type-check
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add apps/admin/src/admin-api-settings-panel.tsx apps/admin/src/admin-types.ts apps/api/src/server.ts apps/admin/src/styles.css scripts/verify-admin-assistant-workbench.mjs scripts/verify-admin-api-layout-contract.mjs
git commit -m "feat: add admin-confirmed provider assistant drafts"
```

---

### Task 6: Polish Admin and Canvas Assistant UI Adaptivity

**Files:**
- Modify: `apps/admin/src/admin-assistant-panel.tsx`
- Modify: `apps/admin/src/admin-assistant-settings-panel.tsx`
- Modify: `apps/admin/src/styles.css`
- Modify: `apps/web/src/components/CanvasAssistant.tsx`
- Modify: `apps/web/src/styles/index.css`
- Test: `scripts/verify-admin-assistant-ui-contract.mjs`
- Test: `scripts/verify-canvas-assistant-ui-contract.mjs`

- [ ] **Step 1: Write failing UI contract assertions**

Assert no visible implementation/debug copy:

```js
for (const banned of ["测试", "验收", "前端助手", "Hermes", "Fallback", "过程"]) {
  assert(!adminSource.includes(`>${banned}<`), `Admin UI must not expose ${banned}`);
}
```

Assert CSS has adaptive constraints:

```js
assert(css.includes("minmax(0, 1fr)"), "Assistant layouts must allow shrinking");
assert(css.includes("overflow-wrap: anywhere"), "Assistant text must wrap long values");
assert(css.includes("max-height: calc(100dvh"), "Assistant dock/panel must respect viewport bottom gap");
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
npm run verify-admin-assistant-ui-contract
npm run verify-canvas-assistant-ui-contract
```

Expected: FAIL until UI cleanup is applied.

- [ ] **Step 3: Clean admin assistant panel**

Remove session timestamp display or replace with neutral copy:

```tsx
<span>当前对话</span>
```

Keep “新建会话” button, but make it compact and aligned.

- [ ] **Step 4: Clean assistant settings panel copy**

Replace long descriptive note:

```tsx
<div className="assistant-settings-note">
  前端助手固定为非持久化记忆模式。
</div>
```

Do not use words like “测试”, “验收”, “前端助手” in user-visible labels.

- [ ] **Step 5: Repair admin CSS**

Use compact adaptive layout:

```css
.assistant-settings-page .form-panel label,
.assistant-toggle {
  display: grid;
  grid-template-columns: minmax(120px, 180px) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.assistant-toggle input {
  width: 18px;
  height: 18px;
  justify-self: start;
}

.admin-assistant-dock__panel {
  max-height: calc(100dvh - 24px);
  min-height: 0;
}

.admin-assistant-message p,
.admin-assistant-attachment span,
.assistant-settings-page input,
.assistant-settings-page textarea {
  overflow-wrap: anywhere;
}
```

- [ ] **Step 6: Keep canvas assistant adaptive**

Ensure panel stays within bottom controls:

```css
.canvas-assistant-panel {
  max-height: calc(100dvh - var(--canvas-assistant-panel-top, 96px) - var(--t8-floating-control-bottom, 12px));
  min-height: var(--canvas-assistant-panel-min-height, 360px);
  overflow: hidden;
}
```

Ensure card/action text wraps instead of expanding buttons:

```css
.canvas-assistant-panel__context-actions button,
.canvas-assistant-attachment {
  min-width: 0;
}

.canvas-assistant-panel__context-action-copy,
.canvas-assistant-attachment__summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 7: Browser QA**

Open `http://127.0.0.1:18200/?v=assistant-ui-qa` in the in-app browser and verify:

- Canvas assistant opens.
- Sending current node does not create an oversized card.
- Assistant panel can stretch downward but still keeps the bottom gap.
- Admin assistant/settings page has aligned controls.
- No `deadlock detected` appears when opening or saving assistant settings.

- [ ] **Step 8: Verify**

Run:

```powershell
npm run verify:admin-assistant-ui-contract
npm run verify:canvas-assistant-ui-contract
npm run build:single-port
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add apps/admin/src/admin-assistant-panel.tsx apps/admin/src/admin-assistant-settings-panel.tsx apps/admin/src/styles.css apps/web/src/components/CanvasAssistant.tsx apps/web/src/styles/index.css scripts/verify-admin-assistant-ui-contract.mjs scripts/verify-canvas-assistant-ui-contract.mjs
git commit -m "fix: polish assistant adaptive ui"
```

---

## Final Verification Gate

- [ ] Run:

```powershell
npm run verify:admin-assistant-settings-save-contract
npm run verify:admin-assistant-chat
npm run verify:canvas-assistant-chat
npm run verify:admin-assistant-workbench
npm run verify:admin-assistant-ui-contract
npm run verify:canvas-assistant-ui-contract
npm run type-check
npm run build:single-port
```

- [ ] Browser QA at `http://127.0.0.1:18200/?v=assistant-final-qa`.
- [ ] Confirm no secrets, raw Hermes payloads, Profile internals, or API keys are printed in terminal, docs, screenshots, or UI.
- [ ] Confirm no prohibited delete command was used.
- [ ] Do not deploy until the user explicitly approves deployment after review.

---

## Risks and Guardrails

- Hermes Profile support must be verified against the actual Hermes API. If Hermes ignores `profile`, keep `persistMemory=false` and rely on separate workspace/session isolation until Profile API is confirmed.
- PostgreSQL settings write must not rewrite providers/models/tasks/audit tables. This is the highest-priority fix for `deadlock detected`.
- Assistant should never auto-save Provider or Model records. It may only generate drafts and apply them to local form state after admin confirmation.
- Frontend canvas assistant must never persist memory. Backend/admin memory remains disabled by default.
- Existing dirty worktree changes must not be reverted. Each task should inspect the diff before committing.

---

## Self-Review

- Spec coverage: all four user issues are covered by Tasks 1-6.
- Placeholder scan: no task depends on unspecified future work; Hermes Profile uncertainty is handled with a conservative no-memory fallback.
- Type consistency: `conversationId`, `profile`, and `persistMemory` are introduced in API/admin/web types before use.
- Safety: no batch delete commands are required; no secrets are printed or committed.
