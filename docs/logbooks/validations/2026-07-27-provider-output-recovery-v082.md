# Provider 输出恢复链路验证（0.8.2）

## 范围

- Provider 内容 `403`、`502/503/504/429` 与响应流中断的下载分类和重试。
- Provider 已成功但本地物料化失败时的远程产物保留。
- Admin `recover-output` 的目标语义是仅恢复已有产物、不创建新的 Provider 请求；发布后端到端审计发现 API/Worker 字段契约不一致，该项不能按现有单元测试视为已验证。
- Redis 入队连接/命令超时边界。

## 本地证据

- `npm test`：`183` 个测试文件通过，`761` 个测试通过，`1` 个文件和 `4` 个测试跳过。
- `npm run build`：shared、API、Worker、Web、Admin 等工作区构建通过。
- focused output/recovery tests：`10/10` 通过；Worker、API、Admin type-check 通过。
- `npm run verify:worker-output-materializer`：通过。
- `npm run verify:provider-generation-task-contract`：通过。
- `npm run verify:provider-generation-worker`：通过。

## 未执行项

- `verify:worker-output-materials`、`verify:task-lifecycle` 等真实 HTTP/Redis 验收需要本地 API、PostgreSQL、Redis 和登录凭据；当前环境未启动这些服务，因此未将其误报为通过。
- 本轮未推送 Gray/Production，也未触碰服务器数据。

## 后续审计更正

- 现有测试只覆盖 API 写库和入队，没有让 Worker 消费恢复任务。
- API 写入 `result.outputRecoveryMode`，Worker 读取 `payload.outputRecoveryMode`；因此“不创建新的 Provider 请求”未被端到端证明，详见 `../../records/worker/2026-07-27-generation-delivery-and-agent-hardening-audit.md`。
