# ADR 0009：输出归档权威源与全局串行执行

> **Status:** Proposed
> **Date:** 2026-08-04
> **Owners:** Canvas / API / Worker / Storage / Operations
> **Decision Scope:** Task output archive / authorization / queue / temporary storage
> **Supersedes:** None

## Context

RunningHub 节点需要在一次任务结束后把全部可用输出组成 ZIP 并自动触发浏览器下载。输出可能包含大视频，多个用户或节点可能同时完成。浏览器压缩会放大客户端内存和 CORS 风险；API 请求内即时压缩会占用 API 生命周期，并且多 API/Worker 实例下无法保证全站串行；直接扫描 owner 输出目录又无法证明文件属于当前任务。

现有系统已经把任务和 Generation Artifact 放在 PostgreSQL，把 Provider 队列和短期并发辅助状态放在 Redis，并由 Worker 负责输出物料化。归档需要延续任务 ownership 和 Artifact 权威边界，同时增加可恢复的临时文件生命周期。

## Decision

输出归档采用服务端异步任务。客户端只提交 source task ID；API 根据当前用户和任务结果冻结权威本地文件集合。PostgreSQL 保存 archive job、owner 公平游标、全局执行槽、租约、终态和临时文件元数据。Redis 不保存归档终态。

API 只负责鉴权、入队、状态查询、取消和 ready 文件下载。Worker 使用 stream 和 backpressure 生成 ZIP，媒体文件使用 store 模式，小型 manifest 可以 deflate。ZIP 先写 job 唯一 `.part`，成功后原子 rename。归档文件位于独立 owner-scoped 临时根目录，不登记为 Generation Artifact、Asset 或长期资源。

全站默认只有一个 archive job 可以 running。多 Worker 必须竞争同一个 durable database slot，并持续刷新 slot lease 和 job heartbeat；失去租约的 Worker中止当前写流。领取顺序按 owner 轮转，同一 owner 内按创建时间排序。相同 owner、source task 和输出指纹复用未过期 job。

成功物料化的文件可以在 source task succeeded、failed 或 cancelled 终态下归档。部分文件缺失时 ZIP包含可用文件和 `manifest.json`；没有本地可用文件时 job 失败。Worker 不回源任意 Provider URL。

## Alternatives

- 浏览器 JS ZIP：实现入口简单，但大文件内存、跨域、临时授权和刷新恢复不可控，因此不采用。
- API 请求内同步流式 ZIP：无需临时文件，但排队等待会占住 HTTP 请求，错误反馈和重试较差，多实例下仍需分布式限流，因此不采用。
- Redis-only archive queue：适合投递，但不能独立承载 owner 权威、终态、TTL、下载重试和迁移审计，因此不作为权威源。
- 每个 Worker 并发一个 job：实现简单，但实例数会放大全站磁盘 I/O 和 CPU，因此不采用。

## Consequences

### Positive

- API 不承担长时间 ZIP 生成。
- 全站并发可证明为一，且 owner 之间不会长期饥饿。
- 大媒体不进入单一 Buffer，CPU 不浪费在已压缩媒体的二次 deflate。
- 权限、路径、幂等、恢复、TTL 和下载重试都有持久权威记录。
- 归档失败不会改变源 RH 任务、计费或 Generation Artifact 生命周期。

### Negative

- 需要新的 PostgreSQL migration、repository、Worker coordinator、临时存储和清理逻辑。
- 异步准备增加一次状态等待，自动下载不能在 RH 完成瞬间立即开始。
- 临时 ZIP 会短期复制源文件总大小，需要严格磁盘余量和 TTL。
- 全局单并发在高峰期会增加排队时间；提升并发必须重新做容量评审。

## Verification

- 多 Worker 集成测试证明任意时刻最多一个 running archive job。
- 多 owner 队列测试证明轮转公平和同 owner 内 FIFO。
- owner、路径穿越、符号链接、任意 URL 和跨 owner 下载测试全部拒绝。
- 大文件测试证明实现使用 stream/backpressure，不读取完整文件 Buffer。
- 取消、heartbeat 丢失、lease takeover、`.part` 清理、原子 rename、TTL 和重复下载均有测试。
- Gray 使用真实 RH 多输出任务验证自动入队、串行准备、浏览器下载和服务资源指标。

## Migration And Rollback

先执行前向 migration，再启用 API 入队和 archive Worker，最后启用 Gray Web 开关。运行时开关可以停止新 job 入队和 Worker 领取，而不影响 RH 生成链路。回滚应用 release 时保留 job 表、历史记录和 source outputs，不回滚数据库 migration；未过期临时 ZIP 由兼容清理器继续按明确路径清理。
