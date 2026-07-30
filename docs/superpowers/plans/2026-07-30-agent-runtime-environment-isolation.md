# Agent Runtime Environment Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Agent governance and AI supervision in one deployment environment from reading, writing, or reporting another environment’s data, while making the Cookie-based readiness probe explicitly optional.

**Architecture:** The API receives its immutable runtime environment from server bootstrap and applies it to every Agent governance read and write. The Admin UI presents only that server-provided environment. The release verifier keeps its static contract but can report a deliberate skipped live probe without requiring a Cookie.

**Tech Stack:** TypeScript, Node.js, Vitest, React, existing release scripts.

## Global Constraints

- Gray and Production remain separate PostgreSQL databases and separate Redis queue prefixes.
- Browser input must never select an Agent governance environment.
- Production is enabled only after a release verification; no Agent Cookie or secret is printed.
- Production starts with `observe`: Agent and Canvas Run on; quality evaluation and automatic recovery off.
- Preserve historical records; no database deletion or cross-environment data copy.

---

### Task 1: Scope Agent governance routes to the server environment

**Files:**
- Modify: `apps/api/src/admin-agent-governance-routes.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/admin-agent-governance-routes.test.ts`

**Interfaces:**
- Consumes: `currentEnvironment: "gray" | "production" | "local"` from server bootstrap.
- Produces: overview payload `{ environment, metrics, controls: [currentControl] }` and `AGENT_RUNTIME_ENVIRONMENT_SCOPE_FORBIDDEN` for cross-environment writes.

- [ ] **Step 1: Write failing API tests**

```ts
expect(payload).toEqual({ environment: "gray", metrics: { activeAgentRuns: 2 }, controls: [{ environment: "gray" }] });
await expect(crossEnvironmentPublish()).rejects.toThrow("AGENT_RUNTIME_ENVIRONMENT_SCOPE_FORBIDDEN");
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- apps/api/src/admin-agent-governance-routes.test.ts`

Expected: the old route calls `readRuntimeControls()` and accepts a Production publish from Gray.

- [ ] **Step 3: Implement server-owned environment scoping**

```ts
const runtimeEnvironment = deps.currentEnvironment;
assertGovernanceEnvironment(environment, runtimeEnvironment, deps.invalidRequest);
controls: [await deps.repository.readRuntimeControl(runtimeEnvironment)]
```

