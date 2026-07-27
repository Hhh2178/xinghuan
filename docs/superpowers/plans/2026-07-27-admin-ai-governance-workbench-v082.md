# Admin AI Governance Workbench v0.8.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Admin AI assistant, supervision and activity surfaces into a coherent Starlight governance workbench, prove version `0.8.2` locally and in Gray, promote the same artifact to Production, and push the verified commits to GitHub.

**Architecture:** Existing Agent definitions, route pools, controls, Runs, approvals, recovery decisions and audit records remain authoritative. Focused pure view-model modules derive readiness, effective supervision modes and correlated activity cases; React workspaces render those projections and reuse the existing versioned editors and mutation APIs. Release promotion uses the repository release harness and canonical release state, with Gray evidence gating Production and GitHub updates.

**Tech Stack:** React 19, TypeScript, Vitest, Lucide React, existing Admin API client, Node verification scripts, CSS Starlight tokens, project Harness and release scripts.

## Global Constraints

- Target product version is exactly `0.8.2`.
- PC desktop only; formal visual acceptance is exactly `1920x1080`.
- Preserve deterministic Workflow execution and Workflow Region scope.
- Do not merge Assistant Conversation, Agent Run, Workflow Run, Approval, Recovery Decision or Audit Record authority.
- Do not expose secrets, unrestricted prompts, signed URLs or raw payloads in Admin projections, screenshots or logs.
- Chrome is preferred for Gray verification; Edge or the Codex internal browser is allowed if Safe Browsing blocks Chrome. Browser substitution does not resolve the classification.
- Gray must pass every functional, visual and runtime gate before Production promotion.
- Production must receive the exact Gray-tested `0.8.2` artifact and must retain a valid rollback release.
- Preserve the existing untracked `docs/logbooks/daily/2026/2026-07-27.md` and integrate it only when the documentation task explicitly updates it.
- Never use force push or destructive release cleanup.

## File Structure

### New focused modules

- `apps/admin/src/admin-assistant-lifecycle.ts`: readiness, lifecycle step and environment publication derivation.
- `apps/admin/src/admin-assistant-lifecycle.test.ts`: assistant readiness and lifecycle tests.
- `apps/admin/src/admin-supervision-mode.ts`: maps runtime controls to understandable supervision modes and summaries.
- `apps/admin/src/admin-supervision-mode.test.ts`: supervision-mode and preset tests.
- `apps/admin/src/admin-agent-activity-view-model.ts`: correlates Runs, approvals, recovery decisions and audit records into ordered cases.
- `apps/admin/src/admin-agent-activity-view-model.test.ts`: activity correlation and ordering tests.
- `apps/admin/src/admin-agent-activity-workspace.tsx`: exception queue, correlated details and approval commands.
- `scripts/verify-admin-ai-governance-workbench-v082.mjs`: source-level contract for the new boundaries and release-critical copy.

### Existing modules to modify

- `apps/admin/src/admin-assistant-governance-workspace.tsx`: guided assistant lifecycle and enabled publication controls.
- `apps/admin/src/admin-agent-role-configuration-editor.tsx`: contextual publication labels and confirmation behavior.
- `apps/admin/src/admin-agent-pool-editor.tsx`: contextual publication labels, simulation result and confirmation behavior.
- `apps/admin/src/admin-agent-governance-api.ts`: activity workspace data loading and any safe type additions.
- `apps/admin/src/admin-agent-governance-workspace.tsx`: supervision summary/mode and delegated activity workspace.
- `apps/admin/src/admin-supervision-workspace-nav.tsx`: compact task labels aligned with the redesigned workbench.
- `apps/admin/src/styles.css`: Starlight assistant, supervision and activity layouts.
- `scripts/verify-agent-governance-contract.mjs`: update the old assistant read-only assertion to the approved publication lifecycle.
- `package.json`: version `0.8.2` and the new verification script.
- `package-lock.json`: synchronized version metadata.
- `docs/systems/admin/README.md`: user-facing workspace behavior.
- `docs/systems/agent-runtime/README.md`: effective modes and publication behavior.
- `docs/logbooks/daily/2026/2026-07-27.md`: append implementation and verification evidence without overwriting existing content.
- Release, validation and `ops/current` files: update only during actual Gray and Production deployment.

