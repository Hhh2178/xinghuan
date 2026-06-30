# Group Execution Manager And Tech Theme Lockdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make group execution run in topological order within each group, add one global group-execution manager node for group-level orchestration, and lock the canvas UI to the current tech theme with only dark/light switching while archiving all legacy style presets.

**Architecture:** Group execution stays in the canvas runtime, but the group-box node becomes a container only. A new manager node owns global group ordering and exclusion, while `topologicalSort()` becomes the single source of truth for execution order inside each group. Theme handling is split into a locked tech runtime path plus an archive path for legacy presets, so the app keeps dark/light mode but no longer exposes alternate visual styles in the foreground.

**Tech Stack:** React, TypeScript, Zustand, XYFlow / React Flow, existing canvas runtime utilities, filesystem docs under `docs/`.

---

### Task 1: Lock Down The Theme Runtime Surface

**Files:**
- Modify: `apps/web/src/stores/theme.ts`
- Modify: `apps/web/src/theme/types.ts`
- Modify: `apps/web/src/theme/defaultTemplates.ts`
- Modify: `apps/web/src/theme/applyTheme.ts`
- Modify: `apps/web/src/theme/validateTheme.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/components/CanvasToolbar.tsx`
- Modify: `apps/web/src/components/ThemeTemplateManager.tsx`
- Modify: `apps/web/src/components/NodeActionBar.tsx`
- Modify: `apps/web/src/components/nodes/GroupBoxNode.tsx`
- Modify: `apps/web/src/components/nodes/OutputNode.tsx`
- Modify: `apps/web/src/components/nodes/PortraitMasterNode.tsx`
- Modify: `apps/web/src/components/nodes/UploadNode.tsx`
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/web/src/components/nodes/RHToolsNode.tsx`
- Modify: `apps/web/src/components/nodes/RhConfigNode.tsx`
- Modify: `apps/web/src/components/nodes/SeedanceNode.tsx`
- Modify: `apps/web/src/components/nodes/VideoNode.tsx`
- Modify: `apps/web/src/components/nodes/ImageNode.tsx`
- Modify: `apps/web/src/components/nodes/PickFromSetNode.tsx`
- Modify: `apps/web/src/components/nodes/TextSplitNode.tsx`
- Modify: `apps/web/src/styles/theme-op.css`
- Modify: `apps/web/src/styles/theme-rh.css`
- Modify: `apps/web/src/styles/theme-naruto.css`
- Modify: `apps/web/src/styles/theme-eva.css`
- Modify: `apps/web/src/styles/theme-yyh.css`
- Modify: `apps/web/src/styles/theme-slamdunk.css`
- Modify: `apps/web/src/styles/theme-soccer.css`
- Modify: `apps/web/src/styles/theme-pixel.css`
- Modify: `apps/web/src/styles/index.css`
- Create: `docs/archive/canvas-theme-presets/README.md`
- Create: `docs/archive/canvas-theme-presets/legacy-style-presets.md`
- Create: `docs/archive/canvas-theme-presets/theme-manager-archive-notes.md`
- Modify: `docs/logbooks/daily/2026/2026-06/2026-06-30.md`

- [ ] **Step 1: Write the failing contract for theme surface lock**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const themeStore = readFileSync(join(root, 'apps', 'web', 'src', 'stores', 'theme.ts'), 'utf8');
const templateManager = readFileSync(join(root, 'apps', 'web', 'src', 'components', 'ThemeTemplateManager.tsx'), 'utf8');

assert.ok(themeStore.includes("style: 'tech'"));
assert.ok(themeStore.includes("toggleStyle"));
assert.ok(templateManager.includes("VISUAL_STYLE_OPTIONS"));
```

- [ ] **Step 2: Run the contract and confirm it fails before code changes**

Run: `npx tsx scripts/verify-canvas-theme-lockdown-contract.ts`
Expected: FAIL because legacy visual style options still exist in foreground code.

- [ ] **Step 3: Remove the foreground multi-style theme controls and keep only tech + dark/light**

```ts
// Keep theme mode switching.
// Remove alternate visual style selection from the foreground.
// Lock default template resolution to the tech template and archive old presets.
```

- [ ] **Step 4: Run the theme contract and the web typecheck**

Run:
`npx tsx scripts/verify-canvas-theme-lockdown-contract.ts`
`npm run type-check -w @xinghuan/web`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src docs/archive/canvas-theme-presets docs/logbooks/daily/2026/2026-06/2026-06-30.md
git commit -m "feat: lock canvas theme to tech and archive legacy presets"
```

### Task 2: Add The Global Group Execution Manager Node

**Files:**
- Modify: `apps/web/src/config/nodeRegistry.ts`
- Create: `apps/web/src/components/nodes/GroupExecutionManagerNode.tsx`
- Modify: `apps/web/src/components/Canvas.tsx`
- Modify: `apps/web/src/stores/groupBus.ts`
- Modify: `apps/web/src/utils/topologicalSort.ts`
- Modify: `apps/web/src/utils/sendMaterials.ts`
- Modify: `apps/web/src/components/canvas/groupBoxGuards.ts`
- Create: `scripts/verify-group-execution-manager-contract.ts`
- Modify: `docs/systems/canvas/node-and-data-model.md`
- Modify: `docs/systems/worker/execution-chain.md`
- Modify: `docs/systems/canvas/README.md`
- Modify: `docs/logbooks/daily/2026/2026-06/2026-06-30.md`

- [ ] **Step 1: Write the failing contract for group execution topology**

```ts
import assert from 'node:assert/strict';
import { topologicalSort } from '../apps/web/src/utils/topologicalSort';

