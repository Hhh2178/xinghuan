# RunningHub Tolerant Analyze And Node Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RH analyze accept mixed RunningHub example text, produce stronger input/output drafts, and let canvas RH nodes consume the richer catalog metadata.

**Architecture:** Keep RH analyze as a local backend rule engine instead of a Hermes integration, but make the parser tolerant to pasted mixed text and use both request/response examples plus doc links to derive drafts. Extend the public RunningHub catalog shape just enough for the web RH node to consume output definitions instead of guessing from `workflowJson`.

**Tech Stack:** Node.js, TypeScript, React, existing contract-verification scripts

---

### Task 1: Lock failing verification

**Files:**
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/scripts/verify-runninghub-analyze-contract.mjs`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/scripts/verify-runninghub-workflow-contract.mjs`

- [ ] Add contract checks for tolerant example parsing helpers and `docUrl` participation.
- [ ] Add contract checks proving public catalog/web schema preserve and consume `outputSchema`.
- [ ] Run:
  - `node scripts/verify-runninghub-analyze-contract.mjs`
  - `node scripts/verify-runninghub-workflow-contract.mjs`
- [ ] Confirm both fail before implementation.

### Task 2: Harden backend analyze draft generation

**Files:**
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/server.ts`

- [ ] Implement tolerant example extraction for mixed text:
  - direct JSON parse
  - fenced JSON block extraction
  - balanced object extraction from larger text
- [ ] Keep request/response parsing local and deterministic; do not add Hermes dependency to RH analyze.
- [ ] Feed `docUrl` into page-id inference and capability/context analysis.
- [ ] Infer stronger `outputDraft` and `executionDraft` from `responseExample` when it looks like async task status or final result payload.
- [ ] Keep warnings precise:
  - JSON extraction failed
  - JSON extracted but no `nodeInfoList`
  - form `runTargetId` mismatches example `runTargetId`

### Task 3: Adapt public RH catalog for runtime consumption

**Files:**
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/packages/shared/src/runninghub.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/api/src/runninghub-catalog.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/services/runninghubCatalog.ts`

- [ ] Expose runtime-relevant output definitions through the public catalog contract.
- [ ] Preserve normalized `outputSchema` in web catalog items.
- [ ] Keep `execution` as the runtime execution contract and avoid leaking admin-only editing state beyond what nodes need.

### Task 4: Adapt RH canvas node behavior

**Files:**
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/utils/runninghubNodeSchema.ts`
- Modify: `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b/apps/web/src/components/nodes/RunningHubNode.tsx`

- [ ] Make node output inference prefer backend `outputSchema` over `workflowJson` keyword guessing.
- [ ] Update node summary/state display so analyzed entries show richer output counts and less misleading empty-state copy.
- [ ] Preserve current optional `instanceType` behavior while keeping `runTargetId/pageId` as runtime internals rather than user-facing obligations.

### Task 5: Verify end to end

**Files:**
- No new source files expected

- [ ] Run:
  - `npm run verify:runninghub-analyze-contract`
  - `npm run verify:runninghub-workflow-contract`
  - `npm run type-check`
- [ ] Inspect `git diff --stat` and `git status --short`.
- [ ] Summarize what changed, what is still heuristic, and whether a follow-up gray deployment is needed.