---

### Task 1: Assistant Lifecycle View Model

**Files:**
- Create: `apps/admin/src/admin-assistant-lifecycle.ts`
- Create: `apps/admin/src/admin-assistant-lifecycle.test.ts`

**Interfaces:**
- Consumes: `AgentDefinition`, `LlmRoutePool`, `AgentEnvironment` from `admin-agent-governance-api.ts`.
- Produces: `deriveAssistantLifecycle(input): AssistantLifecycle`, `AssistantLifecycleStepId`, and `AssistantReadinessIssue`.

- [ ] **Step 1: Write failing readiness tests**

Cover: missing definition, disabled surface, missing approved Agent version, missing approved route version, Gray-only publication, fully published Production, and real verification required after publication.

```ts
expect(deriveAssistantLifecycle({
  enabled: true,
  environment: "production",
  definition,
  pools: [poolWithoutProductionPublication],
  lastVerification: null,
}).issues.map((issue) => issue.code)).toContain("route_not_published");
```

- [ ] **Step 2: Run the test and confirm the red state**

Run: `npm exec vitest run -- apps/admin/src/admin-assistant-lifecycle.test.ts`

Expected: FAIL because `admin-assistant-lifecycle.ts` does not exist.

- [ ] **Step 3: Implement immutable lifecycle derivation**

Define stable steps `capability`, `routing`, `publication`, `verification`; calculate the first incomplete step; return plain-Chinese conclusion, Agent/route version labels and issues without mutating API data.

- [ ] **Step 4: Run focused tests**

Run: `npm exec vitest run -- apps/admin/src/admin-assistant-lifecycle.test.ts apps/admin/src/admin-assistant-governance-view-model.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the lifecycle module**

```powershell
git add apps/admin/src/admin-assistant-lifecycle.ts apps/admin/src/admin-assistant-lifecycle.test.ts
git commit -m "feat(admin): derive assistant publication readiness"
```

### Task 2: Guided Assistant Governance Workspace

**Files:**
- Modify: `apps/admin/src/admin-assistant-governance-workspace.tsx`
- Modify: `apps/admin/src/admin-agent-role-configuration-editor.tsx`
- Modify: `apps/admin/src/admin-agent-pool-editor.tsx`
- Modify: `scripts/verify-agent-governance-contract.mjs`
- Create: `scripts/verify-admin-ai-governance-workbench-v082.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `deriveAssistantLifecycle`, current surface settings, definitions, route pools and catalog models.
- Produces: a four-step assistant workbench that can review, approve, publish and roll back Agent and route versions.

- [ ] **Step 1: Add failing source-contract assertions**

Assert the assistant workspace renders `助手能力`, `模型路由`, `审核发布`, `生效验证`, passes `publicationMode="manage"`, contains Production impact copy, and no longer describes publication as read-only.

- [ ] **Step 2: Run contracts and confirm failure**

Run: `node scripts/verify-admin-ai-governance-workbench-v082.mjs && node scripts/verify-agent-governance-contract.mjs`

Expected: FAIL on the old read-only assistant publication contract.

- [ ] **Step 3: Implement the guided lifecycle**

Render the readiness band, frontend/backend segment, stable step navigation and one active editor. Keep surface settings separate from Agent and route authority. Set both reusable editors to managed publication within this authorized workspace.

- [ ] **Step 4: Add confirmation and readable simulation results**

Production publish and rollback must confirm their new-Run impact. Route simulation must show selected model identity and rejection summary instead of only an entry ID.

- [ ] **Step 5: Run focused contracts and tests**

