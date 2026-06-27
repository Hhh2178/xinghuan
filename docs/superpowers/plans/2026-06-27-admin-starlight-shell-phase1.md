# Admin Starlight Shell Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable slice of the new Admin frontend: Starlight-style global shell, five workspace navigation domains, lazy-loaded page wrappers, and refresh-aware task/system surfaces while preserving existing backend functionality.

**Architecture:** Keep current Admin data loading and business panels intact for phase 1. Add a new view-model layer for workspace grouping, a shell/presentation layer for the new navigation and workspace cards, and CSS tokens aligned with the `stitch` visual baseline. Existing panels remain mounted through the new shell so the release is reversible.

**Tech Stack:** React 19, TypeScript, Vite, lucide-react, existing Admin API client and contract scripts.

---

## File Structure

- Modify `apps/admin/src/admin-view-model.ts`
  - Add five workspace definitions, workspace-to-tab mapping, tab metadata, refresh policy metadata, and helper functions.
- Modify `apps/admin/src/main.tsx`
  - Render the new global shell, grouped navigation, workspace overview cards, and lazy-page loading boundaries around existing panels.
- Modify `apps/admin/src/styles.css`
  - Add Starlight visual tokens and shell/layout styles while preserving existing panel styles.
- Create `scripts/verify-admin-starlight-shell-contract.mjs`
  - Contract test for workspace definitions, shell references, lazy boundaries, refresh controls, and CSS tokens.
- Modify `package.json`
  - Add `verify:admin-starlight-shell`.
- Modify `docs/systems/admin/frontend-design/page-map-and-functions.md`
  - Record phase 1 implementation status.

---

### Task 1: Add Starlight Shell Contract

**Files:**
- Create: `scripts/verify-admin-starlight-shell-contract.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing contract script**

Create `scripts/verify-admin-starlight-shell-contract.mjs`:

```js
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const viewModelPath = join(root, "apps", "admin", "src", "admin-view-model.ts");
const mainPath = join(root, "apps", "admin", "src", "main.tsx");
const stylesPath = join(root, "apps", "admin", "src", "styles.css");

const viewModel = readFileSync(viewModelPath, "utf8");
const main = readFileSync(mainPath, "utf8");
const styles = readFileSync(stylesPath, "utf8");

const requiredWorkspaceIds = [
  "command-center",
  "capability-console",
  "resource-content",
  "governance-center",
  "ops-center",
];

