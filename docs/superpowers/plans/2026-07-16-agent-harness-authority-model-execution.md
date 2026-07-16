# Agent / Harness Authority Model Execution Plan

## Objective

Implement the authority model in `2026-07-16-agent-harness-authority-model.md` without changing product behavior.

## Phase 1 - Lock the sources

### Files

- `config/environments.json`
- `ops/current/release-state.json`
- `scripts/state/*.mjs`
- `scripts/version/set-version.mjs`
- `scripts/verify-authority-state.mjs`

### Work

1. Define schemas and non-secret environment values.
2. Add loaders with strict validation and clear errors.
3. Make version synchronization deterministic.
4. Add authority-state contract tests.

### Verify

- current version and internal package versions match;
- gray/production environment entries resolve;
- release state references existing release and validation records.

### Rollback

Delete only the new unreferenced state modules and restore the previous verifier entry point. Do not touch runtime env files.

## Phase 2 - Generic release interface

### Files

- `scripts/release/_shared.mjs`
- `scripts/release/deploy-release.mjs`
- `scripts/release/verify-release.mjs`
- `package.json`
- compatibility aliases under `scripts/release/`

### Work

1. Replace gray-only defaults with `loadEnvironment(environment)`.
2. Pass the resolved shared env path into readiness verification.
3. Keep `release:gray:*` as aliases that call the generic interface.
4. Add dry-run output showing environment and rollback target.

### Verify

- dry-run for gray and production;
- no `canvas-next.env` reference in the production path;
- existing gray release verification remains unchanged.

## Phase 3 - Agent and docs projections

### Files

- root `D:/codex/服务器/AGENTS.md`
- project `AGENTS.md`
- `README.md`, `MEMORY.md`, `docs/prd/README.md`
- `ops/README.md`, `ops/current/*.md`
- `docs/memory/*.md`
- `scripts/render-current-state.mjs`

### Work

1. Correct root worktree routing.
2. Remove deployment facts from the project constitution except short links.
3. Add generated markers to current summaries.
4. Keep historical facts in logbooks only.

### Verify

- root and project route to the same active worktree;
- generated projections match release-state manifest;
- docs entry and current release contracts pass.

## Phase 4 - Harness activation

### Files

- `.githooks/pre-commit`
- `scripts/harness/run.mjs`
- `scripts/pre-commit-governance.mjs`
- `package.json`
- `.github/workflows/harness.yml`

### Work

1. Add `harness:run` profiles.
2. Emit structured evidence under ignored `.harness/runs/`.
3. Make setup script and status contract visible.
4. Add CI workflow using the same runner.

### Verify

- hook setup on a fresh worktree;
- local quick profile;
- CI YAML syntax and command parity;
- evidence JSON schema.

## Phase 5 - Logbook index maintenance

### Files

- `scripts/logbooks/index.mjs`
- `scripts/verify-logbook-index.mjs`
- `docs/logbooks/README.md`
- `docs/logbooks/daily/2026/2026-07/`

### Work

1. Add minimal metadata to new records only.
2. Generate recent highlights and current month pointers.
3. Add a daily record for this governance change.
4. Never rewrite historical records.

### Verify

- latest release and validation appear in current indexes;
- no stale active version claims in generated index;
- logbook contract passes with missing optional daily records handled explicitly.

## Phase 6 - Delivery

1. Run project/workspace/release Harness.
2. Run type-check, targeted tests and lint.
3. Run CodeGraph sync.
4. Review staged files for runtime artifacts and secrets.
5. Commit in logical units and push.
6. Record commit and remaining risks in the daily logbook.

## Exit conditions

- all phases marked complete in `.planning/.../task_plan.md`;
- worktree clean;
- local and remote commit match;
- current release state and indexes pass deterministic verification;
- no production runtime change is required for this governance refactor.