Run: `npm exec vitest run -- apps/admin/src/admin-assistant-lifecycle.test.ts apps/admin/src/admin-assistant-governance-view-model.test.ts && node scripts/verify-admin-ai-governance-workbench-v082.mjs && node scripts/verify-agent-governance-contract.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the assistant workbench**

```powershell
git add apps/admin/src/admin-assistant-governance-workspace.tsx apps/admin/src/admin-agent-role-configuration-editor.tsx apps/admin/src/admin-agent-pool-editor.tsx scripts/verify-admin-ai-governance-workbench-v082.mjs scripts/verify-agent-governance-contract.mjs package.json
git commit -m "feat(admin): rebuild assistant governance lifecycle"
```

### Task 3: Effective Supervision Modes

**Files:**
- Create: `apps/admin/src/admin-supervision-mode.ts`
- Create: `apps/admin/src/admin-supervision-mode.test.ts`
- Modify: `apps/admin/src/admin-agent-governance-workspace.tsx`
- Modify: `apps/admin/src/admin-supervision-workspace-nav.tsx`
- Modify: `apps/admin/src/admin-supervision-workspace-nav.test.ts`

**Interfaces:**
- Consumes: `AgentRuntimeControl`.
- Produces: `deriveSupervisionMode(control): SupervisionModeSummary` and `applySupervisionPreset(control, mode): AgentRuntimeControl` for `observe`, `controlled`, `automatic`, and derived `custom`.

- [ ] **Step 1: Write failing mode tests**

Test all three presets, custom combinations, revision preservation and the rule that enabling automatic recovery implies Agent and Canvas Run enablement.

- [ ] **Step 2: Run the mode tests and confirm failure**

Run: `npm exec vitest run -- apps/admin/src/admin-supervision-mode.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure preset mapper**

Do not introduce new backend authority. Map the existing booleans to mode labels and explicit summaries; leave quality evaluation independently visible in the advanced policy summary.

- [ ] **Step 4: Rebuild the supervision overview/environment surface**

Add Gray and Production rows, effective-mode selection, safety boundary, readiness checks, policy summaries and the existing dirty-state guard. Keep planner, routing, quality and recovery editors available as focused advanced workspaces.

- [ ] **Step 5: Run supervision tests and governance contract**

