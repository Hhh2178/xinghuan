# RunningHub 节点恢复轮询 Gray Release - 2026-06-23

## 发布目标

- 修复普通 RH 画布节点在后台任务已成功后，因节点重挂载或运行态恢复不完整而长期停在 `45%` 的问题。
- 让普通 RH 节点与 RH Tools 节点统一具备 `taskId + polling` 的持久化恢复轮询能力。

## 发布信息

- 环境：`gray`
- 版本：`v0.4.12`
- release：`20260623-runninghub-poll-resume-gray-r1-v0412`
- 上一灰度 release：`20260623-runninghub-default-key-migrate-gray-r1-v0411`

## Agent 已验证

### 根因与实现

- gray 库中最近 RH 任务已确认：
  - `xh_tasks.status = succeeded`
  - `result.adapter = runninghub`
  - `result.imageUrls / materializedImageUrls` 已存在
- 根因不在 RH 上游，也不在 Worker / 后台任务表，而在普通 RH 节点缺少恢复轮询逻辑：
  - RH Tools 节点已有 `polling + taskId` 恢复轮询
  - 普通 RH 节点此前缺失同等能力
- 本轮实现：
  - `apps/web/src/components/nodes/RunningHubNode.tsx`
  - 新增 RH 轮询全局去重与恢复
  - 节点重新挂载后若仍处于 `polling` 且持有 `taskId`，会继续轮询直到成功 / 失败 / 超时

### 本地校验

- `node scripts/verify-runninghub-node-progress-contract.mjs`
- `node scripts/verify-runninghub-output-reset-contract.mjs`
- `node scripts/verify-runninghub-worker-and-label-contract.mjs`
- `npm run type-check`
- 发布前准备：
  - `npm install --package-lock-only`
  - `npm run release:gray:prepare:runninghub -- --release=20260623-runninghub-poll-resume-gray-r1-v0412`

### 灰度运行态

- 发布后需验证：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260623-runninghub-poll-resume-gray-r1-v0412`
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
  - `http://127.0.0.1:18200/api/status`
    - `version = 0.4.12`
    - `environment = gray`
  - `https://canvas-next.hhh2121.xyz/api/status`
    - `version = 0.4.12`
    - `environment = gray`

## 待用户验收

### 真实业务链路

- 复测普通 RH 节点：
  - 任务提交后等待 RH 与后台成功
  - 画布节点是否会从 `45%` 正常切到成功并回填输出
- 复测在画布刷新、节点重新渲染或等待较长时间后，普通 RH 节点是否仍能最终回填成功结果

### 视觉与交互

- RH 节点进度条、完成回填和输出素材节点联动观感

## 风险与残留问题

- 这轮主要修的是普通 RH 节点恢复轮询；如用户后续反馈仍有“偶发卡住”，下一步应补更强的轮询错误显式提示，而不是静默 warn。

## 回滚信息

- `current` 回滚目标：`/opt/apps/xinghuan-canvas-next/releases/20260623-runninghub-default-key-migrate-gray-r1-v0411`
- 需要重启的服务：`xinghuan-canvas-next.service`、`xinghuan-canvas-next-worker.service`
- 回滚后需复查的接口：`/api/status`
