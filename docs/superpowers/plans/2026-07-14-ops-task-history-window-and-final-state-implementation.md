# 系统发布任务窗口与最终状态时间实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 为后台系统与发布任务监控提供最近 2,000 条展示窗口、稳定的最终状态时间，以及不会造成文字堆积的紧凑任务表格。

**架构：** 任务持久化层负责首次终态时写入 `finalizedAt`，让 API、Worker 与取消流程共享相同语义。任务 repository 先确定最近 2,000 条活动记录，再在窗口内筛选和分页；管理端只渲染该 API 合同，并使用固定列宽和单行截断控制信息密度。

**技术栈：** TypeScript、Vitest、PostgreSQL 16、Node.js HTTP API、React 19、Vite。

---

## 文件边界

| 文件 | 责任 |
| --- | --- |
| `apps/api/db/022_ops_task_finalized_at.sql` | 新增 `xh_tasks.finalized_at` 与排序索引。 |
| `apps/api/src/task-lifecycle.ts` | 终态判断与首次写入 `finalizedAt` 的纯函数。 |
| `apps/api/src/task-lifecycle.test.ts` | 终态时间和重试的回归测试。 |
| `apps/api/src/task-repository.ts` | PostgreSQL/文件模式读写及 2,000 条窗口。 |
| `apps/api/src/task-repository.test.ts` | 窗口、查询与最终状态持久化测试。 |
| `apps/api/src/admin-task-list-routes.ts` | 列表窗口元数据的路由合同。 |
| `apps/api/src/admin-task-list-routes.test.ts` | 路由元数据回归测试。 |
| `apps/api/src/task-cancellation-service.ts` | 取消终态写入。 |
| `apps/api/src/task-cancellation-service.test.ts` | 取消任务最终状态时间测试。 |
| `apps/api/src/provider-generation-task-service.ts` | API 侧入队失败终态写入。 |
| `apps/worker/src/worker-task-store.ts` | Worker 成功/失败终态写入。 |
| `apps/worker/src/worker-task-store.test.ts` | Worker 成功/失败任务持久化测试。 |
| `apps/api/src/server.ts` | 数据库行 `finalized_at` 映射。 |
| `apps/admin/src/admin-types.ts` | 管理端任务列表类型。 |
| `apps/admin/src/admin-task-panel.tsx` | 窗口提示、最终状态列和紧凑行内容。 |
| `apps/admin/src/styles.css` | 固定列宽、截断与横向滚动。 |
| `scripts/verify-admin-task-panel-contract.mjs` | 管理端静态合同。 |

## 任务 1：建立最终状态时间的数据契约

**文件：**
- 新建：`apps/api/db/022_ops_task_finalized_at.sql`
- 修改：`apps/api/src/task-lifecycle.ts`
- 新建：`apps/api/src/task-lifecycle.test.ts`

- [ ] **步骤 1：写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { applyTaskFinalization, isTerminalTaskStatus } from "./task-lifecycle.js";

describe("task finalization", () => {
  it("首次进入终态时写入时间，后续写入不覆盖", () => {
    expect(isTerminalTaskStatus("succeeded")).toBe(true);
    expect(applyTaskFinalization({ status: "succeeded", finalizedAt: undefined }, 1000)).toMatchObject({ finalizedAt: 1000 });
    expect(applyTaskFinalization({ status: "failed", finalizedAt: 900 }, 1000)).toMatchObject({ finalizedAt: 900 });
  });
  it("执行中任务不写入最终时间", () => {
    expect(applyTaskFinalization({ status: "running", finalizedAt: undefined }, 1000).finalizedAt).toBeUndefined();
  });
});
```

- [ ] **步骤 2：确认测试按预期失败**

运行：`npx vitest run apps/api/src/task-lifecycle.test.ts`

预期：因两个函数未导出而失败。

- [ ] **步骤 3：添加最小实现和迁移**

```sql
alter table xh_tasks add column if not exists finalized_at timestamptz;
create index if not exists idx_xh_tasks_updated_created_id_desc
  on xh_tasks(updated_at desc, created_at desc, id desc);
