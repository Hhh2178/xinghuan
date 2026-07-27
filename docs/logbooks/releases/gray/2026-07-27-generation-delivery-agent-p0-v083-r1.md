# Generation Delivery and Agent P0 v0.8.3 Gray

- release: `20260727-generation-delivery-agent-p0-v083-r1`
- version: `0.8.3`
- source commit: `48fbb61e7298b25e7da268e5e07d49a2e8cfc119`
- archive SHA-256: `4937810dd089c9812c0d9deaa9cc8e5ed2e9a493f5f4872a293dcb008005c523`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- previous current: `20260727-provider-output-recovery-v082-r1`
- rollback: `20260727-provider-output-recovery-v082-r1`
- retentionApplyRun: `false`

## Scope

- 将 `recover-output` 明确分为 `output_recovery` operation，恢复产物不再走 Provider execution 分支。
- 在画布生成请求、任务持久化与 PostgreSQL 之间增加 owner-scoped `idempotencyKey` 闭环；并发重复提交由唯一索引和原任务回读吸收。
- 增加旧服务器目标 profile 与 Agent 环境静态 readiness 门禁，避免发布脚本误指向迁移目标。

## Deployment

- 使用 old-server target profile 部署至旧服务器 Gray；`current` 从前一 release 切换至本 release。
- 数据库迁移 `046_provider_generation_task_idempotency.sql` 已应用；既有迁移 45 个跳过。
- 发布前 release 目录数为 8，发布后为 9；没有执行 retention 或删除历史 release。

## Result

- API、Worker、内部状态、旧公网入口、首页、后台与权限 readiness 均通过；数据库为 `xinghuan_canvas_gray`，readiness failures 为 0。
- 本 release 的真实 Provider 成功产物 Gray fixture 未执行；静态交付链路契约和本地单元验证不能替代该验收。
