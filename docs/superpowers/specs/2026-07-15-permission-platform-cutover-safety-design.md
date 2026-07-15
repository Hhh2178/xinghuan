# Permission Platform Cutover Safety Design

**Date:** 2026-07-15
**Scope:** authorization runtime, legacy migration, admin governance, release gates, observability, and gray acceptance
**Target:** gray first; production is out of scope until gray evidence is approved

## 1. Problem

The unified permission platform registered models, RunningHub entries, canvas nodes, and shared resources as restricted subjects, then changed member catalog filtering before publication, rules, legacy migration, and the unified admin panel were ready. Administrators remained unaffected because they bypass authorization. Members received empty catalogs.

The prevention mechanism must make this deployment order structurally impossible.

## 2. Invariants

1. Unauthorized objects are omitted from member catalogs.
2. Direct execution and catalog visibility resolve through the same service.
3. Account rules override group rules; exact rules override inherited rules.
4. New subjects default to restricted and cannot be exposed by an old broad rule alone.
5. A missing rule is deny in the unified system.
6. A migration-incomplete unified system cannot become authoritative.
7. The admin UI displays effective server decisions, not inferred local toggle state.
8. Every enforcement transition is auditable and reversible.

## 3. Runtime Modes

### `legacy`

- Existing group policy remains authoritative.
- Unified subjects and rules may be registered and edited.
- Used only as rollback compatibility.

### `shadow`

- Legacy and unified decisions are both evaluated.
- Legacy decision remains authoritative.
- Aggregate differences record domain, action, legacy result, unified result, and reason.
- No protected subject metadata or request payload is emitted to member responses.

### `enforced`

- Unified authorization is authoritative.
- Entry is blocked unless readiness verification succeeds.
- Legacy data remains read-only for one rollback window.

The default for gray after this repair is `shadow`. Production remains on its existing legacy-compatible release.

## 4. Readiness Contract

`enforced` requires a successful machine-readable report containing:

- schema migration version present;
- subject reconciliation completed at the current catalog revision;
- every current subject explicitly classified as published, restricted, or retired;
- every named group and `ungrouped` principal has an explicit baseline policy marker;
- no user references a missing group;
- no rule references a missing or retired subject unless explicitly waived;
- unified admin capability version matches the API capability version;
- required actions exist for published first-wave domains;
- representative administrator, ungrouped-member, named-group-member, and account-override probes pass;
- no protected domain returns an unexpected empty catalog for its allow probe.

The server must refuse `enforced` startup when this report is absent, expired, or invalid.

## 5. Reconciliation

Reconciliation is idempotent and supports `dry-run`, `apply`, and `verify`.

It performs:

1. Subject registration and orphan retirement.
2. Legacy group-policy normalization, including explicit `ungrouped` coverage.
3. Existing-content publication classification.
4. Equivalent group rule creation without automatically publishing future subjects.
5. Account override preservation.
6. A revisioned reconciliation report and rollback export.

Migration never treats a missing legacy group policy as allow. Missing policy must be resolved explicitly before enforcement.

## 6. Unified Administration

The existing fixed deny-array panel is replaced by a registry-driven workspace:

- principal selector: group, ungrouped, or account;
- subject tree grouped by domain and type;
- publication state control;
- action controls for view, use, execute, manage, and export;
- direct, inherited, default, and overridden state indicators;
- effective-decision explanation;
- batch dry-run with affected member count;
- revision conflict handling;
- audit reason required for mutation.

The panel reads and writes only unified APIs. Legacy rows are shown only in a migration diagnostics view.

## 7. Runtime Integration

All first-wave paths use one authorization facade:

- canvas node discovery and add actions;
- provider model catalog and generation submission;
- RunningHub catalog and execution;
- shared resource catalog, preview, download, and insert;
- future registrars through the same subject/action contract.

Callers do not construct permission behavior independently. Stable subject-key helpers are mandatory.

## 8. Observability

Expose admin-only aggregate health:

- subjects by domain and exposure state;
- rules by principal type, action, and effect;
- groups without explicit baseline policy;
- users with invalid group references;
- shadow-decision mismatch counts by domain and reason;
- member-visible catalog counts for synthetic allow probes;
- denial counts for `subject-not-published` and `no-matching-rule`.

Alerts trigger on an enforced environment with zero published subjects, zero rules, a sudden all-domain catalog collapse, or a sharp denial-reason increase.

## 9. Release Gates

Gray deployment order:

1. Back up permission and legacy policy tables.
2. Deploy runtime in `shadow`.
3. Run reconciliation dry-run and review counts.
4. Apply reconciliation transactionally.
5. Run readiness verification.
6. Validate real member sessions while shadow remains authoritative.
7. Switch gray to `enforced` only after explicit acceptance.
8. Re-run the same probes and monitor mismatch/denial metrics.

Any failure returns gray to `shadow`; it does not require deleting migrated data.

## 10. Required Tests

- Resolver precedence and exposure states.
- Runtime mode authority and differential reporting.
- Reconciliation idempotency and rollback export.
- PostgreSQL migration with missing group policies and ungrouped users.
- Admin save followed by member catalog refresh.
- Catalog/direct-execution consistency for model, RH, and resource subjects.
- New restricted subject remains hidden despite an existing family allow.
- Existing saved canvas nodes remain loadable while denied new entries stay hidden.
- Release readiness fails for the exact 2026-07-15 gray state.

## 11. Acceptance

- Gray cannot enter enforced mode with 0 published subjects or 0 rules.
- Admin, ungrouped member, named-group member, and account override behave as configured.
- Image, video, LLM/audio, RH, shared-resource, and node catalogs are non-empty for allow probes.
- Restricted content is absent and direct execution returns a generic denial.
- Admin effective-state display matches API decisions.
- Reconciliation can run twice without changing the second result.
- Rollback to shadow restores legacy-authoritative behavior immediately.
