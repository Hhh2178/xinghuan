# RunningHub 工作台与单一 RH 节点灰度发布记录 - 2026-06-18

## 目标

- 将 RunningHub 第一阶段改造发布到 gray：
  - RH catalog 规范化
  - 后台 RH 工作台
  - 单一 RH 节点固定 typed handles
  - 前台对 `inputSlots` 的兼容消费过渡
- 保持当前对外版本号继续为 `v0.3.2`。

## Release 信息

- 对外版本号：
  - `v0.3.2`
- gray release：
  - `20260618-runninghub-workspace-gray-r1-6b65dbc`
- 本地基线：
  - `HEAD = 6b65dbc`
- gray current：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260618-runninghub-workspace-gray-r1-6b65dbc`
- 上一灰度 release：
  - `20260618-v032-ui-fixes-gray-r1`

## 本次带入 gray 的范围

- 后端：
  - RunningHub catalog 规范化
  - RH admin items 读取 / 保存 / 预览校验接口
- 后台：
  - RH 工作台入口与结构化条目编辑器
- 前台：
  - `runninghubCatalog` 改为优先消费 `items`
  - RH 节点新增固定输入句柄：
    - `text-in`
    - `image-in`
    - `video-in`
    - `audio-in`
    - `json-in`
  - RH 节点开始优先基于 `inputSlots` 推导运行字段，弱化旧 `fields/nodeInfoList` 依赖
- 文档：
  - project atlas 的 API / 数据流路由
  - DEVLOG 新增 RH 第一阶段推进记录

## 本地发布前验证

- `node scripts/verify-runninghub-catalog-normalization.mjs`
- `node scripts/verify-admin-runninghub-workspace-contract.mjs`
- `node scripts/verify-runninghub-single-node-contract.mjs`
- `npm run build -w @xinghuan/shared`
- `npm run build -w @xinghuan/api`
- `npm run build -w @xinghuan/admin`
- `npm run build -w @xinghuan/web`
- `npm run build:single-port`
- `node scripts/verify-release-package-contract.mjs`
- `node scripts/verify-release-preflight-contract.mjs`
- `npm run package:release -- 20260618-runninghub-workspace-gray-r1-6b65dbc`

结果：

- 全部通过。
- release 包：
  - `dist-release/20260618-runninghub-workspace-gray-r1-6b65dbc.tar.gz`
  - `sizeMB = 5.43`

## 实际发布步骤

1. 上传 release 包到：
   - `/tmp/20260618-runninghub-workspace-gray-r1-6b65dbc.tar.gz`
2. 解包到：
   - `/opt/apps/xinghuan-canvas-next/releases/20260618-runninghub-workspace-gray-r1-6b65dbc`
3. 在新 release 目录执行：
   - `npm ci`
4. 执行迁移：
   - `set -a; . /opt/apps/xinghuan-canvas-next/shared/canvas-next.env; set +a; npm run db:migrate`
5. 切换 `current` 并重启：
   - `xinghuan-canvas-next.service`
   - `xinghuan-canvas-next-worker.service`

## 发布结果

- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- `/api/status`：
  - `environment = gray`
  - `version = 0.3.2`
- `gray current`：
  - `/opt/apps/xinghuan-canvas-next/releases/20260618-runninghub-workspace-gray-r1-6b65dbc`

## Gray Gate

- `verify:release-preflight = ok`
  - `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260618-runninghub-workspace-gray-r1-6b65dbc`
  - `database.name = xinghuan_canvas_gray`
- `verify:request-chain-observability = ok`
- `verify:system-observability = ok`
  - `database.targetMatched = true`

## 风险与补记

- 本轮 `db:migrate` 在 gray release 目录执行时返回：
  - `PG_DRIVER_NOT_INSTALLED`
- 当前这批 RH 改动不包含新的数据库 migration，因此服务切换和 gate 不受影响，gray 已可视为成功切换。
- 但这说明当前 release 包在“只依赖 release 目录内 npm install”的场景下，数据库迁移链路仍存在 `pg` 依赖缺口；后续需要单独补 release packaging / runtime dependency 策略，避免下一次带 migration 的发布在灰度目录里失败。
