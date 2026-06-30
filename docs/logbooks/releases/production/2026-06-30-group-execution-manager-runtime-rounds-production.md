# Group Execution Manager Runtime Rounds Production Release - 2026-06-30

## 状态

- 环境：`production`
- 版本：`v0.5.19`
- release：`20260630-group-execution-manager-runtime-rounds-prod-r1-v0519`
- 当前状态：`2026-06-30 已完成 production deploy + runtime verify`
- 晋级来源 gray release：
  - `/opt/apps/xinghuan-canvas-next/releases/20260630-group-execution-manager-runtime-rounds-gray-r2-v0519`
- 上一 production release：
  - `/opt/apps/xinghuan-canvas/releases/20260628-web-version-sync-prod-r1-v0515`

## 发布目标

- 将 gray 已验证的组执行管理器轮次能力晋级到正式环境。
- 保持 production 与 gray 暴露同一应用版本 `v0.5.19`。
- 确保 production current release 也能直接执行标准 smoke 脚本。

## 变更范围

- `apps/web/src/components/nodes/GroupExecutionManagerNode.tsx`
  - 组执行管理器支持 `开始执行`、`持续开关`、`执行次数`。
- `apps/web/src/components/canvas/groupExecutionManager.ts`
  - 组调度计划支持执行轮次与跳过控制。
- `apps/web/src/components/canvas/useCanvasRuntime.ts`
  - 每轮按当前画布实时重算拓扑。
- `apps/web/src/utils/topologicalSort.ts`
  - 多下游无显式依赖时使用稳定顺序。
- `scripts/package-release.mjs`
  - release package 补齐 `scripts/verify-single-port.mjs`。
- `scripts/verify-release-package-contract.mjs`
  - 补齐 `verify-single-port` 随包契约。

## Agent 已验证

### 本地验证

- `node scripts/verify-release-package-contract.mjs`
- `npm run package:release -- 20260630-group-execution-manager-runtime-rounds-prod-r1-v0519`

### Production 部署与运行态

- 部署脚本复用：
  - `scripts/release/deploy-gray-release.mjs`
  - `scripts/release/verify-gray-runtime.mjs`
- 生产环境覆盖参数：
  - `--remote-root=/opt/apps/xinghuan-canvas`
  - `--shared-env-file=/opt/apps/xinghuan-canvas/shared/canvas.env`
  - `--service=xinghuan-canvas.service`
  - `--worker-service=xinghuan-canvas-worker.service`
  - `--internal-status-url=http://127.0.0.1:18100/api/status`
  - `--public-status-url=https://canvas.hhh2121.xyz/api/status`
  - `--expected-environment=production`
- 服务器解包目录：
  - `/opt/apps/xinghuan-canvas/releases/20260630-group-execution-manager-runtime-rounds-prod-r1-v0519`
- current 指针：
  - `/opt/apps/xinghuan-canvas/releases/20260630-group-execution-manager-runtime-rounds-prod-r1-v0519`
- systemd 状态：
  - `xinghuan-canvas.service`: `active`
  - `xinghuan-canvas-worker.service`: `active`
- 内网状态：
  - `http://127.0.0.1:18100/api/status`
  - `version = 0.5.19`
  - `environment = production`
- 公网状态：
  - `https://canvas.hhh2121.xyz/api/status`
  - `version = 0.5.19`
  - `environment = production`
- 生产 env 下迁移：
  - `npm run db:migrate`
  - `applied = []`
  - `skipped = 19`
- 数据库目标：
  - `current_database() = xinghuan_canvas_next`
  - `XINGHUAN_EXPECTED_DATABASE_NAME = xinghuan_canvas_next`
- production current release 内联 `npm run verify:single-port`
  - 基础站点、登录、后台、画布保存、用户隔离、上传、图片生成库、SPA fallback = `PASS`
  - 视频生成库相关 5 项 = `FAIL`，根因是服务器当前没有可复用的本地样例视频文件，`Local sample video seeded` 前置条件未满足，不是本次生产晋级回归

## 待用户验收

- Production 画布里组执行管理器真实交互是否符合预期。
- `开始执行`、`执行次数 = N`、每轮按新拓扑生效的业务体验是否符合预期。
- `aicopy / grok-imagine-video-1.5-preview` 链路在生产环境是否继续正常。
- Production 公网页面视觉与交互验收。

## 回滚锚点

- 代码回滚目标：
  - `/opt/apps/xinghuan-canvas/releases/20260628-web-version-sync-prod-r1-v0515`
- 回滚后需重启：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`
