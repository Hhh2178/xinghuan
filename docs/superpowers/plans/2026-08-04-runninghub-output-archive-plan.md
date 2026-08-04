# RunningHub Output Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with checkpoints.

**Goal:** Add a persistent RH-node opt-in that queues a server-generated ZIP of the current task's materialized outputs and triggers one browser download without competing with Provider generation work.

**Architecture:** PostgreSQL owns archive jobs, fairness cursor, and the single global lease. API creates/reads/cancels jobs and streams ready ZIP files. A dedicated archive loop in the existing Worker process claims one job at a time, writes a store-mode ZIP through streams, and atomically promotes `.part` files. The Web node stores only the opt-in flag and uses a small hook for task-scoped enqueue/status/download behavior.

**Tech Stack:** React/TypeScript, Node `pg`, Node `fs` streams, `archiver` with store mode, PostgreSQL migration, Vitest, existing Worker runtime.

## Global Constraints

- `OUTPUT_ARCHIVE_GLOBAL_CONCURRENCY=1`.
- `OUTPUT_ARCHIVE_MAX_PENDING_PER_OWNER=2`.
- `OUTPUT_ARCHIVE_TTL_MINUTES=120`.
- `OUTPUT_ARCHIVE_MAX_BYTES=8589934592`.
- `OUTPUT_ARCHIVE_RESERVED_DISK_BYTES=10737418240`.
- Only owner-scoped materialized files are eligible; never fetch arbitrary remote URLs.
- Media entries use ZIP store mode; `manifest.json` may use deflate.
- Archive failure never changes the source RH task status.
- Historical nodes default to `autoDownloadArchive=false`.
- Gray only; Production is not changed in this implementation.

## File Map

