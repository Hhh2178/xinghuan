# Production Supervision And Parallel Group Runtime Design

## Status

Approved for implementation on 2026-08-07. This design extends the existing browser-driven manual group runtime and the accepted Workflow-scoped supervision boundary. It does not make browser-only nodes server-runnable and does not change Workflow Run authority.

## Problem

Production AI supervision is unavailable even though its database controls appear enabled. The Production API and Worker process gates are unset, so the runtime treats both features as disabled. The Admin experience compounds the issue by starting with a hardcoded fallback message and by counting historical or unpublished unhealthy LLM route rows as current routing failures.

Manual group execution has a separate correctness and capacity problem. One global `isRunning` flag permits only one active group, while completion calls global cancellation. The current topology helper silently appends cyclic or unresolved nodes in visual order, group membership is recalculated from live geometry, overlapping groups can claim the same node, external incoming dependencies are removed from the subgraph, and completion correlation relies on millisecond timestamps. These behaviors already permit intermittent ordering errors and would become unsafe if five-group concurrency were enabled without validation.

## Goals

- Restore AI supervision on the old server first and validate it before changing the new server.
- Permit at most five different manual group runs in one Canvas browser session.
- Execute independent topology branches inside each group concurrently.
- Limit the whole Canvas to at most ten actively executing nodes across all manual groups.
- Keep each dependency edge authoritative: a downstream node starts only after every required upstream node has succeeded.
- Reject invalid or ambiguous plans before any node is submitted.
- Isolate group completion and failure so one group cannot cancel another.
- Preserve existing server-side user, platform, Provider, capability, and RunningHub concurrency windows as the final execution limits.
- Produce deterministic tests for the previously intermittent topology failures.

## Non-goals

- Do not migrate every manual group run to Workflow Run in this change.
- Do not make legacy browser-only nodes executable by the Worker.
- Do not add automatic queuing for a sixth group request.
- Do not allow the AI supervisor to modify Canvas nodes or edges.
- Do not change Provider keys, secrets, billing rules, or Production data.
- Do not deploy to old and new servers at the same time.
- Do not add mobile or tablet behavior; visual acceptance remains PC `1920x1080` unless the user requests another viewport.

## Chosen Approach

Use a validated graph plan and a focused browser-side group runtime controller.

The alternatives were rejected for the following reasons:

- Patching only `topologicalSort()` would leave geometry membership races, duplicate ownership, global cancellation, timestamp correlation, and admission control unresolved.
- Moving all group execution to Workflow Run would exceed the scope because some executable Canvas nodes remain browser-only.

The selected design keeps manual execution in the browser but replaces the single serial list with explicit planning, node ownership, ready-layer scheduling, and bounded concurrency.

## AI Supervision Recovery

### Process and database gates

Before enabling old Production process gates, set Production runtime controls to observe mode:

- `agentEnabled=true`
- `canvasRunsEnabled=true`
- `qualityEvaluationEnabled=false`
- `automaticRecoveryEnabled=false`

After the old Gray validation passes, enable the old Production API and Worker process gates through the existing environment and release procedure. No secret value is added to Git or documentation.

Observe mode permits planning, deterministic execution projection, diagnostics, and operator inspection without allowing automatic recovery or quality evaluation to introduce a larger behavioral change during the first Production canary.

### Admin truthfulness

- The initial assistant/supervision state must be derived from the loaded environment and runtime response instead of a hardcoded fallback welcome state.
- LLM route health summaries must count the active, published routing scope for the selected environment.
- Historical, unpublished, or retired route rows remain queryable for audit but do not inflate the current abnormal-route count.
- UI text must distinguish unsaved local configuration from runtime activation; “配置已同步” must not imply that process gates are enabled.

## Execution Plan Model

Planning returns a structured result instead of only a node ID array.

The plan contains:

