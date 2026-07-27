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
| current release | `/opt/apps/xinghuan-canvas-next/releases/20260727-provider-output-recovery-v082-r1` |
| 内部状态 | `http://127.0.0.1:18200/api/status` 返回 `0.8.2 / gray / enforced` |
| API/Worker | `xinghuan-canvas-next.service=active`；`xinghuan-canvas-next-worker.service=active` |
| 权限 readiness | `ready=true`，数据库 `xinghuan_canvas_gray`，failures `0` |
| 公网状态 | `canvas-next.zezhen.online` 当前 DNS 未解析，公网 verify 因 `ENOTFOUND` 未通过；未将其误判为应用失败 |
| 发布隔离 | 仅新服务器 Gray；Production 不变 |

## Grok 五次真实任务

| # | task ID | 提交 | Provider/模型 | 轮询 | 下载 | 物料化 | 最终状态 | 反馈摘要 |
|---:|---|---|---|---|---|---|---|---|
| 1 | `task-1785140976806-oi57se` | 成功入队，约 3.7s 返回终态 | ToAPIs / `grok-video-1.5-preview` | Worker 领取，1 次轮询 | 未进入 | 未进入 | `failed` | `503 all_channels_circuit_broken`，`failureCategory=upstream_poll_gateway_failed` |
| 2 | `task-1785140997036-4nqduh` | 成功入队，约 3.7s 返回终态 | ToAPIs / `grok-video-1.5-preview` | Worker 领取，1 次轮询 | 未进入 | 未进入 | `failed` | `503 all_channels_circuit_broken` |
| 3 | `task-1785141003355-env7yf` | 成功入队，约 3.6s 返回终态 | ToAPIs / `grok-video-1.5-preview` | Worker 领取，1 次轮询 | 未进入 | 未进入 | `failed` | `503 all_channels_circuit_broken` |
| 4 | `task-1785141010661-0cufum` | 成功入队，约 3.6s 返回终态 | ToAPIs / `grok-video-1.5-preview` | Worker 领取，1 次轮询 | 未进入 | 未进入 | `failed` | `503 all_channels_circuit_broken` |
| 5 | `task-1785141016873-7dgrdc` | 成功入队，约 3.6s 返回终态 | ToAPIs / `grok-video-1.5-preview` | Worker 领取，1 次轮询 | 未进入 | 未进入 | `failed` | `503 all_channels_circuit_broken` |

### Additional provider observations

- AIFork `grok-imagine-video-1.5-fast`：`503 No available channel`。
- AIFork `grok-1.5-官转接口`：`503 No available channel`。
- AIFork `grok-imagine-video-1.5-preview`：`400 invalid field ... model`，该模型在 AIFork 当前配置使用了不匹配的上游模型契约；不是本次下载恢复逻辑导致。
- 五次 ToAPIs 任务均完成本地 admission、Redis、Worker 和结构化失败反馈，未产生 `remoteVideoUrls`，没有发生可供恢复的下载阶段。

## Boundary

- 未发布 Production，未修改生产数据库、用户媒体、Provider Key 或服务器 secrets。
- retention 仅执行 dry-run，待验证完成后再决定是否 apply。
- retention dry-run 保留 current、rollback 以及最近五个 Gray release，拟清理 1 个旧 release；本次未 apply。
