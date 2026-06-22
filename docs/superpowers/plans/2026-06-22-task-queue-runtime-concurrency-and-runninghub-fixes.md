# Task Queue Runtime Concurrency And RunningHub Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让普通任务与 RunningHub 任务的并发设置不仅能保存，还能在 worker 运行态真实生效，并同时修复 RH 分析应用时长 JSON 被截断报错的问题。

**Architecture:** 当前后台系统页修改的是 `xh_system_settings.task_queue_settings`，但 worker 进程在启动时一次性读取该配置并固定创建消费循环，所以配置变更不会自动改变真实消费槽数。修复方案分三层：共享配置常量拆分默认值与最大值、worker 增加运行时并发热更新与实际生效状态上报、后台与验证脚本补上“配置值 vs 实际值”的一致性检查；同时将 RH JSON 校验改成长文本安全解析，避免大 schema 被截断。

**Tech Stack:** TypeScript, Node.js, PostgreSQL, Redis, React, ripgrep, CodeGraph

---

### Task 1: 固化失败场景与回归契约

**Files:**
- Modify: `scripts/verify-task-queue-defaults-contract.mjs`
- Modify: `scripts/verify-runninghub-admin-update-tolerance-contract.mjs`
- Modify: `scripts/verify-admin-settings-revision-conflict.mjs`
- Create: `scripts/verify-worker-runtime-concurrency-contract.mjs`

- [ ] **Step 1: 先写 worker 运行时并发契约失败校验**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");

assert.match(worker, /refreshQueueControllers|syncQueueControllers|desiredConcurrency/i);
assert.match(worker, /readTaskQueueSettings\(\)/);
assert.match(worker, /taskQueueSettingsRevision|settingsRevision|effectiveConcurrency/i);

console.log("PASS worker runtime concurrency contract");
```

- [ ] **Step 2: 运行失败校验，确认当前代码还不满足**

Run: `node scripts/verify-worker-runtime-concurrency-contract.mjs`
Expected: FAIL，提示 worker 尚未实现运行时并发热更新或实际值上报。

- [ ] **Step 3: 更新并发默认值/最大值契约**

要求断言：
- 默认总并发 `100`
- 默认单用户并发 `8`
- 总并发最大值 `999`
- 单用户并发最大值 `999`
- 后台系统页对应输入框 `max={999}`

- [ ] **Step 4: 更新 RH JSON 容错契约**

要求断言：
- `safeRunningHubJsonText` 使用长文本读取而不是默认 `safeText`
- `patch.workflowJson / parameterSchema / testPayload` 未修改时继续走 preserve 容错链

- [ ] **Step 5: 扩展系统设置冲突验证脚本**

在 `scripts/verify-admin-settings-revision-conflict.mjs` 中把回写测试数值从旧 `4` 范围改成能覆盖 `100/999` 范围的样例，避免脚本继续默认用旧上限心智。

- [ ] **Step 6: 运行所有契约测试确认 Red**

Run:
```bash
node scripts/verify-task-queue-defaults-contract.mjs
node scripts/verify-runninghub-admin-update-tolerance-contract.mjs
node scripts/verify-worker-runtime-concurrency-contract.mjs
node scripts/verify-admin-settings-revision-conflict.mjs
```

Expected:
- 至少 `verify-worker-runtime-concurrency-contract.mjs` 在实现前失败
- 其他脚本若因新断言失败，也记录为待修复目标

### Task 2: 拆分默认值与最大值，修正系统页限制

**Files:**
- Modify: `packages/shared/src/task-queue-settings.ts`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`

- [ ] **Step 1: 写共享配置的最小实现**

在 `packages/shared/src/task-queue-settings.ts` 中引入：

```ts
export const TASK_QUEUE_DEFAULT_CONCURRENCY = 100;
export const TASK_QUEUE_MAX_CONCURRENCY = 999;
export const TASK_QUEUE_DEFAULT_USER_CONCURRENCY = 8;
export const TASK_QUEUE_MAX_USER_CONCURRENCY = 999;
```

并确保：
- `defaultTaskQueueSettings()` 返回 `100/8`
- `clampTaskQueueConcurrency()` fallback 用默认值
- `clampTaskQueueUserConcurrency()` fallback 用默认值

- [ ] **Step 2: 修正后台系统页输入框**

