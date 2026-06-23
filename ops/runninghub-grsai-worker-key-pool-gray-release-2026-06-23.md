# RunningHub GRSAI Worker 收口与 Key 池 Gray Release - 2026-06-23

## 发布目标

- 将 GRSAI worker 真实执行路径收口到可直接测试的独立 client，补齐不依赖 `redis` 的直测回归护栏。
- 将 RunningHub 调度从“入队静态绑定 Key”改成“默认 Key 优先、worker 执行前实时选可用 Key、全部 Key 满载才排队”。
- 保持统一运行时错误分类、状态查询和灰度发布链路可验证。

## 发布信息

- 环境：`gray`
- 版本：`v0.4.13`
- release：`20260623-runninghub-grsai-worker-key-pool-gray-r1-v0413`
- 上一灰度 release：`20260623-runninghub-poll-resume-gray-r1-v0412`

## Agent 已验证

### 本地代码与产物

- GRSAI worker-side 直测：
  - `npx tsx scripts/verify-worker-grsai-image-adapter.ts`
  - 覆盖：
    - `pending -> success`
    - immediate success
    - non-JSON `502` 重试成功
    - JSON `502` 重试成功
    - 重试耗尽失败
    - success 但无图片结果失败
- 适配器 / worker / RH 相关验证：
  - `npx tsx scripts/verify-grsai-image-adapter.ts`
  - `npm run verify:worker-grsai-contract`
  - `npm run verify:provider-generation-worker`
  - `node scripts/verify-unified-protocol-runtime-contract.mjs`
  - `node scripts/verify-runninghub-dynamic-key-selection-contract.mjs`
  - `node scripts/verify-runninghub-key-pool-contract.mjs`
  - `node scripts/verify-runninghub-node-progress-contract.mjs`
- 类型检查：
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/worker`
  - `npm run type-check -w @xinghuan/web`
  - `npm run type-check -w @xinghuan/admin`
- Gray 打包准备：
  - `npm run release:gray:prepare:runninghub -- --release=20260623-runninghub-grsai-worker-key-pool-gray-r1-v0413 --verify="npx tsx scripts/verify-worker-grsai-image-adapter.ts" --verify="node scripts/verify-runninghub-dynamic-key-selection-contract.mjs"`
- 发布链修补已纳入本轮：
  - workspace 内部版本引用统一到 `0.4.13`
  - `scripts/verify-release-version-alignment.mjs` 兼容 `export const appVersion = "..."`

### 远端部署与运行态

- 发布包：
  - `dist-release/20260623-runninghub-grsai-worker-key-pool-gray-r1-v0413.tar.gz`
- Gray 服务器执行：
  - 上传到 `/tmp/20260623-runninghub-grsai-worker-key-pool-gray-r1-v0413.tar.gz`
  - 解包到 `/opt/apps/xinghuan-canvas-next/releases/20260623-runninghub-grsai-worker-key-pool-gray-r1-v0413`
  - `npm ci`
  - `npm run db:migrate`
    - `applied = []`
    - `skipped = 16`
  - 重启：
    - `xinghuan-canvas-next.service`
    - `xinghuan-canvas-next-worker.service`
- 运行态校验：
  - `readlink -f /opt/apps/xinghuan-canvas-next/current`
    - `/opt/apps/xinghuan-canvas-next/releases/20260623-runninghub-grsai-worker-key-pool-gray-r1-v0413`
  - `systemctl is-active xinghuan-canvas-next.service`
    - `active`
  - `systemctl is-active xinghuan-canvas-next-worker.service`
    - `active`
  - `http://127.0.0.1:18200/api/status`
    - `version = 0.4.13`
    - `environment = gray`
  - `https://canvas-next.hhh2121.xyz/api/status`
    - `version = 0.4.13`
    - `environment = gray`

## 待用户验收

### 视觉验收

- RH 节点在灰度页面上的进度、排队提示、错误展示与结果回填观感。
- 后台 RH 工作台与画布 RH 节点的页面交互观感。

### 真实业务链路

- GRSAI 真实任务是否稳定完成并回填结果。
- RunningHub 多 Key 在默认 Key 满载后是否自动切换到其他可用 Key。
- 所有 Key 满载后是否才进入排队，而不是提前排队或错误失败。

## 风险与残留问题

- 当前灰度只完成了代码层、架构层和运行态层验证，视觉和真实业务体验仍由用户验收。
- `apps/worker/src/worker.ts` 当前在仓库里本来就存在 staged + unstaged 混合历史，本轮只做了增量收口，没有清理其他人的在途内容。
- 生产当前仍停留在 `v0.4.12`，本轮尚未推正式。

## 回滚信息

- `current` 回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260623-runninghub-poll-resume-gray-r1-v0412`
- 需要重启的服务：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后需复查的接口：
  - `/api/status`