- Create: `apps/api/db/049_output_archive_jobs.sql` for jobs, global lease, owner cursor, and indexes.
- Create: `packages/shared/src/output-archive.ts` for status/config/result types and stable error codes.
- Modify: `packages/shared/src/index.ts` to export archive types.
- Create: `apps/api/src/output-archive-repository.ts` for API-side job CRUD, ownership filtering, and idempotent enqueue.
- Create: `apps/api/src/output-archive-routes.ts` for authenticated create/status/cancel/download handlers.
- Modify: `apps/api/src/server.ts` to initialize the repository, register routes, add archive directories to user data paths, and stream ready files.
- Create: `apps/worker/src/output-archive-worker.ts` for lease claiming, fair selection, streaming ZIP generation, heartbeat, cancellation, and cleanup.
- Modify: `apps/worker/src/worker.ts` to start/stop the archive loop under an environment flag.
- Modify: `apps/worker/package.json` and lockfile to add `archiver` and its types.
- Create: `apps/api/src/output-archive-repository.test.ts`.
- Create: `apps/api/src/output-archive-routes.test.ts`.
- Create: `apps/worker/src/output-archive-worker.test.ts`.
- Create: `apps/web/src/services/outputArchive.ts`.
- Create: `apps/web/src/components/nodes/useAutoDownloadTaskArchive.ts`.
- Modify: `apps/web/src/components/nodes/RunningHubNodeConfigSection.tsx` for the switch/status row.
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx` to arm the hook and pass task state.
- Create or modify: focused Web tests for the hook and RH node configuration contract.
- Modify: `docs/systems/worker/queue-and-concurrency.md`, `docs/systems/storage-and-data/material-and-output-storage.md`, and release validation/logbook files required by the release gates.

### Task 1: Add shared archive contracts and the migration

**Interfaces:**

```ts
export type OutputArchiveStatus = "queued" | "running" | "ready" | "downloaded" | "failed" | "cancelled" | "expired";
export type OutputArchiveErrorCode = "archive_too_large" | "insufficient_archive_disk" | "too_many_pending_archives" | "no_materialized_outputs" | "source_task_not_terminal" | "archive_source_invalid";
export interface OutputArchiveJobSummary { jobId: string; status: OutputArchiveStatus; reused: boolean; fileCount: number; sourceBytes: number; archiveBytes?: number; errorCode?: OutputArchiveErrorCode; expiresAt?: string; }
```

- [ ] Write the migration with owner/source indexes, a partial uniqueness rule for active fingerprints, a single global lease row, and an owner cursor row.
- [ ] Add JSONB manifest and lease/heartbeat/cancellation columns exactly as described in the approved design.
- [ ] Add shared status/error/config constants and export them.
- [ ] Add migration-contract tests or SQL assertions for ownership, active dedupe, and the global slot.
- [ ] Run the focused shared/API type checks and commit `feat: add output archive persistence contracts`.

### Task 2: Implement the API repository and routes

**Interfaces:**

```ts
createOutputArchiveJob(taskId: string, ownerId: string): Promise<OutputArchiveJobSummary>;
readOutputArchiveJob(jobId: string, ownerId: string): Promise<OutputArchiveJobSummary | null>;
cancelOutputArchiveJob(jobId: string, ownerId: string): Promise<OutputArchiveJobSummary | null>;
```

- [ ] Resolve the source task by owner and terminal status.
- [ ] Read only `generationArtifactIds` and materialized `/files/output/` result URLs that belong to the same owner.
- [ ] Canonicalize file names, reject remote URLs/path traversal/symlink escapes, stat files, calculate source fingerprint and source bytes.
- [ ] Return stable errors for no outputs, size limit, pending limit, and invalid source.
- [ ] Reuse queued/running/ready/downloaded jobs with the same fingerprint.
- [ ] Register `POST /api/tasks/:taskId/output-archives`, `GET /api/output-archives/:jobId`, `DELETE /api/output-archives/:jobId`, and `GET /api/output-archives/:jobId/download`.
- [ ] Download only ready/downloaded non-expired jobs with `application/zip`, UTF-8 Content-Disposition, and a streaming `createReadStream`.
- [ ] Add owner, URL injection, path traversal, dedupe, and response-header tests.
- [ ] Run API focused tests and type-check; commit `feat: add output archive API`.

### Task 3: Implement the serialized archive Worker

**Interfaces:**

```ts
export function createOutputArchiveWorker(input: {
  pool: Pool;
  workerId: string;
  environment: string;
  dataDir: string;
  enabled: boolean;
}): { run(): Promise<void>; stop(): void };
```

- [ ] Claim the global lease and one owner-fair queued job in a short transaction.
- [ ] Refresh slot lease and job heartbeat while processing; abort the current archive if the database lease cannot be refreshed.
- [ ] Revalidate source paths and disk capacity before opening files.
- [ ] Create a unique owner/job `.part` file using `archiver`, add media with store mode, add `manifest.json`, finalize, and atomically rename.
- [ ] Check cancellation between files and remove only the current `.part` file on cancel/failure.
- [ ] Mark ready with archive size, manifest, filename, and TTL; mark failed with stable error code otherwise.
- [ ] Implement TTL cleanup with explicit owner/job paths and no directory-wide deletion.
- [ ] Add tests for global single-running behavior, owner round-robin, store-mode archiving, partial manifest, cancellation, lease takeover, atomic rename, and TTL cleanup.
- [ ] Start/stop the loop from `apps/worker/src/worker.ts` without changing Provider queue controllers.
- [ ] Run Worker focused tests and type-check; commit `feat: serialize output archive worker`.

### Task 4: Add the Web client and RH-node switch

**Interfaces:**

```ts
export function createOutputArchive(taskId: string): Promise<OutputArchiveJobSummary>;
export function readOutputArchive(jobId: string): Promise<OutputArchiveJobSummary>;
export function cancelOutputArchive(jobId: string): Promise<OutputArchiveJobSummary>;
```

- [ ] Add `autoDownloadArchive` as a persisted node flag with false fallback.
- [ ] Add a compact switch row to `RunningHubNodeConfigSection` using existing node theme classes and a stable fixed-height layout.
- [ ] Implement `useAutoDownloadTaskArchive` with armed-task tracking, taskId dedupe, sessionStorage dedupe, status polling, manual retry, and cleanup on unmount.
- [ ] Arm only when a new task enters submitting/polling/running; never auto-download a historical success on canvas restore.
- [ ] On ready, trigger one same-origin anchor download; preserve ready state if the browser blocks or the network fails.
- [ ] Keep archive errors separate from RH `success/error/cancelled` state.
- [ ] Integrate at the `startPolling` success/error boundary and the node's existing task/status data, without moving ZIP logic into `RunningHubNode.tsx`.
- [ ] Add Web tests for default-off compatibility, persistence, one-task dedupe, status transitions, manual retry, and no generation-state mutation.
- [ ] Run Web focused tests, type-check, and build; commit `feat: add RunningHub output archive toggle`.

### Task 5: Documentation, Harness, and Gray verification

- [ ] Update Worker queue/concurrency and storage/output system docs with the archive queue boundary, single-slot rule, TTL, and config values.
- [ ] Update the Proposed ADR to Accepted only after implementation verification; keep the superseded drawer spec note.
- [ ] Add release validation evidence for migration, API/Worker startup, archive metrics, owner isolation, and browser download.
- [ ] Run `git diff --check`, focused tests, package type-checks/builds, relevant project Harness checks, and the 1920x1080 visual review.
- [ ] Bump only the current Gray patch version after all local checks pass, prepare/deploy Gray, and verify Production is unchanged.
- [ ] Run a real multi-output RH task and at least three queued archive jobs to prove global serialization, fairness, partial manifest behavior, retry, and TTL cleanup.
- [ ] Commit release docs and validation evidence with `chore: verify RunningHub output archive gray release`.

