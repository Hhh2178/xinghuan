# Generation Delivery and Agent P0 v0.8.3 Production Validation

- release: `20260727-generation-delivery-agent-p0-v083-r1`
- version: `0.8.3`
- archive SHA-256: `4937810dd089c9812c0d9deaa9cc8e5ed2e9a493f5f4872a293dcb008005c523`
- target: `ubuntu@101.33.75.38:728`
- retentionApplyRun: `false`

## Promotion basis

- 复用 Gray 已部署的同一 archive；旧服务器临时 archive hash 与本地 SHA-256 一致。
- 本地完整测试、构建、Harness、release governance、target gate 与 Canvas delivery static contract 均通过。

## Production runtime

| 项目 | 结果 |
|---|---|
| current | `/opt/apps/xinghuan-canvas/releases/20260727-generation-delivery-agent-p0-v083-r1` |
| 内部/公网状态 | `0.8.3 / production / enforced` |
| 服务 | `xinghuan-canvas.service` 与 `xinghuan-canvas-worker.service` 均为 `active` |
| 权限 readiness | `ready=true`；154 subjects、126 published、20 restricted、8 retired、2832 rules、11 principals、0 failures |
| 数据库迁移 | `046_provider_generation_task_idempotency.sql` 已应用 |

## Boundary

- 本批次不创建 Production Provider fixture，不触及用户素材、Provider Key 或运行时 secrets。
- Agent readiness 仅验证静态门禁；没有重复运行付费真实请求 canary。
- 未执行 retention apply，历史 release 目录仍保留。
