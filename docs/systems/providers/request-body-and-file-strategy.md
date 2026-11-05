# Provider 请求体与文件策略

## 当前高频能力

- JSON body
- `multipart/form-data`
- 文件字段注入
- 派生字段模板

## APIMart GPT Image 2.6

- `gpt-image-2.6-flare` 与 `gpt-image-2.6-sunburst` 使用异步 `/v1/images/generations`，参考图字段为 `image_urls` 数组；本地输入会由 API 转为限时签名 URL。
- 模型 `parameterSchema.imageOutput` 可配置静态尺寸档位、精确像素步长/边界、静态格式和 GIF 能力；API 在入队前按所选模型规则校验并冻结配置到任务 payload，Worker 不读取后续目录修改并按该快照复核。
- APIMart 2.6 继续强制 prompt、参考图数量、比例/像素尺寸、质量、格式及参数组合的上游硬限制；非法输入同步返回 HTTP 400，不创建后台任务。精确静态像素尺寸宽高须为 16 的倍数、单边不超过 3,840、总像素为 655,360–8,294,400 且长短边比例不超过 3:1。
- 请求保留 `resolution`、`quality`、`output_format`、`background`、`moderation`、`output_compression`、`mask_url`、`markup_url`、`complexity`、GIF 帧参数、SVG 文本模型及推理强度配置。
- GIF 使用单帧像素尺寸及拼图限制；SVG 仅文字生成且需要 `svg.model`。按本项目明确启用的 APIMart 2.6 GIF 参考图试验配置，GIF 请求会保留最多 16 张图片并原样提交到 `image_urls`，尽管 APIMart 文档说明 GIF 仅支持文生图；上游若拒绝则将错误返回用户，不会移除参考图后自动重试。GIF 仍不发送蒙版、标注和输出压缩字段。产物以真实 MIME 与扩展名物料化；SVG 内容响应增加 CSP sandbox。
- APIMart 结果需轮询 task 后读取 `data.result.images[].url[]`。异步请求与格式约束以 APIMart GPT-Image-2.6 接口文档为准。

## 核心字段

- `requestBodyMode`
- `requestContentType`
- `requestFileFields`
- `requestValueTemplates`

## 维护原则

- 差异优先数据化
- 不把平台细节直接扩散到前端

## 多模态素材引用

画布和资源记录只保存相对逻辑引用，例如 `/files/input/...`、`/api/shared-resources/items/:id/content` 与 `/api/materials/generation-library/:id/content`。Provider 请求边界才把它们转换成当前环境的绝对 HTTPS 短时签名地址。

- `/api/provider-files/{scope}/...` 服务用户输入或输出文件。
- `/api/provider-media/{scope}/{token}` 服务公共资源、生成产物及统一的多模态媒体引用。
- `scope` 必须是 `gray` 或 `production` 并与签名 claim 相同；Files 域名按该路径 scope 转发到对应环境，不能用一个无 scope 的通配路径同时代理两个环境。
- URL、签名和绝对 origin 只存在于本次上游请求，不能写回 Canvas JSON、资源元数据或工作流导出文件。

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
