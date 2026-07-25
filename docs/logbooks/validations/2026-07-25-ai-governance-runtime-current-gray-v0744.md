# AI Governance Runtime Current Gray v0.7.44 Validation

- release: `20260725-ai-governance-runtime-current-gray-r1-v0744`
- source commit: `6a154df`
- environment: `gray`
- Production: `untouched`

## Pre-deploy

- `730 passed / 4 skipped` Vitest。
- PostgreSQL Canvas Run integration `4 passed`。
- Canvas Run local E2E：SSE、settlement、pause/resume、cancellation 通过。
- Project/Workspace/Release Harness、type-check、Web/Admin/ComfyUI build 通过。

## Real runtime evidence

- Isolated current-code Gray Candidate run `canvas_run_b8e0d5fe-85b2-4aae-958f-7b9ac295a667`：双上游图片候选进入 selector，完成选优并成功生成下游图片；provenance 含 artifact、source node、Provider、model、prompt。
- Isolated current-code Gray Candidate run `canvas_run_573ffb2e-97a0-452a-9684-d1916da85fcb`：单节点生成两个候选，完成 AI 质量评估、质量分数持久化、选优及下游生成。
- Canvas assistant 与 Admin assistant 均以 `mode=agent` 返回，简短响应未泄露内部 Run/Task/Artifact ID。

## Release acceptance

- 发布后必须复核：内部/公开 `/api/status` 版本 `0.7.44`、环境 `gray`、permission mode `enforced`、API/Worker active、readiness 无失败。
- 发布后必须执行 Admin task pagination、environment sync、Provider task service、Provider Worker smoke。
- 失败时回滚到 `20260725-ai-governance-supervision-gray-r1-v0743`，不删除失败 release。

## Post-deploy evidence

- `release:gray:verify`：`ok=true`，current release、服务状态、版本、环境、权限模式和 readiness 全部匹配。
- `/api/status` internal/public：`version=0.7.44`、`environment=gray`、`permissionMode=enforced`。
- Admin task pagination：`total=625`，分页与失败/图像计数返回正常。
- Environment sync smoke：preview/apply/audit 均通过，no-op apply 正确跳过。
- Provider task service 与 Provider Worker contract smoke：均 `ok=true`。
