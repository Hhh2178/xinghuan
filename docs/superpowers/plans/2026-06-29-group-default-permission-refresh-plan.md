# Group Default Name, Shared Resource Visibility, and Canvas Refresh Persistence Implementation Plan

> **For agentic workers:** This plan is now implemented and retained as a record of the batch.

**Goal:** Fix three related canvas and resource-library issues in order: new groups default to `未命名组`, unauthorized shared resources are hidden instead of shown as denied, and canvas refresh preserves image/video materials instead of clearing them.

**Architecture:** Treat this as three small but connected slices. First, normalize the default group name at the store layer so every group creation path uses the same constant. Second, keep shared-resource permissions enforced at the API boundary and let the drawer render only the visible rows it receives. Third, extend canvas persistence so resource-linked image/video materials are persisted as part of the canvas snapshot and reconstructed on reload, while transient runtime-only fields still get stripped.

**Tech Stack:** TypeScript, React, Zustand, Node HTTP route handlers, existing admin/canvas stores, current contract scripts, CodeGraph, npm workspace scripts.

---

## File Map

### Existing files to modify

- `apps/web/src/stores/groupBus.ts`
  - Change the default new-group name constant to `未命名组`.
- `apps/web/src/components/Canvas.tsx`
  - Keep the group creation path wired to the shared default name constant and add regression coverage for new group creation behavior if needed.
- `apps/api/src/group-permission-policy.ts`
  - Verify the group-level deny-list helpers still express the intended “hide entirely” semantics for shared resources.
- `apps/api/src/shared-resource-routes.ts`
  - Ensure shared-resource list routes only return items the current user can see.
- `apps/web/src/components/ResourceLibraryDrawer.tsx`
  - Remove any client-side “denied” presentation and rely on the filtered API response.
- `apps/web/src/services/sharedResourceApi.ts`
  - Keep request shapes aligned with the filtered list contract.
- `apps/web/src/components/canvas/useCanvasPersistence.ts`
  - Preserve material-bearing nodes and their resource references across reloads.
- `apps/web/src/utils/workflowResource.ts`
  - If the canvas snapshot path uses workflow manifests for materials, ensure resource links survive refresh reconstruction.
- `apps/web/src/utils/sendMaterials.ts`
  - Keep sendable image/video material reconstruction consistent with refreshed canvas state.
- `DEVLOG.md`
  - Record implementation and verification outcomes.

### New files to create

- `scripts/verify-group-default-name-contract.mjs`
  - Verify the group default name constant and creation path.
- `scripts/verify-shared-resource-visibility-contract.mjs`
  - Verify unauthorized shared resources are hidden at the API/UI contract level.
- `scripts/verify-canvas-material-persistence-contract.mjs`
  - Verify image/video materials persist across refresh and are restored from canvas state.

---

## Task 1: Normalize the default group name to `未命名组`

**Files:**
- Modify: `apps/web/src/stores/groupBus.ts`
- Modify: `apps/web/src/components/Canvas.tsx`
- Create: `scripts/verify-group-default-name-contract.mjs`

- [ ] **Step 1: Write the failing contract**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const groupBus = readFileSync(join(root, "apps/web/src/stores/groupBus.ts"), "utf8");
const canvas = readFileSync(join(root, "apps/web/src/components/Canvas.tsx"), "utf8");

