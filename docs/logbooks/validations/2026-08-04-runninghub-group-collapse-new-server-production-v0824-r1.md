# RunningHub 分组折叠 v0.8.24 新服务器 Production 验证

- target: `43.131.246.222:22`
- release: `20260804-runninghub-group-collapse-v0824-r1`
- archive SHA-256: `53c884f3111004ef1034a2472ed34a2968992b37fbd193a8647837c79d7043e8`

## Checks

- `canvas.zezhen.online/api/status` via new-server resolve: `0.8.24 / production / enforced`.
- Permission readiness: `ready=true`, failures `[]`.
- API/Worker active; database target `xinghuan_canvas_next`.
- Outside `node_modules`: TypeScript/TSX `0`, source maps `0`, `src` directories `0`.
- The 22 retired-subject rules were reconciled after a Production snapshot; no other data domain was changed.

## Result

- New-server Production is running the Gray-verified sealed artifact. DNS/traffic cutover remains a separate migration step.
