# 加密服务器封装 Gray 验证 v0.8.25

- release: `20260804-encrypted-server-release-v0825-r1`
- targets: old-server Gray and new-server Gray
- encrypted archive SHA-256: `4bf374ae8c5d98e1aba8fcdb7a787ae602b41196c0b1b827d88e4534f7ce3e3a`
- inner sealed archive SHA-256: `f93a9d1f47faf7adaa76209aef91c8a09fbba09bd9262487ca9e31c3caa19f04`

## Results

- `verify:encrypted-release-contract`: passed.
- Old Gray runtime: current release correct, API/Worker active, public/internal status `0.8.25 / gray / enforced`, permission readiness `ready=true`, failures `0`.
- New Gray runtime: current release correct, API/Worker active, HTTPS `/api/status` via the registered hostname, permission readiness `ready=true`, failures `0`.
- Source isolation: both targets reported `ts=0`, `map=0`, `src=0` outside `node_modules`.
- Database migration: both targets `applied=[]`, `skipped=49`.

## Decision

Gray passed and the exact same encrypted artifact was promoted to Production.
