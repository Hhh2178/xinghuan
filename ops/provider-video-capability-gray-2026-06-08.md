# Provider 视频能力与 APIMart 适配灰度修复记录 - 2026-06-08

## 目标

- 将 Provider 灵活配置、视频模型输入能力开关和 APIMart 异步视频适配发布到灰度环境。
- 修复灰度数据库因历史迁移文件已执行而未自动补齐 `input_capabilities` / `advanced_config` 字段的问题。
- 用服务器本地验收和公网 smoke 确认 `canvas-next.hhh2121.xyz` 恢复到可验收状态。

## Release

- 首次灰度 release：`20260608-1515-provider-video-capability-gray`
- 修复后灰度 release：`20260608-1535-provider-video-capability-gray-fix`
- 灰度域名：`https://canvas-next.hhh2121.xyz`
- 服务端口：`127.0.0.1:18200`
- API 服务：`xinghuan-canvas-next.service`
- Worker 服务：`xinghuan-canvas-next-worker.service`
- 当前 release 路径：`/opt/apps/xinghuan-canvas-next/releases/20260608-1535-provider-video-capability-gray-fix`

## 变更范围

- `packages/model-core/src/index.ts`
  - 新增结构化 `inputCapabilities` / `advancedConfig` 元数据解析与 UI metadata 透出。
- `apps/api/src/server.ts`
  - Provider/模型读写补齐 `input_capabilities`、`advanced_config`。
  - 视频代理补齐 APIMart 异步任务提交、轮询和结果提取。
- `apps/api/src/apimart-video-adapter.ts`
  - 新增 APIMart 视频适配器。
- `apps/admin/src/admin-model-editor.tsx`
  - 新增视频模型 `参考图 / 多图 / 首帧 / 尾帧` 能力开关与高级配置编辑。
- `apps/admin/src/admin-api-settings-panel.tsx`
  - Provider 模型导入/手动新增默认值同步升级为结构化能力。
- `apps/web/src/components/nodes/VideoNode.tsx`
  - 视频节点根据后台发布模型能力动态展示输入方式。
- `apps/web/src/components/nodes/videoNodeBackendInputs.ts`
  - 新增后台视频输入分配纯逻辑，覆盖仅尾帧、多图、首尾帧等分支。
- 新增验收：
  - `scripts/verify-video-node-backend-inputs-contract.ts`
  - `scripts/verify-apimart-video-adapter-contract.ts`
- 新增数据库增量迁移：
  - `apps/api/db/004_provider_model_framework_backfill.sql`

## 首次灰度阻塞点

- release `20260608-1515-provider-video-capability-gray` 已成功切到灰度，但 `npm run verify:single-port` 在服务器报错：

```text
column "input_capabilities" does not exist
```

- 根因：
  - 本轮把 `input_capabilities` / `advanced_config` 直接追加到了历史 `002_provider_model_framework.sql`。
  - 灰度库的 `xh_schema_migrations` 只按文件名记账，`002_provider_model_framework.sql` 早已执行过，因此 `npm run db:migrate` 不会重新补列。
- 修复方式：
  - 新增前向增量迁移 `004_provider_model_framework_backfill.sql`。
  - 发布新 release `20260608-1535-provider-video-capability-gray-fix`。
  - 在灰度执行 `npm run db:migrate`，成功应用 `004_provider_model_framework_backfill.sql`。

## 服务器部署动作

- 本机打包：
  - `releases/20260608-1515-provider-video-capability-gray.tar.gz`
  - `releases/20260608-1535-provider-video-capability-gray-fix.tar.gz`
- 上传到服务器：
  - `/tmp/20260608-1515-provider-video-capability-gray.tar.gz`
  - `/tmp/20260608-1535-provider-video-capability-gray-fix.tar.gz`
- 解压到：
  - `/opt/apps/xinghuan-canvas-next/releases/20260608-1515-provider-video-capability-gray`
  - `/opt/apps/xinghuan-canvas-next/releases/20260608-1535-provider-video-capability-gray-fix`
- 在修复 release 目录执行：
  - `npm ci`
  - `npm run build:single-port`
  - `set -a; . /opt/apps/xinghuan-canvas-next/shared/canvas-next.env; set +a; npm run db:migrate`
- 切换 `/opt/apps/xinghuan-canvas-next/current` 指向修复 release。
- 重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`

## 验收结果

服务器本地通过：

- `npm run verify:single-port`
- `npm run verify:model-catalog`
- `npm run verify:external-video-proxy`
- `node scripts/verify-generic-node-catalog.mjs`
- `npx tsx scripts/verify-video-node-backend-inputs-contract.ts`
- `npm run verify:apimart-video-adapter-contract`

公网 smoke 通过：

- `https://canvas-next.hhh2121.xyz/api/status` 返回 `200`
- `https://canvas-next.hhh2121.xyz/` 返回 `200`
- `https://canvas-next.hhh2121.xyz/admin` 返回 `200`
- `curl -fsS https://canvas-next.hhh2121.xyz/api/status` 返回 `environment=gray`

服务状态通过：

- `readlink -f /opt/apps/xinghuan-canvas-next/current` 返回 `20260608-1535-provider-video-capability-gray-fix`
- `systemctl is-active xinghuan-canvas-next.service` 返回 `active`
- `systemctl is-active xinghuan-canvas-next-worker.service` 返回 `active`
- `npm run db:migrate` 输出 `applied=["004_provider_model_framework_backfill.sql"]`

## 当前结论

本轮 Provider 视频能力与 APIMart 适配已经在灰度恢复到可验收状态。首个 release 的阻塞点不是运行时代码失败，而是数据库 schema 漏迁移；当前已通过前向增量迁移补齐并完成灰度复验。剩余已知未闭环项仍是历史 GRSAI 异步灰度回归脚本，不属于本轮变更新增阻塞。

## 追加说明（2026-06-08 晚间）

- 用户后续继续验收时，又发现两个补充问题：
  - APIMart 视频真实任务时长会超过此前本地默认等待窗口，需要把默认最大轮询时长放宽。
  - APIMart `gpt-image-2` 图像链路并不是同步返回图片，而是与视频一样先返回 `task_id`。
- 已在本机确认：
  - APIMart 图像提交返回 `code=200`、`data[0].status=submitted`、`data[0].task_id=...`
  - APIMart 官方文档明确要求图像提交后轮询 `GET /v1/tasks/{task_id}`，完成态结果位于 `data.result.images[0].url[0]`
- 因此本轮晚间追加修复将补两点：
  - 视频默认最大轮询时长改为 `360s`
  - 图像代理补齐异步任务轮询与嵌套图片结果提取
- 对应后台模型编辑器也会补一个结构化“最大轮询时长（秒）”输入位，默认值同样为 `360`。
