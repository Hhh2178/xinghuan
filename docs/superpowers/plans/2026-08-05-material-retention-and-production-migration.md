# 素材生命周期与 Production 完整迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将生成素材保留天数纳入 Admin 可编辑运行参数，验证资源库持久化/物理删除，并在 2026-08-05 18:30 自动完成旧 Production 到新 Production 的完整替换迁移。

**Architecture:** 在现有 `xh_system_settings` 和 Admin system settings 路由上扩展独立的 `materialLifecycleSettings`，清理器通过共享读取接口使用数据库配置；迁移采用受保护的一次性脚本，先备份目标再恢复源数据库和持久化文件。

**Tech Stack:** TypeScript, Node.js ESM, PostgreSQL, Redis, React/TSX, Vitest, SSH/SCP, Codex scheduled automation.

## Global Constraints

- 默认生成输出保留 `3` 天；新服务器 Production 初始值为 `15` 天。
- 只清理未收藏、未分类、未进入资源库且无任务/画布引用的临时生成产物。
- 迁移覆盖旧 Production 数据库、资源库、画布、项目、生成记录和对应持久化文件。
- 迁移前完整备份新 Production；旧 Production 不修改。
- 不迁移密钥、Redis 临时队列、登录会话或日志。
- 18:30 自动执行前必须通过备份和只读预检。

---

### Task 1: 生命周期参数契约与存储

**Files:**
- Modify: `apps/api/src/settings-repository.ts`
- Modify: `apps/api/src/admin-types.ts`
- Modify: `packages/shared/src/*` settings type location found by `rg "TaskQueueSettings"`
- Create: `apps/api/src/material-lifecycle-settings.ts`
- Test: `apps/api/src/material-lifecycle-settings.test.ts`

- [ ] Write failing tests for default `3`, clamped integer range, database round-trip and environment fallback.
- [ ] Implement `MaterialLifecycleSettings` with `outputRetentionDays` and normalization.
- [ ] Extend system settings persistence without changing existing task queue JSON semantics.
- [ ] Run focused tests and type-check.
- [ ] Commit `feat: add persisted material lifecycle settings`.

### Task 2: 清理器接入动态参数

**Files:**
- Modify: `scripts/prune-old-output-materials.mjs`
- Modify: API/Worker output-prune bootstrap discovered by `rg "prune-old-output-materials|output-prune"`
- Test: `scripts/prune-old-output-materials.test.ts` or existing equivalent

- [ ] Add a failing test proving database-configured `15` overrides the default `3`.
- [ ] Make dry-run output include configured source and retention days.
- [ ] Route timer/worker invocation through the shared settings reader with environment fallback.
- [ ] Verify old eligibility guards and shared-file protection remain unchanged.
- [ ] Run focused tests and a local dry-run fixture.
- [ ] Commit `feat: drive output pruning from runtime retention setting`.

### Task 3: Admin API 与运行参数界面

**Files:**
- Modify: `apps/api/src/admin-system-settings-routes.ts`
- Modify: `apps/api/src/admin-system-response-adapter.ts`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
- Modify: `apps/admin/src/styles/route-shell.css`
- Test: `apps/api/src/admin-system-settings-routes.test.ts`
- Test: `apps/admin/src/admin-system-configuration.test.tsx`

- [ ] Add failing API tests for read/write, revision conflict, audit action and range validation.
- [ ] Extend `/api/admin/system` payload and write route with material lifecycle settings.
- [ ] Add the “素材生命周期” panel with retention input, scope summary, last-save state and clear grouping beside queue settings.
- [ ] Keep existing queue settings and navigation paths compatible.
- [ ] Run focused API/Admin tests and desktop build.
- [ ] Commit `feat: add admin material lifecycle controls`.

### Task 4: 资源库持久化与物理删除验证

**Files:**
- Modify: resource delete route module found by `rg "delete from xh_assets"`
- Modify: `apps/web/src/components/ResourceLibraryDrawer.tsx` only for error/status copy if required
- Create: focused API deletion test/fixture
- Create: `scripts/verify-resource-library-storage-contract.mjs`

- [ ] Reproduce current deletion behavior against a fixture with one unique file and one shared file.
- [ ] Implement transaction-safe record deletion plus owner-scoped, boundary-checked physical file deletion.
- [ ] Preserve shared files and referenced generated artifacts.
- [ ] Add contract output for DB row count, file existence and orphan count.
- [ ] Run focused tests and local contract.
- [ ] Commit `fix: remove unreferenced resource files on delete`.

### Task 5: 完整迁移脚本与预检

**Files:**
- Create: `scripts/release/migrate-production-data.mjs`
- Create: `scripts/release/verify-production-migration.mjs`
- Create: `scripts/release/production-migration.test.ts`
- Modify: `package.json`
- Modify: `config/release-target-profiles.json` only if target-specific migration metadata is required

- [ ] Add dry-run preflight that validates SSH, current release, database names, disk space and target backup directory.
- [ ] Implement backup-first export/restore for database and persistent data; never copy env files, keys, queues, sessions or logs.
- [ ] Add explicit `--source-profile=old-server --target-profile=new-server --env=production --apply=true` guard.
- [ ] After restore, write target lifecycle setting to `15` through the supported settings path and verify it.
- [ ] Add post-migration comparison for row counts, resource IDs, file manifests, API/Worker status and permission readiness.
- [ ] Run dry-run only first, then a local fixture test.
- [ ] Commit `feat: add guarded production data migration workflow`.

### Task 6: 18:30 一次性自动化与文档

**Files:**
- Create/update migration spec and validation logbook under `docs/logbooks/validations/`
- Modify: `docs/systems/storage-and-data/material-and-output-storage.md`
- Modify: `docs/systems/admin/README.md` or current runtime settings documentation
- Modify: `docs/systems/harness/README.md`

- [ ] Create one-time Codex automation for `2026-08-05 18:30 Asia/Shanghai` bound to the migration script.
- [ ] Include success/failure notification and no secret values in the prompt.
- [ ] Record schedule ID outside Git and reference only its purpose in the logbook.
- [ ] Run all harness contracts, package the server release and update release records.
- [ ] Commit `docs: record material lifecycle and migration rollout`.

### Task 7: 发布与远端同步

- [ ] Build one Gray-verified encrypted server release and reuse it for Production.
- [ ] Deploy Gray old/new, verify, then deploy Production old/new.
- [ ] Push commits to the configured GitHub remote if network/authentication is available; otherwise report the exact push blocker without exposing credentials.
- [ ] After 18:30 migration, run target runtime and data validation; keep old server rollback path.