Run: `npm exec vitest run -- apps/admin/src/admin-supervision-mode.test.ts apps/admin/src/admin-supervision-workspace-nav.test.ts && node scripts/verify-admin-ai-governance-workbench-v082.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the supervision workbench**

```powershell
git add apps/admin/src/admin-supervision-mode.ts apps/admin/src/admin-supervision-mode.test.ts apps/admin/src/admin-agent-governance-workspace.tsx apps/admin/src/admin-supervision-workspace-nav.tsx apps/admin/src/admin-supervision-workspace-nav.test.ts
git commit -m "feat(admin): clarify effective AI supervision modes"
```

### Task 4: Correlated Activity And Approval Workbench

**Files:**
- Create: `apps/admin/src/admin-agent-activity-view-model.ts`
- Create: `apps/admin/src/admin-agent-activity-view-model.test.ts`
- Create: `apps/admin/src/admin-agent-activity-workspace.tsx`
- Modify: `apps/admin/src/admin-agent-governance-api.ts`
- Modify: `apps/admin/src/admin-agent-governance-workspace.tsx`

**Interfaces:**
- Consumes: `AgentRunsData`, `AgentApproval[]`, `RecoveryDecision[]`, `AgentAuditRecord[]`, and catalog `ModelRecord[]`.
- Produces: `buildActivityCases(input): ActivityCase[]`, `ActivityCasePriority`, safe detail facts and explicit approval-impact descriptions.

- [ ] **Step 1: Write failing activity correlation tests**

Cover pending approval priority, failed Run priority, degraded/recovered cases, recovery-to-approval linkage, missing historical model fallback, immutable input arrays and deterministic time ordering.

- [ ] **Step 2: Run the activity tests and confirm failure**

Run: `npm exec vitest run -- apps/admin/src/admin-agent-activity-view-model.test.ts`

Expected: FAIL because the activity view model does not exist.

- [ ] **Step 3: Implement bounded client-side correlation**

Join only the already bounded API arrays by stable IDs. Build human-readable labels with safe ID fallbacks. Do not place raw action payloads, prompts or signed URLs in list items.

- [ ] **Step 4: Load recovery evidence in the activity workspace**

Extend `ActivityData` to include `adminAgentGovernanceApi.recovery()`. Keep the API repository unchanged unless measured payload size or snapshot inconsistency proves a bounded aggregate endpoint is necessary.

- [ ] **Step 5: Build exception queue and same-page detail**

Render metrics, status/environment/time filters, selectable cases, evidence timeline, approval impact and explicit approve/reject actions. Require an operator reason and preserve it after mutation failure.

- [ ] **Step 6: Run activity tests, contracts and Admin type check**

Run: `npm exec vitest run -- apps/admin/src/admin-agent-activity-view-model.test.ts && node scripts/verify-admin-ai-governance-workbench-v082.mjs && npm run type-check --workspace @xinghuan/admin`

Expected: PASS.

- [ ] **Step 7: Commit the activity workbench**

```powershell
git add apps/admin/src/admin-agent-activity-view-model.ts apps/admin/src/admin-agent-activity-view-model.test.ts apps/admin/src/admin-agent-activity-workspace.tsx apps/admin/src/admin-agent-governance-api.ts apps/admin/src/admin-agent-governance-workspace.tsx
git commit -m "feat(admin): correlate AI runs approvals and recovery"
```

### Task 5: Starlight Visual Integration And Documentation

**Files:**
- Modify: `apps/admin/src/styles.css`
- Modify: `docs/systems/admin/README.md`
- Modify: `docs/systems/agent-runtime/README.md`
- Modify: `docs/logbooks/daily/2026/2026-07-27.md`

**Interfaces:**
- Consumes: the class names introduced in Tasks 2-4 and existing `--starlight-*` tokens.
- Produces: a consistent `1920x1080` Admin workbench and canonical documentation.

- [ ] **Step 1: Add visual contract assertions**

Require Starlight gradient/grid use, lifecycle tracks, stable two-column work areas, activity selection states, drawer/dialog focus states and overflow ownership.

- [ ] **Step 2: Run the visual contract and confirm failure**

Run: `node scripts/verify-admin-ai-governance-workbench-v082.mjs`

Expected: FAIL on missing redesigned CSS selectors.

- [ ] **Step 3: Implement scoped Starlight styles**

Use existing tokens and gradients. Keep radii at 6px or below, reserve cards for repeated items and bounded tools, use stable tracks and scrolling, and ensure long names wrap or ellipsize without hiding commands.

- [ ] **Step 4: Update system documentation and append the daily log**

Document the guided publication lifecycle, effective supervision modes, correlated activity projection and security boundaries. Append to the existing daily file rather than replacing it.

- [ ] **Step 5: Run documentation and UI contracts**

Run: `node scripts/verify-admin-ai-governance-workbench-v082.mjs && npm run verify:visual-design-docs-contract && npm run verify:documentation-entry-contract && npm run verify:hotspot-watchlist-contract`

Expected: PASS.

- [ ] **Step 6: Commit visual and documentation changes**

```powershell
git add apps/admin/src/styles.css docs/systems/admin/README.md docs/systems/agent-runtime/README.md docs/logbooks/daily/2026/2026-07-27.md scripts/verify-admin-ai-governance-workbench-v082.mjs
git commit -m "style(admin): align AI governance with Starlight"
```

### Task 6: Version 0.8.2 And Local Acceptance

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: release-preparation files generated by repository scripts only when required.

**Interfaces:**
- Consumes: all implementation tasks.
- Produces: a locally verified `0.8.2` release candidate.

- [ ] **Step 1: Set and verify version metadata**

Update both package files to `0.8.2`; do not change major/minor or create a second Production version.

- [ ] **Step 2: Run focused tests and contracts**

Run all new Vitest files plus `verify-admin-ai-governance-workbench-v082`, `verify-agent-governance-contract`, `verify-admin-agent-runtime-model-loading`, and `verify-admin-assistant-settings-save-contract`.

- [ ] **Step 3: Run type checks, build and full tests**

Run: `npm run type-check && npm run build && npm run test`

Expected: all pass.

- [ ] **Step 4: Run project/workspace/release Harnesses**

Run: `npm run harness:verify:project && npm run harness:verify:workspace && npm run harness:verify:release`

Expected: all pass.

- [ ] **Step 5: Start the local application and perform 1920x1080 visual acceptance**

Use the repository-supported local server. Verify assistant, supervision and activity default/loading/empty/error/dirty/busy states, long names, advanced panels, approval confirmation, console errors, horizontal overflow and text overlap. Capture screenshots and inspect them before continuing.

- [ ] **Step 6: Commit the release candidate**

```powershell
git add package.json package-lock.json
git commit -m "release: prepare admin AI governance v0.8.2"
```

### Task 7: Gray Deployment And Authenticated Verification

**Files:**
- Create: `docs/logbooks/releases/gray/2026-07-27-admin-ai-governance-v082-*.md` using the actual release ID.
- Create or modify: `docs/logbooks/validations/2026-07-27-admin-ai-governance-v082-*.md`.
- Modify: `ops/current/release-state.json`, `ops/current/gray.md`, release indexes and required entrypoints.

**Interfaces:**
- Consumes: the locally accepted `0.8.2` source commit and the authorized new-server SSH target from the project runbook.
- Produces: a verified Gray release and complete evidence for the Production gate.

- [ ] **Step 1: Prepare the Gray artifact with the repository release script**

Generate one release ID, verify source commit/version and inspect the manifest. Do not print secrets.

- [ ] **Step 2: Deploy to Gray and verify runtime health**

Use the authorized SSH key and `ubuntu` account. Confirm API and Worker services, `/api/status`, version, environment, migrations and restart count.

- [ ] **Step 3: Run authenticated Gray functional tests**

Test both assistants, Gray Agent/route publication, route simulation, supervision mode persistence, one governed Workflow Run, activity correlation and one safe approval/recovery path.

- [ ] **Step 4: Run Gray visual acceptance at 1920x1080**

Use Chrome unless blocked; otherwise use Edge or the internal browser and record the browser. Inspect screenshots and console output.

- [ ] **Step 5: Record Gray evidence and run release gates**

Update Gray release state and logbooks, then run release-state consistency, release-logbook sync and release Harness checks.

- [ ] **Step 6: Commit Gray records**

Commit only after the deployed release and canonical records agree.

### Task 8: Production Promotion, Final Verification And GitHub Push

**Files:**
- Create: `docs/logbooks/releases/production/2026-07-27-admin-ai-governance-v082-*.md`.
- Modify: validation record with Production evidence.
- Modify: `ops/current/release-state.json`, `ops/current/production.md`, release indexes and required entrypoints.

**Interfaces:**
- Consumes: the exact Gray-tested artifact and passing Gray validation record.
- Produces: verified Production `0.8.2`, valid rollback state and synchronized GitHub branches.

- [ ] **Step 1: Recheck the Production gate**

Confirm no high-severity issue, exact artifact identity, current rollback release, database backup boundary and clean release worktree.

- [ ] **Step 2: Promote the same artifact to Production**

Do not rebuild or alter the package. Verify API, Worker, environment and version immediately after promotion.

- [ ] **Step 3: Run non-destructive Production smoke tests**

Verify Admin login, all three AI governance routes, published assistant readiness and one safe assistant request. Do not create a destructive recovery scenario in Production.

- [ ] **Step 4: Record Production evidence and canonical state**

Update Production release/validation records, release indexes and `ops/current` projections; run all staged release and consistency gates.

- [ ] **Step 5: Run retention dry-run and protected pruning only if required**

Protect current and rollback releases. Use only the repository retention script; inspect the dry run before any apply operation.

- [ ] **Step 6: Commit Production records and verify the final tree**

Run `git status --short`, `git log`, full release Harness and `git diff --check`. Preserve unrelated user changes.

- [ ] **Step 7: Push verified commits to GitHub without force**

Push `feature/canvas-agent-runtime`, then fast-forward GitHub `main` to the same verified commit only if its remote head is still an ancestor. Fetch and re-evaluate instead of forcing if the remote moved.

- [ ] **Step 8: Final report**

Report version, release IDs, source commit, browsers used, test totals, Gray/Production URLs, rollback IDs, GitHub branch heads and any residual Safe Browsing status.