- Frozen group ID, group name, execution count, and member IDs.
- Executable nodes and relevant directed edges.
- Stable ready layers.
- Incoming dependency counts and descendant relationships.
- External boundary dependencies.
- Cycle or unresolved node IDs.
- Duplicate group membership and active-node ownership conflicts.
- Plan validation errors with user-facing group and node names.

### Stable group membership

`data.memberIds` becomes the execution authority for a group request. Geometry may still update membership after deliberate drag, resize, or group-edit completion, but render-time node measurement must not silently rewrite the membership used by an active run.

At admission time the controller freezes the member list and current edge snapshot. Later Canvas edits affect only the next run or next configured round, never an already active round.

### Topology validation

Kahn sorting must not append unresolved nodes. If processed node count differs from executable node count, planning returns a cycle/unresolved error and no node starts.

Self-edges are topology errors rather than ignored edges. Stable visual position and node ID remain tie-breakers only among simultaneously ready nodes; they never override dependencies.

### External dependencies

An already prepared static boundary input may be consumed without being executed inside the group. Boundary readiness must come from an explicit node-type policy: a non-executable node, or a source/input node type whose serialized data passes its existing required-input validator and is not currently running. The planner must not infer readiness from a stale generic `status` field. An external upstream node that requires execution must be included in the group; otherwise admission is rejected with a message identifying the missing upstream relationship.

An external node currently owned by another active group is never treated as a ready boundary input. This prevents one group from reading a value that another group is still changing.

### Duplicate ownership

A node may belong to only one active manual group. Admission rejects:

- Overlapping group membership in the frozen plan.
- A group whose node is already owned by another active group.
- Repeated execution of the same active group.

The rejection occurs before any task submission.

## Layered Group Scheduling

Each group is a directed acyclic graph rather than a single serial queue.

### Ready-node rule

A node is ready when:

- It belongs to the frozen group plan.
- It has not started or completed in the current round.
- Every internal upstream dependency has succeeded.
- Every accepted external boundary dependency is ready.
- The node is not owned by another active run.
- A global node slot is available.

All ready nodes may run concurrently. When a node finishes, the scheduler reevaluates only its descendants and dispatches newly ready nodes in stable order.

### Concurrency budgets

- Maximum active manual groups: `5`.
- Maximum active nodes across all manual groups on the Canvas: `10`.
- There is no independent per-group node maximum; groups share the ten-slot budget fairly.
- Ready nodes beyond the ten-slot budget wait in the browser and are not submitted to the API or Provider early.
- Existing backend concurrency limits remain authoritative after submission.

The scheduler uses round-robin admission across active groups when several groups have ready nodes. A large group cannot permanently consume all ten slots while another admitted group has ready work.

### Group admission behavior

- First through fifth distinct valid groups are admitted.
- A repeated active group is rejected with `该分组正在执行`.
- A sixth distinct group is not queued and shows `并行分组已达上限（5/5），请等待任一分组完成后再试。`
- Global Run All and Group Execution Manager runs are exclusive with manual concurrent groups.
- A manual group request is rejected while either global mode is active.

### Rounds

A group with `executionCount > 1` completes all branches in the current round before taking a new Canvas topology and membership snapshot for the next round. The next round is independently validated. A topology edit cannot change the already active round.

## Completion, Failure, And Cancellation

### Completion correlation

The run bus uses a monotonic completion sequence rather than `Date.now()` as the ordering authority. A waiter records the current sequence before dispatch and accepts only a later completion for the expected node.

The timestamp may remain for logs and sound deduplication, but it is not used to prove that a completion belongs to a new execution attempt.

### Failure propagation

Existing node retry configuration remains effective. After retries are exhausted:

- The failed node reaches a terminal failed state.
- Its descendants are marked blocked and never start in that round.
- Independent branches already running are allowed to finish.
- Independent ready branches continue to run.
- The group reaches a failed terminal state after all runnable independent work settles.
- A later configured round does not start after a failed round.

### Cancellation

