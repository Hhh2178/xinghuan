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
