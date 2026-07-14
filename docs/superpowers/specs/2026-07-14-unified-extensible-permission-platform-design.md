# Unified Extensible Permission Platform Design

**Date:** 2026-07-14
**Status:** Approved for planning
**Scope:** Member visibility and use permissions for current and future canvas content

## 1. Decision

Replace the current per-group `deny` lists with one authorization platform based on registered permission subjects and explicit rules.

The platform is group-first but supports account exceptions. New member-facing content is hidden and unusable by default until an administrator publishes it to one or more groups, or explicitly elects a domain-level publication policy. An account-level allow may override a group-level deny; an account-level deny may revoke a group-level allow.

Administrators retain unrestricted access. The platform does not replace ownership checks, admin-role checks, session rules, or provider/model enabled state.

## 2. Problem Statement

The current implementation stores five hard-coded deny arrays per group:

- public resource categories
- public resource items
- RunningHub apps
- RunningHub workflows
- node types

That approach has four structural limits:

1. Every new controlled domain requires a schema field, UI panel, route change, and bespoke filtering code.
2. Only groups are represented; account-specific grants and revocations cannot be expressed consistently.
3. Catalog visibility and execution authorization can diverge when different call sites implement different missing-policy defaults.
4. A virtual `ungrouped` bucket exists in application logic but was initially blocked by a database foreign key.

The design must cover current domains and future models, ComfyUI workflows, templates, export functions, share links, and new AIGC capabilities without multiplying policy formats.

## 3. Goals

- One authorization decision for catalog visibility, detail access, insertion, task submission, export, and management actions.
- Group policy plus account exceptions with deterministic precedence.
- New content is non-member-visible by default.
- New domains and new entries register themselves without adding columns to a policy JSON shape.
- A virtual `ungrouped` group remains addressable and persistable.
- Every decision is explainable in the admin UI and auditable at submission time.
- Existing resource and RH behavior migrates without suddenly expanding member access.

## 4. Non-Goals

- Replace administrator role authorization or ordinary project ownership isolation.
- Build nested groups, organization hierarchies, billing/quota, SSO, or cross-tenant sharing in the first implementation.
- Retroactively cancel an already accepted upstream generation task when a rule changes.
- Expose raw provider secrets or internal system routes through the permission catalog.

## 5. Core Model

### 5.1 Permission Subject

Every member-facing controlled object has a stable `subjectKey`, a type, optional parent, lifecycle state, and metadata for display.

Examples:

| Domain | Subject key | Parent key | Typical actions |
| --- | --- | --- | --- |
| Public resource category | `resource.category/<id>` | `resource.category/*` | `view`, `use` |
| Public resource item | `resource.item/<id>` | category then `resource.item/*` | `view`, `use`, `export` |
| RH application | `runninghub.app/<catalogId>` | `runninghub.app/*` | `view`, `use`, `execute` |
| RH workflow | `runninghub.workflow/<catalogId>` | `runninghub.workflow/*` | `view`, `use`, `execute` |
| Canvas node type | `canvas.node/<type>` | `canvas.node/*` | `view`, `use` |
| Provider model | `provider.model/<modelRecordId>` | capability then `provider.model/*` | `view`, `use`, `execute` |
| ComfyUI shared workflow | `comfyui.workflow/<id>` | `comfyui.workflow/*` | `view`, `use`, `execute` |
| Shared template | `template/<id>` | `template/*` | `view`, `use`, `export` |

Subject keys are immutable after creation. A display name or catalog title may change without invalidating policy references.

### 5.2 Subject Lifecycle And Publication Gate

A registered subject has one member-exposure state:

- `restricted`: default. Only administrators can discover or use it. No broad group rule can expose it accidentally.
- `published`: eligible for matching group/account rules.
- `retired`: hidden from new catalogs and execution, while historical task/audit references remain resolvable.

When an administrator publishes an object, the UI requires one of two explicit choices:

1. assign one or more groups/accounts directly; or
2. inherit the selected domain publication policy, such as `runninghub.app/*`.

This keeps new content hidden by default while still allowing deliberate domain-wide rollout policies.

### 5.3 Principals And Rules

A rule has:

- principal: `group` or `user`
- principal ID: a stable group ID, `ungrouped`, or user ID
- subject key
- action
- effect: `allow` or `deny`
- optional reason, creator, timestamps, and policy revision

Rules are stored independently rather than as hard-coded domain arrays. One rule controls one action for one subject scope. Multiple actions are saved as separate rows to make auditing and future indexing simple.

## 6. Authorization Resolution

All decisions must call one `AuthorizationService.can()` implementation. The same service also exposes `filter()` for catalogs and `explain()` for the admin console.

Resolution order:

1. An administrator is allowed.
2. A `restricted` or `retired` subject is denied to members before normal rules are evaluated.
3. Collect matching account rules, from exact subject to parent wildcard.
4. If account rules match, use the most specific matching account scope. At equal specificity, `deny` wins.
5. Otherwise collect matching group rules, from exact subject to parent wildcard.
6. If group rules match, use the most specific matching group scope. At equal specificity, `deny` wins.
7. No matching rule is denied.

This enforces the confirmed business rule: an explicit account allow overrides a group deny, and an explicit account deny overrides a group allow. It also lets a more-specific rule refine a broad domain rule without inventing special-case code.

Every protected path uses the action relevant to the operation:

- catalog/list rendering: `view`
- preview, insert, or reference selection: `use`
- upstream task creation or RH execution: `execute`
- admin governance: `manage`
- file/template result extraction: `export`

Existing nodes on an old canvas must still be evaluated at execution time. A hidden catalog entry is never sufficient authorization.

## 7. Persistence Design

### 7.1 `xh_permission_subjects`

| Column | Purpose |
| --- | --- |
| `subject_key` primary key | Stable authorization identity |
| `domain` | `resource`, `runninghub`, `canvas`, `provider`, `comfyui`, `template` |
| `subject_type` | Concrete kind within the domain |
| `parent_key` nullable | Inheritance chain |
| `source_id` | Owning record ID for reconciliation |
| `exposure_state` | `restricted`, `published`, or `retired` |
| `display_name`, `metadata` | Admin catalog only; never authorization identity |
| `revision`, timestamps | Conflict handling and audit traceability |

Unique `(domain, source_id)` prevents duplicate registration. Deleting a source retires its subject instead of deleting audit references.

### 7.2 `xh_permission_rules`

| Column | Purpose |
| --- | --- |
| `id` | Stable rule ID |
| `principal_type` | `group` or `user` |
| `principal_id` | Group ID, `ungrouped`, or user ID |
| `subject_key` | Exact or wildcard registered subject scope |
| `action` | `view`, `use`, `execute`, `manage`, `export` |
| `effect` | `allow` or `deny` |
| `reason`, `created_by`, timestamps | Explainability and accountability |
| `revision` | Optimistic concurrency |

Unique `(principal_type, principal_id, subject_key, action)` prevents ambiguous duplicate rows. The table deliberately does not foreign-key `principal_id` because `ungrouped` is virtual. API validation verifies named users and groups before writes.

### 7.3 Task Authorization Snapshot

Generation and RH task records receive an `authorization_snapshot` containing user ID, effective group, subject key, action, winning rule ID/effect, policy revision, and evaluated time. A task is authorized at submission; subsequent rule edits control future submissions but do not corrupt an already accepted task.

## 8. Registration And Reconciliation

Each domain owns a `PermissionSubjectRegistrar` adapter. Creating, importing, publishing, disabling, or deleting a domain record calls that adapter in the same database transaction where possible.

Required first adapters:

1. Shared resources and categories
2. RunningHub apps and workflows
3. Canvas node registry
4. Provider models

Second-wave adapters:

1. ComfyUI shared workflows
2. Shared workflow/template resources
3. Export and share-link capabilities

A reconciliation job compares source records with `xh_permission_subjects`, creates missing restricted subjects, retires orphaned subjects, and reports mismatched parents. It never automatically publishes a newly discovered subject.

## 9. API And Enforcement Boundaries

### Read APIs

- `GET /api/me/permissions`: effective group, account overrides, policy revision, and capability summary; no hidden subject metadata.
- `GET /api/permission-subjects`: administrator catalog with lifecycle, direct assignments, inherited rules, and impact counts.
- Existing public resource, RH, model, ComfyUI, and template catalog endpoints call `filter(action=view)`.

