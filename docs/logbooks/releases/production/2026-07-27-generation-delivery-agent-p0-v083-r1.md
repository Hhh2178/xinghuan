# Generation Delivery and Agent P0 v0.8.3 Production

- release: `20260727-generation-delivery-agent-p0-v083-r1`
- version: `0.8.3`
- source commit: `48fbb61e7298b25e7da268e5e07d49a2e8cfc119`
- archive SHA-256: `4937810dd089c9812c0d9deaa9cc8e5ed2e9a493f5f4872a293dcb008005c523`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas`
- previous current: `20260727-provider-output-recovery-v082-r1`
- rollback: `20260727-provider-output-recovery-v082-r1`
- retentionApplyRun: `false`

## Promotion

- Production 复用与 Gray 相同 SHA-256 的 archive，并通过 old-server target profile 部署。
- 数据库迁移 `046_provider_generation_task_idempotency.sql` 已应用；既有迁移 45 个跳过。
- 发布前 release 目录数为 7，发布后为 8；没有执行 retention 或删除历史 release。

## Result

- API、Worker、内部状态、旧公网入口与权限 readiness 均通过，Production current 已切换到本 release。
- 仅进行了非破坏性运行态验证；没有在 Production 发起真实 Provider fixture 或付费 Agent canary。
