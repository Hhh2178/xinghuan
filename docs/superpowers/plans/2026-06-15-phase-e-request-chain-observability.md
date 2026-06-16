# Phase E Request-Chain Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为当前 Phase E 第一阶段补齐请求链路观测基线，让 API、审计、后台审计页和 Worker 能围绕 `requestId / taskId / userId / providerId / modelId` 形成最小可追踪闭环。

**Architecture:** 在现有 `apps/api/src/server.ts` 上增加轻量请求上下文与结构化日志 helper，通过现有审计表字段和任务 JSON 承载链路元数据；后台只扩展审计视图契约与展示，不单独引入新页面；Worker 统一关键生命周期日志格式，并尽量复用已有任务字段传递上下文。

**Tech Stack:** TypeScript, React, Vite, Node.js, PostgreSQL, Redis, existing `apps/api`, `apps/admin`, `apps/worker`, `scripts`, `package.json`.

---

## File Structure Map

- Modify: `apps/api/src/server.ts`
  - 增加请求上下文、`x-request-id`、审计增强、结构化日志、任务链路元数据透传。
- Modify: `apps/admin/src/admin-types.ts`
  - 扩展 `AuditRecord` 契约。
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
  - 审计页展示 `requestId / ip / userAgent`。
- Modify: `apps/worker/src/worker.ts`
  - 增加 worker 结构化日志 helper 并在关键链路接线。
- Create: `scripts/verify-request-chain-observability.mjs`
  - 端到端验证请求头、审计落库与后台读取。
- Create: `scripts/verify-worker-observability-contract.mjs`
  - 验证 worker 代码已输出统一字段契约。
- Modify: `package.json`
  - 注册新的 verify 命令。
- Modify: `DEVLOG.md`
- Modify: `MEMORY.md`
- Modify: `docs/production-multi-user-hardening-plan-2026-06-13.md`

## Task 1: 审计与请求上下文契约测试

**Files:**
- Create: `scripts/verify-request-chain-observability.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写失败的请求链路验证脚本**

```javascript
import assert from "node:assert/strict";

const response = await fetch(`${baseUrl}/api/status`);
assert.ok(response.headers.get("x-request-id"), "expected x-request-id header");
```

- [ ] **Step 2: 运行脚本，确认它先失败**

Run: `node scripts/verify-request-chain-observability.mjs`
Expected: FAIL because `x-request-id` is missing or audit payload lacks new fields.

- [ ] **Step 3: 扩展脚本断言后台审计记录字段**

```javascript
assert.equal(typeof latestAudit.requestId, "string");
assert.ok(latestAudit.requestId.length > 0);
assert.equal(typeof latestAudit.ip, "string");
assert.equal(typeof latestAudit.userAgent, "string");
```

- [ ] **Step 4: 在 `package.json` 注册命令**

```json
"verify:request-chain-observability": "node scripts/verify-request-chain-observability.mjs"
```

- [ ] **Step 5: 再次运行，确认仍为红灯**

Run: `npm run verify:request-chain-observability`
Expected: FAIL on missing API/audit fields, not on script syntax error.

## Task 2: API 请求上下文与审计增强

**Files:**
- Modify: `apps/api/src/server.ts`
- Test: `scripts/verify-request-chain-observability.mjs`

- [ ] **Step 1: 在 `server.ts` 中补请求上下文类型和 helper**

```typescript
interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  startedAt: number;
  userId?: string;
  userEmail?: string;
}
```

- [ ] **Step 2: 在请求入口生成或清洗 `x-request-id`**

```typescript
const requestId = sanitizeRequestId(request.headers.get("x-request-id")) || createRequestId();
responseHeaders.set("x-request-id", requestId);
```

- [ ] **Step 3: 升级 `appendAudit(...)` 签名并写入新字段**

```typescript
async function appendAudit(
  actor: CurrentUser,
  action: string,
  targetType: string,
  targetId: string,
  summary: string,
  context?: RequestContext,
) { /* ... */ }
```

- [ ] **Step 4: PostgreSQL 与 file-mode 同步写入**

```typescript
request_id: context?.requestId || "",
ip: context?.ip || "",
user_agent: context?.userAgent || "",
```

- [ ] **Step 5: 后台关键写操作调用 `appendAudit(...)` 时传入当前请求上下文**

```typescript
await appendAudit(adminUser, "task.cancel", "task", id, `取消任务 ${updated.title}`, requestContext);
```

- [ ] **Step 6: 为任务创建与取消补 API 结构化日志**

```typescript
logApiEvent("task.created", {
  requestId: context.requestId,
  userId: context.userId,
  taskId: task.id,
  providerId: provider.id,
  modelId: model.modelId,
});
```

- [ ] **Step 7: 跑红灯脚本，确认转绿**

Run: `npm run verify:request-chain-observability`
Expected: PASS for response header and audit persistence checks.

## Task 3: 后台审计契约与展示

**Files:**
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
- Test: `scripts/verify-admin-readonly-panels-contract.mjs`

- [ ] **Step 1: 先写失败的契约断言**

```javascript
assert.match(source, /requestId\?: string/);
assert.match(source, /ip\?: string/);
assert.match(source, /userAgent\?: string/);
```

- [ ] **Step 2: 运行契约脚本，确认红灯**

Run: `node scripts/verify-admin-readonly-panels-contract.mjs`
Expected: FAIL because `AuditRecord` and panel columns still missing fields.

- [ ] **Step 3: 扩展 `AuditRecord`**

```typescript
export interface AuditRecord {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  createdAt: number;
}
```

- [ ] **Step 4: 扩展 `AuditPanel` 列**

```tsx
columns={["时间", "操作者", "动作", "对象", "请求", "来源", "说明"]}
```

- [ ] **Step 5: 用紧凑展示避免表格失控**

```tsx
`${item.ip || "-"} ${item.userAgent ? `| ${item.userAgent.slice(0, 80)}` : ""}`
```

- [ ] **Step 6: 运行后台契约验证**

Run: `npm run verify:admin-readonly-panels-contract`
Expected: PASS

## Task 4: Worker 结构化日志契约

**Files:**
- Create: `scripts/verify-worker-observability-contract.mjs`
- Modify: `apps/worker/src/worker.ts`
- Modify: `package.json`

- [ ] **Step 1: 先写失败的 worker 契约检查**

```javascript
assert.match(source, /service:\s*"xinghuan-worker"/);
assert.match(source, /event:/);
assert.match(source, /requestId:/);
assert.match(source, /workerId:/);
```

- [ ] **Step 2: 运行脚本，确认红灯**

Run: `node scripts/verify-worker-observability-contract.mjs`
Expected: FAIL because helper or required event payloads do not yet exist consistently.

- [ ] **Step 3: 在 `worker.ts` 增加统一日志 helper**

```typescript
function logWorkerEvent(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ service: "xinghuan-worker", environment, workerId, event, ...payload }));
}
```

- [ ] **Step 4: 在关键生命周期替换或补充统一事件**

```typescript
logWorkerEvent("task.received", { taskId, requestId, userId, providerId, modelId, capability });
logWorkerEvent("task.succeeded", { taskId, requestId, userId, providerId, modelId, capability });
logWorkerEvent("task.failed", { taskId, requestId, userId, providerId, modelId, capability, error });
```

- [ ] **Step 5: 从任务记录读取链路字段**

```typescript
const requestId = readString(task.result?.requestId || task.payload?.requestId);
const userId = task.ownerId;
```

- [ ] **Step 6: 注册命令并运行验证**

Run: `npm run verify:worker-observability-contract`
Expected: PASS

## Task 5: 任务请求链路透传

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/worker/src/worker.ts`
- Test: `scripts/verify-request-chain-observability.mjs`

