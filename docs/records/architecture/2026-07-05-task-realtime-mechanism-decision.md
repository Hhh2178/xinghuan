# Task Realtime Mechanism Decision - 2026-07-05

## Decision

Defer F1 implementation during the clean worktree migration line.

The preferred next implementation path is **shared frontend polling first**, not task SSE. SSE remains a later option after the polling contract is centralized and measured.

## Current Behavior

Task/runtime status is currently polled independently inside multiple canvas nodes:

- `apps/web/src/components/nodes/ImageNode.tsx` keeps one or more `setInterval` timers for external image task polling.
- `apps/web/src/components/nodes/VideoNode.tsx` keeps separate timers for backend video, external video, and FAL-style polling paths.
- `apps/web/src/components/nodes/AudioNode.tsx` keeps audio task polling timers.
- `apps/web/src/components/nodes/RunningHubNode.tsx` and `RHToolsNode.tsx` poll RunningHub task status every 5 seconds and include their own de-duplication logic.
- `SeedanceNode.tsx` also owns its own polling interval and timeout behavior.

The API already has task-runtime building blocks:

- `apps/api/src/provider-generation-task-service.ts` reads provider generation task status.
- `apps/api/src/task-runtime-events.ts` writes runtime events.
- `apps/api/src/task-runtime-projection.ts` maps task status into runtime presentation state.

However, there is not yet one frontend-owned runtime status coordinator for all task-backed nodes.

## Target

Reduce duplicate task-status requests in multi-node execution scenarios without changing task completion semantics.

Initial success target for the future implementation:

- For N active task-backed nodes, replace N independent status timers with one shared status coordinator.
- In common grouped execution, reduce browser status polling requests by at least 50% compared with per-node timers.
- Preserve existing node completion semantics: node run promises must resolve only after the underlying task has completed, failed, cancelled, or timed out.
- Preserve cancellation and resumed-polling behavior for persisted `status=polling` node states.

## Option A - Task SSE

Approach:

- Add a task status stream endpoint similar to `announcement-sse.ts`.
- Broadcast task runtime events when API/Worker status changes.
- Frontend nodes subscribe to task events instead of polling.

Pros:

- Best long-term request reduction.
- Fits existing `task-runtime-events` direction.
- Enables richer realtime progress and centralized observability.

Cons:

- Requires reliable event ordering, reconnect behavior, auth/session handling, and backfill after missed events.
- Touches API, Worker, and multiple frontend nodes at once.
- Higher regression risk for long-running generation tasks.

## Option B - Shared Frontend Polling

Approach:

- Add a shared frontend task runtime polling coordinator.
- Nodes register active task IDs and receive updates from one batched or de-duplicated polling loop.
- Keep existing task status endpoints initially.

Pros:

- Smaller change surface than SSE.
- Can preserve current request/response semantics while reducing duplicate timers.
- Easier to roll out node-by-node and verify with browser/network measurements.

Cons:

- Still polling-based.
- Requires a small frontend runtime registry and careful cleanup when nodes unmount or workflows reload.
- Full benefit needs all task-backed nodes migrated to the coordinator.

## Chosen Next Step

Defer implementation now and create a separate F1 implementation plan later with this order:

1. Add a shared frontend polling coordinator and tests for registration, de-duplication, unsubscribe, and completion cleanup.
2. Migrate one low-risk node first, preferably RunningHub/RHTools because they already have global poll de-duplication concepts.
3. Measure request count before/after in a grouped execution with at least 3 active task-backed nodes.
4. Only after shared polling is stable, revisit SSE as a Phase 2 realtime upgrade.

## Deferral Reason

The current migration line is focused on clean worktree completeness, repository boundaries, and release-chain stability. Implementing realtime status changes now would touch high-risk frontend node execution code and API runtime status behavior in the same line.

This decision keeps F1 visible without mixing a realtime redesign into the structural migration release path.

## Validation

No source code changes are included in this decision batch.

Required checks for this decision batch:

```powershell
git diff --name-only | Select-String -Pattern 'SSE|poll|Polling|task-status|TaskStatus'
npm run verify:current-release-entry-consistency
git diff --check
```

Expected:

- Only documentation files should appear.
- Current gray/production release entries remain consistent.
