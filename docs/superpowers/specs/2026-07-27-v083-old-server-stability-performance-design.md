# v0.8.3 Old-Server Stability And Performance Design

**Status:** Proposed for user review

**Evidence:** `../../records/architecture/2026-07-27-v083-old-server-stability-performance-audit.md`
**Release boundary:** old server only, product version fixed at `0.8.3`

## 1. Outcome

This design turns the existing `0.8.3` objective into six independently releasable sub-builds. It first prevents duplicate Provider execution and accidental deployment to the new server, then isolates frontend crashes, establishes measurable loading/rendering baselines, reduces Canvas update amplification, and continues hotspot decomposition only where it improves runtime stability or testability.

Success means:

- output recovery cannot enter a Provider adapter;
- Agent state is verified before a release is promoted;
- release tooling cannot silently target `43.131.246.222` during this objective;
- one broken node, preview, or lazy chunk does not replace the full Canvas with the legacy penguin fallback;
- loading and 50/100/200-node behavior have repeatable measurements and enforced budgets;
- high-frequency Canvas changes update the smallest possible node/edge set;
- every sub-build is reversible and uses the same Gray archive for Production;
- historical releases remain untouched.

## 2. Chosen Approach

Use layered stabilization, not frontend-first patching and not a repository-wide rewrite.

Rejected alternatives:

1. **Frontend-first:** improves the visible crash page quickly but leaves duplicate billing and target-selection risk unresolved.
2. **Big-bang architecture rewrite:** may reduce file sizes faster but combines state, persistence, rendering, Provider and deployment risk into one rollback unit.

The chosen sequence is `r1` release safety, `r2` crash isolation, `r3` measured loading, `r4` Canvas updates, `r5` node/CSS boundaries, and `r6` API/Worker orchestration seams.

## 3. Global Invariants

- Root `package.json` version is exactly `0.8.3` for every sub-build.
- Release IDs carry the sequence (`r1`, `r2`, ...); Production promotion does not increment the product version.
- Deployment target is exactly `ubuntu@101.33.75.38:728`.
- Gray and Production keep separate roots, services, env files, ports, public URLs and databases.
- The new server and `zezhen.online` targets are not read, written, restarted or deployed by this objective.
- No retention apply and no release-directory deletion.
- No secret, signed URL, database URL or key content enters logs, Git or documents.
- Current Canvas ownership, revision, persistence, task and Provider protocol invariants remain unchanged unless a separately approved ADR changes them.
- Existing dirty output-recovery changes are preserved and completed; no unrelated user changes are absorbed into a commit.

## 4. Release Architecture

### 4.1 Explicit old-server target

Add a non-secret deployment target profile owned by release tooling. The profile contains the old host, port, roots, service names, env-file paths, status URLs and expected database names for Gray and Production.

Every deploy/verify invocation in this objective must select `--target-profile=old-server`. A preflight verifier compares the resolved target against the profile and exits before archive upload if any field differs. Passing only `--env=gray` or `--env=production` is insufficient because the canonical environment file currently points to the new server.

The verifier returns a sanitized target summary:

```ts
interface ReleaseTargetFingerprint {
  profile: 'old-server';
  environment: 'gray' | 'production';
  host: '101.33.75.38';
  port: 728;
  remoteRoot: string;
  serviceName: string;
  workerServiceName: string;
  internalStatusUrl: string;
  publicStatusUrl: string;
  expectedDatabaseName: string;
}
```

The SSH key path is accepted separately and is never part of the fingerprint.

### 4.2 Promotion

Gray creates the archive and SHA-256. Production accepts that existing archive and recorded SHA only. Packaging is never repeated between environments. Release records contain the preflight fingerprint, archive SHA, previous current link, verification results and an explicit `retentionApplyRun: false` statement.

## 5. r1: Generation Recovery And Agent Gate

### 5.1 Worker operation boundary

One pure resolver decides task operation before any Provider dispatch:

```ts
type WorkerTaskOperation = 'provider_execution' | 'output_recovery';

function resolveWorkerTaskOperation(task: Pick<TaskRow, 'payload' | 'result'>): WorkerTaskOperation;
```

`output_recovery` wins if either trusted persisted marker equals `output_only`. Admin writes the marker to both payload and result during the compatibility period. Only `provider_execution` may call the Provider execution function.

The Gray acceptance fixture proves unchanged task ID, zero Provider submit delta, zero cost-item delta, readable artifact and terminal `succeeded` state.

### 5.2 Agent release gate

A read-only verifier checks:

- all eight bootstrap definitions;
- required publications for assistant, admin assistant and supervision;
- required route publications with at least one `text_chat` candidate;
- explicit environment runtime controls;
- status environment matches the requested target;
- frontend and admin canaries return `mode=agent`, not fallback.

The verifier never bootstraps, publishes or changes controls. Missing state produces stable failure codes and blocks promotion.

## 6. r2: Crash Isolation And Legacy Fallback Removal

### 6.1 Diagnostic envelope

Web and Admin use a client-safe diagnostic envelope:

```ts
interface UiFailureDiagnostic {
  id: string;
  scope: 'app-shell' | 'workspace' | 'node-renderer' | 'lazy-chunk' | 'media-preview' | 'admin-route';
  code: string;
  occurredAt: string;
  recoverable: boolean;
  userMessage: string;
}
```

Raw component stacks and sensitive URLs go only to development console output or an approved telemetry sink. Production UI displays the diagnostic ID and safe actions.

### 6.2 Boundary hierarchy

1. App-shell boundary preserves login/navigation recovery.
2. Workspace boundary protects Canvas loading and persistence.
3. A node-type wrapper protects every registered node renderer and renders a compact failed-node shell in the same node footprint.
4. Media preview boundaries isolate decode/load failure.
5. Lazy-chunk recovery reloads at most once per recovery ID; a second failure shows a stable recovery panel.
6. Admin keeps route `resetKey` behavior and adopts the same diagnostic fields.

