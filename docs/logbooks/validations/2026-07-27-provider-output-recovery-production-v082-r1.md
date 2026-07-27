# Provider Output Recovery v0.8.2 Production Validation

- release: `20260727-provider-output-recovery-v082-r1`
- version: `0.8.2`
- source commit: `55aa3d9`
- archive SHA-256: `F1607BADC97988CD79E3C9FBA344F67839257BFB3C466AAF5409E3418BF8B6A1`

## Promotion Basis

- 本地全量测试、构建、Worker/API 契约和发布治理通过。
- 旧服务器 Gray 已运行同一 archive，内部/公网状态、API/Worker 和权限 readiness 全部通过。
- Production 复用 Gray 已验收版本 `0.8.2`，不额外递增版本。

## Runtime

| 项目 | 结果 |
|---|---|
| current release | 待部署验证 |
| 内部与公网状态 | 待部署验证 |
| API/Worker | 待部署验证 |
| 权限 readiness | 待部署验证 |
| 首页与后台 | 待部署验证 |

## Boundary

- 仅操作旧服务器 Production；新服务器和 Gray 本轮不操作。
- retention 先 dry-run，本批次不直接清理历史 release。
