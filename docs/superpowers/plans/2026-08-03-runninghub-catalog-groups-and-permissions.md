# RunningHub Catalog Groups and Permissions Implementation Plan

> **Execution progress (2026-08-03):** Shared group contracts, Provider `rh_groups` migration/persistence, group lifecycle API, Admin grouped rail/editor selector, Canvas grouped selector, permission group subjects and two-gate runtime are implemented in the current slice. Remaining: authenticated Gray acceptance, production promotion, and release `0.8.18` evidence.

> **Actual implementation note:** Group lifecycle is currently kept beside the existing RunningHub catalog authority in `apps/api/src/server.ts` and wired through `admin-runninghub-routes.ts`; a separate `runninghub-group-service.ts` was intentionally not introduced to avoid duplicating the Provider JSONB write boundary. The local slice includes normalization, repository persistence, permission truth-table coverage, Admin/Canvas focused tests and a cross-layer verifier. Dedicated live route/service tests and authenticated Gray acceptance remain release follow-ups.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Provider-scoped groups for RunningHub apps and workflows, expose grouped catalogs in Admin and Canvas, and enforce group permissions as an outer boundary above item permissions.

**Architecture:** Persist group metadata in a new Provider JSONB column and store an optional stable `groupId` on existing RH entries, preserving catalog IDs and execution targets. Register group and item permission subjects independently, then apply a two-gate authorization function for view and execute so an item rule can never reopen a denied group.

**Tech Stack:** TypeScript, PostgreSQL JSONB, Node API, unified permission platform, React 19 Admin/Web, Vitest.

## Global Constraints

- This follows administrator tiers and becomes Gray `0.8.18`; Production reuses the exact Gray archive.
- Groups are Provider-scoped; group names are case-insensitively unique within one Provider.
- New and legacy entries default to ungrouped when `groupId` is absent or invalid.
- Moving an entry does not change `id`, `catalogId`, `runTargetId`, `appId` or `workflowId`.
- Deleting a group moves its entries to ungrouped in the same Provider write.
- Disabled groups hide and block every contained entry, including historical direct submit and Workflow Run recovery.
- Effective access is `groupAllowed && itemAllowed`; ungrouped entries use the existing item decision only.
- Group permissions are configured through the existing unified permission platform, not a second policy database.
- PC visual acceptance is `1920x1080` only.
- Do not touch the existing unrelated July logbook changes.
- If the unrelated July logbook changes are still uncommitted at release time, stop before the release-clean gate and ask the user to resolve them; do not stash, reset, commit or delete them.

---

## File Map

- Modify `packages/shared/src/runninghub.ts`: add `RhCatalogGroup` and group identity on public items.
- Create `packages/shared/src/runninghub-groups.test.ts`: normalization-independent shared grouping contracts.
- Create `apps/api/db/048_runninghub_catalog_groups.sql`: `xh_providers.rh_groups` JSONB column.
- Modify `apps/api/src/runninghub-catalog.ts`: normalize groups and item group IDs; public/admin projection.
- Modify `apps/api/src/provider-repository-types.ts`: add `rhGroups` and normalizer dependency.
- Modify `apps/api/src/provider-repository-mappers.ts`: read `rh_groups`.
- Modify `apps/api/src/provider-repository.ts`: write `rh_groups` atomically with RH entries.
- Modify `apps/api/src/provider-repository.test.ts`: round-trip group persistence.
- Modify `apps/api/src/server.ts`: group CRUD and entry reassignment remain beside the existing Provider JSONB authority.
- Modify `apps/api/src/admin-runninghub-routes.ts`: group endpoints and item `groupId` payload.
- Create `apps/api/src/runninghub-permission-gate.ts`: explicit group/item two-gate decision.
- Create `apps/api/src/runninghub-permission-gate.test.ts`: deny/allow truth table.
- Modify `apps/api/src/permissions/permission-subject-registrars.ts`: register/retire group subjects.
- Modify `apps/api/src/permissions/permission-subject-registrars.test.ts`: group subject lifecycle.
- Modify `apps/api/src/server.ts`: wire group lifecycle, public catalog metadata, list/detail/submit/run authorization and environment sync.
- Modify `apps/api/src/environment-sync-service.ts`: carry `rhGroups` in Provider snapshots.
- Modify `apps/admin/src/admin-types.ts`: group and group-bearing item contracts.
- Modify `apps/admin/src/admin-api-client.ts`: group CRUD API.
- Create `apps/admin/src/admin-runninghub-group-manager.tsx`: group create/edit/reorder/enable/delete owner.
- Modify `apps/admin/src/admin-runninghub-workspace.tsx`: grouped rail and group state.
- Modify `apps/admin/src/admin-runninghub-item-editor.tsx`: group selector.
- Modify `apps/admin/src/admin-runninghub-workspace.test.tsx`: grouped Admin UI contracts.
- Modify `apps/web/src/services/runninghubCatalog.ts`: normalize group metadata and group items.
- Create `apps/web/src/services/runninghubCatalog.test.ts`: response normalization/grouping tests.
- Modify `apps/web/src/components/nodes/RunningHubNodeConfigSection.tsx`: grouped `<optgroup>` selector.
- Create `scripts/verify-runninghub-group-permission-contract.mjs`: cross-layer source contract.
- Modify `package.json`: register the group permission verifier and RunningHub release preset.
- Create `docs/adr/0008-runninghub-catalog-group-permission-boundary.md` and index it.
- Modify `CONTEXT.md`, `docs/systems/runninghub/README.md`, `docs/systems/runninghub/catalog-and-entry-model.md`, and auth permission documentation.

