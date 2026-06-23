# RunningHub Key 池与节点阶段进度 Gray Release - 2026-06-23

## 发布目标

- 发布 RunningHub Key 池、按 Key 独立并发窗口、系统页自动汇总并发、RH 节点阶段进度与参数显示策略收口。

## 发布信息

- 环境：`gray`
- 版本：`v0.4.10`
- release：`20260623-runninghub-key-pool-progress-gray-r1-v0410`
- 上一灰度 release：`20260623-runninghub-draft-output-reset-gray-r1-v049`

## Agent 已验证

### 本地代码与产物

- `npm install --package-lock-only`
- `npm run release:gray:prepare:runninghub -- --release=20260623-runninghub-key-pool-progress-gray-r1-v0410`
- prepare 结果：
  - `build:single-port` 通过
  - `verify-release-version-alignment` 通过
  - `verify-release-package-contract` 通过
  - `verify-runninghub-draft-and-summary-contract` 通过
  - `verify-runninghub-output-reset-contract` 通过
  - `verify-runninghub-worker-and-label-contract` 通过
  - `verify-runninghub-admin-empty-input-contract` 通过
  - `verify-runninghub-key-pool-contract` 通过
  - `verify-runninghub-node-progress-contract` 通过
- release 包：
  - `dist-release/20260623-runninghub-key-pool-progress-gray-r1-v0410.tar.gz`
  - 包版本：`v0.4.10`
  - 包大小：`5.34 MB`

### 远端部署与运行态

- `npm run release:gray:deploy -- --release=20260623-runninghub-key-pool-progress-gray-r1-v0410 --archive=dist-release/20260623-runninghub-key-pool-progress-gray-r1-v0410.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem`
- `npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --expected-version=0.4.10 --expected-environment=gray`
- gray 当前 release：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260623-runninghub-key-pool-progress-gray-r1-v0410`
- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 运行态接口：
  - `http://127.0.0.1:18200/api/status`
    - `version = 0.4.10`
    - `environment = gray`
  - `https://canvas-next.hhh2121.xyz/api/status`
    - `version = 0.4.10`
    - `environment = gray`

## 待用户验收

### 视觉验收

- RH 工作台 Key 池折叠卡片布局、节点阶段进度条、备注强调块、字段名显示效果。

### 真实业务链路

- 多 Key 并发切换、排队提示、RH 任务提交与结果回流、后台 Key 配置编辑与保存。

## 风险与残留问题

- 多 Key 轮转的线上真实压力仍需要用户以实际 Key 池进行业务链路验收。

## 回滚信息

- `current` 回滚目标：`/opt/apps/xinghuan-canvas-next/releases/20260623-runninghub-draft-output-reset-gray-r1-v049`
- 需要重启的服务：`xinghuan-canvas-next.service`、`xinghuan-canvas-next-worker.service`
- 回滚后需复查的接口：`/api/status`