在 `apps/admin/src/admin-readonly-panels.tsx` 中：
- 图片/音频/视频总并发输入 `max={999}`
- 图片/音频/视频单用户并发输入 `max={999}`
- RH 平台总并发输入 `max={999}`
- 仍保留默认展示值 `100/8`

- [ ] **Step 3: 运行并发契约验证**

Run:
```bash
node scripts/verify-task-queue-defaults-contract.mjs
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/task-queue-settings.ts apps/admin/src/admin-readonly-panels.tsx scripts/verify-task-queue-defaults-contract.mjs
git commit -m "fix: split task queue defaults from max limits"
```

### Task 3: 修复 RH 分析应用的长 JSON 截断

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/admin/src/admin-runninghub-workspace.tsx`

- [ ] **Step 1: 写后端最小修复**

把：

```ts
const text = safeText(value);
```

改成：

```ts
const text = safeLongText(value, "", 200000);
```

位置：`apps/api/src/server.ts` 的 `safeRunningHubJsonText()`

- [ ] **Step 2: 前端应用草案时避免把空白 base 字段无意义覆盖现有条目**

在 `apps/admin/src/admin-runninghub-workspace.tsx` 的 `buildUpdatePayloadFromDraft()` 中：
- 仅当 `title/note/pageId/runTargetId/taskCapability` 为非空且有效时才写入 payload
- 对 `base` 卡片的空字符串不要主动覆盖现有值

- [ ] **Step 3: 运行 RH 契约验证**

Run:
```bash
node scripts/verify-runninghub-admin-update-tolerance-contract.mjs
node scripts/verify-admin-runninghub-workspace-contract.mjs
npm run verify:runninghub-analyze-contract
```

Expected: PASS

- [ ] **Step 4: 用真实灰度样例回放本地逻辑**

运行现有回放脚本或临时 Node 命令，确认以下组合不再报错：
- 仅 `parameterSchema`
- `fields + parameterSchema`
- `apply all` 全量 payload

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/server.ts apps/admin/src/admin-runninghub-workspace.tsx scripts/verify-runninghub-admin-update-tolerance-contract.mjs scripts/verify-admin-runninghub-workspace-contract.mjs
git commit -m "fix: tolerate long runninghub analyze payloads"
```

### Task 4: 让 worker 并发配置在运行时真实生效

**Files:**
- Modify: `apps/worker/src/worker.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/admin/src/admin-types.ts`
- Modify: `apps/admin/src/admin-readonly-panels.tsx`
- Create: `scripts/verify-worker-runtime-concurrency-contract.mjs`

- [ ] **Step 1: 设计 worker 运行态控制结构**

在 `apps/worker/src/worker.ts` 引入一个按 capability 管理的控制器结构，例如：

```ts
interface QueueController {
  capability: TaskQueueCapability;
  queue: string;
  desiredConcurrency: number;
  activeSlots: number;
}
```

目标：
- worker 启动后不再只靠一次性 `queueDescriptors.flatMap(...)`
- 允许周期性读取最新 `taskQueueSettings`
- 若 `desiredConcurrency` 变大，补启动新的消费 loop
- 若 `desiredConcurrency` 变小，超出的 loop 在下一轮安全退出

- [ ] **Step 2: 先写最小失败断言**

让 `scripts/verify-worker-runtime-concurrency-contract.mjs` 检查：
- 存在并发刷新函数
- worker 会周期性重新读取系统设置
- worker 会把“实际生效并发”写到 redis 或健康输出

- [ ] **Step 3: 实现 queue controller 热更新**

建议实现路径：
- 启动时创建 controller map
- 初次按配置启动 loops
- 新增 `refreshQueueControllers()` 定时任务，每 5~10 秒读取一次 `readTaskQueueSettings()`
- 对每个 `image/audio/video` capability 比较 `desired` 和 `activeSlots`
- 增量启动缺少的 slot
- 缩容时为超额 slot 记录 `shouldStopWhenIdle`

- [ ] **Step 4: 给 worker 暴露运行态有效并发**

新增运行态元数据，例如写入 redis：

```ts
key: xinghuan:worker-runtime:<workerId>
value: {
  workerId,
  queues: [
    { capability: "image", desiredConcurrency: 100, activeConcurrency: 100, settingsRevision: 12 }
  ],
  updatedAt
}
```

并设置合理 TTL。