```

```ts
const TERMINAL_TASK_STATUSES = new Set(["succeeded", "failed", "cancelled"]);
export function isTerminalTaskStatus(status: string) { return TERMINAL_TASK_STATUSES.has(status); }
export function applyTaskFinalization<T extends { status: string; finalizedAt?: number }>(task: T, now = Date.now()): T {
  return !isTerminalTaskStatus(task.status) || Number(task.finalizedAt) > 0 ? task : { ...task, finalizedAt: now };
}
```

`createRetriedTask()` 必须移除旧任务的 `finalizedAt`；取消补丁返回 `finalizedAt: now`。

- [ ] **步骤 4：确认通过并提交**

运行：`npx vitest run apps/api/src/task-lifecycle.test.ts`

预期：通过。

提交：
`git add apps/api/db/022_ops_task_finalized_at.sql apps/api/src/task-lifecycle.ts apps/api/src/task-lifecycle.test.ts`
`git commit -m "feat: add task finalization timestamp contract"`

## 任务 2：限制最近 2,000 条任务窗口

**文件：**
- 修改：`apps/api/src/task-repository.ts`
- 修改：`apps/api/src/task-repository.test.ts`
- 修改：`apps/api/src/server.ts`

- [ ] **步骤 1：写 2,001 条文件模式的失败测试**

```ts
const page = await repo.readTaskListPage({ page: 1, pageSize: 100, status: "", providerId: "", capability: "" });
expect(page).toMatchObject({ windowLimit: 2000, windowSize: 2000, truncated: true, total: 2000 });
expect(page.items[0].id).toBe("task-2000");
expect(page.items).not.toContainEqual(expect.objectContaining({ id: "task-0" }));
```

再测试 `writeTaskRecord({ status: "failed", finalizedAt: 1200 })` 的读取结果，以及后续 `appendTaskLog()` 不改写 `finalizedAt`。

- [ ] **步骤 2：确认失败**

运行：`npx vitest run apps/api/src/task-repository.test.ts`

预期：因窗口字段和最终状态持久化缺失而失败。

- [ ] **步骤 3：扩展类型、读写和行映射**

为 `TaskRecordShape`、`TaskListItemShape`、`TaskPostgresRowShape` 加 `finalizedAt?: number`；为 `TaskListPage` 加：

```ts
windowLimit: number;
windowSize: number;
truncated: boolean;
```

所有 PostgreSQL insert/update/detail/list SQL 都处理 `finalized_at`。`server.ts` 的 `toAdminTaskRecord()` 映射 `finalized_at` 到 `finalizedAt`。旧终态摘要使用：

```ts
finalizedAt: task.finalizedAt || (isTerminalTaskStatus(task.status) ? task.updatedAt : undefined)
```

- [ ] **步骤 4：实现窗口语义**

定义 `const TASK_LIST_WINDOW_LIMIT = 2000`。PostgreSQL 使用先限额再筛选的 CTE：

```sql
with recent_tasks as (
  select id from xh_tasks
  order by updated_at desc, created_at desc, id desc
  limit 2000
)
select ... from recent_tasks r
join xh_tasks t on t.id = r.id
left join xh_users u on u.id = t.owner_id
where ...
order by t.updated_at desc, t.created_at desc, t.id desc
limit $n offset $n;
```

使用最多 2,001 行轻量查询计算 `windowSize` 与 `truncated`。文件模式先按 `updatedAt desc, createdAt desc, id desc` 排序，再 `slice(0, 2000)`，最后调用现有筛选。

- [ ] **步骤 5：确认通过并提交**

运行：`npx vitest run apps/api/src/task-repository.test.ts`

提交：
`git add apps/api/src/task-repository.ts apps/api/src/task-repository.test.ts apps/api/src/server.ts`
`git commit -m "feat: bound admin task history to recent window"`

## 任务 3：让 API、取消与 Worker 使用同一终态规则

**文件：**
- 修改：`apps/api/src/admin-task-list-routes.ts`
- 修改：`apps/api/src/admin-task-list-routes.test.ts`
- 修改：`apps/api/src/task-cancellation-service.ts`
- 新建：`apps/api/src/task-cancellation-service.test.ts`
- 修改：`apps/api/src/provider-generation-task-service.ts`
- 修改：`apps/worker/src/worker-task-store.ts`
- 新建：`apps/worker/src/worker-task-store.test.ts`

- [ ] **步骤 1：写失败测试**

路由注入的 `readTaskListPage` 返回 `windowLimit: 2000`、`windowSize: 2000`、`truncated: true`，断言响应保留三者。取消服务测试断言取消后的任务含 `finalizedAt`。Worker 成功和失败写入测试断言终态仅写入一次。

- [ ] **步骤 2：确认失败**

运行：
`npx vitest run apps/api/src/admin-task-list-routes.test.ts apps/api/src/task-cancellation-service.test.ts`

预期：新字段断言失败。

- [ ] **步骤 3：接入统一函数**

所有 API/Worker 成功、失败、超时和取消写入在持久化前执行：

```ts
await deps.writeTaskRecord(applyTaskFinalization({ ...task, status: "failed", updatedAt: now }, now));
```

日志写入和普通管理员编辑不得调用该函数。路由 `AdminTaskListPage` 类型同步返回窗口元数据。

- [ ] **步骤 4：确认通过并提交**

运行：
`npx vitest run apps/api/src/admin-task-list-routes.test.ts apps/api/src/task-cancellation-service.test.ts apps/api/src/task-repository.test.ts apps/api/src/task-lifecycle.test.ts`

提交：
`git add apps/api/src/admin-task-list-routes.ts apps/api/src/admin-task-list-routes.test.ts apps/api/src/task-cancellation-service.ts apps/api/src/provider-generation-task-service.ts apps/worker/src/worker-task-store.ts`
`git commit -m "feat: record task terminal timestamps"`

## 任务 4：实现紧凑任务表格

**文件：**
- 修改：`apps/admin/src/admin-types.ts`
- 修改：`apps/admin/src/admin-task-panel.tsx`
- 修改：`apps/admin/src/styles.css`
- 修改：`scripts/verify-admin-task-panel-contract.mjs`

- [ ] **步骤 1：先更新静态合同并确认失败**

要求 `最终状态时间` 列、`taskPage.truncated`、窗口提示文案、`task.finalizedAt` 和 `title={task.title}`：

```js
panelSource.includes("仅显示最近 2,000 条任务记录") &&
panelSource.includes("task.finalizedAt") &&
panelSource.includes('title={task.title}')
```

运行：`node scripts/verify-admin-task-panel-contract.mjs`

预期：面板尚未实现时失败。

- [ ] **步骤 2：扩展类型并实现表格**

`TaskRecord` 加 `finalizedAt?: number`，`TaskListPage` 加窗口元数据。状态后新增最终状态时间列：

```ts
function finalStatusTime(task: TaskRecord) {
  return task.finalizedAt ? new Date(task.finalizedAt).toLocaleString() : "--";
}
```

工具栏显示：

```tsx
<span>{taskPage.truncated ? "仅显示最近 2,000 条任务记录" : `显示全部 ${taskPage.windowSize} 条最近任务`}</span>
```

任务列只显示标题、Provider 列只显示 Provider、模型列只显示模型、账号列只显示账号主名称、日志列只显示 `displayMessage` 或最近一条日志；所有文本单行截断并使用 `title` 展示完整值。

- [ ] **步骤 3：增加稳定样式**

```css
.task-monitor-cell { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-monitor-cell--time { min-width: 156px; max-width: 156px; }
.task-monitor-row td { vertical-align: middle; }
```

移除账号单元格中的邮箱/分组第二行。窄屏继续使用现有表格横向滚动，不能把多列折叠为多行。

- [ ] **步骤 4：验证并提交**

运行：
`node scripts/verify-admin-task-panel-contract.mjs`
`npm run type-check -w @xinghuan/admin`
`npm run build -w @xinghuan/admin`

提交：
`git add apps/admin/src/admin-types.ts apps/admin/src/admin-task-panel.tsx apps/admin/src/styles.css scripts/verify-admin-task-panel-contract.mjs`
`git commit -m "feat: compact ops task monitor rows"`

## 任务 5：全量验证与灰度验收

**文件：**
- 新建：`docs/logbooks/releases/gray/2026-07-14-ops-task-window-gray.md`
- 修改：`docs/logbooks/releases/current-release-index.md`
- 修改：`ops/current/gray.md`

- [ ] **步骤 1：运行本地验证集**

```powershell
npx vitest run apps/api/src/task-lifecycle.test.ts apps/api/src/task-repository.test.ts apps/api/src/admin-task-list-routes.test.ts apps/api/src/task-cancellation-service.test.ts
npm run type-check -w @xinghuan/api
npm run type-check -w @xinghuan/admin
node scripts/verify-admin-task-pagination.mjs
node scripts/verify-admin-task-panel-contract.mjs
npm run verify:critical
```

预期：全部通过。

- [ ] **步骤 2：部署并验收灰度**

遵循既有灰度 runbook，执行数据库迁移、构建运行产物、只切换 `canvas-next.hhh2121.xyz` 的 release 并重启灰度 API/Worker。禁止改动生产、内部代理或共享密钥。

验证：
`curl http://127.0.0.1:18200/api/status`
`npm run verify:admin-task-pagination`

在灰度管理员会话确认窗口提示、成功/失败/取消终态时间、运行中 `--`、筛选分页取消重试以及长文本不堆积。

- [ ] **步骤 3：记录灰度证据并提交**

`npm run verify:release-logbook-sync-staged`
`npm run verify:current-release-entry-consistency`
`git add docs/logbooks/releases/gray/2026-07-14-ops-task-window-gray.md docs/logbooks/releases/current-release-index.md ops/current/gray.md`
`git commit -m "docs: record ops task window gray release"`

生产保持不变，等待用户完成灰度验收后才可单独发起正式发布。
