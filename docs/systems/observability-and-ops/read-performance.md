# 读取性能与后台资源边界

## 读路径

- Admin 账号、用户组和会话在 PostgreSQL 模式下使用定向投影；文件模式仍通过 `AuthDb` 兼容。
- Provider、模型和 RunningHub 目录优先使用 targeted repository，目录 GET 不触发权限主体全量 reconciliation。
- RunningHub 目录按用户权限上下文生成 revision/ETag；客户端收到 `304` 时复用同一用户缓存，不跨用户共享。
- 任务列表只返回任务摘要、日志条数和最新一行日志；完整 payload/result/logs 通过详情和日志接口按 ID 读取。
- 生成库列表不再使用 `select *`，内容下载继续走单独的流式 content endpoint。

## 后台资源

- 普通读取审计进入有界 FIFO buffer，写入失败会重试；安全、权限和变更审计仍同步写入。
- ZIP 归档只由 Worker 处理，使用全局租约、单并发、owner 公平轮转、流式文件读取和临时文件原子 rename。
- API 系统页兼容保留 `/api/admin/system`，并提供 `/api/admin/system/health` 与 `/api/admin/system/runtime-settings` 两个定向读取入口。

## 验证入口

- `npm run verify:targeted-read-repositories`
- `npm run verify:read-path-no-side-effects`
- `npm run verify:read-cache-authorization`
- `npm run verify:output-archive-load-isolation`
- `npm run measure:api-memory-soak -- --base-url=$env:XINGHUAN_GRAY_BASE_URL`
