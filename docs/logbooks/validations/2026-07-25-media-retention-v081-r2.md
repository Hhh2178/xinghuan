# Media Retention v0.8.1 Validation

- release: `20260725-media-retention-v081-r2`
- source commit: `85b1993`
- archive SHA-256: `AE5D388A6D8894610C2FE3FDDFBA8229E1D3AA099F193BA7E6F32D35CD186453`

## Local

- `npm run type-check` passed。
- `npm run build:single-port` passed。
- `npm run verify:quick` passed。
- `verify:generation-artifact-framework-contract` and `verify:generation-artifact-operations` passed。
- pre-commit governance checks passed。

## Runtime

- Old Gray/Production and new Gray/Production all report `version=0.8.1` with the correct environment.
- API and Worker units are active in all four targets.
- Migration `045_ephemeral_upload_retention.sql` applied in all four databases.
- Old Production protected cleanup: 369 artifact candidates updated, 763 files deleted, 0 deletion failures; post-run dry-run reports 0 candidates.
- Historical orphan files are reported but not blindly deleted.

## Boundary

- GitHub was not pushed。
- Old server remains online。
- No release retention prune was run。
- Existing Production build packages remain in place。
