# v0.6.1 AIFork Contract And Access Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AIFork video requests and results model-configurable, recover completed videos in the canvas, and close the related admin-session and RunningHub visibility regressions.

**Architecture:** Keep canvas input normalized as `prompt`, `duration`, `ratio`, inferred `modeType`, `images`, and `audios`. A constrained request-contract interpreter in `@xinghuan/model-core` maps those sources into nested JSON paths declared in each model's existing `advancedConfig`; it has no expression execution. The worker uses an AIFork-specific poller and normalized result extraction, while access fixes make the effective ungrouped policy visible in the admin UI and treat API 401 responses as session loss.

**Tech Stack:** TypeScript, Node.js HTTP API, React, Postgres, existing contract scripts, npm workspaces.

---

## File Map

- `packages/model-core/src/aicopy-video-adapter.ts`: typed request-contract renderer and AIFork result URL extraction.
- `apps/worker/src/worker-media-polling.ts`: AIFork async video polling helper.
- `apps/worker/src/worker.ts`: pass audio/mode data to the contract renderer and call the AIFork poller.
- `apps/admin/src/admin-model-editor.tsx`: explain and validate the model-level request-contract JSON field.
- `apps/api/src/group-permission-policy-routes.ts`: render the same implicit default-deny policy that runtime enforcement uses.
- `apps/admin/src/admin-api-client.ts` and `apps/admin/src/main.tsx`: surface an expired session as a login transition.
- `scripts/verify-aicopy-video-adapter-contract.ts`: executable contract coverage for Grok and SD requests/results.
- `scripts/verify-admin-auth-expiry-contract.mjs`: regression check for the admin 401 handling contract.
- version manifest files: change all package versions to `0.6.1`.

### Task 1: Lock The AIFork Request Contract With Failing Tests

**Files:**
- Modify: `scripts/verify-aicopy-video-adapter-contract.ts`
- Test: `scripts/verify-aicopy-video-adapter-contract.ts`

- [x] Add an SD full-series fixture with `duration=15`, `ratio=9:16`, one image, no audio, and this contract:

```ts
requestContract: {
  bindings: [
    { path: "duration", source: "duration", type: "number" },
    { path: "metadata.modeType", source: "modeType", type: "string" },
    { path: "metadata.ratio", source: "ratio", type: "string" },
    { path: "metadata.enableSound", value: "on", type: "string" },
    { path: "images", source: "images", type: "string[]" },
    { path: "audios", source: "audios", type: "string[]", omitWhenEmpty: true },
  ],
  resultPaths: ["result_url", "data.metadata.url", "data.output"],
}
```

- [x] Assert the built request has numeric `duration`, nested `metadata`, `images`, and no empty `audios`; assert the completed AIFork response resolves the HTTPS `result_url` before the HTTP metadata URL.
- [x] Run `npx tsx scripts/verify-aicopy-video-adapter-contract.ts` and confirm it fails because the existing adapter cannot render nested bindings or root `result_url`.

### Task 2: Implement The Constrained Model Request Contract

**Files:**
- Modify: `packages/model-core/src/aicopy-video-adapter.ts`
- Modify: `packages/model-core/src/index.ts`
- Test: `scripts/verify-aicopy-video-adapter-contract.ts`

- [x] Define `AicopyRequestBinding` with only `path`, `source`, `value`, `type`, and `omitWhenEmpty` fields.
- [x] Permit only the source names `model`, `prompt`, `duration`, `ratio`, `resolution`, `modeType`, `images`, and `audios`; ignore unknown source names and unsafe/empty path segments.
- [x] Add nested-path assignment that creates plain objects only, never arrays or executable expressions.
- [x] Preserve legacy `requestMapping`, `requestValueTypes`, and `requestValueTemplates` if no `requestContract.bindings` exists.
- [x] Extend `extractAicopyVideoResult()` so configured result paths and standard AIFork paths prefer `result_url`, then `content_url`, `data.metadata.url`, then historical output paths.
- [x] Re-run the contract script and confirm it passes.

### Task 3: Use AIFork Polling In The Worker

**Files:**
- Modify: `apps/worker/src/worker-media-polling.ts`
- Modify: `apps/worker/src/worker.ts`
- Test: `scripts/verify-aicopy-video-adapter-contract.ts`

