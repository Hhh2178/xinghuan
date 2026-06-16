# Phase D 发布缺口与放行门槛历史记录（2026-06-15）

> 状态说明：本文件记录的是 `2026-06-15` 在 gray / production 放行前的缺口判断。
> 当前它已经不是项目实时状态入口，真实当前状态请改看：
>
> - `ops/phase-d-gray-release-2026-06-15.md`
> - `ops/phase-d-production-release-2026-06-15.md`
> - `ops/README.md`
> - `MEMORY.md`

## 目的

- 记录当前 `Phase D` 在本地代码层已经完成，但尚未进入灰度/正式 active release 的真实状态。
- 明确当前不能写成“已灰度发布 / 已正式发布”的原因。
- 给后续真正执行 `Phase D` 灰度与正式放行提供可复用的最小门槛和执行顺序。

## 当时结论

截至本文件编写时，`Phase D` 的真实状态是：

- 当前 worktree 中：
  - 代码已完成收口
  - 本地验收已通过
- 当前服务器 gray / prod：
  - active release 仍停留在 `Phase C`
  - 尚未发现 `Phase D` 代码和迁移已进入 active release 的证据

因此当前只能得出：

- `Phase D` 已完成本地代码基线
- `Phase D` 尚未完成 gray / prod 放行

不能写成：

- “Phase D 已灰度上线”
- “Phase D 已正式发布”

## 当前服务器实态

### 灰度

- current:
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260615-phase-c-login-rate-limit-gray-r1`
- 服务：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 状态接口：
  - `http://127.0.0.1:18200/api/status -> environment=gray`

### 正式

- current:
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260615-phase-c-login-rate-limit-prod-r1`
- 服务：
  - `xinghuan-canvas.service = active`
  - `xinghuan-canvas-worker.service = active`
- 状态接口：
  - `http://127.0.0.1:18100/api/status -> environment=production`

## 当前未进入 active release 的证据

以下证据表明服务器当前 release 还不是 `Phase D`：

- 当前 gray / prod release 指针都仍指向 `20260615-phase-c-login-rate-limit-*`
- 当前 gray / prod `apps/api/db/` 目录只到：
  - `013_login_rate_limit.sql`
- 当前本地 `Phase D` 迁移是：
  - `apps/api/db/014_task_runtime_phase_d.sql`
- 当前本地 `Phase D` 新增脚本：
  - `scripts/verify-task-cancellation-phase-d.mjs`
  - `scripts/verify-admin-task-pagination.mjs`
- 当前本地 `Phase D` 新增服务：
  - `apps/api/src/task-cancellation-service.ts`

这些内容都还不能作为“已进入服务器当前 active release”的证据使用。

## 当前放行阻塞项

### 阻塞 1：gray / prod active release 尚未切到 Phase D

当前服务器 active release 仍是 `Phase C` 登录限流版本。

影响：

- 不能用服务器 current 状态为 `Phase D` 背书
- 不能产出真实的 `Phase D` gray / prod 发布记录

### 阻塞 2：release preflight runbook 与服务器产物不一致

当前 runbook 规定：

- `npm run verify:release-preflight`

但服务器 current release 中执行后报错：

- `Cannot find module .../scripts/capture-release-preflight.mjs`

说明至少当前服务器 release 产物中：

- `package.json` 已包含 `verify:release-preflight`
- 但对应脚本文件未随 release 一起存在

影响：

- 当前不能把 `release-preflight` 作为服务器侧可靠放行步骤直接复用
- 后续正式放行前，必须先修正“脚本入口与发布产物一致性”

### 阻塞 3：Phase D 缺少 PostgreSQL gray runtime 验收样本

本地 `file-mode` 验收虽然通过，但 `Phase D` 放行标准还缺：

- PostgreSQL 灰度环境下长任务取消样本
- PostgreSQL 灰度环境下 stale reaper 命中样本
- 支持 / 不支持上游取消两类 Provider 的真实样本

影响：

- 当前只能证明代码正确性和本地链路自洽
- 还不能证明 gray / prod 运行态闭环已经成立

## 后续最小执行顺序

### 1. 先做 gray build / release

- 打包包含以下内容的新 gray release：
  - `apps/api/db/014_task_runtime_phase_d.sql`
  - `apps/api/src/task-cancellation-service.ts`
  - `scripts/verify-task-cancellation-phase-d.mjs`
  - `scripts/verify-admin-task-pagination.mjs`
  - `scripts/capture-release-preflight.mjs`

### 2. gray 先执行迁移

- 运行：
  - `node scripts/db-migrate.mjs`
- 期望：
  - `014_task_runtime_phase_d.sql` 被应用

### 3. 修复并复验 preflight

- 在 gray current release 上执行：
  - `npm run verify:release-preflight`
- 期望：
  - 脚本存在
  - 能输出当前 release 指针、服务状态、数据库快照

### 4. 执行 gray Phase D 真实验收

至少覆盖：

- `npm run verify:phase-d`
- `npm run verify:provider-generation-task-service`
- `npm run verify:provider-generation-worker`
- 至少一组支持上游取消的真实样本
- 至少一组仅本地取消的真实样本
- 至少一次 stale reaper 命中验证

### 5. gray 通过后，再决定正式放行

正式放行前至少要补：

- 正式 preflight 快照
- 正式精简验收
- 正式发布记录

## 当前建议

当前更准确的推进方式不是写“Phase D release 已完成”，而是：

1. 保持 `Phase D` 状态为：
   - 本地代码与本地验收完成
   - gray / prod 待发布
2. 先补齐：
   - gray 发布记录
   - gray preflight 快照
   - gray runtime 样本
3. 再进入：
   - 正式 preflight
   - 正式发布
   - 正式记录

## 与主入口的关系

本文件不是长期主入口摘要，而是当前 `Phase D` 放行缺口的专项说明。

主入口应以以下口径同步：

- `MEMORY.md`
  - `Phase D` 已完成本地收口，但未完成 gray / prod 放行
- `ops/README.md`
  - 增加本文件入口
- `docs/production-multi-user-hardening-plan-2026-06-13.md`
  - `Phase D` 当前状态补充“服务器 active release 仍停留在 Phase C”