assert.match(groupBus, /DEFAULT_GROUP_NAME\s*=\s*['"]未命名组['"]/);
assert.match(canvas, /DEFAULT_GROUP_NAME/);

console.log("PASS group default name contract");
```

- [ ] **Step 2: Run the contract and verify it fails**

Run: `node scripts/verify-group-default-name-contract.mjs`

Expected: FAIL because the store still uses the old hardcoded string.

- [ ] **Step 3: Update the default group name constant**

```ts
export const DEFAULT_GROUP_NAME = '未命名组';
```

- [ ] **Step 4: Confirm the canvas creation path still consumes the constant**

Keep `Canvas.tsx` using `DEFAULT_GROUP_NAME` for the `groupBox` creation payload so all group creation code paths stay aligned.

- [ ] **Step 5: Run the contract and verify it passes**

Run: `node scripts/verify-group-default-name-contract.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/stores/groupBus.ts apps/web/src/components/Canvas.tsx scripts/verify-group-default-name-contract.mjs
git commit -m "fix: normalize default group name"
```

## Task 2: Hide unauthorized shared resources instead of showing denial states

**Files:**
- Modify: `apps/api/src/group-permission-policy.ts`
- Modify: `apps/api/src/shared-resource-routes.ts`
- Modify: `apps/web/src/components/ResourceLibraryDrawer.tsx`
- Modify: `apps/web/src/services/sharedResourceApi.ts`
- Create: `scripts/verify-shared-resource-visibility-contract.mjs`

- [ ] **Step 1: Write the failing visibility contract**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const policy = readFileSync(join(root, "apps/api/src/group-permission-policy.ts"), "utf8");
const routes = readFileSync(join(root, "apps/api/src/shared-resource-routes.ts"), "utf8");
const drawer = readFileSync(join(root, "apps/web/src/components/ResourceLibraryDrawer.tsx"), "utf8");

assert.match(policy, /canUseSharedResource/);
assert.match(routes, /filterSharedResourceItemsForUser/);
assert.doesNotMatch(drawer, /拒绝|denied|permission denied/i);

console.log("PASS shared resource visibility contract");
```

- [ ] **Step 2: Run the contract and verify it fails**

Run: `node scripts/verify-shared-resource-visibility-contract.mjs`

Expected: FAIL until the UI and API contract are tightened to remove any denial-state presentation.

- [ ] **Step 3: Enforce hide-only behavior at the API layer**

Keep `shared-resource-routes.ts` filtering categories and items with `filterSharedResourceItemsForUser(...)`, and make sure non-admin users never receive forbidden rows in the first place.

- [ ] **Step 4: Remove denial-state rendering from the drawer**

Update `ResourceLibraryDrawer.tsx` so it only handles:

- empty visible list
- loading state
- normal visible rows

Do not render a visible “no permission” badge, card, or disabled placeholder for hidden resources.

- [ ] **Step 5: Keep the shared API surface consistent**

Ensure `sharedResourceApi.ts` remains a thin transport layer and does not reintroduce client-side visibility policy logic.

- [ ] **Step 6: Run the contract and verify it passes**

Run: `node scripts/verify-shared-resource-visibility-contract.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/group-permission-policy.ts apps/api/src/shared-resource-routes.ts apps/web/src/components/ResourceLibraryDrawer.tsx apps/web/src/services/sharedResourceApi.ts scripts/verify-shared-resource-visibility-contract.mjs
git commit -m "fix: hide unauthorized shared resources"
```

## Task 3: Preserve image/video materials across canvas refresh

**Files:**
- Modify: `apps/web/src/components/canvas/useCanvasPersistence.ts`
- Modify: `apps/web/src/utils/workflowResource.ts`
- Modify: `apps/web/src/utils/sendMaterials.ts`
- Modify: `apps/web/src/components/Canvas.tsx`
- Create: `scripts/verify-canvas-material-persistence-contract.mjs`

- [ ] **Step 1: Write the failing persistence contract**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const persistence = readFileSync(join(root, "apps/web/src/components/canvas/useCanvasPersistence.ts"), "utf8");
const workflowResource = readFileSync(join(root, "apps/web/src/utils/workflowResource.ts"), "utf8");
const sendMaterials = readFileSync(join(root, "apps/web/src/utils/sendMaterials.ts"), "utf8");

assert.match(persistence, /getCanvasData\(requestedCanvasId\)/);
assert.match(persistence, /saveCanvasData\(canvasIdForSave, payload, \{ allowEmpty: allowEmptySave \}\)/);
assert.match(workflowResource, /cleanupNodeRuntimeForWorkflowTemplate/);
assert.match(sendMaterials, /resourceItemToSendMaterials/);

console.log("PASS canvas material persistence contract");
```

- [ ] **Step 2: Run the contract and verify it fails**

Run: `node scripts/verify-canvas-material-persistence-contract.mjs`

Expected: FAIL because refresh still drops material state in at least one path.

- [ ] **Step 3: Separate runtime-only cleanup from material persistence**

In `useCanvasPersistence.ts`, keep stripping only transient fields that are truly runtime-only, but ensure image/video material references remain in the saved canvas snapshot and are restored on reload.

- [ ] **Step 4: Keep workflow/material reconstruction stable**

If the canvas stores resource-backed workflow fragments or media references, make sure `workflowResource.ts` and `sendMaterials.ts` preserve enough metadata to reconstruct the materials after refresh without forcing a re-upload.

- [ ] **Step 5: Make the restore path idempotent**

After a refresh, loading a canvas should recreate the same visible material nodes/cards without duplicating them or clearing them on first persistence tick.

- [ ] **Step 6: Run the contract and verify it passes**

Run: `node scripts/verify-canvas-material-persistence-contract.mjs`

Expected: PASS.

- [ ] **Step 7: Run focused workspace checks**

Run:

```bash
npm run verify:group-default-name
npm run verify:shared-resource-visibility
npm run verify:canvas-material-persistence
npm run build -w @xinghuan/web
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/canvas/useCanvasPersistence.ts apps/web/src/utils/workflowResource.ts apps/web/src/utils/sendMaterials.ts apps/web/src/components/Canvas.tsx scripts/verify-canvas-material-persistence-contract.mjs
git commit -m "fix: preserve canvas materials across refresh"
```

---

## Verification Notes

- The new behavior for shared resources is “hide, not deny”.
- The default group name change should be verified from the store constant and the canvas creation path together.
- Canvas refresh verification should cover image and video materials specifically, because those are the ones users reported being lost.
- If any of the three contracts require additional helper files or small split-outs, keep them narrowly scoped and update the relevant `docs/logbooks/` entry in the same batch.