- [ ] **Step 5: 后台系统页读取并显示“配置值 vs 实际生效值”**

在 `apps/api/src/server.ts` 的系统接口中，汇总 worker runtime 信息，返回：

```ts
redis: {
  queues: [
    {
      capability,
      queue,
      concurrency,
      userConcurrency,
      depth,
      effectiveConcurrency,
      workerCount
    }
  ]
}
```

然后在 `apps/admin/src/admin-readonly-panels.tsx` 增加显示：
- 配置并发
- 实际生效并发
- worker 数量
- 若不一致，给出提示文案

- [ ] **Step 6: 统一检查图片/视频/音频/RH**

确认：
- `image/audio/video` 的消费 loop 都依赖 runtime 刷新
- `runninghub` 平台窗口仍从 `readTaskQueueSettings()` 动态读取，不需要单独 fixed loop，但系统页也要显示其窗口值

- [ ] **Step 7: 运行 worker 契约与队列验证**

Run:
```bash
node scripts/verify-worker-runtime-concurrency-contract.mjs
node scripts/verify-admin-settings-revision-conflict.mjs
node scripts/verify-worker-queue.mjs
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/worker/src/worker.ts apps/api/src/server.ts apps/admin/src/admin-types.ts apps/admin/src/admin-readonly-panels.tsx packages/shared/src/index.ts scripts/verify-worker-runtime-concurrency-contract.mjs scripts/verify-admin-settings-revision-conflict.mjs
git commit -m "fix: apply task queue concurrency changes at worker runtime"
```

### Task 5: 本地全量验证与索引同步

**Files:**
- Modify: `DEVLOG.md`
- Modify: `docs/superpowers/specs/2026-06-22-runninghub-protocol-admin-and-canvas-node-rebuild-design.md`

- [ ] **Step 1: 运行契约与专项验证**

Run:
```bash
node scripts/verify-task-queue-defaults-contract.mjs
node scripts/verify-runninghub-admin-update-tolerance-contract.mjs
node scripts/verify-worker-runtime-concurrency-contract.mjs
node scripts/verify-admin-settings-revision-conflict.mjs
node scripts/verify-admin-runninghub-workspace-contract.mjs
npm run verify:runninghub-analyze-contract
npm run verify:worker
```

Expected: 全部 PASS

- [ ] **Step 2: 运行类型检查与构建**

Run:
```bash
npm run type-check
npm run build:single-port
```

Expected: PASS

- [ ] **Step 3: 同步 CodeGraph**

Run:
```bash
codegraph sync
```

Expected: 索引无 pending changes

- [ ] **Step 4: 更新日志与说明文档**

补记：
- 并发默认值 / 最大值调整
- worker 运行时热更新并发
- 系统页新增实际生效并发显示
- RH 分析应用长 JSON 修复

### Task 6: 灰度发布与严格验收

**Files:**
- Modify: `scripts/package-release.mjs`
- Modify: `ops/...` 当前灰度记录

- [ ] **Step 1: 打包新灰度 release**

Run:
```bash
npm run package:release -- 20260622-runninghub-and-task-queue-gray-r5-v042-local
```

Expected: 产物生成成功

- [ ] **Step 2: 部署灰度并重启 API + worker**

要求：
- 这一步必须同时切换 API 与 worker
- 不能只重启 API，否则新并发能力无法生效

- [ ] **Step 3: 灰度接口验收**

检查：
- `/api/status`
- `/api/admin/system`
- worker 健康日志/运行态输出

确认系统页能看到：
- 配置并发
- 实际生效并发
- 队列深度

- [ ] **Step 4: 灰度任务实跑验收**

至少验证：
1. 图片任务连续提交 2~3 个，在余量充足时不应无意义排队
2. 视频任务验证同类逻辑
3. 音频任务验证同类逻辑
4. RH 任务验证平台窗口逻辑仍正常

- [ ] **Step 5: RH 工作台视觉验收**

确认：
- “AI 分析并填写” 后应用全部不再报 `RunningHub JSON 字段必须是合法 JSON`
- 输入槽、Schema、输出、执行规则能正确写回
- 画布端 RH 节点参数区正常展开

- [ ] **Step 6: 最终提交**

```bash
git add .
git commit -m "fix: sync runtime concurrency with admin settings and stabilize runninghub apply flow"
```
