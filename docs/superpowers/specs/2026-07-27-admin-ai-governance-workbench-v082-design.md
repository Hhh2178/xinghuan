# Admin AI Governance Workbench v0.8.2 Design

## Status

- Status: approved by the user on 2026-07-27.
- Target version: `0.8.2`.
- Product scope: Admin `AI 助手`, `AI 托管与自动化`, and `运行与审计`.
- Visual scope: PC desktop only, with one formal acceptance pass at `1920x1080`.
- Release scope: local verification, Gray deployment and authenticated Gray verification are authorized. Production promotion is authorized only after every Gray gate in this document passes.
- Browser scope: Chrome is preferred. If local Google Safe Browsing continues to block the new domain, use Edge or the Codex internal browser for the same authenticated test matrix. A browser change is not evidence that the Safe Browsing classification is resolved.
- GitHub scope: no GitHub push is required by this design unless separately requested.

## Problem

The backend already supports Agent configuration drafts, review, approval, environment publication, LLM route versions, route simulation, environment controls, quality profiles, Runs, approvals, recovery decisions and audit records. The Admin UI exposes most of these capabilities, but groups them around implementation entities rather than administrator tasks.

The current experience has four concrete failures:

1. The assistant workspace displays Agent and route publication as read-only, while the supervision workspace filters assistant routes. An administrator can edit assistant configuration but cannot complete the Production publication lifecycle from the normal Admin path.
2. Assistant surface settings, Agent configuration and LLM routing are visually equal and disconnected. Operators cannot tell which missing step causes restricted mode.
3. Supervision exposes low-level switches without explaining their effective behavior, dependencies or Workflow Run scope.
4. Runs, approvals, recovery decisions and audit records are separate read-only lists. Operators must manually correlate raw IDs before they can understand or safely approve an action.

The existing dark industrial treatment also diverges from the established Admin Starlight system. The redesign must use the current black/cyan base, restrained cyan and green gradients, fine grid, low-luminance borders and layered blue/cyan surfaces.

## Goals

1. Organize assistant governance around the lifecycle `选择模型 -> 启用助手 -> 审核发布 -> 验证已生效`.
2. Let an authorized administrator complete Agent and route publication for Gray and Production from the assistant workspace.
3. Make every control explain its scope, effect, dependencies and fallback behavior.
4. Replace low-level supervision switches with understandable supervision modes while preserving advanced per-field control.
5. Turn runtime evidence into one actionable queue with an immutable correlated detail view.
6. Preserve all current authority boundaries and historical records.
7. Match the existing Admin Starlight visual language without creating a separate micro-theme.
8. Deliver, validate and promote version `0.8.2` through Gray before Production.

## Non-Goals

- No mobile or tablet redesign.
- No new free-form autonomous Agent behavior.
- No automatic node creation, edge changes or silent Canvas mutations.
- No replacement of deterministic Workflow compilation or Worker scheduling authority.
- No merging of Assistant Conversation, Agent Run, Workflow Run, Approval, Recovery Decision or Audit Record identities.
- No automatic Production promotion when Gray evidence is incomplete.
- No claim that changing browsers resolves Google Safe Browsing classification.

## Chosen Approach

The chosen structure combines a guided lifecycle with an exception-first overview.

Rejected alternatives:

- Entity-first editors preserve backend purity but continue forcing administrators to understand internal tables and version IDs.
- A single simplified settings form hides important review, publication and audit boundaries and would create an unsafe mutable monolith.

The selected approach keeps existing APIs and domain records authoritative. New frontend view models correlate those records into task-oriented workspaces. A read-only aggregation endpoint may be added only if client-side joins cannot provide bounded pagination and consistent snapshots for the activity queue.

## Information Architecture

`智能体与自动化` retains three exclusive subpages:

1. `AI 助手`
2. `AI 托管与自动化`
3. `运行与审计`

Only the active workspace mounts. Dirty editors keep the existing stay/discard guard. Manual refresh is disabled while a mutation is pending or a draft is dirty.

## AI Assistant Workspace

### Surface selection

A segmented control switches between:

- `创作侧助手`: Canvas, node, workflow and supervision diagnostic context.
- `后台 AI 助手`: Provider, model, task and audit context.

The two surfaces retain separate settings, Agent definitions, route pools and permission boundaries.

### Status overview

The first band answers whether the selected assistant is usable in the current environment:

- current conclusion;
- assistant configuration status;
- route publication status;
- latest verification status.

Restricted mode must state the missing requirement in plain Chinese, such as `Production 路由未发布`, instead of showing only a version or internal key.

### Guided lifecycle

The main editor contains four stable steps:

1. `助手能力`: display name, placeholder, enabled state and allowed context attachments.
2. `模型路由`: primary chat model, ordered fallbacks and route simulation.
3. `审核发布`: Agent and route draft/review/approve/publish/rollback for Gray and Production.
4. `生效验证`: a real assistant request with visible selected model, environment, outcome and timestamp.

