# Provider Output Recovery v0.8.2 Gray Validation

- release: `20260727-provider-output-recovery-v082-r1`
- version: `0.8.2`
- source commit: `55aa3d9`

## Local

- Full test suite: `183 passed` files, `761 passed` tests, `4 skipped`。
- Full build、workspace TypeScript、Worker/API 契约、release package 和 pre-commit governance 通过。
- 已知既存 lint：`apps/worker/src/canvas-run-coordinator.test.ts:225` 的 `no-regex-spaces`，与本批次无关。

## Gray Runtime

| 项目 | 结果 |
|---|---|
| 公网状态 | 待部署后记录 `/api/status` HTTP 状态、版本、环境和权限模式 |
| API/Worker | 待部署后确认两个 systemd 服务 active |
| 发布隔离 | 仅新服务器 Gray；Production 不变 |

## Grok 五次真实任务

| # | task ID | 提交 | Provider/模型 | 轮询 | 下载 | 物料化 | 最终状态 | 反馈摘要 |
|---:|---|---|---|---|---|---|---|---|
| 1 | 待执行 | 待执行 | Grok | 待执行 | 待执行 | 待执行 | 待执行 | 待执行 |
| 2 | 待执行 | 待执行 | Grok | 待执行 | 待执行 | 待执行 | 待执行 | 待执行 |
| 3 | 待执行 | 待执行 | Grok | 待执行 | 待执行 | 待执行 | 待执行 | 待执行 |
| 4 | 待执行 | 待执行 | Grok | 待执行 | 待执行 | 待执行 | 待执行 | 待执行 |
| 5 | 待执行 | 待执行 | Grok | 待执行 | 待执行 | 待执行 | 待执行 | 待执行 |

## Boundary

- 未发布 Production，未修改生产数据库、用户媒体、Provider Key 或服务器 secrets。
- retention 仅执行 dry-run，待验证完成后再决定是否 apply。
