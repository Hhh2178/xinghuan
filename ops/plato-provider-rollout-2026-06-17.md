# 柏拉图 Provider 接入与结构化 AI 助手发布记录 - 2026-06-17

## 目标

- 修复柏拉图视频模型不能直接沿用统一 OpenAI 风格 JSON 提交的问题。
- 将后台 API 接入助手和右侧后台 AI 助手从“猜配置”升级为“输出结构化接入方案”。
- 在 gray 和 production 执行真实 6 秒视频任务验收，确认链路可用。

## Release 信息

- gray release：
  - `20260617-plato-multipart-gray-r2-427237e-dirty`
- production release：
  - `20260617-plato-multipart-prod-r1-427237e-dirty`
- gray current：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260617-plato-multipart-gray-r2-427237e-dirty`
- production current：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260617-plato-multipart-prod-r1-427237e-dirty`
- 本地工作树基线：
  - `427237e`

## 根因结论

- `grok-1.5-video-6s/10s/15s` 不能继续走 `/v2/videos/generations` JSON body。
- 这些模型实际要求：
  - `/v1/videos`
  - `multipart/form-data`
  - 参考图通过文件字段 `input_reference` 上传
- `grok-imagine-video-1.5-preview` 仍保留：
  - `/v2/videos/generations`
  - JSON body

这不是单一服务商的偶发特例，而是“同一平台下不同模型族使用不同提交协议”的真实兼容场景。

## 代码收口

- 新增通用请求体能力：
  - `apps/api/src/provider-request-body.ts`
  - `apps/worker/src/worker-provider-request-body.ts`
- 当前支持的结构化字段：
  - `requestBodyMode`
  - `requestContentType`
  - `requestFileFields`
  - `requestValueTemplates`
- 当前能力覆盖：
  - API 直连视频链路
  - Worker 异步视频链路
  - 后台 API 接入助手结构化输出
  - 右侧后台 AI 助手格式化展示

## 柏拉图当前配置规则

### grok-1.5-video-6s / 10s / 15s

- `submitPath`：`/v1/videos`
- `requestBodyMode`：`multipart_form_data`
- `requestContentType`：`multipart/form-data`
- `requestFileFields`：`images`
- `requestMapping.images`：`input_reference`
- `requestValueTemplates.size`：`{video_size}`
- 轮询：
  - `pollPathTemplate = /v2/videos/generations/{task_id}`
  - `taskIdPath = task_id`
  - `taskStatusPath = status`
  - `resultVideoPath = data.output`

### grok-imagine-video-1.5-preview

- `submitPath`：`/v2/videos/generations`
- 请求体：JSON
- 结果路径：`data.output`

## 验证

### 本地验证

- `npx tsx scripts/verify-apimart-video-adapter-contract.ts`
- `node scripts/verify-assistant-provider-template-contract.mjs`
- `node scripts/verify-admin-assistant-ui-contract.mjs`
- `npm run build -w @xinghuan/api`
- `npm run build -w @xinghuan/worker`
- `npm run build -w @xinghuan/admin`
- `npm run build:single-port`
- `npm run verify:release-package-contract`

结果：

- 全部通过。

### gray 验收

- `npm run verify:release-preflight = ok`
- `npm run verify:request-chain-observability = ok`
- `npm run verify:system-observability = ok`
- `https://canvas-next.hhh2121.xyz/api/status = 200`
- 真实 `grok-1.5-video-6s` 任务：
  - `status = succeeded`
  - 已返回并落库本地视频

### production 验收

- `npm run verify:release-preflight = ok`
- `npm run verify:request-chain-observability = ok`
- `npm run verify:system-observability = ok`
- `https://canvas.hhh2121.xyz/api/status = 200`
- 真实 `grok-1.5-video-6s` 任务：
  - 首次返回上游繁忙
  - 重试后 `status = succeeded`
  - 已返回并落库本地视频

## 发布注意点

- 本轮 release 名保留 `dirty`，说明发包时工作树已经包含未提交修改；这不影响已验收内容，但后续应补齐提交收口。
- 用于真实验收的参考图不能过小；过小图片可能被上游直接判为无效。
- 如果再次出现“官方负载大，请尝试重新生成”，应优先判断为上游容量波动，而不是本地 multipart 配置继续错误。

## 结论

- 柏拉图 Provider 接入当前已在 gray / production 完成真实验收。
- 后台 API 接入助手和右侧后台 AI 助手已经具备输出结构化接入方案的基础能力。
- 这次改造已经抽象成可复用的 Provider 请求体能力，后续新平台接入应优先走这套结构，而不是继续增加专门分支。
