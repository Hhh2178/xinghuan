# RunningHub Timeout Empty Default Production Release - 2026-06-24

## 状态

- 环境：`production`
- 版本：`v0.5.1`
- release：`20260624-runninghub-timeout-empty-default-prod-r1-v051`
- 当前状态：`已完成 production deploy + runtime verify`
- 晋级来源 gray release：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-runninghub-timeout-empty-default-gray-r1-v051`
- 上一 production release：
  - `/opt/apps/xinghuan-canvas/releases/20260624-task-runtime-kernel-governance-prod-r1-v051`

## 发布目标

- 把“轮询超时默认留空，只有手动填写才启用”的治理版从 gray 晋级到 production。
- 让 RH 长任务、GRSAI 与其他异步协议统一采用更稳的无默认超时链路。
- 保持现有 `v0.5.1` 版本号不变，直接完成灰度到正式的同版切换。

## 变更范围

- RH 工作台 / Provider 编辑器不再默认落 `pollTimeoutMs`
- AI 自动分析与后端归一化逻辑不再默认写入超时
- worker / external proxy / polling helper 只在显式 timeout 时启用本地超时
- RH 前端节点不再在画布侧本地提前报轮询超时

## Agent 已验证

### 类型检查 / 契约

- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/worker`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/admin`
- `codegraph sync`
- `node scripts/verify-app-shell-loading-announcement-contract.mjs`
- `node scripts/verify-runninghub-frontend-polling-contract.mjs`
- `node scripts/verify-runninghub-timeout-governance-contract.mjs`
- `node scripts/verify-poll-timeout-empty-by-default-contract.mjs`
- `node scripts/verify-generation-timeout-unification.mjs`
- `node scripts/verify-runninghub-worker-no-default-timeout-contract.mjs`

### Production 运行态

- `readlink -f /opt/apps/xinghuan-canvas/current`
  - `/opt/apps/xinghuan-canvas/releases/20260624-runninghub-timeout-empty-default-prod-r1-v051`
- `systemctl is-active xinghuan-canvas.service`
  - `active`
- `systemctl is-active xinghuan-canvas-worker.service`
  - `active`
- `http://127.0.0.1:18100/api/status`
  - `version = 0.5.1`
  - `environment = production`
- `https://canvas.hhh2121.xyz/api/status`
  - `version = 0.5.1`
  - `environment = production`

## 本次部署执行

- 发布包：
  - `dist-release/20260624-runninghub-timeout-empty-default-prod-r1-v051.tar.gz`
- 服务器解包目录：
  - `/opt/apps/xinghuan-canvas/releases/20260624-runninghub-timeout-empty-default-prod-r1-v051`
- release 内执行：
  - `npm ci`
  - `npm run db:migrate`
- 本次迁移结果：
  - `applied = []`
  - `skipped = 18`

## 回滚锚点

- 代码回滚目标：
  - `/opt/apps/xinghuan-canvas/releases/20260624-task-runtime-kernel-governance-prod-r1-v051`
- 回滚后需重启：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`

## 影响

- production 不再默认把 RH 任务提前判成“轮询超时”。
- 任务超时策略改成显式配置优先，降低误杀长任务的概率。
- 因为版本号保持 `v0.5.1`，用户界面不会看到版本跳变，但 release id 已更新。

## 待用户验收

- RH 长任务真实回写与完成体验
- 多 Key 并发补位是否符合业务预期
- 画布上的真实业务交互与输出体验
