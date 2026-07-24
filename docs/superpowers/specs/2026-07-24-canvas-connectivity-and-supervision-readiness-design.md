# Canvas Connectivity And Supervision Readiness

## Status

Proposed. This document extends the accepted Workflow-scoped supervision model in ADR 0004. It does not alter the Run authority boundary, release state, or Production.

## Problem

Grouped nodes and Workflow Regions can visually obscure edges, making valid topology appear disconnected. Selecting a node does not explain its local or transitive dependencies. AI supervision also exposes low-level validation errors after an attempted Run, so users cannot tell whether a Workflow Region, node, input, model, or runtime gate blocked execution.

## Goals

- Keep every edge legible above Group and Workflow Region fills.
- On node selection, distinguish direct dependency edges from the rest of the upstream/downstream chain.
- Explain AI supervision readiness before Run creation and translate authoritative failures into a concrete repair action.
- Preserve server-side validation as the only authority for creating and starting a Run.
- Validate only PC `1920x1080` and `2560x1440` views.

## Non-goals

- Do not make legacy-browser nodes server-runnable.
- Do not permit AI supervision to add nodes, change topology, or choose unpublished models.
- Do not change active Run snapshots or bypass feature flags, PostgreSQL, ownership, model, budget, or Worker validation.
- Do not test or add mobile/tablet behavior.

## Connectivity Design

### Edge visibility

Canvas edge renderers will be layered above Group/Workflow Region background fills while remaining below selected nodes and interaction controls. Every ordinary edge retains a baseline stroke with sufficient contrast against both canvas and region fills. Region boundaries must never clip or mask an edge merely because both endpoints are members.

### Selection hierarchy

When exactly one node is selected, directed graph traversal computes four disjoint edge sets:

- Direct upstream: edges ending at the selected node, rendered with strongest cyan emphasis.
- Direct downstream: edges starting at the selected node, rendered with strongest orange emphasis.
- Transitive upstream: all earlier reachable edges, rendered in subdued cyan-blue.
- Transitive downstream: all later reachable edges, rendered in subdued amber.

Direct edges take precedence if an edge is also encountered during traversal. Unrelated edges stay visible at reduced opacity. Multiple selection and no selection retain normal edge styling. Traversal is bounded to the loaded Canvas edge graph and uses visited node/edge sets, so cycles cannot recurse indefinitely.

## AI Supervision Readiness

The Supervision Dock will show a readiness summary for the selected Workflow Region before Run creation:

- **Ready**: Region exists, has executable steps, all non-skipped nodes are `native_server`, boundary inputs are resolvable, and the latest client-side snapshot has no known structural blocker.
- **Blocked**: Missing Workflow Region, empty plan, legacy-browser node, missing or mismatched Workflow Input, or invalid topology. The panel identifies the responsible node and supplies the supported correction.
- **Needs server check**: client-visible structure is valid but provider/model availability, owner assets, runtime feature flags, or current database state require the authoritative create/start endpoint.

The server remains authoritative. The client readiness output is advisory and must never enable a Start button when the server rejects a Run. Create/start failures map stable error codes to a node-oriented explanation and retain the original code in expandable technical details.

The supported Run recipe is explicit: Workflow Region -> supported native-server nodes -> optional explicit Smart Candidate Selector -> Workflow Output. The historical `canvas-agent` node remains readable only and must never be offered as a correction.

## Gray Validation

Use an isolated Gray Canvas and approved test account only. Verify, in order:

1. Runtime controls, API, Worker, and current Gray release are healthy before creating test data.
2. A valid minimum Workflow Region creates a Run Plan, starts, reaches output, and produces an ordered event ledger.
3. A workflow with one legacy node is blocked before Start with a node-specific correction.
4. A missing Workflow Input is blocked with a boundary-specific correction.
5. Pause/resume, cancellation, and a failed supported node retain explicit diagnosis and do not affect another Run.
6. At `1920x1080` and `2560x1440`, grouped edges remain visible and the four selection states are distinguishable without horizontal overflow.

All Gray mutations are disposable and must be explicitly deleted after evidence capture. No Production request, configuration change, deployment, or GitHub push is in scope.

## Verification

- Unit tests for graph classification precedence, cycles, selected/no-selected state, and readiness/error-code mapping.
- Existing compiler/service tests cover authoritative structural, boundary, and native-server enforcement.
- Web type-check, production build, Assistant and Agent Runtime contracts, CodeGraph sync, and relevant Harness checks.
- Playwright screenshots and interaction checks at the two approved PC viewports.

## Rollback

All changes are additive presentation/readiness logic around existing authority checks. Removing the client projection does not mutate persisted Canvases or Runs. Gray rollback remains the currently verified release procedure; Production remains untouched.