Resetting a node boundary never deletes node data, edges or the current Canvas. Full reload is secondary and warns when local changes are pending.

### 6.3 Legacy inventory

Classify every `T8-penguin`, `penguin:*` and visible penguin reference as:

- `visible-copy`: replace in r2;
- `compatibility-contract`: retain behind named compatibility constants and tests;
- `dead-code`: remove only when CodeGraph and behavior tests prove no consumer.

Event names, schemas and hidden historic node types are compatibility contracts until a migration supports both old and new forms.

## 7. r3: Loading And Performance Evidence

### 7.1 Scenarios

Create deterministic local fixtures for authenticated shell, empty Canvas, and 50/100/200-node Canvases. The node mix includes text, image, video metadata, output, grouped nodes and a controlled number of runtime projections without external Provider calls.

Measure:

- entry and Canvas chunk request timing;
- time to usable workspace;
- first stable Canvas render;
- React commits and node render counts;
- long tasks and frame-rate distribution during a five-second drag;
- `ResizeObserver` and `updateNodeInternals` calls;
- polling requests;
- JS heap trend before and after media nodes unmount.

Store machine-readable JSON outside Git runtime artifacts and commit only summarized baselines to validation records.

### 7.2 Loading policy

Replace module-evaluation `preloadWorkspaceShell` with staged loading:

- authentication UI loads without Canvas/RHTools prefetch;
- after successful authentication, schedule Sidebar and Canvas prefetch using idle time or explicit navigation intent;
- node chunks load by registered type when a Canvas snapshot is known;
- heavyweight MediaPipe and editor chunks remain interaction-driven;
- a failed prefetch never blocks navigation.

Admin keeps domain-level lazy routes; the baseline identifies shared code incorrectly retained in its 453.91 kB entry before further splitting.

### 7.3 Budgets

Release Harness records and compares entry, Canvas, Admin, CSS and selected heavyweight node chunks. A regression requires an explicit validation-record explanation; silent growth fails the gate.

## 8. r4: Canvas Update Model

The goal is smaller update scope, not a replacement state framework.

- Preserve existing React Flow and Canvas persistence authority.
- Introduce one mutation interface for node-data, selection, layout and runtime projection changes.
- Node renderers call the mutation interface rather than arbitrary full-graph `setNodes(map)` operations.
- Preserve object identity for untouched nodes and edges.
- Coalesce drag, resize and runtime projection updates at most once per animation frame where behavior permits.
- Replace whole-graph reads with explicit inputs or narrow selectors for the node and upstream IDs actually needed.
- Evaluate `onlyRenderVisibleElements` against grouped nodes, Workflow Region layers and off-screen execution before enabling it; it is not enabled solely because it exists.
- Keep persistence snapshots and revision conflict handling outside transient render projections.

Every migrated mutation has behavior tests proving node data, edges, selection, undo snapshot and persistence output remain equivalent.

## 9. r5: Node And CSS Boundaries

Split one responsibility at a time while preserving public node props:

- PoseMaster: field schema, preview sections, runtime actions;
- ToolboxParam: parameter sections, material bindings, preview helpers;
- Image/DrawingBoard: runtime actions, view sections and persistence helpers;
- shared node chrome: resize, error, status and preview shells;
- CSS: error recovery, Canvas shell, node chrome and Admin route shell.

Each split must lower the original hotspot or its change-coupling score and add behavior/render coverage. Moving code without a runtime or testability benefit does not pass review.

## 10. r6: API And Worker Orchestration Seams

- Worker owns one operation dispatch table; operation handlers own Provider execution, output recovery and deterministic Canvas steps.
- API extracts provider key-pool/import-model normalization residue through existing handler/repository patterns.
- Pure normalization moves only when both API and Worker can share the exact contract.
- No Express migration, persistence rewrite or Provider protocol redesign is included.
- Source-string verifiers remain only for structural boundaries; behavior moves to Vitest/integration tests.

## 11. Failure And Rollback Behavior

- A local batch that fails remains uncommitted or is reverted as its own commit.
- Gray failure restores the recorded Gray `current` link and restarts only Gray API/Worker.
- Production failure restores the recorded Production `current` link and restarts only Production API/Worker.
- No irreversible schema migration is planned. Any newly discovered schema need stops that batch for a separate expand/contract design.
- Frontend loading, boundary and batching changes have isolated commits and kill switches where runtime risk is non-trivial.
- Failed releases remain on disk for audit.

## 12. Test And Acceptance Model

Every batch runs focused RED/GREEN tests, workspace type-check, affected builds, relevant contracts, hotspot governance, project/workspace/release Harness, `git diff --check`, CodeGraph sync and clean-worktree release gates.

Gray adds runtime status, permission readiness, homepage/Admin HTTP, browser console, 1920×1080 PC behavior and batch-specific acceptance. Production uses the identical archive and repeats non-destructive runtime checks. Production never creates a destructive recovery fixture; it relies on deployed-contract verification plus Gray fixture evidence.

Performance acceptance compares the same fixture, viewport, browser and measurement procedure to the committed baseline. A result is accepted only when behavior remains correct and the target metric improves or stays within its declared budget.

## 13. Documentation And Commit Boundaries

Each sub-build updates:

- the affected `docs/systems/` package;
- hotspot ledger when a watched file changes;
- validation and release records;
- `ops/current/release-state.json` and generated projections only after actual deployment;
- the current release index and daily log.

Commits are scoped as plan/spec, source behavior, Gray evidence and Production evidence. Generated build output, credentials and temporary performance JSON are never staged.
