# 退役权限规则清理 Gray 验证 v0.8.26

- target: old-server Gray
- release: `20260805-retired-permission-cleanup-v0826-r1`

## Checks

- Current release path matched the expected release ID.
- API and Worker services were active.
- Internal and public status both reported `0.8.26 / gray / enforced`.
- Permission readiness reported `ready=true`, database `xinghuan_canvas_gray`, and zero failures.
- Release retention dry-run and apply retained five releases, including current and rollback; one obsolete release was removed by the guarded retention script.
