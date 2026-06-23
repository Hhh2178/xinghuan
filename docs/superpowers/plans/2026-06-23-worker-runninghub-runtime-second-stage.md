# Worker RunningHub Runtime Second Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不打断现有协议链路的前提下，把 `worker.ts` 中剩余的 RunningHub 协议执行、Key 池调度、取消同步与统一运行态归一化继续拆薄，降低后续协议接入和 bug 修复成本。

**Architecture:** 保持 `apps/worker/src/worker.ts` 作为任务编排 glue，不再继续承载大段 provider 业务细节。以“协议 client”“调度模块”“运行态诊断模块”“取消同步 helper”四类职责拆分。优先复用已完成的 `worker-grsai-image-client.ts` 模式，对 RunningHub 做平行收口，而不是全量重写 worker。

**Tech Stack:** TypeScript, Node.js, worker runtime, shared unified diagnostics, RunningHub provider chain, CodeGraph, RTK

---

### Task 1: 固化第二阶段拆分边界与契约护栏

**Files:**
- Create: `scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs`
- Modify: `docs/systems/worker/README.md`
- Modify: `docs/systems/runninghub/README.md`
- Test: `node scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs`

- [ ] **Step 1: 写第二阶段 contract 脚本**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");

assert.match(worker, /createRunningHubClient/);
assert.match(worker, /selectExecutableRunningHubKey/);
assert.match(worker, /closeTaskAsCancelled/);
assert.match(worker, /normalizeUnifiedFailure/);

console.log("PASS worker runninghub runtime second stage contract");
```

- [ ] **Step 2: 运行 contract，先确认当前缺口**

Run: `node scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs`
Expected: 初始可能失败，暴露当前尚未拆出的边界

- [ ] **Step 3: 文档补当前目标边界**

在 `docs/systems/worker/README.md` 与 `docs/systems/runninghub/README.md` 中明确：
- `worker.ts` 只保留 orchestration glue
- RunningHub 拆成 client + dispatch
- 统一运行态与取消同步会抽公共 helper

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs docs/systems/worker/README.md docs/systems/runninghub/README.md
git commit -m "test: add worker runninghub second-stage contract"
```

### Task 2: 抽离 RunningHub 协议 client

**Files:**
- Create: `apps/worker/src/worker-runninghub-client.ts`
- Modify: `apps/worker/src/worker.ts`
- Test: `scripts/verify-worker-runninghub-client.ts`

- [ ] **Step 1: 写 RunningHub client 直测脚本**

覆盖至少：
- workflow submit success
- AI app submit success
- poll success
- poll failed
- success without usable outputs
- cancel request / cancel success

- [ ] **Step 2: 从 `worker.ts` 中迁出协议动作**

迁出职责：
- submit workflow
- submit AI app
- poll workflow / app query
- parse RunningHub output
- translate upstream errors into unified runtime diagnostics

- [ ] **Step 3: `worker.ts` 只通过 client 调用**

要求：
- `worker.ts` 不再直接拼 RunningHub submit/query 的 fetch 细节
- `worker.ts` 只消费 client 返回的统一结果结构

- [ ] **Step 4: 跑验证**

Run:
- `npx tsx scripts/verify-worker-runninghub-client.ts`
- `node scripts/verify-runninghub-node-progress-contract.mjs`
- `node scripts/verify-runninghub-key-pool-contract.mjs`

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/worker-runninghub-client.ts apps/worker/src/worker.ts scripts/verify-worker-runninghub-client.ts
git commit -m "refactor: extract runninghub worker client"
```

### Task 3: 抽离 RunningHub Key 池调度模块

**Files:**
- Create: `apps/worker/src/worker-runninghub-dispatch.ts`
- Modify: `apps/worker/src/worker.ts`
- Modify: `apps/api/src/server.ts`
- Test: `node scripts/verify-runninghub-dynamic-key-selection-contract.mjs`

- [ ] **Step 1: 抽出调度能力**

迁出职责：
- 选择默认 Key / fallback Key
- 读取并发窗口
- 占位 / 释放
- `all_keys_busy` 判定
- `legacy-default` 兼容回退

- [ ] **Step 2: 保持对外字段不变**

继续维持：
- `preferredRhKeyId`
- `assignedRhKeyId`
- `assignedRhKeyNoteSnapshot`
- `assignedRhKeyMaxConcurrency`
- `rhQueueReason`

- [ ] **Step 3: 跑验证**

Run:
- `node scripts/verify-runninghub-dynamic-key-selection-contract.mjs`
- `node scripts/verify-runninghub-key-pool-contract.mjs`
- `npm run type-check -w @xinghuan/worker`
- `npm run type-check -w @xinghuan/api`

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/worker-runninghub-dispatch.ts apps/worker/src/worker.ts apps/api/src/server.ts
git commit -m "refactor: isolate runninghub key dispatch"
```

### Task 4: 抽离统一运行态与取消同步 helper

**Files:**
- Create: `apps/worker/src/worker-runtime-diagnostics.ts`
- Create: `apps/worker/src/worker-cancel-sync.ts`
- Modify: `apps/worker/src/worker.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `node scripts/verify-unified-protocol-runtime-contract.mjs`

- [ ] **Step 1: 抽出统一失败归一化**

迁出职责：
- `normalizeUnifiedFailure`
- patch 合并优先级
- `failureCategory`
- `providerDiagnostic`
- `upstreamHttpStatus`
- `upstreamResponseSnippet`

- [ ] **Step 2: 抽出取消同步**

迁出职责：
- worker 侧 cancel request 发起
- 后台取消时同步到 provider
- provider 已取消时同步回画布运行态

- [ ] **Step 3: 跑验证**

Run:
- `node scripts/verify-unified-protocol-runtime-contract.mjs`
- `npm run verify:provider-generation-worker`
- `npm run verify:worker-grsai-contract`

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/worker-runtime-diagnostics.ts apps/worker/src/worker-cancel-sync.ts apps/worker/src/worker.ts packages/shared/src/index.ts
git commit -m "refactor: extract runtime diagnostics and cancel sync"
```

### Task 5: 收口入口文档与 release gate

**Files:**
- Modify: `README.md`
- Modify: `docs/memory/current-state.md`
- Modify: `docs/systems/worker/README.md`
- Modify: `docs/systems/runninghub/README.md`
- Modify: `docs/logbooks/daily/2026/2026-06/2026-06-23.md`
- Test: `codegraph sync`

- [ ] **Step 1: 同步系统文档**

补充：
- `worker.ts` 新角色
- RunningHub client / dispatch 的边界
- 新增 helper 的责任说明

- [ ] **Step 2: 同步 daily 与 current-state**

把第二阶段收口纳入：
- 当前风险
- 当前下一步
- 当前推荐阅读入口

- [ ] **Step 3: 跑最终验证**

Run:
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/worker`
- `node scripts/verify-unified-protocol-runtime-contract.mjs`
- `node scripts/verify-runninghub-dynamic-key-selection-contract.mjs`
- `node scripts/verify-worker-runninghub-runtime-second-stage-contract.mjs`
- `codegraph sync`

- [ ] **Step 4: Commit**

```bash
git add README.md docs/memory/current-state.md docs/systems/worker/README.md docs/systems/runninghub/README.md docs/logbooks/daily/2026/2026-06/2026-06-23.md
git commit -m "docs: record worker runninghub second-stage plan"
```
