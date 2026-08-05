# 退役权限规则清理 v0.8.26 Gray

- release: `20260805-retired-permission-cleanup-v0826-r1`
- targets: old-server and new-server
- source commit: `ff1064d854b457e53fe05acc99b0049ae2fc6361`
- encrypted archive SHA-256: `5fc01d4e778abd5079fed02845be1a8205bfc26f37cd2e467fbfbce60d32881d`

## Result

- The same encrypted archive was decrypted and installed on both Gray targets.
- Both API/Worker pairs are active; internal status reports `0.8.26 / gray / enforced`.
- Permission readiness passed with zero failures on both Gray databases.
- Migrations were `applied=[]`, `skipped=49`; guarded retention apply left five releases on each target.
- Public DNS for the new Gray hostname currently returns `ENOTFOUND` from the local resolver and requires domain-side repair before browser acceptance.
