# AI Governance, Provider Operability And Supervision V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Admin Provider/model operations readable, rebuild assistant and supervision governance, add RunningHub standard image/video execution, and make AI-supervised workflow planning and failures visible, actionable and diagnosable by the Canvas assistant.

**Architecture:** Keep stable IDs and deterministic Canvas compilation authoritative while adding human-readable identity snapshots, versioned assistant/supervision configuration, a validated Agent analysis projection and a dedicated RunningHub standard-model adapter. Share normalized diagnostics and channel-health semantics across API, Web and Admin, but keep each surface's layout and permission boundary explicit.

**Tech Stack:** TypeScript, React, Vite, Node.js HTTP API, PostgreSQL, Redis Worker queues, Vitest, Playwright/browser acceptance, Agent Runtime, RunningHub OpenAPI v2.

## Global Constraints

- Baseline Gray version is `v0.7.42`.
- Do not push GitHub.
- Do not touch Production, including configuration publication or data.
- Gray deployment remains paused until the user explicitly approves deployment after local gates.
- Work only in `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`.
- PC desktop only; visual acceptance covers exactly `1920x1080` and `2560x1440`.
- Do not expose API keys, encrypted secrets, cookies, signed media URLs, database URLs or owner identities in source, docs, logs, screenshots or chat.
- RunningHub real image/video calls are authorized, but each acceptance case is bounded to one request unless the test specifically verifies batch/concurrency behavior.
- AI assistant and AI supervision completion requires authenticated real-model behavior; mocked/unit/source checks alone are insufficient.
- Every task ends with focused tests, relevant type-check/build, diff review and a validation log entry before the next task begins.
- Use additive migrations and stable legacy redirects; do not rewrite historical run events or task logs.

---

## File Map

### Design And Governance

- Create: `docs/adr/0005-agent-analyzed-deterministic-supervision.md` - accepted authority boundary for Agent analysis versus deterministic execution.
- Modify: `docs/adr/README.md` - register ADR 0005.
- Modify: `CONTEXT.md` - add execution identity snapshot and normalized supervision diagnostic terms.
- Modify: `docs/systems/agent-runtime/README.md` - document separated assistants, planner analysis and failure context.
- Modify: `docs/systems/providers/protocol-layering.md` - distinguish RunningHub standard model from app/workflow execution.
- Modify: `docs/systems/observability-and-ops/channel-health.md` - document the revised Admin presentation only.
- Create: `docs/logbooks/daily/2026-07-24-ai-governance-provider-operability-supervision-v2.md` - append-only implementation journal.
- Create per stage: `docs/logbooks/validations/2026-07-24-<stage>.md` - commands, behavior and screenshot evidence.

### Task Identity And Provider Catalog