### Task 1: Add shared group contracts and the database column

**Files:**
- Modify: `packages/shared/src/runninghub.ts`
- Create: `packages/shared/src/runninghub-groups.test.ts`
- Create: `apps/api/db/048_runninghub_catalog_groups.sql`

**Interfaces:**
- Produces `RhCatalogGroup` and `RhCatalogItem.groupId/groupName`.

- [ ] **Step 1: Write the failing shared type behavior test**

```ts
import { describe, expect, it } from "vitest";
import type { RhCatalogGroup, RhCatalogItem } from "./runninghub.js";

describe("RunningHub catalog groups", () => {
  it("keeps group identity independent from catalog identity", () => {
    const group: RhCatalogGroup = {
      id: "rhg-video",
      providerId: "runninghub",
      name: "视频生成",
      description: "",
      enabled: true,
      sortOrder: 10,
      createdAt: 1,
      updatedAt: 1,
    };
    const item = { catalogId: "runninghub:workflow:wf-1", groupId: group.id, groupName: group.name } as RhCatalogItem;
    expect(item.catalogId).toBe("runninghub:workflow:wf-1");
    expect(item.groupId).toBe("rhg-video");
  });
});
```

- [ ] **Step 2: Run the test and observe the missing type**

Run: `npx vitest run packages/shared/src/runninghub-groups.test.ts`

- [ ] **Step 3: Add the exact shared interfaces**

```ts
export interface RhCatalogGroup {
  id: string;
  providerId: string;
  name: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}
```

Add optional `groupId` and `groupName` to `RhCatalogItem`.

- [ ] **Step 4: Add the migration**

```sql
alter table xh_providers
add column if not exists rh_groups jsonb not null default '[]'::jsonb;
```

- [ ] **Step 5: Run shared build and commit**

Run: `npm run build -w @xinghuan/shared && npx vitest run packages/shared/src/runninghub-groups.test.ts`

```bash
git add packages/shared/src/runninghub.ts packages/shared/src/runninghub-groups.test.ts apps/api/db/048_runninghub_catalog_groups.sql
git commit -m "feat: define RunningHub catalog groups"
```

### Task 2: Persist and normalize groups with Provider records

**Files:**
- Modify: `apps/api/src/runninghub-catalog.ts`
- Modify: `apps/api/src/provider-repository-types.ts`
- Modify: `apps/api/src/provider-repository-mappers.ts`
- Modify: `apps/api/src/provider-repository.ts`
- Modify: `apps/api/src/provider-repository.test.ts`

**Interfaces:**
- Produces `normalizeRunningHubGroups(value, providerId): RhCatalogGroup[]`.
- `normalizeRunningHubCatalogItems(value, kind, validGroupIds?)` preserves only valid group IDs.
- `AdminProviderRecord.rhGroups?: RhCatalogGroup[]`.

- [ ] **Step 1: Write failing normalization tests**

Test that normalization trims names, clamps integer sort order to a non-negative value, removes duplicate IDs, removes duplicate case-insensitive names within one Provider, forces the supplied provider ID, and sorts by `sortOrder`, then name, then ID.