- [ ] **Step 1: 为任务创建补最小链路字段**

```typescript
result: {
  requestId: requestContext.requestId,
  userId: currentUser.id,
}
```

- [ ] **Step 2: 保持现有任务结构兼容**

```typescript
const nextResult = {
  ...(task.result || {}),
  requestId: task.result?.requestId || requestContext.requestId,
  userId: task.result?.userId || currentUser.id,
};
```

- [ ] **Step 3: 运行请求链路验证，确认任务创建后的审计和日志链路仍通过**

Run: `npm run verify:request-chain-observability`
Expected: PASS

## Task 6: 类型检查与回归验证

**Files:**
- Test: `apps/api/src/server.ts`
- Test: `apps/admin/src/admin-types.ts`
- Test: `apps/admin/src/admin-readonly-panels.tsx`
- Test: `apps/worker/src/worker.ts`

- [ ] **Step 1: 跑 API 类型检查**

Run: `npm run type-check -w @xinghuan/api`
Expected: PASS

- [ ] **Step 2: 跑 Admin 类型检查**

Run: `npm run type-check -w @xinghuan/admin`
Expected: PASS

- [ ] **Step 3: 跑 Worker 类型检查**

Run: `npm run type-check -w @xinghuan/worker`
Expected: PASS

- [ ] **Step 4: 跑新增验证命令**

Run: `npm run verify:request-chain-observability`
Expected: PASS

- [ ] **Step 5: 跑 Worker 契约验证**

Run: `npm run verify:worker-observability-contract`
Expected: PASS

- [ ] **Step 6: 跑现有回归验证，避免 Phase D 回退**

Run: `npm run verify:admin-readonly-panels-contract`
Expected: PASS

Run: `npm run verify:provider-generation-task-service`
Expected: PASS

Run: `npm run verify:provider-generation-worker`
Expected: PASS

## Task 7: 文档与推进记录

**Files:**
- Modify: `DEVLOG.md`
- Modify: `MEMORY.md`
- Modify: `docs/production-multi-user-hardening-plan-2026-06-13.md`

- [ ] **Step 1: 在 `DEVLOG.md` 记录本轮 Phase E 实现与验证结果**
- [ ] **Step 2: 在 `MEMORY.md` 记录当前请求链路观测已落地的真实状态**
- [ ] **Step 3: 在正式化治理方案里把 Phase E 当前完成项更新为“请求链路观测第一步已完成”**

## 实施边界

- 本轮不拆分 `apps/api/src/server.ts` 的大文件结构，只做局部 helper 与接线。
- 本轮不新增复杂筛选 UI，不做新的审计页面。
- 本轮不承诺全系统所有日志都 100% 统一，只覆盖关键 API / Worker 任务链路。
- 本轮不引入外部观测平台。

## 验收命令

- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/worker`
- `npm run verify:request-chain-observability`
- `npm run verify:worker-observability-contract`
- `npm run verify:admin-readonly-panels-contract`
- `npm run verify:provider-generation-task-service`
- `npm run verify:provider-generation-worker`

## 预期交付结果

- API 请求具备统一 `x-request-id`。
- 审计记录可带出 `requestId / ip / userAgent`。
- 后台审计页能直观看到这些字段。
- Worker 关键生命周期日志采用统一结构化字段。
- Phase E 从“口头要做观测”变成“已有最小可追踪链路基线”。
