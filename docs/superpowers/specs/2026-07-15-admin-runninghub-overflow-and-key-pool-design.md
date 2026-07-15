# Admin RunningHub Overflow And Key Pool Design

**Date:** 2026-07-15
**Scope:** Admin global overflow guardrails, RunningHub catalog cards, Provider-level RH Key pool information architecture
**Status:** Approved for implementation
**Target gray version:** `v0.6.5`

## 1. Evidence And Problem Boundary

The `v0.6.4` gray backend was reviewed at `1920x1080` with the AI assistant open. API settings, public resources, organization governance, tasks, and environment sync no longer reproduce the earlier full-panel overlap. Two RunningHub defects remain:

1. Long AI application titles, notes, capability summaries, status, and Provider names share an unconstrained natural-height catalog card. The Provider footer can visually enter the following card.
2. The RH Key pool is rendered below the selected workflow/application editor, which incorrectly presents Provider credentials as item-owned configuration.

The fix must preserve the existing RunningHub CRUD, test, analyze, Key save, default-Key, enable/disable, and delete behavior.

## 2. Information Architecture

The RunningHub workspace order is fixed as:

1. Workspace introduction and actions.
2. Workflow and AI application statistics.
3. **Provider-level RH Key pool.**
4. Search, kind tabs, and status filters.
5. Catalog rail and selected-item editor.
6. AI analysis workbench.

The Key pool is not a child of the selected workflow or AI application. Its summary must state the current Provider, enabled-Key count, and total concurrency. It remains collapsed by default. Create, edit, default, enable/disable, delete, and save controls are exposed only in the expanded body.

## 3. Catalog Card Structure

Each catalog card has four explicit tracks:

1. Icon.
2. Title: one line with ellipsis and a native title tooltip.
3. Note and capability summary: note is limited to two lines; capability summary is one line.
4. Footer: enabled state and Provider identity, separated from content and unable to overlap the following card.

Warnings remain visible but are limited to two lines. All tracks use `min-width: 0`; long identifiers may break safely without widening the rail.

## 4. Global Overflow Guardrails

The Admin shell must guarantee:

- direct workspace and page children may shrink with `min-width: 0`;
- flex/grid toolbars wrap instead of covering adjacent controls;
- URLs and long identifiers wrap only in descriptive/detail surfaces;
- tables retain their own controlled horizontal scrolling;
- no blanket `overflow: hidden` is applied to form controls, tables, menus, or dialogs.

## 5. Responsive Acceptance Matrix

The following four combinations are mandatory:

| Viewport | AI assistant | Required result |
| --- | --- | --- |
| `1920x1080` | closed | two-column RH rail/editor layout, no overlap |
| `1920x1080` | open | layout may collapse at its breakpoint, all controls remain reachable |
| `2560x1440` | closed | two-column layout with bounded catalog rail |
| `2560x1440` | open | two-column layout remains readable, no text collision |

Each combination must cover both workflow and AI application tabs, a long-text catalog card, the collapsed and expanded Key pool, and regression checks for API settings, public resources, organization governance, tasks, and environment sync.

## 6. Non-Goals

- No RunningHub API or database schema change.
- No secret values in browser evidence, logs, screenshots, or Git.
- No change to canvas-side RunningHub permissions or execution behavior.
- No production deployment in this stage; production remains on its recorded current version.

## 7. Acceptance Evidence

Completion requires all of the following:

1. Source contract proves the Key pool precedes catalog filters/layout and is outside the item editor stack.
2. Source contract proves explicit title, note, summary, warning, and footer tracks.
3. CSS contract proves one-line/two-line clamps and shrink-safe grid/flex boundaries.
4. Admin contract tests, typecheck, build, project/workspace/release harnesses, and release guards pass.
5. Gray `v0.6.5` is deployed and the four browser combinations are recorded in the validation logbook.