Test entry behavior:

```ts
expect(normalizeRunningHubCatalogItems([{ id: "a", groupId: "missing" }], "app", new Set(["group-a"]))[0].groupId).toBeUndefined();
expect(normalizeRunningHubCatalogItems([{ id: "a", groupId: "group-a" }], "app", new Set(["group-a"]))[0].groupId).toBe("group-a");
```

- [ ] **Step 2: Run focused failures**

Run: `npx vitest run apps/api/src/provider-repository.test.ts`

- [ ] **Step 3: Implement group normalization**

Use stable defaults:

```ts
{
  id,
  providerId,
  name,
  description: safeText(row.description),
  enabled: row.enabled !== false,
  sortOrder: Math.max(0, Math.floor(Number(row.sortOrder) || 0)),
  createdAt: Number(row.createdAt) || now,
  updatedAt: Number(row.updatedAt) || Number(row.createdAt) || now,
}
```

Do not invent a group for legacy entries.

- [ ] **Step 4: Add `rh_groups` to every Provider read/write**

Update `PROVIDER_SELECT`, row interface, mapper, insert/upsert and targeted Provider updates. Persist `rhGroups`, `rhApps` and `rhWorkflows` in one SQL statement so a group delete and item ungrouping cannot split.

- [ ] **Step 5: Run repository tests and commit**

Run:

```bash
npx vitest run apps/api/src/provider-repository.test.ts
npm run type-check -w @xinghuan/api
```

```bash
git add apps/api/src/runninghub-catalog.ts apps/api/src/provider-repository-types.ts apps/api/src/provider-repository-mappers.ts apps/api/src/provider-repository.ts apps/api/src/provider-repository.test.ts
git commit -m "feat: persist RunningHub group metadata"
```

### Task 3: Implement group lifecycle and Admin API

**Files:**
- Create: `apps/api/src/runninghub-group-service.ts`
- Create: `apps/api/src/runninghub-group-service.test.ts`
- Modify: `apps/api/src/admin-runninghub-routes.ts`
- Create: `apps/api/src/admin-runninghub-routes.test.ts`
- Modify: `apps/api/src/server.ts`

**Interfaces:**
- `listGroups(providerId): Promise<RhCatalogGroup[]>`.
- `createGroup({ providerId, name, description }): Promise<RhCatalogGroup>`.
- `updateGroup(groupId, patch): Promise<RhCatalogGroup>`.
- `deleteGroup(groupId): Promise<{ groupId: string; ungroupedCatalogIds: string[] }>`.
- Admin endpoints: GET/POST `/api/admin/runninghub/groups`, PATCH/DELETE `/api/admin/runninghub/groups/:groupId`.

- [ ] **Step 1: Write lifecycle tests**

Cover create, case-insensitive duplicate name rejection, rename, reorder, disable, delete, and delete ungrouping both app and workflow entries. The delete test must assert one Provider repository write contains the new groups and both new entry arrays.

- [ ] **Step 2: Run the failing service test**

Run: `npx vitest run apps/api/src/runninghub-group-service.test.ts`

- [ ] **Step 3: Implement stable IDs and validation**

Generate IDs as `rhg-${now}-${randomSuffix}`. Reject blank names with `RUNNINGHUB_GROUP_NAME_REQUIRED`, duplicates with `RUNNINGHUB_GROUP_NAME_EXISTS`, unknown Provider/group with 404-equivalent errors, and cross-Provider item assignment with `RUNNINGHUB_GROUP_PROVIDER_MISMATCH`.

- [ ] **Step 4: Extend item mutation payloads**

Add `groupId?: string` to create/update bodies. Empty string unsets group. Before write, resolve the group inside the same Provider and reject missing/foreign group IDs. Duplicating an item copies its group unless the create payload explicitly supplies another group.

- [ ] **Step 5: Add route tests**

Test status codes, payload shape and audit actions:

```text
runninghub.group.read
runninghub.group.create
runninghub.group.update
runninghub.group.delete
```

Deletion audit summary includes the number of entries moved to ungrouped but not Provider secrets.

- [ ] **Step 6: Wire, run and commit**

Run:

