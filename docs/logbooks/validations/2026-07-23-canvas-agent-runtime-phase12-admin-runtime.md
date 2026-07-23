# Canvas Agent Runtime Phase 12 Validation

## Scope

- Branch: `feature/canvas-agent-runtime`
- Environment: local isolated Admin dev server only (`127.0.0.1:18320`)
- Production and Gray: untouched
- Credentials/cookies: not recorded

## Code And Runtime Evidence

- Agent runtime configuration normalization/resolution covers prompt, role description, Pool Key, knowledge bounds, tools, token/timeout/cost, approval, recovery and quality profile.
- Governance create/clone/review/approve/publish revalidates Pool, knowledge audience/enabled collections and quality references.
- Platform tool `deny` policies filter the published role allowlist; platform `allow` cannot expand it. Policy effect, constraints and revision are recorded in the Run snapshot.
- Tool Gateway now enforces the published `maxCallsPerRun`, `requireCanvasRevision` and `requireBudget` constraints at invocation time.
- Tool policy writes reject invalid subjects/effects and normalize constraints to `maxCallsPerRun` 1..1000 plus strict booleans; unknown JSON fields are discarded before persistence.
- Idempotent replay returns the original Run before resolving a newly published configuration or creating a new Knowledge Snapshot.

## Verification

- Latest `npm test`: 116 files passed, 1 skipped; 421 tests passed, 4 skipped.
- `npm run type-check`: passed for all workspaces.
- `npm run build`: passed for all workspaces, including Admin production build.
- `npm run verify:agent-governance-contract`: passed.
- `npm run verify:file-hotspot-budgets`: passed.
- Latest `npm run harness:verify:project`: passed in 56.7 seconds after Tool Gateway policy normalization was added.
- `git diff --check`: passed.
- `codegraph sync`: passed; `codegraph impact createAgentOrchestrator --depth 2` showed only the orchestrator module as direct impact.

## Browser Evidence

- Admin dev server rendered the login boundary at `1920x1080`, `1440x900`, `1366x768` and `390x844` with no horizontal overflow.
- Screenshots are ignored artifacts under `output/playwright/phase12-admin-*.png` and are intentionally not staged.
- Authenticated governance editor behavior and field-level publication interactions require an isolated one-time admin account. No account was configured in this terminal, so that portion remains open for the Phase 14 authenticated browser gate.

## Outcome

Phase 12 implementation, backend/runtime verification and static UI contracts are complete. The plan remains `in_progress` solely until authenticated Admin visual/behavior verification is performed in an authorized isolated environment.
