# 生成库服务端权威改造实施计划

## Preconditions

- `CONTEXT.md` 已定义 Generation Artifact / Generation Library / Resource Asset / Promotion。
- ADR 0001 经用户明确要求进入实施，状态改为 Accepted。
- 当前只做本地代码、迁移、文档和测试；不执行 Gray / Production 数据写入。

## Phase 1 — Schema And Domain Interface

Touched files:

- `apps/api/db/024_generation_artifacts.sql`
- `packages/shared/src/generation-artifact.ts`
- `packages/shared/src/index.ts`

Verification:

- schema contract 检查字段、状态、唯一约束和索引。
- shared type-check 与状态转换测试。

Rollback:

- 新表在未切换读取前是旁路；回滚应用版本即可，表保留不删。

## Phase 2 — Deep Lifecycle Module

Touched files:

- `apps/api/src/generation-artifact-repository.ts`
- `apps/api/src/generation-artifact-lifecycle.ts`
- `apps/api/src/generation-artifact-routes.ts`
- `apps/api/src/server.ts`

Verification:

- owner 隔离、GET 只读、登记幂等、删除和晋级测试。
- file adapter 并发/原子写测试。

Rollback:

- 路由可恢复旧 JSON 实现；旧 JSON 在迁移窗口内保持只读备份。

## Phase 3 — Worker Authority

Touched files:

- `apps/worker/src/output-materials.ts`
- `apps/worker/src/worker.ts`
- Worker verifier scripts.

Verification:

- 图片、视频、音频物料化后均登记 artifact。
- 同一 task 重试保持稳定 ID 和单条记录。
- 新输出不再自动写入 `xh_assets`。

Rollback:

- 恢复旧 Worker 写入路径；artifact 表保留用于审计，不删除数据。

## Phase 4 — Canvas And Promotion

Touched files:

- `apps/web/src/components/Canvas.tsx`
- `apps/web/src/components/GenerationLibraryDrawer.tsx`
- `apps/web/src/services/api.ts`

Verification:

- Canvas 不再扫描并 POST 登记。
- 生成库查询、预览、下载、删除保持可用。
- 保存到资源库调用 Promotion，重复点击幂等。

Rollback:

- 可恢复兼容登记 effect；Promotion 产生的 Resource Asset 是长期数据，不自动回删。

## Phase 5 — Migration And Lifecycle Operations

Touched files:

- `scripts/migrate-generation-library-artifacts.mjs`
- `scripts/prune-old-output-materials.mjs`
- `scripts/reconcile-generation-artifacts.mjs`
- `package.json`、release package contract、systemd docs/examples.

Verification:

- migration dry-run、损坏 JSON 报告、重复 apply 幂等。
- cleanup dry-run 无写入；apply 只处理已到期且未晋级 artifact。
- missing/orphan 只报告或受控推进，不碰资源库长期文件。

Rollback:

- 所有运维命令默认 dry-run；旧 JSON 不删除；物理清理最后启用。

Release ordering:

- 首次切换目标环境时，部署脚本必须带 `--migrate-generation-artifacts=true`，在切换 `current` 前完成 schema、历史 JSON dry-run 和幂等回填。

## Phase 6 — Documentation And Harness

Touched files:

- `docs/systems/storage-and-data/`
- `docs/systems/worker/`
- `docs/systems/canvas/`
- `docs/logbooks/daily/`
- architecture/harness contracts.

Verification:

- 专项生成库 contract。
- `harness:verify:project`、`harness:verify:workspace`、`harness:verify:release`。
- `npm run test` 与相关 runtime verifiers。

## Completion Checklist

- [x] ADR 0001 Accepted，当前/目标文档不混写。
- [x] PostgreSQL schema 与 file fallback 均可工作。
- [x] Worker 成为主要登记者。
- [x] GET 完全只读。
- [x] Canvas 自动登记移除。
- [x] Promotion 幂等并保护长期文件。
- [x] migration/reconcile/cleanup 默认 dry-run。
- [x] 专项测试和完整 Harness 通过。
- [x] 本地实施阶段未触碰 Gray / Production 数据或部署；真实发布按独立 Release gate 执行。