The active step owns the primary action. Publication controls are no longer read-only in this workspace. Production publication and every rollback require an impact confirmation.

### Advanced strategy

Token budget, timeout, estimated-cost ceiling, capability tags, circuit-breaker threshold, cooldown, approval policy and other expert fields move to an `高级策略` drawer. The drawer displays effective values and validation errors but does not obscure the normal lifecycle.

### Validation rules

- Only enabled chat-capable catalog models are selectable.
- A route must contain at least one enabled candidate.
- The selected Agent definition and route purpose must match the current assistant surface.
- Publication readiness requires both an approved Agent version and approved route version.
- Publishing affects only new Agent Runs; active Runs retain their snapshots.
- The verification step cannot show success without a real completed request in the selected environment.

## AI Supervision Workspace

### Environment controls

Gray and Production appear as separate environment rows. Each row explains that changes affect only new Workflow Runs. The UI shows the effective mode derived from the underlying environment controls.

### Supervision modes

Three modes provide understandable presets:

- `仅观察`: plan and diagnose; do not execute automatic recovery.
- `受控托管`: execute bounded safe retries; model changes and prompt rewrites require approval.
- `自动恢复`: execute published recovery actions inside the frozen budget and candidate set.

Modes are projections over existing controls and policy fields, not new runtime authorities. If advanced fields no longer match a preset, the UI displays `自定义托管` with an explicit summary.

### Policy sections

The main page summarizes:

- deterministic planning and maximum concurrency;
- smart candidate confidence threshold and low-confidence behavior;
- technical-failure retries, backoff and route fallback;
- content/policy failure behavior and approval requirement;
- quality evaluation profile;
- frozen budget and candidate constraints.

Planner configuration, route pools, quality profiles and recovery roles remain versioned editors. Saving creates a draft; it never mutates the active published version.

### Safety explanation

The page permanently states that supervision is Workflow Region-scoped and cannot create nodes, modify connections, bypass permissions, exceed frozen budgets or change active Run snapshots.

Ambiguous low-level switches such as `agentEnabled`, `canvasRunsEnabled`, `automaticRecoveryEnabled` and `qualityEvaluationEnabled` are not presented as unrelated peers. Their effective combined behavior is shown through the supervision mode and readiness checks.

## Activity And Audit Workspace

### Exception-first queue

The first view prioritizes:

1. pending approvals;
2. failed Runs;
3. degraded Runs and manual transfers;
4. successfully recovered Runs.

Filters include environment, time range, status, owner and workflow. The queue uses human workflow, node, Provider and model names as primary labels. Stable IDs remain available in technical details and copy actions.

### Correlated detail

Selecting one queue item opens an unframed same-page detail region containing:

- environment and human workflow identity;
- Workflow Run and Agent Run references;
- normalized failure diagnostic;
- immutable event timeline;
- recovery decision and model change;
- approval state and decision reason;
- audit actions and tool results;
- affected budget and downstream state.

The UI correlates records by stable IDs without merging their storage or lifecycle.

### Approval actions

Every approval states before confirmation:

- what will execute;
- which Run and step are affected;
- whether Canvas or node configuration changes;
- whether budget changes;
- what rejection does.

Prompt rewrite approvals include a bounded before/after diff. Model fallback approvals show current and target human-readable identities. Approve, reject and cancel remain explicit audited commands.

### Empty, loading and error states

- Empty queues explain that no action is required and preserve filters.
- Partial-load failures keep successfully loaded evidence visible and identify the unavailable section.
- Mutation failures keep the detail open, preserve the operator's reason and do not optimistically mark the command successful.
- Stale revision conflicts reload the current record and require a fresh decision.
- Unknown historical IDs display readable fallback labels and retain raw identifiers under technical details.

## Visual System

The workspaces reuse existing Admin shell and tokens:

- black and cyan base surfaces;
- subtle cyan/green radial and linear gradients;
- the existing 40px fine grid where already used by the Admin workspace;
- low-luminance borders and square-to-6px radii;
- cyan for active/focus, green for healthy/success, yellow for attention, red only for destructive or failed states;
- compact headings and dense operational typography;
- Lucide icons for familiar actions;
- no decorative cards, nested cards, gradient orbs or oversized marketing typography.

Page sections remain unframed or full-width bands. Cards are reserved for repeated route entries, queue items and genuinely bounded tools. All fixed controls have stable dimensions, and no content may overlap at `1920x1080`.

## Component Boundaries

The implementation should avoid growing the existing governance workspace files into new hotspots. Expected boundaries are:

- assistant readiness/lifecycle view model;
- assistant lifecycle header and step navigation;
- publication readiness and environment actions;
- supervision mode mapper and effective-policy summary;
- activity queue correlation view model;
- activity list, detail timeline and approval impact panel;
- shared governance status, environment and error presentation primitives.

