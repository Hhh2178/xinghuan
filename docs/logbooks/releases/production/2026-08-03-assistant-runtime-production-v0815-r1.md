# Assistant Runtime and Multimodal Context v0.8.15 Production

- release: `20260803-assistant-runtime-v0815-r1`
- version: `0.8.15`
- source branch: `feature/canvas-agent-runtime`
- source commit: `da2a8a1`
- archive SHA-256: `B6DDBD51B91EDDFE1E54FEE8383520DA561B1F1FA87F0DBF1F311E0063F6A221`
- target: `old-server` / Production
- rollback: `20260730-admin-rail-single-owner-footer-v0814-r1`
- retention apply: `false`

## Scope

- Promote the Gray-verified assistant model status, multimodal image context and selected-node diagnostic fixes without changing the environment-specific Agent configuration boundary.

## Verification

- Production deployment applied 0 migrations and skipped 46 registered migrations.
- Runtime verification: API/Worker active; public/internal status `0.8.15 / production`; permission mode `enforced`; no failed checks.

## Not Performed

- No billed Agent or Provider canary.
- No retention apply.
