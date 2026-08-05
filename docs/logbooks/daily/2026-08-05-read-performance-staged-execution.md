# 2026-08-05 读取性能分阶段执行

## 目标调整

- 读取性能优化拆为 A-F 六个批次。
- 每个批次必须独立构建、旧服务器 Gray 验证、调优和晋级；失败只回退当前批次。
- 新服务器、Production、数据迁移和 GitHub 推送继续暂停。

## 阶段 A 本地进展

- 新增只读测量 fixture 和 `scripts/measure-read-performance.mjs`，支持 cold 10 次、warm 50 次、P50/P95/P99、响应体和重复请求计数。
- 新增 `request-performance-observability`，记录低基数 route、请求耗时、状态、响应体、错误率和有界窗口。
- `/api/admin/system` 增加 RSS、heap、FD、active handles、event-loop delay 和请求性能摘要。
- 新增 `scripts/verify-gray-stage-gate.mjs`，拒绝 Production URL，输出 PASS/HOLD/ROLLBACK_REQUIRED，不修改服务器状态。

## 本地验证

- 全量 Vitest：252 files passed，1 skipped；952 tests passed，4 skipped。
- workspace type-check：通过。
- API build：通过。
- project harness：通过。
- 本地只读 mock 测量和阶段 Gate：PASS。

## Gray 状态

- 真实旧服务器 Gray 测量尚未执行。
- 当前开发 worktree 仍保留素材生命周期/迁移等既有未提交改动，release-clean 门未满足。
- 本机没有 `XINGHUAN_RELEASE_ENCRYPTION_KEY`，无法在本地生成服务器加密制品；不读取、不输出服务器密钥。
- 因此阶段 A 当前只能标记 `HOLD`，不得进入阶段 B，也不得部署 Production 或启动迁移。

## A-E 代码改造收口（本轮）

- 阶段 B：账号、用户组、会话改为定向目录读取；Admin workspace 保留活动子页边界；Provider/模型读路径继续复用 targeted repository。
- 阶段 C：RunningHub 目录复用 Provider/权限上下文、支持按 revision 的 ETag；画布与模型前端 store 保留 in-flight 合并和短 freshness window。
- 阶段 D：任务列表移除完整日志和大字段，新增任务详情/日志读取入口；审计列表接入有界 FIFO read-audit buffer；系统增加 health/runtime-settings 定向入口。
- 阶段 E：补充 ZIP Worker 负载隔离契约、内存 soak 测量器和 targeted-read/read-side-effect/cache-authorization Harness 契约。
- RH 自动 ZIP 下载补充按 `taskId` 的浏览器本地幂等标记，覆盖首次下载后画布 800ms 保存防抖窗口内立即刷新导致的重复下载；显式重试会清理标记。输出素材节点左上角批量下载入口继续按去重后的图片、视频、音频 URL 逐项触发默认下载路径。
- 以上均为开发 worktree 代码改造；尚未重新构建或部署新的 Gray 制品，Production、迁移和 GitHub 继续暂停。

## 退役权限主体清理（0.8.26 候选）

- 服务商或模型退出目录后，权限 Subject 仍保留为 `retired`，历史任务、成本、审计记录和身份快照不受影响。
- 权限 reconciliation 会删除仅指向 `retired` Subject 的授权规则；PostgreSQL 使用单条原子 `DELETE ... USING`，文件存储路径同步覆盖。
- 每次清理均追加系统审计记录；权限后台默认隐藏退役主体，并提供“当前对象 / 已退役 / 全部”筛选。
- 本地验证：全量 Vitest 258 个文件、971 个测试通过（4 个跳过）；完整构建、类型检查、权限平台契约、读路径副作用契约、项目 Harness、workspace Harness 和 release Harness 均通过。

## 旧服务器 Gray GRSAI 生图压力验证

- 在旧服务器 Gray 的 `v0.8.26` 上执行最多 20 次的真实 `GRSAI / gpt-image-2` 受控生图验证，覆盖同步代理与 Worker 异步队列并回读结果文件。
- 4 个并发批次全部通过；最终 8 次同步与 8 次 Worker 生成成功，连同前置 4 次同步探测共 20 次，未超过调用上限。
- 压测后 API 和 Worker 均为 `active`，内部状态为 `ok / gray / permissionMode=enforced`，系统负载为 `0.11 / 0.08 / 0.06`，本次时间窗未发现 Worker 错误、超时或崩溃日志。
- 灰度验证脚本同步当前 CSRF、任务能力与详情轮询合同；完整证据见 [`2026-08-05-grsai-gpt-image-2-old-gray-stress.md`](../validations/2026-08-05-grsai-gpt-image-2-old-gray-stress.md)。
