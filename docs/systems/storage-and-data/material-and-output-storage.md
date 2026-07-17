# 素材与输出落库

## 当前稳定规则

- 生成结果要进入统一输出与素材访问层
- 预览、下载、打开要有统一 URL 语义
- 输出不能只留在上游外链

## 当前仓库生成库实现

- PostgreSQL 表 `xh_generation_artifacts` 是 Gray / Production 下一次发布后的生成产物元数据权威源；迁移由 `024_generation_artifacts.sql` 创建。
- Worker 在输出文件物料化后直接登记 Generation Artifact；同步 API 输出保存路径也在服务端登记。
- Canvas 不再扫描节点并并发 POST 登记。旧 POST 接口暂时保留为兼容入口。
- GET 只查询当前 owner 的 `active/promoted` 且未到期记录，不推进状态、不写 JSON、不删除文件。
- `GenerationArtifactLifecycle` 集中负责查询、内容解析、删除和 Promotion；PostgreSQL 与 file adapter 位于 repository seam 后。
- Artifact Binary 的解析和删除通过 `ArtifactStore` interface；首阶段使用本地文件 adapter，业务生命周期不绑定具体存储实现。
- 本地 file adapter 仍使用 `generation-library.json`，但写入经过每用户串行队列和临时文件原子替换。
- 当前已部署 Gray / Production 仍运行上一版本实现；必须完成 schema、JSON dry-run/import 和 Gray 生命周期验证后才能切换运行态口径。

## 生命周期与运维

- 状态：`active`、`promoted`、`expired`、`missing`、`deleted`。
- 默认三天期限写入 `expires_at`。
- `npm run generation-artifacts:migrate:dry-run`：扫描历史 JSON，不写数据库。
- `npm run generation-artifacts:migrate`：显式幂等回填；不删除或覆盖历史 JSON。
- 首次发布使用 `release:gray:deploy -- --migrate-generation-artifacts=true`，保证 schema 与回填在服务切换前完成。
- `npm run generation-artifacts:reconcile:dry-run`：报告到期、缺失和物理文件候选。
- `npm run generation-artifacts:reconcile`：显式推进状态；只删除已到期、未晋级且没有资源引用的文件。
- reconciliation 同时报告未登记输出文件；只报告不删除。已经进入 `expired` 但物理删除失败的文件会在下一次运行继续重试。
- 兼容命令 `cleanup:output-materials(:dry-run)` 已指向同一个 reconciliation module。

## Promotion

- `POST /api/generation-library/items/:id/promote` 使用稳定 Asset ID 幂等创建长期 Resource Asset。
- promoted 产物在生成库期限内仍可见；到期后退出生成库，但长期资源文件受保护。
- Resource Asset 不再由所有 Worker 输出自动创建。

## 关键入口

- `apps/worker/src/output-materials.ts`
- 生成库内容访问接口

## 相关领域与决策

- 领域词汇：根 `CONTEXT.md`
- Accepted ADR：`docs/adr/0001-generation-artifact-authority-and-lifecycle.md`
- 治理规格：`docs/superpowers/specs/2026-07-17-generation-artifact-lifecycle-governance.md`
- 实施计划：`docs/superpowers/plans/2026-07-17-generation-library-authority-migration.md`