const checks = [
  {
    name: "admin view model exists",
    pass: existsSync(viewModelPath),
  },
  {
    name: "workspace model defines all five domains",
    pass: requiredWorkspaceIds.every((id) => viewModel.includes(`id: "${id}"`)),
  },
  {
    name: "workspace labels use product language",
    pass:
      viewModel.includes('label: "运营总览"') &&
      viewModel.includes('label: "能力配置"') &&
      viewModel.includes('label: "资源与内容"') &&
      viewModel.includes('label: "组织与治理"') &&
      viewModel.includes('label: "系统与发布"'),
  },
  {
    name: "existing tabs remain mapped into workspaces",
    pass:
      viewModel.includes('"overview"') &&
      viewModel.includes('"providers"') &&
      viewModel.includes('"runninghub-workspace"') &&
      viewModel.includes('"public-resources"') &&
      viewModel.includes('"users"') &&
      viewModel.includes('"tasks"') &&
      viewModel.includes('"system"') &&
      viewModel.includes('"environment-sync"'),
  },
  {
    name: "main renders new shell classes",
    pass:
      main.includes("starlight-shell") &&
      main.includes("starlight-sidebar") &&
      main.includes("starlight-topbar") &&
      main.includes("starlight-domain-nav") &&
      main.includes("starlight-workspace-home"),
  },
  {
    name: "main keeps existing business panels",
    pass:
      main.includes("<Overview") &&
      main.includes("<UsersPanel") &&
      main.includes("<ApiSettingsPanel") &&
      main.includes("<AdminRunningHubWorkspace") &&
      main.includes("<AdminPublicResourcesPanel") &&
      main.includes("<TasksPanel") &&
      main.includes("<AuditPanel") &&
      main.includes("<SystemPanel") &&
      main.includes("<AdminEnvironmentSyncPanel"),
  },
  {
    name: "lazy loading boundary is present",
    pass: main.includes("Suspense") && main.includes("starlight-page-loading"),
  },
  {
    name: "refresh controls are visible in shell",
    pass: main.includes("refreshPolicy") && main.includes("最近刷新"),
  },
  {
    name: "stitch visual tokens are present",
    pass:
      styles.includes("--starlight-bg") &&
      styles.includes("--starlight-cyan") &&
      styles.includes("--starlight-panel") &&
      styles.includes(".starlight-shell") &&
      styles.includes(".starlight-domain-nav"),
  },
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Admin Starlight shell contract failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
```

- [ ] **Step 2: Add package script**

Add to root `package.json` scripts:

```json
"verify:admin-starlight-shell": "node scripts/verify-admin-starlight-shell-contract.mjs"
```

- [ ] **Step 3: Run contract and verify RED**

Run:

```bash
npm run verify:admin-starlight-shell
```

Expected:

```text
Admin Starlight shell contract failed:
- workspace model defines all five domains
- main renders new shell classes
- lazy loading boundary is present
- stitch visual tokens are present
```

---

### Task 2: Add Workspace View Model

**Files:**
- Modify: `apps/admin/src/admin-view-model.ts`

- [ ] **Step 1: Add workspace types and definitions**

Add `AdminWorkspaceId`, `AdminWorkspace`, `adminWorkspaces`, `tabWorkspaceMap`, `workspaceForTab`, `tabsForWorkspace`, and `refreshPolicyFor`.

- [ ] **Step 2: Preserve old tab labels**

Keep `adminNavItems`, `titleFor`, `statusText`, `taskTone`, `taskStatusText`, `taskDisplayTone`, `capabilityLabel`, and `modelCapabilityTagLabel` compatible with existing contracts.

- [ ] **Step 3: Run existing contract**

Run:

```bash
npm run verify:admin-view-model-contract
```

Expected: pass.

---

### Task 3: Render New Shell Around Existing Panels

**Files:**
- Modify: `apps/admin/src/main.tsx`

- [ ] **Step 1: Import new model helpers and Suspense**

Update imports to include React `Suspense`, workspace helpers, and icons needed by the shell.

- [ ] **Step 2: Replace flat sidebar with Starlight shell**

Render:

- `starlight-shell`
- `starlight-sidebar`
- `starlight-domain-nav`
- `starlight-topbar`
- `starlight-workspace-home`
- existing business panels inside `Suspense`

- [ ] **Step 3: Add workspace overview cards**

When active page is a workspace home, show cards for that workspace's mapped tabs.

- [ ] **Step 4: Keep existing assistant behavior**

Retain `AdminAssistantPanel` and current open/close persistence.

---

### Task 4: Add Starlight Styles

**Files:**
- Modify: `apps/admin/src/styles.css`

- [ ] **Step 1: Add CSS tokens**

Add:

```css
:root {
  --starlight-bg: #0b0c10;
  --starlight-panel: #1f2128;
  --starlight-panel-2: #171920;
  --starlight-border: #2d2f36;
  --starlight-cyan: #66fcf1;
  --starlight-cyan-dim: rgba(102, 252, 241, 0.16);
  --starlight-text: #f4f7fb;
  --starlight-muted: #9aa7ad;
  --starlight-warning: #f1c40f;
  --starlight-danger: #e74c3c;
  --starlight-success: #2ecc71;
}
```

- [ ] **Step 2: Add shell layout styles**

Add styles for sidebar, topbar, domain nav, workspace cards, loading boundary, refresh policy, and responsive assistant layout.

---

### Task 5: Verify and Document Phase 1

**Files:**
- Modify: `docs/systems/admin/frontend-design/page-map-and-functions.md`

- [ ] **Step 1: Run contracts**

Run:

```bash
npm run verify:admin-starlight-shell
npm run verify:admin-view-model-contract
npm run build -w @xinghuan/admin
```

Expected: all pass.

- [ ] **Step 2: Update frontend design record**

Add a section noting phase 1 implemented:

- Starlight shell.
- Five workspace navigation.
- Existing panel migration.
- Lazy page boundary.
- Refresh policy display.

- [ ] **Step 3: Commit**

Commit files:

```bash
git add package.json scripts/verify-admin-starlight-shell-contract.mjs apps/admin/src/admin-view-model.ts apps/admin/src/main.tsx apps/admin/src/styles.css docs/systems/admin/frontend-design/page-map-and-functions.md docs/superpowers/plans/2026-06-27-admin-starlight-shell-phase1.md
git commit -m "feat: add admin starlight shell phase 1"
```

---

## Self-Review

- Spec coverage: This phase covers global Shell, five workspaces, stitch baseline, lazy boundary, refresh-policy visibility, and preservation of existing admin functionality. It does not yet redesign every business panel; those belong to later phases.
- Placeholder scan: No TODO/TBD placeholders are used in executable steps.
- Type consistency: New workspace IDs map existing `AdminTabId` values and do not rename existing panel ids.
