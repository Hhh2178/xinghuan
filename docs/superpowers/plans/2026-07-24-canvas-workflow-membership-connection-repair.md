# Canvas Workflow Membership Connection Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a compatible node visibly inside a Workflow Region join that workflow during a connection action, so the connection is executable rather than silently rejected.

**Architecture:** A small pure resolver determines whether a connection is direct, requires adding one unowned endpoint to the visible workflow, or remains blocked. `Canvas.tsx` reuses that resolver for both React Flow preview validation and committed edge creation, keeping the admission decision identical in both phases.

**Tech Stack:** React 19, @xyflow/react, TypeScript, Vitest, @xinghuan/shared workflow documents.

## Global Constraints

- PC desktop behavior only; no mobile or tablet work.
- Do not publish Gray, touch Production, or push GitHub.
- Preserve existing Workflow Region boundary and Input/Output direction rules.
- Add a local Git commit only after fresh verification.

---

### Task 1: Model visible-region membership admission

**Files:**
- Create: `apps/web/src/components/canvas/workflowConnectionMembership.ts`
- Test: `apps/web/src/components/canvas/workflowConnectionMembership.test.ts`

**Interfaces:**
- Consumes: `Node`, `WorkflowDocument`, `isWorkflowBoundaryConnectionAllowed`.
- Produces: `resolveWorkflowConnectionMembership({ source, target, workflows })` returning `direct`, `join`, or `blocked`.

- [ ] Write the failing exported-fixture test for image member to unowned selector inside the Workflow Region.
- [ ] Run `npx vitest run apps/web/src/components/canvas/workflowConnectionMembership.test.ts` and observe the missing resolver failure.
- [ ] Implement the resolver with full visual containment and post-join boundary validation.
- [ ] Re-run the focused test and confirm direct, join, and blocked cases pass.

### Task 2: Use the resolver for preview and connection commit

**Files:**
- Modify: `apps/web/src/components/Canvas.tsx`
- Test: `apps/web/src/components/canvas/workflowConnectionMembership.test.ts`

**Interfaces:**
- Consumes: `resolveWorkflowConnectionMembership` from Task 1.
- Produces: a new internal edge plus one workflow revision when `kind === 'join'`.

- [ ] Replace duplicate member-boundary checks in `onIsValidConnection` and `onConnect` with the resolver.
- [ ] Update exactly the resolved workflow membership before adding the edge and avoid the ordinary second revision bump.
- [ ] Keep existing direct connections and blocked boundary directions unchanged.
- [ ] Run the focused test and web type check.

### Task 3: Record and verify the local repair

**Files:**
- Modify: `docs/systems/canvas/node-and-data-model.md`
- Modify: `docs/logbooks/daily/2026-07-24.md`

- [ ] Document the visible-region membership repair and its boundary limits.
- [ ] Run focused tests, `npm run type-check`, the relevant Canvas contracts, and project Harness.
- [ ] Perform a local 1920x1080 Canvas interaction check for Image -> Smart Candidate Selector.
- [ ] Commit the verified local repair without deploying or pushing.