- [x] Add `pollAicopyVideoTask()` using `extractAicopyVideoResult()`, terminal status helpers, the configured poll path, and the existing heartbeat format.
- [x] Change the AIFork branch in `executeVideoTask()` from `pollApimartVideoTask()` to `pollAicopyVideoTask()`.
- [x] Derive `modeType` from the queued payload: no image is `text2video`, first-plus-last frame is `frames2video`, all other image cases are `image2video`.
- [x] Pass `audios` from the queued payload and `requestContract` from `advancedConfig` into the adapter.
- [x] Add a contract-source assertion that the AIFork branch calls `pollAicopyVideoTask` and does not call `pollApimartVideoTask`.
- [x] Run the AIFork contract script and `npm run type-check -w @xinghuan/worker`.

### Task 4: Make The Model Editor Own The Contract

**Files:**
- Modify: `apps/admin/src/admin-model-editor.tsx`
- Modify: `apps/admin/src/admin-types.ts`
- Test: `scripts/verify-aicopy-video-adapter-contract.ts`

- [x] Add an AIFork video request-contract guide directly above the existing advanced-config JSON field, including the allowed sources and a copyable SD full-series example.
- [x] Validate `advancedConfig.requestContract.bindings` client-side as an array of objects with safe dotted paths and permitted source/value forms before save.
- [x] Keep all existing advanced-config keys unchanged so current Grok and legacy AIFork models remain compatible.
- [x] Run `npm run type-check -w @xinghuan/admin`.

### Task 5: Repair Effective Permission And Admin Session Feedback

**Files:**
- Modify: `apps/api/src/group-permission-policy-routes.ts`
- Modify: `apps/admin/src/admin-api-client.ts`
- Modify: `apps/admin/src/main.tsx`
- Create: `scripts/verify-admin-auth-expiry-contract.mjs`

- [x] Make `buildPolicyResponse()` return `policyForUser()`'s effective deny list for a missing non-admin policy, so the admin UI no longer labels implicit deny as open access.
- [x] Add an `AdminApiError` predicate for `status=401` or `code=AUTH_REQUIRED`.
- [x] In the top-level admin mutation/data-loading error path, clear `currentUser` after that predicate so the stale dashboard cannot submit further writes.
- [x] Add source-level regression checks for the effective-policy call and the explicit auth-loss transition.
- [x] Run `node scripts/verify-admin-auth-expiry-contract.mjs` and `npm run type-check -w @xinghuan/admin -w @xinghuan/api`.

### Task 6: Prepare Release v0.6.1 And Verify

**Files:**
- Modify: root and workspace `package.json` version entries
- Modify: `README.md`, `AGENTS.md`, `MEMORY.md`, and current-state/release planning entries as required by the repository release guard
- Test: targeted scripts, workspace type checks, project harness

- [x] Change all workspace version fields currently set to `0.5.27` to `0.6.1`; regenerate `package-lock.json` with the supported npm version.
- [x] Update the current repair scope to state that production remains on `v0.5.22` until gray verification succeeds.
- [x] Run `npx tsx scripts/verify-aicopy-video-adapter-contract.ts`.
- [x] Run `node scripts/verify-admin-auth-expiry-contract.mjs`.
- [x] Run `npm run type-check -w @xinghuan/model-core -w @xinghuan/worker -w @xinghuan/admin -w @xinghuan/api`.
- [x] Run the relevant project harness and a production-safe gray deployment verification before proposing production promotion.

### Task 7: Persist The Virtual Ungrouped Permission Bucket

**Files:**
- Create: `apps/api/db/020_ungrouped_permission_policy.sql`
- Create: `scripts/verify-ungrouped-permission-policy-contract.mjs`

- [x] Remove the foreign key that incorrectly requires every policy group ID to exist in `xh_user_groups`; `ungrouped` is a virtual group created by the existing route and permission runtime.
- [x] Keep the existing primary key and `updated_by` foreign key, so each virtual or named group still has one policy and editor attribution remains valid.
- [x] Deploy the migration to gray, persist an explicit empty deny policy for `ungrouped`, and verify in the deployed module that ungrouped members receive the RunningHub catalog while named groups without a policy remain default-closed.

## Deployment Data Step

After the code is verified in gray, write an explicit empty-deny policy for the `ungrouped` bucket only if the administrator confirms that existing ungrouped users should have all current RH entries. New named groups remain default-closed. This is an intentional production permission-data change and must be verified with a member session before promotion.
