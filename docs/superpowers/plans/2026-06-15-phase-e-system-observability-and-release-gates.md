# Phase E System Observability And Release Gates Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development. Keep each verification result truthful and do not write gray / production success unless the server-side release was actually executed.

**Goal:** 为 Phase E 第二阶段补齐系统页最小观测项、固定发布 gate 文档，并把关键验证脚本纳入 release package。

**Architecture:** 在现有 `/api/admin/system` 上扩展数据库目标、任务运行概览和审计 `requestId` 覆盖率；后台系统页只新增表格行，不引入新页面；运维侧以 `ops/production-acceptance-checklist.md` 和新的 Phase E gate 文档作为当前入口；release package 继续维持 runtime-only，但带上当前阶段的关键 verify 脚本。

**Tech Stack:** TypeScript, React, Node.js, PostgreSQL, existing admin/api scripts, markdown ops docs.

---

## File Structure Map

- Modify: `apps/api/src/server.ts`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
- Modify: `scripts/verify-admin-readonly-panels-contract.mjs`
- Create: `scripts/verify-system-observability.mjs`
- Create: `scripts/verify-release-gate-docs-contract.mjs`
- Modify: `scripts/package-release.mjs`
- Modify: `scripts/verify-release-package-contract.mjs`
- Modify: `package.json`
- Create: `ops/phase-e-observability-release-gate-2026-06-15.md`
- Modify: `ops/production-acceptance-checklist.md`
- Modify: `ops/README.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/prd/README.md`
- Modify: `docs/prd/v0.1.0/progress.md`
- Modify: `docs/production-multi-user-hardening-plan-2026-06-13.md`
- Modify: `DEVLOG.md`
- Modify: `MEMORY.md`

## Task 1: 锁定 system 面板与放行文档契约

- [ ] 扩展 `verify-admin-readonly-panels-contract.mjs`，要求新的系统状态行存在。
- [ ] 新建 `verify-release-gate-docs-contract.mjs`，锁定生产验收清单、ops 入口和 Phase E gate 文档。
- [ ] 在 `package.json` 注册 `verify:system-observability` 和 `verify:release-gate-docs-contract`。

## Task 2: 实现 `/api/admin/system` 观测字段

- [ ] 扩展 `readDatabaseStatus()`，返回当前数据库、目标数据库和是否匹配。
- [ ] 新增任务概览汇总：
  - `total`
  - `queued`
  - `running`
  - `succeeded`
  - `failed`
  - `cancelled`
  - `failedLast24h`
- [ ] 新增最近审计 `requestId` 覆盖率汇总。
- [ ] `/api/admin/system` 返回新的 `observability` 结构。

## Task 3: 后台系统页展示

- [ ] 扩展 `SystemInfo` 类型。
- [ ] 在 `SystemPanel` 增加数据库目标、任务概览和审计覆盖率行。
- [ ] 运行 `verify:admin-readonly-panels-contract`。

## Task 4: 固定发布 gate 与 release package

- [ ] 更新 `ops/production-acceptance-checklist.md`。
- [ ] 新增 `ops/phase-e-observability-release-gate-2026-06-15.md`。
- [ ] 更新 `ops/README.md` 当前入口。
- [ ] 把 `verify-request-chain-observability`、`verify-system-observability`、`verify-worker-observability-contract` 纳入 release package 与契约检查。

## Task 5: 验证与状态文档同步

- [ ] 运行：
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/admin`
  - `npm run build -w @xinghuan/api`
  - `npm run build -w @xinghuan/admin`
  - `npm run verify:admin-readonly-panels-contract`
  - `npm run verify:release-gate-docs-contract`
  - `npm run verify:release-package-contract`
- [ ] 启动 fresh local instance，运行：
  - `npm run verify:request-chain-observability`
  - `npm run verify:system-observability`
- [ ] 把真实结果写回：
  - `DEVLOG.md`
  - `MEMORY.md`
  - `docs/production-multi-user-hardening-plan-2026-06-13.md`
  - `docs/prd/v0.1.0/progress.md`

## Success Criteria

- system 页新增观测项已代码落地并本地通过验证。
- 发布 gate 文档已形成当前入口，不再散落在旧 release 记录里。
- 当前阶段状态写实为：
  - `Phase E` 第一阶段请求链路已完成本地收口
  - 第二阶段系统观测与 gate 文档已完成本地收口
  - gray / production 真实执行仍待后续 release
