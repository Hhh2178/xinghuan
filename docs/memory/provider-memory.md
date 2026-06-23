# Provider 长期记忆

## 当前长期有效判断

- Provider 差异不只在模型名，还在提交端点、请求体、文件字段和轮询协议
- 优先走“默认结构层 -> 高级配置层 -> adapter 层”的三层处理
- 不应该把单个平台差异直接写进前端或单独造节点

## 当前稳定规则

- 请求体差异优先数据化
- 模型级端点分流是允许的
- 后台 AI 助手输出应以结构化接入方案为目标

## 典型样本

- 柏拉图 `grok-1.5-video-6s/10s/15s`
  - `/v1/videos`
  - `multipart/form-data`
- `grok-imagine-video-1.5-preview`
  - `/v2/videos/generations`
  - JSON body

## 相关入口

- `../systems/providers/README.md`
- `../systems/providers/request-body-and-file-strategy.md`
- `../project-atlas/provider-protocol-and-request-body-design.md`
