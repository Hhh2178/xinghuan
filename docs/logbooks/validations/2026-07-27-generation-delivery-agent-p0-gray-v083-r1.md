# Generation Delivery and Agent P0 v0.8.3 Gray Validation

- release: `20260727-generation-delivery-agent-p0-v083-r1`
- version: `0.8.3`
- archive SHA-256: `4937810dd089c9812c0d9deaa9cc8e5ed2e9a493f5f4872a293dcb008005c523`
- target: `ubuntu@101.33.75.38:728`
- retentionApplyRun: `false`

## Local verification

- Full suite: `184` passed files, `767` passed tests, `4` skipped.
- Type-check、single-port build、Harness release、release governance、CodeGraph sync 与 hotspot budget 均通过。
- `verify:output-recovery-operation-contract`、old-server Gray target gate、Agent readiness static contract 与 Canvas generation delivery contract 均通过。

## Gray runtime

| 项目 | 结果 |
|---|---|
| current | `/opt/apps/xinghuan-canvas-next/releases/20260727-generation-delivery-agent-p0-v083-r1` |
| 内部/公网状态 | `0.8.3 / gray / enforced` |
| 服务 | `xinghuan-canvas-next.service` 与 `xinghuan-canvas-next-worker.service` 均为 `active` |
| 权限 readiness | `ready=true`；131 subjects、125 published、3 restricted、3 retired、932 rules、5 principals、0 failures |
| 数据库迁移 | `046_provider_generation_task_idempotency.sql` 已应用 |

## Acceptance boundary

- 受控 mock Provider fixture：`task-1785167610738-tq766l`；同一 Canvas async 请求提交两次返回同一 task ID，Provider request count=`1`，终态为 `succeeded`，物料化 `/files/output/` 返回 HTTP 200 且非空。
- 该计数证明重复提交未导致第二次 Provider 调用；mock Provider 不计费，因此不把它表述为真实供应商成本证明。
- fixture 清理复核：`fixtureProvidersRemaining=0`、`fixtureArtifactsRemaining=0`。
- 未执行付费 Provider 真实生成，故不对真实供应商成功率或计费账本作结论。
- 未执行 retention apply，所有历史 release 目录仍保留。
