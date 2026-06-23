# RunningHub GRSAI Worker 收口与 Key 池 Production Release - 2026-06-23

## 发布目标

- 将已在 gray 验证通过的 `v0.4.13` RunningHub / GRSAI 收口版本推进到 production。
- 让 production 与 gray 对齐到同一对外版本：`v0.4.13`。
- 保持 GRSAI worker 独立 client、RunningHub 动态 Key 池调度、统一运行态诊断字段在 production 可用。

## 发布信息

- 环境：`production`
- 版本：`v0.4.13`
- release：`20260623-runninghub-grsai-worker-key-pool-prod-r1-v0413`
- 对应 gray release：`20260623-runninghub-grsai-worker-key-pool-gray-r1-v0413`
- 上一 production release：`20260623-runninghub-poll-resume-prod-r1-v0412`

## Agent 已验证

### 本地发布前 gate

- `npm run release:gray:prepare:runninghub -- --release=20260623-runninghub-grsai-worker-key-pool-prod-r1-v0413 --verify="npx tsx scripts/verify-worker-grsai-image-adapter.ts" --verify="node scripts/verify-runninghub-dynamic-key-selection-contract.mjs"`
- 关键通过项：
  - `npm install --package-lock-only`
  - `npm run build:single-port`
  - `node scripts/verify-release-version-alignment.mjs`
  - `npm run verify:release-package-contract`
  - `node scripts/verify-runninghub-draft-and-summary-contract.mjs`
  - `node scripts/verify-runninghub-output-reset-contract.mjs`
  - `node scripts/verify-runninghub-worker-and-label-contract.mjs`
  - `node scripts/verify-runninghub-admin-empty-input-contract.mjs`
  - `node scripts/verify-runninghub-key-pool-contract.mjs`
  - `node scripts/verify-runninghub-node-progress-contract.mjs`
  - `npx tsx scripts/verify-worker-grsai-image-adapter.ts`
  - `node scripts/verify-runninghub-dynamic-key-selection-contract.mjs`
- 产物：
  - `dist-release/20260623-runninghub-grsai-worker-key-pool-prod-r1-v0413.tar.gz`

### 生产服务器执行

- 上传：
  - `/tmp/20260623-runninghub-grsai-worker-key-pool-prod-r1-v0413.tar.gz`
- 解包：
  - `/opt/apps/xinghuan-canvas/releases/20260623-runninghub-grsai-worker-key-pool-prod-r1-v0413`
- 生产 release 内执行：
  - `npm ci`
  - `npm run db:migrate`
    - `applied = []`
    - `skipped = 16`
- 切换：
  - `current -> /opt/apps/xinghuan-canvas/releases/20260623-runninghub-grsai-worker-key-pool-prod-r1-v0413`
- 重启：
  - `xinghuan-canvas`
  - `xinghuan-canvas-worker`

### Production 运行态

- `readlink -f /opt/apps/xinghuan-canvas/current`
  - `/opt/apps/xinghuan-canvas/releases/20260623-runninghub-grsai-worker-key-pool-prod-r1-v0413`
- `systemctl is-active xinghuan-canvas`
  - `active`
- `systemctl is-active xinghuan-canvas-worker`
  - `active`
- `http://127.0.0.1:18100/api/status`
  - `version = 0.4.13`
  - `environment = production`
- `https://canvas.hhh2121.xyz/api/status`
  - `version = 0.4.13`
  - `environment = production`

### Production 观测 gate

- `npm run verify:request-chain-observability`
  - `ok = true`
- `npm run verify:system-observability`
  - `database.current = xinghuan_canvas_next`
  - `database.expected = xinghuan_canvas_next`
  - `database.targetMatched = true`

## 待用户验收

- RH 多 Key 在 production 的真实业务链路是否按“默认 Key 优先，满载后切换其他 Key”运行。
- GRSAI 真实任务在 production 是否稳定完成并回填结果。
- 画布 RH 节点、RH Tools 节点与输出素材节点的真实交互体验。

## 风险与残留问题

- production 当前数据库目标仍为：
  - `current = xinghuan_canvas_next`
  - `expected = xinghuan_canvas_next`
- 这代表 production 当前仍沿用共享库口径，而不是独立命名的正式数据库。
- 本轮已完成代码、运行态与观测 gate 验证；真实页面视觉与业务体验仍由用户验收。

## 回滚信息

- `current` 回滚目标：
  - `/opt/apps/xinghuan-canvas/releases/20260623-runninghub-poll-resume-prod-r1-v0412`
- 需要重启的服务：
  - `xinghuan-canvas`
  - `xinghuan-canvas-worker`