Pass `environment === "production" ? "production" : environment === "gray" ? "gray" : "local"` from `server.ts`; reject cross-environment publication and control writes before repository mutation.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- apps/api/src/admin-agent-governance-routes.test.ts`

Expected: PASS.

### Task 2: Remove the false cross-environment Admin experience

**Files:**
- Modify: `apps/admin/src/admin-agent-governance-api.ts`
- Modify: `apps/admin/src/admin-agent-governance-workspace.tsx`
- Modify: `apps/admin/src/admin-assistant-governance-workspace.tsx`
- Modify: `apps/admin/src/admin-agent-governance-workspace.test.ts`

**Interfaces:**
- Consumes: `AgentOverview.environment` supplied by the scoped API.
- Produces: only the current service environment label; no writable or readable local environment switch.

- [ ] **Step 1: Write failing view-model tests**

```ts
expect(environmentLabel({ environment: "gray" })).toBe("Gray");
expect(environmentLabel({ environment: "production" })).toBe("Production");
```

- [ ] **Step 2: Run the focused Admin tests and verify failure**

Run: `npm test -- apps/admin/src/admin-agent-governance-workspace.test.ts apps/admin/src/admin-assistant-governance-view-model.test.ts`

Expected: FAIL until the current-environment-only helper and view wiring exist.

- [ ] **Step 3: Implement the single-environment presentation**

```ts
export interface AgentOverview { environment: AgentEnvironment; metrics: Record<string, number>; controls: AgentRuntimeControl[]; }
```

Remove the Gray / Production switch in the assistant governance header. The automation workspace labels its received `overview.environment`; it renders only the server-provided control array.

- [ ] **Step 4: Run the focused Admin tests and verify pass**

Run: `npm test -- apps/admin/src/admin-agent-governance-workspace.test.ts apps/admin/src/admin-assistant-governance-view-model.test.ts`

Expected: PASS.

### Task 3: Make live Agent readiness intentionally optional

**Files:**
- Modify: `scripts/verify-agent-environment-readiness.mjs`
- Modify: `scripts/verify-agent-environment-readiness-contract.mjs`
- Modify: `docs/systems/agent-runtime/README.md`
- Modify: `docs/systems/observability-and-ops/release-gates.md`

**Interfaces:**
- Consumes: `--readiness=check|skip` and optional `--admin-cookie-env`.
- Produces: `{ liveReadiness: "checked" | "skipped" }`; `check` still requires Cookie, `skip` never reads it.

- [ ] **Step 1: Extend the static verifier contract first**

```js
assert.match(verifier, /readiness=skip/, "readiness skip mode missing");
assert.match(verifier, /liveReadiness/, "readiness result must be explicit");
```

- [ ] **Step 2: Run the contract and observe failure**

Run: `npm run verify:agent-environment-readiness-contract`

Expected: FAIL until the verifier supports the explicit mode and result.

- [ ] **Step 3: Implement skip/check behavior**

```js
const readiness = String(firstArg(args.readiness) || "check").trim();
if (readiness === "skip") printJson({ ok: true, liveReadiness: "skipped", reason: "explicit_release_choice" });
```

Reject any value other than `check` or `skip`; retain all existing definition, publication and optional billed-canary checks for `check`.

- [ ] **Step 4: Run contract and dry-run verification**

Run: `npm run verify:agent-environment-readiness-contract; npm run verify:agent-environment-readiness -- --target-profile=old-server --env=gray --readiness=skip`

Expected: both commands exit `0`, with `liveReadiness: "skipped"` in the second output.

### Task 4: Verify, document and prepare controlled Production enablement

**Files:**
- Modify: `docs/logbooks/daily/2026/2026-07/2026-07-30.md`
- Modify: `docs/systems/agent-runtime/README.md`

**Interfaces:**
- Consumes: verified code release and server feature-gate states.
- Produces: an auditable rollout checklist for `XINGHUAN_CANVAS_RUNS_ENABLED=true` and `XINGHUAN_CANVAS_RUN_WORKER_ENABLED=true` on Production.

- [ ] **Step 1: Run code verification**

Run: `npm test -- apps/api/src/admin-agent-governance-routes.test.ts apps/admin/src/admin-agent-governance-workspace.test.ts apps/admin/src/admin-assistant-governance-view-model.test.ts && npm run verify:agent-environment-readiness-contract && npm --workspace @xinghuan/admin run build && git diff --check`

Expected: all commands exit `0`.

- [ ] **Step 2: Record Production rollout prerequisites**

Document that the code release must be deployed before configuration change; verify database target, API and Worker status; then set both Canvas Run feature gates, restart both services, set current Production control to `observe`, and validate the panel without a billed run.

- [ ] **Step 3: Commit scoped source and documentation**

```bash
git add apps/api/src/admin-agent-governance-routes.ts apps/api/src/server.ts apps/api/src/admin-agent-governance-routes.test.ts apps/admin/src/admin-agent-governance-api.ts apps/admin/src/admin-agent-governance-workspace.tsx apps/admin/src/admin-assistant-governance-workspace.tsx apps/admin/src/admin-agent-governance-workspace.test.ts apps/admin/src/admin-assistant-governance-view-model.test.ts scripts/verify-agent-environment-readiness.mjs scripts/verify-agent-environment-readiness-contract.mjs docs/superpowers/specs/2026-07-30-agent-runtime-environment-isolation-design.md docs/superpowers/plans/2026-07-30-agent-runtime-environment-isolation.md docs/systems/agent-runtime/README.md docs/systems/observability-and-ops/release-gates.md docs/logbooks/daily/2026/2026-07/2026-07-30.md
git commit -m "fix(agent): isolate runtime environment controls"
```

## Self-review

- Scope isolation is covered by Task 1; UI isolation by Task 2; optional readiness by Task 3; production activation remains an explicitly verified operational task in Task 4.
- No task deletes historical rows, copies Agent records between environments, or makes a hidden cross-environment request.
- Every introduced payload name (`environment`, `controls`, `liveReadiness`) is defined before its use.
