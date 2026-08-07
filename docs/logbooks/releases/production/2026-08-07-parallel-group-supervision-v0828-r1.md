# 并行分组与 AI 托管恢复 v0.8.28 Production

- release: `20260807-parallel-group-supervision-v0828-r1`
- targets: old-server Production and new-server Production
- source commit: `59d8bfa31d4e447d9332723d4e4a65ee46738e64`
- encrypted archive SHA-256: `85a90e8e6a7a5dc942989169d05f77c72b2c98934827f82be6f0828836482cfc`
- sealed archive SHA-256: `99c9654224dd0ba557f4f65938ba59c4eccf08f5f35e410d6c884f5fb38b8bbc`
- rollback: `20260805-retired-permission-cleanup-v0826-r1`

## Result

- The exact Gray-verified artifact was promoted to both Production targets after database and environment backups.
- API and Worker are active and report `0.8.28 / production / enforced`; permission readiness has zero failures on both servers.
- Agent and Canvas Run controls plus both process gates are enabled. Automatic recovery and quality evaluation remain disabled, preserving observe mode.
- Controlled plan-only supervision passed on both Production targets with deterministic execution layers `[2,1,1,1]`; no paid Production generation was submitted.
- Old Production retained its healthy published `gpt-5.6-terra` supervision route.
- New Production initially had no Agent or pool publications. The audited bootstrap created and published the three required Agent definitions and route pools with ModelScope, after which current route health reported zero unhealthy entries.
- Permission readiness totals were old Production `177 / 2704 / 11` and new Production `158 / 2920 / 11` for subjects, rules, and principals.
- New-server HTTPS status passed with direct address resolution. Ordinary local DNS still returns `ENOTFOUND`; production traffic cutover remains outside this release.

## Retention

- Canonical current and rollback anchors were updated before protected retention execution.
- Old and new Production dry-run/apply both passed; each retains five releases and protects current plus rollback.
