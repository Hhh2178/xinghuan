# Admin Rail Single Owner Footer v0.8.14 Gray

- release: `20260730-admin-rail-single-owner-footer-v0814-r1`
- version: `0.8.14`
- source branch: `release/admin-governance-content-d-v0813`
- source commit: `14147ec`
- archive SHA-256: `3644760948fc181ef23fd75c755bbae972b955d6b1211fc4ab15e85a70d79294`
- target: `old-server` / Gray
- rollback: `20260730-admin-agent-isolation-rails-v0813-r1`
- retention apply: `false`

## Scope

- Make the shared configuration layout the sole sticky owner for Provider and RunningHub administration pages.
- Keep Provider and RunningHub lists independently scrollable within that shared rail; remove their duplicate viewport sticky rules.
- Remove the gradient color blocks under “新建平台” and the RunningHub workflow/application footer action.
- Carry forward the already Gray-accepted Agent Runtime environment isolation in the same source line; no Agent runtime feature gate changed.

## Verification

- Focused Provider/RunningHub rail tests passed. Full Vitest passed: 232 files passed, 1 skipped; 890 tests passed, 4 skipped.
- Admin production build, full release package build, release governance checks, and whitespace check passed.
- Packaging generated the recorded 2.5 MB archive. Gray deployment applied 0 migrations and skipped 46 registered migrations.
- Gray API and Worker are active. Public/internal status report `0.8.14 / gray`; permission readiness is `enforced / ready` with 132 subjects, 125 published, 3 restricted, 4 retired, 932 rules, 5 principals, and 0 failures.

## Not Performed

- No billed Agent or Provider canary.
- No retention apply.
