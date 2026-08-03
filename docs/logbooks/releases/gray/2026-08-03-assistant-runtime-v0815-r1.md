# Assistant Runtime and Multimodal Context v0.8.15 Gray

- release: `20260803-assistant-runtime-v0815-r1`
- version: `0.8.15`
- source branch: `feature/canvas-agent-runtime`
- source commit: `da2a8a1`
- archive SHA-256: `B6DDBD51B91EDDFE1E54FEE8383520DA561B1F1FA87F0DBF1F311E0063F6A221`
- target: `old-server` / Gray
- rollback: `20260730-admin-rail-single-owner-footer-v0814-r1`
- retention apply: `false`

## Scope

- Show the resolved assistant model and route state in Canvas and Admin assistant surfaces.
- Pass uploaded assistant images as signed multimodal `image_url` content and require image-understanding route capability.
- Include sanitized selected-node runtime errors in assistant diagnostic context when no persisted Run event is available.

## Verification

- Full Vitest passed: 234 files passed, 1 skipped; 894 tests passed, 4 skipped.
- API, Web and Admin type-check/build passed; release package and governance gates passed.
- Gray deployment applied 0 migrations and skipped 46 registered migrations.
- Runtime verification: API/Worker active; public/internal status `0.8.15 / gray`; permission mode `enforced`; no failed checks.

## Not Performed

- No billed Agent or Provider canary.
- No retention apply.
