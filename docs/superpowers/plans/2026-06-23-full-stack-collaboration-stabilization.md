# Full-Stack Collaboration Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以最小风险把全项目前端、后台、API、Worker、RunningHub 的协作链拆薄并收口。

**Architecture:** 这次不做一次性重构，按“先止血、再收口、最后隔离”的顺序推进。每个阶段都必须能单独验证、单独灰度、单独回滚。

**Tech Stack:** TypeScript, React, Node.js, PostgreSQL, Redis, RunningHub, RTK, CodeGraph

---

### Task 1: 建立全局协作审查入口

**Files:**
- Create: `docs/records/2026-06-23-full-stack-collaboration-audit.md`
- Create: `docs/superpowers/specs/2026-06-23-full-stack-collaboration-governance-design.md`
- Modify: `docs/records/README.md`

- [ ] **Step 1: 写入审查记录**

记录当前确认问题：
- 巨型入口文件
- RH 停止语义不统一
- 分析与执行漂移
- production / gray 环境未完全隔离

- [ ] **Step 2: 写入治理设计**

写清楚：
- 分层方式
- 关键原则
- 验收标准

- [ ] **Step 3: 更新记录索引**

把新审查记录挂到 `docs/records/README.md`

- [ ] **Step 4: 校验文档无占位符**

Run:

```bash
rtk grep "TBD|TODO|fill in|implement later" docs/records docs/superpowers/specs docs/superpowers/plans
```

Expected:
- 不应出现占位符式描述

- [ ] **Step 5: Commit**

```bash
git add docs/records/2026-06-23-full-stack-collaboration-audit.md docs/superpowers/specs/2026-06-23-full-stack-collaboration-governance-design.md docs/records/README.md
git commit -m "docs: add full-stack collaboration audit and governance design"
```

### Task 2: 统一运行态与取消态

**Files:**
- Modify: `apps/web/src/services/generation.ts`
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/web/src/components/nodes/RHToolsNode.tsx`
- Modify: `apps/api/src/task-cancellation-service.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: 抽出前端取消入口**

所有节点取消都先走同一个生成服务接口，不再各写各的停止语义。

- [ ] **Step 2: 节点 UI 显式区分“停轮询”和“真取消”**

把按钮文案和状态回写分开，避免假取消。

- [ ] **Step 3: 后端取消返回统一字段**

至少保留：
- `cancelled`
- `upstream`
- `cancelScope`
- `upstreamSupported`
- `upstreamAttempted`
- `message`

- [ ] **Step 4: 跑类型检查**

Run:

```bash
npm run type-check -w @xinghuan/web
npm run type-check -w @xinghuan/api
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/generation.ts apps/web/src/components/nodes/RunningHubNode.tsx apps/web/src/components/nodes/RHToolsNode.tsx apps/api/src/task-cancellation-service.ts apps/api/src/server.ts
git commit -m "fix: unify task cancellation semantics"
```

### Task 3: 收口 RunningHub 分析与执行

**Files:**
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`
- Modify: `apps/admin/src/admin-runninghub-item-editor.tsx`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/web/src/components/nodes/RunningHubNode.tsx`
- Modify: `apps/web/src/components/nodes/RHToolsNode.tsx`
- Modify: `apps/api/src/runninghub-execution-descriptor.ts`
- Modify: `apps/api/src/runninghub-catalog.ts`

- [ ] **Step 1: 让分析结果有更明确的草案状态**

把 `requestExample` / `responseExample` 的结果分成：
- 输入草案
- 输出草案
- 执行规则草案
- 漂移提示
- 已生效状态

- [ ] **Step 2: 节点共享执行规则**

RunningHub 节点与 RH Tools 节点共享：
- display label
- submit
- poll
- output reset
- cancel
- `runTargetId / targetType` 高级区语义

- [ ] **Step 3: 让后台草案和前端执行同源**

避免后台看见的字段与画布执行字段继续分叉。
优先保证：
- `execution`
- `outputSchema`
- drift 提示

- [ ] **Step 4: 跑契约测试**

Run:

```bash
node scripts/verify-runninghub-analyze-contract.mjs
node scripts/verify-runninghub-node-progress-contract.mjs
node scripts/verify-runninghub-output-reset-contract.mjs
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/admin-runninghub-workspace.tsx apps/admin/src/admin-runninghub-item-editor.tsx apps/admin/src/admin-types.ts apps/web/src/components/nodes/RunningHubNode.tsx apps/web/src/components/nodes/RHToolsNode.tsx apps/api/src/runninghub-execution-descriptor.ts apps/api/src/runninghub-catalog.ts
git commit -m "refactor: align runninghub analysis and execution"
```

### Task 4: 拆薄 API / Worker / Canvas 热点

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/web/src/components/Canvas.tsx`
- Modify: `apps/web/src/components/ApiSettings.tsx`
- Modify: `apps/admin/src/admin-api-settings-panel.tsx`

- [ ] **Step 1: 列出最重的职责块**

优先切：
- API 路由聚合
- Worker 调度聚合
- Canvas 项目/素材/运行态聚合
- Admin provider 设置聚合

- [ ] **Step 2: 把不该留在入口文件里的 helper 抽出去**

保持每个新文件只做一件事。

- [ ] **Step 3: 跑一次类型检查**

Run:

```bash
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/worker
npm run type-check -w @xinghuan/web
npm run type-check -w @xinghuan/admin
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/server.ts apps/worker/src/worker.ts apps/web/src/components/Canvas.tsx apps/web/src/components/ApiSettings.tsx apps/admin/src/admin-api-settings-panel.tsx
git commit -m "refactor: split collaboration hotspots"
```

### Task 5: 完成环境边界收口

**Files:**
- Modify: `ops/current/production.md`
- Modify: `ops/production-deploy-runbook.md`
- Modify: `ops/production-acceptance-checklist.md`
- Modify: `docs/memory/current-state.md`

- [ ] **Step 1: 把 production 边界写清楚**

明确数据库、队列、版本、回滚边界。

- [ ] **Step 2: 增加硬阻断检查**

生产环境不允许继续指向 gray 资源。

- [ ] **Step 3: 更新运行态记录**

让主入口和当前状态保持一致。

- [ ] **Step 4: 跑只读验证**

Run:

```bash
npm run verify:system-observability
```

- [ ] **Step 5: Commit**

```bash
git add ops/current/production.md ops/production-deploy-runbook.md ops/production-acceptance-checklist.md docs/memory/current-state.md
git commit -m "ops: tighten production boundary records"
```

### Task 6: 最终收尾与复查

**Files:**
- Modify: `README.md`
- Modify: `docs/prd/README.md`
- Modify: `ops/README.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: 更新当前状态入口**

把已解决、待解决、待灰度的内容同步到主入口。

- [ ] **Step 2: 更新逐日台账**

记录本轮审查、计划、验证、提交。

- [ ] **Step 3: 执行 CodeGraph 同步**

Run:

```bash
codegraph sync
```

- [ ] **Step 4: 最终 Commit**

```bash
git add README.md docs/prd/README.md ops/README.md DEVLOG.md
git commit -m "docs: close full-stack collaboration stabilization record"
```

## 交付顺序

1. 先写记录和设计
2. 再做取消 / 运行态统一
3. 再收口 RunningHub 协作链
4. 再拆热点文件
5. 最后做环境边界和入口收尾