- Create: `apps/api/db/043_task_execution_identity_snapshot.sql`.
- Create: `apps/api/src/task-execution-identity.ts` and test.
- Modify: `apps/api/src/task-repository.ts` and test.
- Modify: `apps/api/src/admin-task-list-routes.ts` and test.
- Modify: `apps/api/src/server.ts` only for the existing record projection/insertion wiring.
- Modify: `apps/admin/src/admin-types.ts`.
- Modify: `apps/admin/src/admin-task-panel.tsx` and its source contract.
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`.
- Modify: `apps/admin/src/styles.css`.
- Modify: `scripts/verify-admin-task-panel-contract.mjs`.
- Modify: `scripts/verify-admin-provider-rail-layout.mjs`.

### Channel Health

- Modify: `packages/ui/src/channel-health-report.tsx` and test.
- Modify: `apps/admin/src/admin-channel-health-dashboard.tsx`.
- Rewrite scoped rules in `apps/admin/src/admin-channel-health-dashboard.css`.
- Modify: `scripts/verify-channel-health-contract.mjs`.

### Assistant And Automation Governance

- Modify: `apps/admin/src/admin-view-model.ts` and view-model contract.
- Create: `apps/admin/src/admin-assistant-governance-workspace.tsx`.
- Create: `apps/admin/src/admin-assistant-governance-view-model.ts` and test.
- Modify: `apps/admin/src/admin-agent-governance-workspace.tsx`.
- Modify: `apps/admin/src/admin-agent-governance-purpose.ts`.
- Modify: `apps/admin/src/admin-agent-governance-api.ts`.
- Modify: `apps/admin/src/main.tsx` and `apps/admin/src/styles.css`.
- Retire from active routing: `apps/admin/src/admin-assistant-settings-panel.tsx`.
- Modify: `apps/api/src/admin-assistant-settings-routes.ts`.
- Modify: Agent bootstrap/configuration route modules located by CodeGraph before editing.
- Modify: `apps/api/src/server.ts` assistant key selection by scope.
- Modify: assistant and governance Harness scripts.

### RunningHub Standard Models

- Create: `apps/worker/src/worker-runninghub-standard-adapter.ts` and test.
- Create: `apps/worker/src/worker-runninghub-standard-media.ts` and test.
- Modify: `apps/worker/src/worker.ts` only for adapter routing and output handoff.
- Modify: `apps/api/src/provider-generation-task-service.ts` and test/source contract.
- Modify: model parameter schema/advanced configuration types only where needed for explicit execution mode.
- Create: `scripts/verify-runninghub-standard-model-contract.mjs`.
- Modify: Provider and RunningHub system docs.

### Agent Analysis, Diagnostics And Assistant Follow-up

- Create: `packages/shared/src/canvas-run-diagnostic.ts` and test; export from `packages/shared/src/index.ts`.
- Create: `packages/agent-core/src/canvas-run-agent-analysis.ts` and test; export from package index.
- Modify: `packages/agent-core/src/workflow-compiler.ts` and tests.
- Create: `apps/api/src/canvas-run-agent-analysis-service.ts` and test.
- Modify: `apps/api/src/canvas-run-service.ts`, repository projections and route tests.
- Modify: Worker Canvas Run scheduler modules discovered through CodeGraph, with focused concurrency tests.
- Modify: `apps/web/src/components/canvas-agent/canvas-run-api.ts`.
- Modify: `apps/web/src/components/canvas-agent/canvas-run-error-message.ts` and add tests.
- Modify: `apps/web/src/components/canvas-agent/CanvasRunSupervisor.tsx`.
- Modify: `apps/web/src/components/canvas-agent/CanvasSupervisionDock.tsx` and styles.
- Modify: `apps/web/src/components/canvas-assistant/useAssistantSession.ts` and tests.
- Modify: assistant request sanitization/server prompt-context assembly and its tests.
- Create: `scripts/verify-canvas-supervision-diagnostic-contract.mjs`.

---

### Task 1: Lock Architecture, Acceptance Matrix And Harness Ownership

**Interfaces:**
- Consumes: approved design in `docs/superpowers/specs/2026-07-24-ai-governance-provider-operability-and-supervision-v2-design.md`.
- Produces: ADR 0005, implementation journal, validation matrix and registered Harness ownership for later tasks.

- [x] **Step 1: Write ADR 0005 with the authority rule**

Record that Agent analysis is advisory, `compileCanvasRunPlan` plus server validation is authoritative, Worker scheduling can only execute ready steps, and deterministic fallback remains available when the Agent is unavailable.

- [x] **Step 2: Register domain terms and system documentation entry points**

Add `Execution Identity Snapshot`, `Canvas Run Agent Analysis`, `Execution Layer` and `Canvas Run Failure Diagnostic` to `CONTEXT.md`. Register the ADR and link this plan from the relevant system documents.

- [x] **Step 3: Create the implementation journal and stage evidence template**

The journal must contain the baseline commit, Gray `v0.7.42`, no-push/no-Production constraints, the two viewport sizes and one row per task with status, tests, evidence path and commit.

- [x] **Step 4: Register Harness ownership for the new architecture**

Register the architecture, acceptance matrix and release boundary in the project Harness. Each behavior contract is introduced in the implementation task that also makes it pass, so the shared branch never commits an intentionally failing project gate:

```text
/admin/automation/assistants exists
/admin/automation/supervision exists
/admin/capabilities/admin-assistant redirects
runninghub is accepted by generic image and video task submission
CanvasRunFailureDiagnostic is shared
```

- [x] **Step 5: Run the documentation and architecture checks**

Run:

```powershell
npm run verify:domain-context-and-adr-contract
npm run verify:documentation-entry-contract
npm run verify:agent-runtime-architecture-contract
npm run verify:agent-governance-contract
```

Expected: documentation and architecture checks pass; later behavior ownership is listed in this plan and stage ledger.

- [x] **Step 6: Review and commit the planning baseline**

Run `git diff --check`, inspect staged files, then commit only the design/plan/ADR/journal/Harness baseline with:

```powershell
git commit -m "docs(ai): plan supervision and provider operability v2"
```

### Task 2: Human-readable Task Identity And Compact Provider Rail

**Interfaces:**
- Consumes: existing task `provider_id`, model record ID and Provider/model catalogs.
- Produces: `TaskExecutionIdentitySnapshot`, Admin task projection names and protocol-free Provider rail.

- [x] **Step 1: Write failing execution identity tests**

Cover snapshot-first projection, live-name fallback, deleted Provider/model fallback, retry snapshot preservation and filtering by stable Provider ID.

Target shape:

```ts
export interface TaskExecutionIdentitySnapshot {
  providerId: string;
  providerName: string;
  modelRecordId: string;
  providerModelId: string;
  modelName: string;
}
```

- [x] **Step 2: Run focused tests and confirm RED**

```powershell
npx vitest run apps/api/src/task-execution-identity.test.ts apps/api/src/task-repository.test.ts apps/api/src/admin-task-list-routes.test.ts
npm run verify:admin-task-panel-contract
npm run verify:admin-provider-rail-layout
```

- [x] **Step 3: Add migration 043 and repository persistence**

Add an `execution_identity_snapshot jsonb not null default '{}'::jsonb` column and any bounded list-query index justified by the final SQL. Centralize normalization in `task-execution-identity.ts`; both PostgreSQL and file fallback paths must produce the same public projection.

- [x] **Step 4: Join display names in the lightweight Admin list query**

Join `xh_providers` and `xh_models` without selecting task payload/result. Return snapshot/live/raw fallbacks as `providerName`, `modelName` and `providerModelId` while preserving IDs.

- [x] **Step 5: Update Admin task list presentation and filtering**

Render human names as primary text, raw IDs as subdued secondary text, and Provider filter options as `{ value: providerId, label: providerName }`.

- [x] **Step 6: Remove the protocol badge from the Provider rail**

Delete `<em>{provider.protocol...}</em>` from the compact rail. Give the name block `min-width: 0`, allow the service name the recovered width, keep full name in `title`, and retain protocol only in the selected Provider editor.

- [x] **Step 7: Verify focused behavior and build**

```powershell
npx vitest run apps/api/src/task-execution-identity.test.ts apps/api/src/task-repository.test.ts apps/api/src/admin-task-list-routes.test.ts
npm run verify:admin-task-panel-contract
npm run verify:admin-provider-rail-layout
npm run type-check
npm run build -w @xinghuan/api
npm run build -w @xinghuan/admin
```

- [x] **Step 8: Run authenticated PC visual checks and record evidence**

At `1920x1080` and `2560x1440`, verify long Provider names remain readable in the model catalog and Admin task rows show Provider/model names with raw IDs secondary. Record screenshots and console/network state.

- [ ] **Step 9: Review and commit Task 2**

Run `git diff --check`, source-size/Hotspot checks for touched large files, write the validation log, then commit:

```powershell
git commit -m "fix(admin): make provider and task identities readable"
```

### Task 3: Channel Health Provider/Model Visual Hierarchy

**Interfaces:**
- Consumes: unchanged `ChannelHealthReport` data contract.
- Produces: shared semantic table header hooks and a bounded Admin presentation variant.

- [ ] **Step 1: Add failing static-render and source-contract cases**

Assert that every Provider has a named section header, every model row exposes identity/rate/trend/feedback cells, and Admin passes an explicit `surface="admin"` or equivalent class contract.

- [ ] **Step 2: Confirm RED**

```powershell
npx vitest run packages/ui/src/channel-health-report.test.tsx apps/admin/src/admin-channel-health-refresh.test.ts
npm run verify:channel-health-contract
```

- [ ] **Step 3: Add shared semantic column hooks without changing report data**

Add accessible labels and stable class hooks for Provider headers, model column headers and rows. Do not fork aggregation semantics or feedback windows.

- [ ] **Step 4: Rebuild the Admin layout**

Use one repeated Provider panel per Provider, one bounded model table per panel, opaque row backgrounds, fixed column tracks and a centered maximum content width. Avoid nested decorative cards; the Provider panel is the repeated record boundary.

- [ ] **Step 5: Verify focused tests, Admin build and data behavior**

```powershell
npx vitest run packages/ui/src/channel-health-report.test.tsx apps/admin/src/admin-channel-health-refresh.test.ts
npm run verify:channel-health-contract
npm run build -w @xinghuan/ui
npm run build -w @xinghuan/admin
```

- [ ] **Step 6: Authenticated visual acceptance**

At both PC viewports, verify at least two Providers with multiple models where actual data permits. Check Provider boundaries, model separators, trend alignment, long names, empty buckets, stale-data banner and no horizontal content overlap.

- [ ] **Step 7: Record and commit Task 3**

Write the validation log with screenshots and commit:

```powershell
git commit -m "fix(channel-health): clarify provider and model hierarchy"
```

### Task 4: Separate AI Assistant And Supervision Governance

**Interfaces:**
- Consumes: `AssistantSettings`, versioned Agent definitions, LLM route pools and Agent governance APIs.
- Produces: separate frontend/backend assistant workspaces, separate supervision workspace and stable legacy route redirect.

- [ ] **Step 1: Write failing IA and configuration projection tests**

Cover:

```text
/admin/automation/assistants -> AI 助手
/admin/automation/supervision -> AI 托管与自动化
/admin/automation/activity -> 运行与审计
/admin/capabilities/admin-assistant -> redirect to assistants
frontend assistant -> assistant-planner
backend assistant -> admin-assistant-planner
```

Verify the frontend/backend surface settings and Agent publication states remain distinct.

- [ ] **Step 2: Confirm RED**

```powershell
npm run verify:admin-view-model-contract
npm run verify:admin-assistant-settings-save-contract
npm run verify:agent-governance-contract
npm run verify:admin-assistant-ui-contract
```

- [ ] **Step 3: Extend assistant settings compatibility**

Normalize `frontendAssistantAgentKey` and `backendAssistantAgentKey`, preserving the old `assistantAgentKey` as a read fallback only. Route Canvas and Admin chat to separate Agent definitions. Keep knowledge/context permissions enforced by scope on the server.

- [ ] **Step 4: Register and bootstrap the backend assistant purpose**

Add a stable `admin-assistant-planner` definition and route pool template. Bootstrap is idempotent and must never overwrite published versions.

- [ ] **Step 5: Implement the AI Assistant governance workspace**

Use a frontend/backend segmented control. Compose surface settings with the matching Agent role editor and route pool. Show current Gray/Production publications, but do not publish or modify Production during this work.

- [ ] **Step 6: Refocus the supervision workspace**

Move controls, planner model, maximum parallelism, quality, candidate selection and recovery policies under `AI 托管与自动化`. Move runs, approvals and audit into `运行与审计`. Historical Agent definitions remain read-only.

- [ ] **Step 7: Remove old active UI ownership**

Remove `后台 AI 助手` from `Provider 与模型`, stop rendering `AdminAssistantSettingsPanel`, and preserve only a route redirect. Provider/model pages must no longer contain assistant model or policy controls.

- [ ] **Step 8: Verify configuration, permission and builds**

```powershell
npm run verify:admin-view-model-contract
npm run verify:admin-assistant-settings-save-contract
npm run verify:admin-assistant-chat
npm run verify:admin-assistant-ui-contract
npm run verify:agent-governance-contract
npm run verify:member-admin-boundary
npm run type-check
npm run build -w @xinghuan/api
npm run build -w @xinghuan/admin
```

- [ ] **Step 9: Authenticated behavior and visual acceptance**

At both PC viewports, inspect both assistant segments, edit and discard a draft safely, verify route pool labels use human model/Provider names, verify legacy route redirect, and confirm Production controls are not used.

- [ ] **Step 10: Record and commit Task 4**

```powershell
git commit -m "feat(agent): separate assistant and supervision governance"
```

### Task 5: RunningHub Standard Image And Video Provider Adapter

**Interfaces:**
- Consumes: queued generic image/video tasks and configured RunningHub Provider/model records.
- Produces: `runningHubExecutionMode`, standard submit/query adapter and materialized outputs.

- [ ] **Step 1: Write failing adapter contract tests**

Use injected `fetch` and fake timers to cover:

- image submit returns `taskId` and polls to a `png` result;
- video submit returns `taskId` and polls to an `mp4` result;
- `FAILED` returns safe `errorCode/errorMessage`;
- temporary media upload maps local/protected input to RH upload URL;
- signed URLs and Authorization are absent from diagnostics;
- specialized `webappId/workflowId` payload still routes to the existing catalog client.

- [ ] **Step 2: Confirm RED**

```powershell
npx vitest run apps/worker/src/worker-runninghub-standard-adapter.test.ts apps/worker/src/worker-runninghub-standard-media.test.ts
npm run verify:provider-generation-task-service
npm run verify:provider-generation-worker
```

- [ ] **Step 3: Accept RunningHub in generic image/video submission**

Add `runninghub` to both API capability allowlists. Freeze `runningHubExecutionMode` based on explicit catalog target fields versus a standard model path. Do not apply the Grok/AICopy prompt-byte limit to RunningHub; retain only the platform-wide prompt safety ceiling.

- [ ] **Step 4: Implement the standard adapter as a focused module**

Provide:

```ts
export async function executeRunningHubStandardModel(input: {
  capability: "image" | "video";
  baseUrl: string;
  apiKey: string;
  modelPath: string;
  body: Record<string, unknown>;
  fetchImpl?: typeof fetch;
  onHeartbeat: (patch: Record<string, unknown>) => Promise<void>;
}): Promise<Record<string, unknown>>;
```

Normalize submit/query URLs, status mapping and result types. Return adapter `runninghub-standard-image` or `runninghub-standard-video`.

- [ ] **Step 5: Implement protected media upload and output materialization handoff**

Read only owner-authorized local artifacts, upload through RH binary media endpoint when needed, and return temporary remote URLs to the standard adapter. Reuse the existing Worker output materializer so final tasks expose platform-owned URLs.

- [ ] **Step 6: Route Worker execution without changing catalog targets**

In `executeSingleImageTask` and `executeSingleVideoTask`, route `standard_model` to the new adapter and `catalog_target` to `executeRunningHubTask`. Preserve key-pool assignment and heartbeat semantics where configured.

- [ ] **Step 7: Verify mocked edge cases and builds**

```powershell
npx vitest run apps/worker/src/worker-runninghub-standard-adapter.test.ts apps/worker/src/worker-runninghub-standard-media.test.ts
npm run verify:runninghub-standard-model-contract
npm run verify:provider-generation-task-service
npm run verify:provider-generation-worker
npm run verify:worker-output-materializer
npm run verify:runninghub-workflow-contract
npm run type-check
npm run build -w @xinghuan/api
npm run build -w @xinghuan/worker
```

- [ ] **Step 8: Run controlled real RunningHub image verification**

Using the configured RH image model, submit one real request through the generic Provider API. Record only allowlisted evidence: internal task ID, display Provider/model names, adapter name, final status, output count, materialized local URL and timestamps. Do not record key, signed URL or full upstream body.

- [ ] **Step 9: Run controlled real RunningHub video verification**

Use a platform-owned image artifact as the input to the configured RH video model. Verify media upload/fetch, submit, polling, `mp4` classification, task state, output materialization and Canvas playback. One real video request is sufficient unless the first fails for a diagnosed configuration reason.

- [ ] **Step 10: Record and commit Task 5**

Document real costs/status without secrets and commit:

```powershell
git commit -m "feat(runninghub): support standard image and video models"
```

### Task 6: Normalized Supervision Errors And Assistant Diagnostic Context

**Interfaces:**
- Consumes: Canvas Run API errors, run events, task diagnostics and sanitized workflow context.
- Produces: shared `CanvasRunFailureDiagnostic`, direct Canvas copy and assistant failure attachments.

- [ ] **Step 1: Write failing diagnostic normalization tests**

Cover workflow boundaries, cycles, unsupported nodes, model repair, Provider rejection/rate limit, queue wait/stall, budget exceeded, permission denied, cancellation, Worker timeout and unknown fallback. Assert secrets, signed URLs and raw bodies are removed.

- [ ] **Step 2: Confirm RED**

```powershell
npx vitest run packages/shared/src/canvas-run-diagnostic.test.ts apps/web/src/components/canvas-agent/canvas-run-error-message.test.ts apps/web/src/components/canvas-assistant/useAssistantSession.test.ts
npm run verify:canvas-supervision-diagnostic-contract
```

- [ ] **Step 3: Implement the shared diagnostic projector**

Normalize stable codes and safe event/task fields into category, title, summary, action, retryability, location and collapsed technical details. Provider/model names are allowed; credentials, signed URLs and full upstream response snippets are not.

- [ ] **Step 4: Make Canvas failures direct and location-aware**

Render the four-part explanation, affected node/model, retryability and a dedicated `让 AI 助手分析` action. Keep technical code/request ID in a collapsed details region.

- [ ] **Step 5: Expand assistant failure context safely**

Attach the normalized diagnostic, failed step, plan group/layer, bounded neighboring nodes and latest relevant events. Add an event bridge so clicking the Canvas error action opens the assistant with exactly that diagnostic selected.

- [ ] **Step 6: Strengthen assistant prompt behavior**

Require the assistant to separate observed facts, likely cause, affected steps and repair actions. It must state uncertainty and may not claim execution/retry/mutation without an audited result.

- [ ] **Step 7: Verify tests, boundaries and builds**

```powershell
npx vitest run packages/shared/src/canvas-run-diagnostic.test.ts apps/web/src/components/canvas-agent/canvas-run-error-message.test.ts apps/web/src/components/canvas-assistant/useAssistantSession.test.ts
npm run verify:canvas-supervision-diagnostic-contract
npm run verify:canvas-assistant-chat
npm run verify:canvas-assistant-ui-contract
npm run verify:member-admin-boundary
npm run type-check
npm run build -w @xinghuan/shared
npm run build -w @xinghuan/api
npm run build -w @xinghuan/web
```

- [ ] **Step 8: Run real failed-run assistant diagnosis**

Create a disposable workflow failure with a safe, intentional invalid model/input configuration. Confirm Canvas copy identifies the node and repair, click the assistant action, and verify the real assistant response cites the actual run evidence and gives applicable repair steps.

- [ ] **Step 9: Record and commit Task 6**

```powershell
git commit -m "feat(canvas): make supervision failures diagnosable"
```

### Task 7: AI Agent Analysis And Validated Concurrent Supervision

**Interfaces:**
- Consumes: workflow snapshot, deterministic dependency graph, published `supervision-planner` configuration and concurrency policy.
- Produces: frozen `CanvasRunAgentAnalysis`, deterministic execution layers and visible planning/run events.

- [ ] **Step 1: Write failing deterministic layer tests**

Test a graph `A -> C`, `B -> C`, `C -> D` and assert layers `[[A,B],[C],[D]]`. Test stage ordering, cycles, skipped steps, maximum parallelism and the rule that Agent suggestions cannot place dependencies in one layer.

- [ ] **Step 2: Write failing Agent analysis validation tests**

Cover valid recommendations, unknown step IDs, dependency violations, excessive parallelism, malformed response, timeout and deterministic fallback.

- [ ] **Step 3: Confirm RED**

```powershell
npx vitest run packages/agent-core/src/canvas-run-agent-analysis.test.ts packages/agent-core/src/workflow-compiler.test.ts apps/api/src/canvas-run-agent-analysis-service.test.ts
npm run test:canvas-run-postgres-integration
```

- [ ] **Step 4: Implement deterministic execution layers**

Extend the compiler output with layers derived only from validated dependencies and stage constraints. Keep stable order for equally ready steps.

- [ ] **Step 5: Implement the bounded Agent analysis service**

Call the published `supervision-planner` through the existing orchestrator with a sanitized workflow summary and deterministic graph. Validate the structured response, persist its Agent Run/audit linkage and fall back without blocking plan creation.

- [ ] **Step 6: Freeze analysis, layers and effective policy in the Run**

Store analysis and layers in the plan/configuration snapshot. Emit `analysis_started`, `analysis_completed`, `analysis_degraded`, `execution_layer_started` and `execution_layer_completed` events.

- [ ] **Step 7: Make Worker scheduling honor ready steps and effective concurrency**

The runnable set is `pending steps whose dependencies succeeded and whose layer is active`. Effective concurrency is the minimum of workflow limit, published policy, Provider quota and ready count. Convergence steps wait for all required upstream outputs.

- [ ] **Step 8: Render analysis and layer progress in Canvas**

Show summary, concurrency groups, serial constraints, risks, estimated request count and degraded status before execution. During execution, project active layer and node/task progress directly onto the workflow.

- [ ] **Step 9: Verify focused tests, integration and builds**

```powershell
npx vitest run packages/agent-core/src/canvas-run-agent-analysis.test.ts packages/agent-core/src/workflow-compiler.test.ts apps/api/src/canvas-run-agent-analysis-service.test.ts
npm run test:canvas-run-postgres-integration
npm run test:canvas-run-local-e2e
npm run verify:agent-runtime-architecture-contract
npm run verify:canvas-workflow-capabilities-contract
npm run type-check
npm run build
```

- [ ] **Step 10: Run real multi-branch AI supervision verification**

Use a disposable workflow with two independent image-generation branches, a candidate/convergence step and a downstream image operation. Confirm the real Agent analysis identifies the branches, the deterministic validator approves only valid concurrency, two upstream tasks overlap in time, convergence waits, Canvas shows live states and final artifacts reach downstream nodes.

- [ ] **Step 11: Run real failure-and-recovery variation**

Trigger one Provider/model failure in a separate disposable run. Confirm the failed node is visible, unaffected completed branch remains completed, normalized error is direct, recovery policy is audited and the assistant can analyze the failure.

- [ ] **Step 12: Record and commit Task 7**

```powershell
git commit -m "feat(agent): analyze and schedule supervised workflows"
```

### Task 8: End-to-end Governance And Real AI Acceptance

**Interfaces:**
- Consumes: completed Tasks 1-7.
- Produces: requirement-by-requirement evidence for frontend assistant, backend assistant, supervision and RH standard models.

- [ ] **Step 1: Configure isolated Gray-target draft versions without publishing Production**

Create or reuse approved draft versions for frontend assistant, backend assistant and supervision planner. Record only IDs/versions and display names, never secrets. Do not publish to Gray while the release pause is active.

- [ ] **Step 2: Verify frontend assistant real behavior**

In an authenticated Canvas, ask about the selected workflow, the generated execution plan and a real failure. Confirm it uses current workflow/run evidence and does not advise the retired AI hosting node.

- [ ] **Step 3: Verify backend assistant real behavior**

In Admin, ask for a task/provider diagnosis. Confirm the backend assistant uses its separately selected Agent/model configuration and can access allowed task/audit context while the frontend assistant cannot.

- [ ] **Step 4: Verify supervision configuration changes affect only new runs**

Create a run, change a draft/published test configuration in the authorized environment, and confirm the existing run keeps its frozen snapshot while the next run uses the new version. Restore the authorized environment configuration after the test.

- [ ] **Step 5: Verify all requested Admin visuals at both PC viewports**

Capture model catalog, task list, channel health, AI Assistant governance and AI Supervision governance at `1920x1080` and `2560x1440`. Check text fit, Provider/model boundaries, opaque backgrounds, no overlaps and no mobile-specific regressions introduced.

- [ ] **Step 6: Record real-model evidence**

Create one validation log that links the RH image, RH video, frontend assistant, backend assistant, multi-branch supervision and failed-run analysis evidence. Include task/run IDs, safe timestamps, statuses and materialized artifact paths only.

- [ ] **Step 7: Review and commit acceptance records**

```powershell
git commit -m "test(ai): record real supervision and assistant acceptance"
```

### Task 9: Full Harness, Completion Audit And Gray Approval Gate

**Interfaces:**
- Consumes: all implementation commits and validation logs.
- Produces: clean local release candidate and an explicit stop before Gray deployment.

- [ ] **Step 1: Run focused contracts again**

```powershell
npm run verify:admin-task-panel-contract
npm run verify:admin-provider-rail-layout
npm run verify:channel-health-contract
npm run verify:admin-view-model-contract
npm run verify:admin-assistant-settings-save-contract
npm run verify:agent-governance-contract
npm run verify:provider-generation-task-service
npm run verify:provider-generation-worker
npm run verify:runninghub-standard-model-contract
npm run verify:canvas-supervision-diagnostic-contract
npm run verify:canvas-assistant-chat
```

- [ ] **Step 2: Run workspace and project gates**

```powershell
npm run codegraph:sync
npm run type-check
npm run build
npm run harness:verify:project
npm run harness:verify:workspace
npm run verify:file-hotspot-budgets
npm run verify:hotspot-watchlist-contract
npm run verify:dependency-security-baseline
```

- [ ] **Step 3: Run full relevant test suite**

```powershell
npm test
npm run test:canvas-run-postgres-integration
npm run test:canvas-run-local-e2e
```

- [ ] **Step 4: Perform the completion audit**

For every requirement in the design, point to code, test, rendered behavior and real-run evidence. Treat missing or indirect evidence as incomplete. Confirm Production was untouched and no secret/runtime artifact is staged.

- [ ] **Step 5: Run staged safety checks and commit final documentation**

```powershell
npm run verify:no-runtime-artifacts-staged
npm run verify:staged-source-size-guard
npm run verify:hotspot-doc-sync-staged
git diff --check
git commit -m "docs(ai): complete provider and supervision v2 evidence"
```

- [ ] **Step 6: Stop at the Gray deployment gate**

Do not run release preparation or deployment. Report the local commit, test matrix, real-model evidence and remaining risks to the user. Wait for explicit Gray deployment approval.

- [ ] **Step 7: After explicit approval only, prepare the next patch Gray release**

Increment only the patch version according to project policy, prepare/deploy/verify Gray, repeat authenticated real behavior and both PC viewport checks, update release/validation records, then stop. Production remains untouched.

## Completion Evidence

Completion requires all of the following:

- Admin tasks show Provider/model names and preserve historical readability.
- The model catalog Provider rail no longer displays protocol badges.
- Admin channel health has clear Provider/model boundaries at both PC viewports.
- `Provider 与模型` no longer owns assistant governance.
- Frontend and backend assistants have separate configurable Agent/model/policy state.
- AI supervision governance owns planner, parallelism, quality, recovery and approvals.
- RunningHub generic Provider image and video requests succeed with materialized outputs.
- Agent analysis is visible, validated and auditable; deterministic execution remains authoritative.
- A real multi-branch workflow demonstrates actual concurrent upstream execution and correct convergence.
- Canvas supervision errors are direct and actionable.
- The real Canvas assistant consumes a real failed-run diagnostic and provides evidence-based analysis.
- Focused tests, full relevant tests, type-check, builds, Harness, CodeGraph and diff checks pass.
- No GitHub push occurred, Gray was not deployed without explicit approval, and Production was untouched.

## Self-Review

- Spec coverage: all six requested changes plus error clarity, assistant error context, real AI tests and per-stage checks map to Tasks 2-8.
- Placeholder scan: no TBD/TODO/implement-later placeholders remain.
- Type consistency: task identity, RH execution mode, Agent analysis, execution layers and failure diagnostic names match the approved design.
- Authority check: internal IDs, deterministic compiler, Worker scheduler, artifact store and version publication remain authoritative in their domains.
- Release check: the plan stops before Gray deployment and forbids Production/GitHub changes.
