# Production v0.7.4 流式响应崩溃与回滚

## 事件

- `20260718-generation-artifact-authority-prod-r1-v074` 在公网混合压测期间，于 `2026-07-18 12:39:44 +08:00` 因 `ERR_HTTP_HEADERS_SENT` 退出一次并由 systemd 自动重启。
- 根因是 Generation Artifact 内容流在客户端断开后已发送 headers，顶层 catch 再次调用 `sendJson`，导致进程退出。
- Production 于 `2026-07-18 12:50 +08:00` 回滚到 `20260717-admin-ten-domain-version-correction-prod-r1-v073`；严格 runtime/readiness gate 恢复通过。

## 数据影响

- 发布前 custom dump 已验证可恢复。
- 数据库 migration 024 与 698 条有效 legacy Artifact 已写入，结构对 v0.7.3 向前兼容；未执行数据库回退。
- 3 个已不存在 owner 与 2 个损坏 legacy JSON 被迁移器安全跳过。
- 测试 Asset 已清理；无 Provider、所有权、dedupe 或等待锁残留。

## 修复

- 顶层错误处理在 response 已发送、结束或销毁时不再二次写 headers；记录流失败并关闭未结束连接。
- 新增公开接口回归验证：登录、登记 8 MiB Artifact、100 次并发中断内容流，API 必须持续存活。
- 修复以 `v0.7.5` 先重新进入 Gray，不直接覆盖 `v0.7.4`。