### Mutation APIs

- `POST/PATCH /api/admin/permission-subjects/:key/publish`
- `PUT /api/admin/permission-rules/:id`
- `DELETE /api/admin/permission-rules/:id`
- `GET /api/admin/permission-explain?principal=<...>&subject=<...>&action=<...>`

Each mutation is revision-protected, emits an audit event, and returns the computed effective outcome. Bulk assignment is an explicit batch endpoint with a dry-run impact response.

### Runtime Enforcement

The following paths must use the same service rather than local `null => allow` fallbacks:

- shared resource list, detail, download, preview, and insert
- RH list, target lookup, task submission, polling result exposure
- node add menu and node-driven task submission
- provider-model catalog and image/video/audio/chat generation submission
- ComfyUI shared workflow catalog and run endpoint
- template import, use, export, and sharing

## 10. Admin Interaction Design

The existing `账号 / 用户组 / 权限 / 会话` workspace remains the entry point.

### Permission Workspace

- Left rail: groups, `ungrouped`, and account override search.
- Main header: effective policy state, affected member count, unsaved revision, and a simulation control.
- Subject tree: domain, type, lifecycle, and publication state. It is generated from the registry rather than hard-coded sections.
- Row controls: action toggles for `view/use/execute/manage/export`; inherited state is visually distinct from direct state.
- Side inspector: matching group rule, account override, parent policy, resulting decision, and affected users.
- Publish flow: new subject starts restricted, then requires direct assignment or an explicit domain-inheritance choice.
- Bulk changes: show impacted members and subjects before save; no silent wide grants.

### Account Workspace

- Each account row shows group membership and a concise override count.
- Expanding an account reveals only direct overrides, not a duplicate full policy matrix.
- The account inspector shows why an account differs from its group and provides an action to remove the override and return to group inheritance.

## 11. Audit, Observability, And Safety

Audit records include principal, subject, action, effect, actor, previous and new revision, reason, and impact count.

Denials are observable without exposing hidden content:

- catalog filters increment aggregate denied/hidden counters by domain
- task submission denials record the subject/action and winning rule, not secrets or request payloads
- an admin-only dashboard reports stale restricted subjects, rules pointing to retired subjects, and entries without a registrar

No API returns a forbidden item merely to explain denial to a member. Member-facing behavior remains direct omission from catalogs; direct execution returns a generic authorization error.

## 12. Migration Strategy

### Phase 1: Foundation

- Add subjects, rules, revisions, registrar interfaces, and `AuthorizationService`.
- Keep the current group policy read path as a compatibility adapter.
- Add dual-decision telemetry in gray: compare legacy and new outcomes without changing member-visible behavior.

### Phase 2: First Domain Cutover

- Register shared resources, RH entries, node types, and provider models.
- Route their catalogs and execution paths through `AuthorizationService`.
- Remove the current mismatch where a missing rule hides RH catalog entries but can allow direct execution.

### Phase 3: Data Migration And UI

- Convert current group deny lists into equivalent group rules.
- Preserve explicit `ungrouped` policy as a first-class virtual principal.
- Add group matrix, account overrides, explain simulation, publish flow, and batch dry-run.
- Keep legacy rows read-only until all first-wave routes use the new service, then archive them with a rollback export.

### Phase 4: Expanded Domains

- Add ComfyUI workflows, templates, export, sharing, and future node domains through registrar adapters.
- Add optional quota and time-window policy layers only after the core decision service is stable.

## 13. Acceptance Criteria

1. A new model, RH entry, resource, node type, workflow, or template is invisible and non-executable to members until published.
2. Group allow makes a published subject visible and usable only for configured actions.
3. Account allow overrides group deny; account deny overrides group allow.
4. Catalog, detail, insertion, and execution return the same authorization decision for a subject/action pair.
5. Existing canvas nodes cannot bypass a later execution restriction.
6. `ungrouped` can save and resolve explicit rules in both PostgreSQL and file-backed modes.
7. Every rule mutation and denied task submission can be explained to an administrator from audit data.
8. Adding a future domain requires a registrar and subject metadata, not a new policy column or a duplicate authorization implementation.