```bash
npx vitest run apps/api/src/runninghub-group-service.test.ts apps/api/src/admin-runninghub-routes.test.ts
npm run verify:api-admin-runninghub-route-split-contract
npm run verify:file-hotspot-budgets
```

```bash
git add apps/api/src/runninghub-group-service.ts apps/api/src/runninghub-group-service.test.ts apps/api/src/admin-runninghub-routes.ts apps/api/src/admin-runninghub-routes.test.ts apps/api/src/server.ts
git commit -m "feat: add RunningHub group management API"
```

### Task 4: Register group subjects and enforce the two-gate permission model

**Files:**
- Create: `apps/api/src/runninghub-permission-gate.ts`
- Create: `apps/api/src/runninghub-permission-gate.test.ts`
- Modify: `apps/api/src/permissions/permission-subject-registrars.ts`
- Modify: `apps/api/src/permissions/permission-subject-registrars.test.ts`
- Modify: `apps/api/src/server.ts`
- Create: `scripts/verify-runninghub-group-permission-contract.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `runningHubGroupSubjectKey(providerId, groupId)`.
- Produces `decideRunningHubAccess({ item, group, action, decide }): Promise<{ allowed: boolean; groupDecision?: PermissionDecision; itemDecision: PermissionDecision }>`.

- [ ] **Step 1: Write the permission truth-table test**

```ts
it.each([
  [true, true, true],
  [true, false, false],
  [false, true, false],
  [false, false, false],
] as const)("group=%s item=%s -> %s", async (groupAllowed, itemAllowed, expected) => {
  const result = await decideRunningHubAccess({
    item: groupedItem,
    group: enabledGroup,
    action: "execute",
    decide: async (subjectKey) => ({
      allowed: subjectKey.startsWith("runninghub.group/") ? groupAllowed : itemAllowed,
      reason: "group-rule",
    }),
  });
  expect(result.allowed).toBe(expected);
});
```

Also assert ungrouped calls `decide` once and disabled group returns false without evaluating item allow as an override.

- [ ] **Step 2: Run the failing test**

Run: `npx vitest run apps/api/src/runninghub-permission-gate.test.ts`

- [ ] **Step 3: Register group subjects**

Extend reconciliation sources with:

```ts
runningHubGroups: Array<{
  id: string;
  providerId: string;
  name: string;
  enabled: boolean;
}>;
```

Create parent `runninghub.group/*`. Enabled groups are published, disabled groups restricted, deleted groups retired. Item subjects keep their current parent families; do not use permission parent specificity to implement group precedence.

- [ ] **Step 4: Replace all RH decisions with the gate**

Use the same helper in:

- public catalog filtering for `view`;
- catalog detail through the filtered catalog;
- direct submit for `execute`;
- Workflow Run start/resume validation for `execute`.

Resolve group metadata from the Provider that owns the item. An invalid group reference is treated as ungrouped only after normalization; a disabled group is unavailable.

- [ ] **Step 5: Add the cross-layer verifier**

The verifier must assert group subject registration, explicit `groupDecision && itemDecision`, public catalog gate, submit gate, Workflow Run gate, Admin group endpoint and Canvas grouped selector. Register:

```json
"verify:runninghub-group-permission-contract": "node scripts/verify-runninghub-group-permission-contract.mjs"
```

- [ ] **Step 6: Run permission tests and commit**

Run:

```bash
npx vitest run apps/api/src/runninghub-permission-gate.test.ts apps/api/src/permissions/permission-subject-registrars.test.ts
npm run verify:permission-platform-hardening
npm run verify:runninghub-group-permission-contract
```

```bash
git add apps/api/src/runninghub-permission-gate.ts apps/api/src/runninghub-permission-gate.test.ts apps/api/src/permissions/permission-subject-registrars.ts apps/api/src/permissions/permission-subject-registrars.test.ts apps/api/src/server.ts scripts/verify-runninghub-group-permission-contract.mjs package.json
git commit -m "feat: enforce RunningHub group permission boundaries"
```

### Task 5: Carry groups through public catalog and environment sync

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/environment-sync-service.ts`
- Create: `apps/api/src/environment-sync-service.test.ts`
- Modify: `apps/api/src/runninghub-catalog.ts`

**Interfaces:**
- Public provider catalog adds `groups: RhCatalogGroup[]` filtered to groups with at least one visible item.
- Items include `groupId/groupName` after authorization.
- Environment Provider records add `rhGroups?: RhCatalogGroup[]`.

- [ ] **Step 1: Add public projection tests**

Assert visible grouped items carry the canonical group name, hidden/disabled groups are absent, and an empty visible group is not returned. Ungrouped items have neither group field.

- [ ] **Step 2: Add sync round-trip tests**

Assert group ID/name/order/enabled status survive preview and apply. Provider summary adds `rhGroupCount`. A source item referencing a group omitted from the source snapshot becomes ungrouped during target normalization.

- [ ] **Step 3: Implement public response shape**

For each Provider, build authorized items first, derive `visibleGroupIds`, and return groups in canonical order only when their IDs are visible. Do not expose permission rule details in public catalog.

- [ ] **Step 4: Run API tests and commit**

Run:

```bash
npx vitest run apps/api/src/environment-sync-service.test.ts apps/api/src/runninghub-permission-gate.test.ts
npm run verify:environment-sync-smoke
npm run verify:runninghub-workflow-api
```

```bash
git add apps/api/src/server.ts apps/api/src/environment-sync-service.ts apps/api/src/environment-sync-service.test.ts apps/api/src/runninghub-catalog.ts
git commit -m "feat: publish and sync RunningHub groups"
```

### Task 6: Build grouped Admin management

**Files:**
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-api-client.ts`
- Create: `apps/admin/src/admin-runninghub-group-manager.tsx`
- Create: `apps/admin/src/admin-runninghub-create-dialog.tsx`
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
- Modify: `apps/admin/src/admin-runninghub-item-editor.tsx`
- Modify: `apps/admin/src/admin-runninghub-workspace.test.tsx`

**Interfaces:**
- `adminRunningHubApi.listGroups/createGroup/updateGroup/deleteGroup`.
- Create dialog returns `{ kind, title, groupId }` or first creates a group and returns its ID.

- [ ] **Step 1: Extend Admin SSR tests**

Render groups `视频生成`, `图片处理` and ungrouped entries. Assert group headings, item counts, create-group action, item group selector and disabled-group status are present. Assert deleting a group uses confirmation copy “条目将移至未分组，不会删除条目”.

- [ ] **Step 2: Run the failing Admin test**

Run: `npx vitest run apps/admin/src/admin-runninghub-workspace.test.tsx`

- [ ] **Step 3: Add API types and methods**

Use typed payloads:

```ts
type RhGroupCreatePayload = { providerId: string; name: string; description?: string };
type RhGroupUpdatePayload = { name?: string; description?: string; enabled?: boolean; sortOrder?: number };
```

- [ ] **Step 4: Implement the group manager and grouped rail**

Groups sort by `sortOrder/name/id`; ungrouped is always last. Each group section shows enabled/disabled, item count and edit actions. Keep the existing rail as the sole scroll owner and keep its footer fixed.

- [ ] **Step 5: Implement create and edit flows**

The create dialog offers `未分组`, existing groups and `新建分组`. If new group is selected, create it first, then create the item with the returned `groupId`; if item creation fails, keep the newly created empty group and show a retry error rather than silently deleting it. The editor group selector saves through the existing item PATCH.

- [ ] **Step 6: Run Admin tests and commit**

Run:

```bash
npx vitest run apps/admin/src/admin-runninghub-workspace.test.tsx
npm run type-check -w @xinghuan/admin
npm run build -w @xinghuan/admin
npm run verify:admin-runninghub-workspace-helper-split-contract
```

```bash
git add apps/admin/src/admin-types.ts apps/admin/src/admin-api-client.ts apps/admin/src/admin-runninghub-group-manager.tsx apps/admin/src/admin-runninghub-create-dialog.tsx apps/admin/src/admin-runninghub-workspace.tsx apps/admin/src/admin-runninghub-item-editor.tsx apps/admin/src/admin-runninghub-workspace.test.tsx
git commit -m "feat: manage grouped RunningHub catalogs"
```

### Task 7: Show grouped catalogs in Canvas

**Files:**
- Modify: `apps/web/src/services/runninghubCatalog.ts`
- Create: `apps/web/src/services/runninghubCatalog.test.ts`
- Modify: `apps/web/src/components/nodes/RunningHubNodeConfigSection.tsx`

**Interfaces:**
- Produces `groupRunningHubCatalogItems(items): Array<{ key: string; label: string; items: RunningHubCatalogItem[] }>`.

- [ ] **Step 1: Write grouping tests**

Assert canonical group order follows the API item order, same group IDs merge, duplicate names do not merge across IDs, and ungrouped appears last with label `未分组`.

- [ ] **Step 2: Run the failing Web test**

Run: `npx vitest run apps/web/src/services/runninghubCatalog.test.ts`

- [ ] **Step 3: Normalize group fields**

`normalizeCatalogItem` accepts only trimmed string `groupId/groupName`; an absent group ID removes both fields. Legacy payload remains ungrouped.

- [ ] **Step 4: Replace the flat options with grouped options**

```tsx
{groupRunningHubCatalogItems(workflowCatalog).map((group) => (
  <optgroup key={group.key} label={group.label}>
    {group.items.map((workflow) => (
      <option key={workflow.catalogId} value={workflow.catalogId}>
        {`${workflow.title} · ${workflow.providerName} · ${workflow.fields.length} 字段`}
      </option>
    ))}
  </optgroup>
))}
```

- [ ] **Step 5: Run Web checks and commit**

Run:

```bash
npx vitest run apps/web/src/services/runninghubCatalog.test.ts
npm run type-check -w @xinghuan/web
npm run build -w @xinghuan/web
npm run verify:runninghub-node-helper-split-contract
```

```bash
git add apps/web/src/services/runninghubCatalog.ts apps/web/src/services/runninghubCatalog.test.ts apps/web/src/components/nodes/RunningHubNodeConfigSection.tsx
git commit -m "feat: display RunningHub catalog groups on canvas"
```

### Task 8: Document, validate and release `0.8.18`

**Files:**
- Create: `docs/adr/0008-runninghub-catalog-group-permission-boundary.md`
- Modify: `docs/adr/README.md`
- Modify: `CONTEXT.md`
- Modify: `docs/systems/runninghub/README.md`
- Modify: `docs/systems/runninghub/catalog-and-entry-model.md`
- Modify: `docs/systems/auth-and-users/permissions-and-administrator-boundary.md`
- Modify: release version/state/logbook files required by governance.

**Interfaces:**
- Produces a Gray/Production release with independent group and item permission evidence.

- [ ] **Step 1: Record the domain and architecture decision**

Add `RunningHub Catalog Group` to `CONTEXT.md`. ADR 0008 records Provider ownership, optional group assignment, delete-to-ungroup behavior and the explicit two-gate decision.

- [ ] **Step 2: Run the full local matrix**

Run:

```bash
npm run type-check
npm run test
npm run build:single-port
npm run verify:runninghub-group-permission-contract
npm run verify:runninghub-workflow-contract
npm run verify:runninghub-workflow-api
npm run verify:permission-platform-hardening
npm run harness:verify:project
npm run harness:verify:workspace
npm run harness:verify:release
```

- [ ] **Step 3: Deploy Gray `0.8.18`**

Use release ID `20260803-runninghub-groups-v0818-r1`. Back up the Provider and permission tables, deploy the sealed artifact, apply migration, reconcile permission subjects and verify readiness.

- [ ] **Step 4: Perform authenticated Gray acceptance**

Create one group and one app/workflow test entry, move it between groups and ungrouped, rename/reorder/disable the group, and delete a disposable group. Verify:

```text
group deny + item allow = denied
group allow + item deny = denied
group allow + item allow = allowed
ungrouped + item allow = allowed
disabled group + any item rule = denied
```

Check Admin grouped rail and Canvas selector at `1920x1080`, then run one authorized non-billed catalog read and one controlled execution only when the existing test fixture guarantees no charge.

- [ ] **Step 5: Promote the same artifact to Production after approval**

Apply the same migration, reconcile subjects, verify readiness and confirm existing ungrouped RH entries remain visible and executable according to their previous item permissions.

- [ ] **Step 6: Update canonical state and release evidence**

Update `ops/current/release-state.json` first, then projections and release/validation logbooks. Run staged release contracts and commit:

Append the verified `0.8.18` RunningHub group and permission evidence to `docs/systems/harness/README.md` and `docs/systems/harness/workspace-verify-release-map.md`, including the exact Gray archive/SHA reused by Production.

```bash
git commit -m "release: deploy RunningHub groups v0.8.18"
```