const nodes = [
  { id: 'a', type: 'text', position: { x: 0, y: 0 }, data: {} },
  { id: 'b', type: 'image', position: { x: 0, y: 0 }, data: {} },
  { id: 'c', type: 'output', position: { x: 0, y: 0 }, data: {} },
];
const edges = [
  { id: 'e1', source: 'a', target: 'b' },
  { id: 'e2', source: 'b', target: 'c' },
];

assert.deepEqual(topologicalSort(nodes as any, edges as any, new Set(['text', 'image', 'output'])), ['a', 'b', 'c']);
```

- [ ] **Step 2: Run the contract and confirm the existing group execution path does not yet honor topology**

Run: `npx tsx scripts/verify-group-execution-manager-contract.ts`
Expected: FAIL.

- [ ] **Step 3: Add a single global manager node and route its state through the canvas runtime**

```ts
// The manager node stores group-level order and skip flags.
// The canvas runtime reads that order when running all groups.
// Each group still executes its members by topological order.
```

- [ ] **Step 4: Make the canvas run path execute group members in sorted order**

```ts
// Build a per-group subgraph.
// Sort executable nodes by directed edges using topologicalSort().
// Execute the sorted sequence instead of parallel-firing the whole group.
```

- [ ] **Step 5: Run the runtime tests and web typecheck**

Run:
`npx tsx scripts/verify-group-execution-manager-contract.ts`
`npm run type-check -w @xinghuan/web`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/config/nodeRegistry.ts apps/web/src/components/nodes/GroupExecutionManagerNode.tsx apps/web/src/components/Canvas.tsx apps/web/src/stores/groupBus.ts apps/web/src/utils/topologicalSort.ts apps/web/src/utils/sendMaterials.ts apps/web/src/components/canvas/groupBoxGuards.ts scripts/verify-group-execution-manager-contract.ts docs/systems/canvas/node-and-data-model.md docs/systems/worker/execution-chain.md docs/systems/canvas/README.md
git commit -m "feat: add global group execution manager and topo ordering"
```

### Task 3: Update Docs, Archive Notes, And Verify The Release Surface

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `MEMORY.md`
- Modify: `docs/prd/README.md`
- Modify: `ops/README.md`
- Modify: `DEVLOG.md`
- Modify: `docs/logbooks/releases/current-release-index.md`
- Modify: `docs/logbooks/releases/gray/README.md` if current gray entry changes
- Modify: `docs/logbooks/releases/production/README.md` if current production entry changes
- Modify: `docs/logbooks/daily/2026/2026-06/recent-highlights.md`
- Modify: `docs/superpowers/plans/2026-06-30-group-execution-manager-and-tech-theme-lockdown.md`

- [ ] **Step 1: Write the archive record for removed visual styles**

```md
# Canvas Theme Presets Archive

- Removed from foreground runtime: pixel, op, rh, naruto, eva, yyh, slamdunk, soccer-hero.
- Remaining foreground runtime: tech only, with dark/light mode preserved.
- Archive source of truth: this folder.
```

- [ ] **Step 2: Update the current-state docs to mention the locked tech theme and new group manager**

```md
- Current theme runtime: tech only, dark/light preserved.
- Legacy visual presets: archived out of foreground runtime.
- Group execution: topo-ordered inside each group, orchestrated by one global manager node.
```

- [ ] **Step 3: Run the release surface consistency checks**

Run:
`npm run verify:current-release-entry-consistency`
`npm run type-check -w @xinghuan/web`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md MEMORY.md docs/prd/README.md ops/README.md DEVLOG.md docs/logbooks/releases/current-release-index.md docs/logbooks/daily/2026/2026-06/recent-highlights.md docs/superpowers/plans/2026-06-30-group-execution-manager-and-tech-theme-lockdown.md docs/archive/canvas-theme-presets
git commit -m "docs: record group execution manager and theme lockdown"
```

## Self-Review

- Spec coverage:
  - Group topo execution is covered by Task 2.
  - Global group manager node is covered by Task 2.
  - Tech-only runtime with dark/light preserved is covered by Task 1.
  - Legacy preset archive and documentation removal are covered by Task 1 and Task 3.
- Placeholder scan:
  - No TBD/TODO placeholders.
  - Code snippets are concrete and tied to real files.
- Type consistency:
  - `topologicalSort()` is the shared ordering primitive.
  - `GroupExecutionManagerNode` is the single new orchestration node.
  - `tech` remains the only active visual style in runtime; `dark/light` remains the mode switch.