- Natural group success or failure releases only that group's node ownership and group slot.
- It must not call global `cancelAll()`.
- Toolbar cancellation cancels every active manual group, clears all pending ready work, and invokes the existing global node cancellation path.
- Cancellation, success, failure, and component unmount all release slots idempotently.

## User Experience

- Each GroupBox run control shows its own running state and cannot start the same group twice.
- The Canvas toolbar shows aggregate active-group and active-node progress while any manual group is running.
- Admission failures use a nonblocking visible notice rather than failing silently.
- Cycle and external-dependency messages identify the group and affected nodes by display name when available, retaining IDs only in technical details or logs.
- No modal backdrop or full-screen blur is introduced.

## Component Boundaries

Prefer focused modules instead of expanding `Canvas.tsx`:

- Graph planning and validation: pure helper module near `groupExecutionManager.ts`.
- Active group/node ownership and admission: focused Zustand store or controller module.
- Fair ready-node scheduling and per-group lifecycle: runtime helper consumed by `useCanvasRuntime.ts`.
- Run bus completion sequence and targeted release primitives: `runBus.ts`.
- Group request identity and running projection: `groupBus.ts` and `GroupBoxNode.tsx`.
- `Canvas.tsx` remains wiring only for requests, toolbar projection, and notices.

## Test Strategy

Write failing contracts before implementation.

### Graph planning tests

- A simple chain produces serial ready layers.
- Disconnected subgraphs and fan-out branches share a ready layer where dependencies permit.
- Downstream nodes wait for all upstream nodes.
- Repeated planning produces stable layers.
- A cycle is rejected instead of appended in visual order.
- A self-edge is rejected.
- Duplicate group membership is rejected.
- A missing executable external upstream dependency is rejected.
- A valid prepared boundary input is accepted.

### Concurrency tests

- Five distinct groups are admitted.
- A sixth group is rejected and not queued.
- A duplicate active group is rejected.
- No more than ten nodes are active across all groups.
- Ready work is admitted fairly across groups.
- A slot is released after success, failure, cancellation, and unmount.
- One group finishing does not cancel another.
- Global cancellation stops all groups.
- Global Run All and Group Execution Manager remain exclusive.

### Completion and failure tests

- Two completions with the same millisecond timestamp are still distinguished by sequence.
- A failed branch blocks only its descendants.
- An independent branch continues after another branch fails.
- A failed round prevents later configured rounds.
- Retry behavior does not consume an additional group slot or leak node ownership.

### AI supervision tests

- Unset process gates report disabled even when database controls are true.
- Observe-mode controls do not permit automatic recovery or quality evaluation.
- Initial Admin state reflects the loaded runtime response.
- Current route health excludes retired, historical, and unpublished rows while audit queries retain them.

### Verification gates

- Focused TypeScript contract scripts.
- Web, API, Worker, and Admin type-checks affected by the change.
- Relevant builds and existing group execution, Agent Runtime, environment isolation, and release contracts.
- Project Harness, release Harness, hotspot budgets, staged source-size checks, and CodeGraph sync.
- Old Gray authenticated browser verification at `1920x1080`.

## Rollout And Acceptance

Use one immutable release artifact per promotion step:

1. Local implementation and non-billable tests.
2. Old server Gray deployment.
3. Old Gray topology fixtures, five-group/ten-node scheduling checks, cancellation checks, and AI supervision observe-mode validation.
4. One minimal approved paid canary only after non-billable checks pass.
5. Old server Production controlled promotion and inspection using the same artifact.
6. New server Gray deployment only after old Production is stable.
7. New server Production promotion only after new Gray passes the same checks.

Production activation must not enable automatic recovery during the first canary. Any mismatch between canonical release state and server runtime stops promotion.

## Rollback

- Code rollback uses the environment's recorded rollback release.
- Process gates can be disabled independently without changing database history.
- Observe-mode database controls remain safe when process gates are disabled.
- Browser group runs do not persist scheduler ownership; reloading the page clears local active-run state without rewriting Canvas topology.
- No migration deletes historical runs, route health records, tasks, or audit data.