Editors for Agent roles, route pools and quality profiles remain reusable domain editors. They receive publication capability and context from their owning workspace instead of embedding page-specific navigation.

## Data Flow

### Assistant publication

1. Load surface settings, Agent definitions, route pools and model catalog.
2. Derive readiness for the selected surface and environment.
3. Save surface settings or create versioned Agent/route drafts.
4. Transition drafts through review and approval.
5. Publish approved Agent and route versions to Gray or Production.
6. Reload authoritative publication state.
7. Run a real assistant verification and record the displayed result.

### Supervision configuration

1. Load environment controls, planner/recovery roles, route pools and quality profiles.
2. Map controls and policies to an effective supervision mode.
3. Edit a preset or advanced fields.
4. Save versioned drafts and publish through the existing lifecycle.
5. Show that active Runs retain frozen snapshots.

### Activity handling

1. Load bounded Run, approval, recovery and audit pages.
2. Correlate records into stable queue items.
3. Load full detail only when selected.
4. Submit an approval decision with the operator reason and current revision.
5. Reload the authoritative item, timeline and queue counters.

## Permissions And Security

- Existing Admin authentication, CSRF and permission checks remain mandatory.
- UI visibility never replaces server authorization.
- Raw prompts, signed URLs, credentials, secrets and unrestricted payloads must not enter queue list projections.
- Technical details use the existing normalized safe diagnostic envelope.
- Production publication, rollback and approval commands require explicit confirmation and current revision checks.
- Assistant context permissions remain separate for frontend and backend surfaces.

## Testing Strategy

### Focused automated tests

- readiness derivation for every missing/published Agent and route combination;
- surface-to-Agent and route-purpose isolation;
- lifecycle transitions and publication action visibility;
- supervision mode mapping, including custom combinations;
- activity correlation, ordering, pagination and human-readable identity fallback;
- approval impact copy and stale-revision handling;
- dirty-state navigation guards;
- loading, empty, partial failure and mutation failure states;
- accessibility names, keyboard navigation and focus return for drawers/dialogs.

### Project verification

- relevant focused tests;
- Admin and API type checks;
- Admin build;
- full project test suite;
- project, workspace and release Harnesses;
- source-size, hotspot, documentation and runtime-artifact gates required by the repository.

### Visual acceptance

At `1920x1080`, verify all three workspaces with:

- default, loading, empty, error, dirty and busy states;
- long Provider/model/workflow names;
- expanded advanced strategy drawer;
- approval confirmation and prompt diff;
- no horizontal overflow, clipped actions or overlapping text;
- visual consistency with existing Admin overview and workspace bands.

### Gray authenticated verification

After deploying `0.8.2` to Gray:

1. Publish or confirm a Gray Agent and route for both assistant surfaces.
2. Run a real frontend assistant request and a real backend assistant request.
3. Confirm the selected published version/model and absence of restricted mode.
4. Exercise a supervised Workflow Run with planning, execution and evidence projection.
5. Produce or select one safe approval/recovery scenario and verify the correlated queue, impact copy, decision and audit timeline.
6. Verify refresh, reload and new-session persistence.
7. Confirm API/Worker health, no unexpected restart and no new console error.
8. Capture screenshots and validation evidence without secrets or private payloads.

If Chrome is blocked by Safe Browsing, repeat the same steps in Edge or the internal browser. The test report records the browser used and separately records the Chrome classification status.

## Release Gates

### Version

The implementation changes the product version from `0.8.1` to `0.8.2`. Gray and Production must use the same approved `0.8.2` release artifact; Production promotion does not create another version.

### Gray gate

Gray deployment may proceed only after local tests, build, Harnesses, documentation and the `1920x1080` local visual pass succeed. Gray is accepted only after the authenticated matrix above passes and runtime evidence is written to the validation logbook.

### Production gate

Production promotion is allowed only when:

- every Gray verification item passes;
- no unresolved severity-high functional, security or visual issue remains;
- release state and rollback release are valid;
- the same tested artifact is promoted;
- Production post-deploy API, Worker, assistant publication and one non-destructive smoke test pass.

Any failed gate stops promotion. Fixes require a new Gray artifact and a repeat of affected verification; Production must never receive an untested patch.

## Documentation

Implementation must update:

- `docs/systems/admin/` for the new Admin behavior;
- `docs/systems/agent-runtime/` for publication and effective supervision controls;
- the 2026-07-27 daily logbook;
- Gray and Production release/validation records;
- `ops/current/release-state.json` and its human-readable projections after each actual deployment.

## Rollback

- UI restructuring can roll back without rewriting Agent, route, Run, approval or audit records.
- Published versions remain immutable and can be republished through existing rollback actions.
- Supervision mode is a projection over existing controls; rollback restores the prior controls rather than inventing a new runtime state.
- Production rollback uses the protected release recorded in canonical release state.
- The existing legacy routes continue redirecting to the corresponding governance workspace.
