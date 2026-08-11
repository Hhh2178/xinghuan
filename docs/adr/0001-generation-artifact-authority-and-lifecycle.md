# ADR 0001: 生成产物权威源与生命周期

> **Status:** Accepted  
> **Date:** 2026-07-17  
> **Owners:** Storage/Data、API、Worker、Canvas  
> **Decision Scope:** 生成结果登记、生成库查询、三天生命周期、资源库晋级  
> **Supersedes:** None

## Context

当前生成库元数据按用户存放在 `generation-library.json`。Canvas 在观察到节点输出后，由浏览器并发调用登记接口；API 对同一 JSON 文件执行读、改、整文件覆盖，读取时还会顺带清理过期条目和文件。

这使正确性依赖前端页面是否打开、节点扫描是否触发以及多个写请求的时间顺序。并发覆盖、进程中断或 JSON 解析失败都可能让生成库条目丢失；元数据、输出文件和画布引用也可能发生漂移。该事实与 `CONTEXT.md` 中“服务端权威、GET 只读、并发安全”的不变量不一致。

本 ADR 只记录目标架构提案。当前实现仍以 `docs/systems/storage-and-data/material-and-output-storage.md` 和代码为准。

## Decision

本 ADR 已获用户明确授权进入实施，按以下边界执行：

1. PostgreSQL 表 `xh_generation_artifacts` 成为 Generation Artifact 元数据的唯一业务权威源；至少记录 artifact ID、owner ID、kind、状态、存储定位、来源任务/画布/节点、创建/到期时间和晋级关系。
2. Worker 在生成文件物料化成功后通过服务端 `GenerationArtifactLifecycle` 服务登记；前端扫描不再承担“确保产物存在”的职责。
3. API 的生成库 GET 只查询当前用户且保持只读。过期推进、孤儿修复和物理清理由后台命令或定时任务显式执行。
4. 状态机至少区分 `active`、`expired`、`promoted`、`missing`、`deleted`；数据库状态先推进，物理删除异步且可重试。
5. Artifact Binary 通过 `ArtifactStore` 适配器访问，首阶段可继续使用本地文件系统，未来可替换对象存储而不改变领域接口。
6. Promotion 是显式、幂等的服务端动作，创建或关联 Resource Asset；晋级后的长期素材不受生成库三天期限控制。
7. 建立 Reconciler 对比数据库、文件和引用，输出缺失、孤儿和过期积压指标；不得通过普通读取请求静默修复。

## Alternatives

- 继续使用 JSON，加文件锁、原子 rename 和损坏备份：可作为迁移前止血，但仍缺少查询、审计、状态机和跨进程事务能力，不能作为长期权威源。
- 由前端串行登记并增加重试：只能降低单页面并发，无法解决关闭页面、多个实例、进程中断和服务端生命周期问题。
- 直接把画布节点数据作为权威源：画布编辑和删除会改变展示拓扑，不适合承担独立产物生命周期与资源晋级。
- 立即迁移到对象存储：能改善文件层扩展性，但不能单独解决元数据权威、ownership 和生命周期；应与 ArtifactStore 解耦后独立决策。

## Consequences

### Positive

- 生成库不再依赖浏览器扫描或无锁 JSON 覆盖。
- owner、三天期限、晋级和清理具有可查询、可审计的服务端语义。
- 数据库、文件和画布引用的漂移可以被观测和修复。
- 后续迁移对象存储时不需要重写业务模型。

### Negative

- 需要数据库迁移、双读/回填期、定时清理和 reconciliation 运维能力。
- Worker 物料化与元数据登记之间需要明确失败补偿。
- 迁移期间必须同时保护历史 JSON、现有文件和用户可见行为，实施复杂度高于局部修补。

## Verification

### 2026-08-11 Amendment: configurable retention window

The three-day value remains the product fallback, not a deployment-wide constant. The authoritative runtime value is `materialLifecycle.outputRetentionDays` in system settings. Worker registration, legacy API registration, Canvas display, and reconciliation packaging must consume or preserve that authority consistently. Existing artifact expiry timestamps remain immutable unless an explicit migration/backfill operation is recorded.

- 契约测试覆盖 owner 隔离、服务端登记幂等、GET 无写副作用和状态机合法迁移。
- 并发测试证明同一用户多产物登记不丢失，重复回调不产生重复记录。
- 迁移演练核对每个用户的 JSON 条目数、数据库条目数、文件存在性和异常清单。
- Gray 至少观察一个完整三天生命周期窗口，再考虑 Production 晋级。
- 观测指标覆盖登记失败、missing、orphan、过期积压和清理重试。

## Migration And Rollback

1. 先建立表、repository、lifecycle 服务和只读 reconciliation，不改变现有读路径。
2. 备份并解析每用户 JSON，损坏文件单独隔离，回填采用稳定幂等键。
3. Worker 双写数据库与现有 JSON；对账稳定后，Gray 切换数据库读路径。
4. 停止前端自动登记，再停止 JSON 写入；保留 JSON 和原文件至少一个受控回滚窗口。
5. Production 只晋级 Gray 已验证制品。若出现 owner、数量或访问回归，恢复旧读路径，不反向删除已回填数据库记录。
6. 物理文件清理必须最后启用，并始终与元数据状态推进分离。
