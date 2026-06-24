# RunningHub Timeout Empty Default Gray Release - 2026-06-24

## 状态

- 环境：`gray`
- 版本：`v0.5.1`
- release：`20260624-runninghub-timeout-empty-default-gray-r1-v051`
- 当前状态：`已完成 gray deploy + runtime verify`
- 上一 gray release：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-task-runtime-kernel-governance-gray-r1-v051`

## 发布目标

- 把 RH 与后续异步任务的“轮询超时默认留空”口径正式落到 gray。
- 去掉前端 RH 节点本地轮询硬超时，避免 RH 长任务在画布提前报超时。
- 统一后台、API、worker、协议分析自动填充对 `pollTimeoutMs` 的默认值治理。

## 变更范围

- 后台 RH 工作台与 Provider 模型编辑器：
  - 轮询超时默认留空
  - 只有手动填写时才真正写入配置
- API / 分析面板：
  - AI 自动分析不再替用户默认写入轮询超时
  - RH execution rules 的 timeout 改为可选值
- Worker / 外部协议代理：
  - 没有显式 timeout 时不启用本地轮询超时
  - RH / GRSAI / 通用异步 polling 统一支持“无限期等待上游完成”
- Web：
  - RH 节点本地前端 polling 不再自行超时终止
  - 继续保留节点运行态与公告入口热修

## Agent 已验证

### 类型检查

- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/worker`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/admin`

### 契约 / 护栏

- `codegraph sync`
- `node scripts/verify-app-shell-loading-announcement-contract.mjs`
- `node scripts/verify-runninghub-frontend-polling-contract.mjs`
- `node scripts/verify-runninghub-timeout-governance-contract.mjs`
- `node scripts/verify-poll-timeout-empty-by-default-contract.mjs`
- `node scripts/verify-generation-timeout-unification.mjs`
- `node scripts/verify-runninghub-worker-no-default-timeout-contract.mjs`

### Gray 运行态

- `readlink -f /opt/apps/xinghuan-canvas-next/current`
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-runninghub-timeout-empty-default-gray-r1-v051`
- `systemctl is-active xinghuan-canvas-next.service`
  - `active`
- `systemctl is-active xinghuan-canvas-next-worker.service`
  - `active`
- `http://127.0.0.1:18200/api/status`
  - `version = 0.5.1`
  - `environment = gray`
- `https://canvas-next.hhh2121.xyz/api/status`
  - `version = 0.5.1`
  - `environment = gray`

## 本次部署执行

- 发布包：
  - `dist-release/20260624-runninghub-timeout-empty-default-gray-r1-v051.tar.gz`
- 服务器解包目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-runninghub-timeout-empty-default-gray-r1-v051`
- release 内执行：
  - `npm ci`
  - `npm run db:migrate`
- 本次迁移结果：
  - `applied = []`
  - `skipped = 18`

## 影响

- RH 长任务不再默认被本地 5 分钟 / 6 分钟一类隐式超时截断。
- 后续新增协议只要不手动填写 timeout，也会沿用“默认留空”的一致口径。
- 这批改动不改动版本号，继续保持 gray / production 同批次都是 `v0.5.1`。

## 待用户验收

- RH 长任务在灰度上的真实完成回写体验
- RH 多 Key 并发与排队体验
- 画布侧真实业务输出、视觉与交互体验
