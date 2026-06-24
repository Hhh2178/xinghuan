# Announcement Center And RunningHub Queue Repair Gray Candidate - 2026-06-24

## 状态

- 环境：`gray`
- 版本：`v0.5.1`
- 候选 release：`待定`
- 当前状态：`本地验证完成，待清理工作树 + 分组提交 + gray deploy`

## 候选发布目标

- 上线统一公告中心能力：
  - 后台公告管理
  - 前台公告抽屉
  - SSE 实时广播
  - 强提醒弹层
- 收口 RunningHub 多 Key 动态调度：
  - 默认 Key 优先
  - 执行前实时选可用 Key
  - 全部 Key 满载才 `all_keys_busy`
- 收口 worker 统一失败口径与 RH 队列治理 verify 护栏。

## Agent 已验证

### 类型 / 构建

- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/worker`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/web`

### 契约 / 运行态脚本

- `node scripts/verify-announcement-contract.mjs`
- `node scripts/verify-announcement-sse-contract.mjs`
- `node scripts/verify-unified-protocol-runtime-contract.mjs`
- `node scripts/verify-worker-adapter-contract.mjs`
- `node scripts/verify-runninghub-dynamic-key-selection-contract.mjs`
- `node scripts/verify-runninghub-queue-governance-contract.mjs`
- `node scripts/verify-runninghub-key-pool-contract.mjs`
- `node scripts/verify-runninghub-key-acquire-fallback.mjs`
- `node scripts/verify-runninghub-node-progress-contract.mjs`
- `npx tsx scripts/verify-runninghub-poll-non-json-contract.ts`
- `node scripts/verify-runninghub-workflow-contract.mjs`
- `node scripts/verify-runninghub-workflow-api.mjs`

### 本地总验收链

- `XINGHUAN_VERIFY_PORT=18335 node scripts/verify-local-acceptance-chain.mjs`

结果:
- 本地单端口总验收链在干净端口 `18335` 全绿。
- 公告接口、SSE、RunningHub worker submit/query、前端画布节点渲染 smoke、任务生命周期与外部协议代理均通过。

## 本轮查证重点

### Verify 漂移已修正

- `verify-unified-protocol-runtime-contract` 已改为检查真实拆分落点：
  - `worker-grsai-image-client.ts`
  - `worker-media-polling.ts`
  - `worker-task-lifecycle.ts`
- `verify-worker-adapter-contract` 已改为检查真实任务读取边界：
  - `worker-task-store.ts`

### RH 队列 / 轮询问题查证

- 多 Key 调度口径仍然是：
  - `preferredRhKeyId -> 其他 default Key -> 其他启用 Key`
- `assignedRhKeyId` 只代表 worker 真正执行时选中的 Key，不再在 API 入队时写死。
- `all_keys_busy` 只在全部启用 Key 满载时出现。
- 没有任何可用 Key 时直接按 `model_config` 失败，不伪装排队。

### 本地环境噪音说明

- 先前 `verify-canvas-node-render-smoke` 曾出现动态 chunk 拉取失败。
- 根因不是稳定业务回退，而是本机残留单端口进程占用 `18333`，导致 smoke 可能命中旧进程或脏进程状态。
- 当前补充了 smoke 网络诊断输出：
  - `runtimeErrors`
  - `networkFailures`
  - `assetResponses`
- 后续 gray 前本地放行建议：
  - 优先使用干净端口
  - 或先确认本机不存在残留 `apps/api/dist/server.js` 单端口进程

## 待用户验收

- Gray 页面观感与交互体验
- 公告中心视觉与强提醒体验
- RunningHub 真实多 Key 业务体验
- RH 队列、轮询、取消同步在真实外部平台上的表现

## 下一步

1. 清理工作树并分组提交
2. `codegraph sync`
3. 生成 gray release 名称并执行 gray deploy
4. 用户做灰度人工验收
