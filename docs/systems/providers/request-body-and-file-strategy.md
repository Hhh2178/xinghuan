# Provider 请求体与文件策略

## 当前高频能力

- JSON body
- `multipart/form-data`
- 文件字段注入
- 派生字段模板

## 核心字段

- `requestBodyMode`
- `requestContentType`
- `requestFileFields`
- `requestValueTemplates`

## 维护原则

- 差异优先数据化
- 不把平台细节直接扩散到前端

## AICOPY 视频补充请求契约

- 后台以 Provider 的 `protocol=aicopy` 与模型 `capability=video` 判断是否展示 SD 补充请求契约，不依赖模型 ID、名称或旧模型白名单。
- 新增任意 AICOPY 视频模型时都会显示该入口；是否启用仍由模型自己的 `advancedConfig.aicopyRequestContractEnabled` 决定，不在同一 Provider 内自动继承。
- 开启后才合并标准请求 bindings/result paths；关闭时不得向 Grok 等不需要 SD 字段的模型写入补充契约。
- AICOPY SD 视频不能再用一套默认 body 覆盖所有模型；`advancedConfig.requestContractProfile` 当前区分：
  - `sd2-per-second`：顶层 `duration / metadata / images / videos / audios`。
  - `sd2-per-request`：`input.prompt / input.media`，并按模型固定 `seconds=15` 与横竖屏 `size`。
  - `sd-channel-431`：`video_config / reference_images` 与 `input.media` 并存。
  - `sd-channel-900`：固定 15 秒、720p，媒体仅使用顶层 `images`。
- `requestContract` 的数据源支持 `videos`、`referenceMode` 和结构化 `media`；`media` 按图片、视频、音频顺序生成 `reference_image / reference_video / reference_audio` 对象，首尾帧仍由图片顺序保证。
- 非默认 profile 在后台保存时必须保留自己的 bindings，不能再次合并 `sd2-per-second` 默认字段。
- 视频提示词字节数不在平台 API 预检。历史 `advancedConfig.maxPromptBytes`（包括 AICOPY/AIFork 旧的 4096 提示）不会阻止任何协议的请求；必须先把请求交给服务商，由服务商返回实际限制。平台仍保留通用的输入安全上限，不把它伪装成渠道模型限制。
- 上游嵌套 JSON 错误必须解包到最内层可读原因，避免把 `fail_to_fetch_task` 套娃文本直接展示给用户。
