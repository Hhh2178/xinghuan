# 异步视频 Provider 接入规范

日期：2026-06-10

## 目标

把后续新视频 API 平台的接入流程统一成一套标准模板，让以下三个层面说同一种语言：

- 后台管理员配置
- 后台 AI 助手草案生成
- Hermes 分析与后续自动化协助

目标不是为每个平台写一套私有逻辑，而是先判断它属于哪种链路模板，再填入受控字段。

## 统一模板

### 1. `sync_inline_result`

适用：

- 提交请求后直接返回最终视频 URL

要求：

- 不需要任务轮询
- 不需要第二段资源查询

最小字段：

- `submitPath`
- `requestMapping`
- `fixedBody`

### 2. `async_task_poll_result`

适用：

- 提交请求后返回任务 ID
- 单一轮询接口最终返回视频 URL

最小字段：

- `submitPath`
- `taskIdPath`
- `pollPathTemplate`
- `taskStatusPath`
- `resultVideoPath`
- `requestMapping`
- `requestValueTypes`

样板：

- ToAPIs

### 3. `async_task_poll_then_final_lookup`

适用：

- 提交请求后返回任务 ID
- 轮询任务接口只返回中间资源 ID
- 需要再查一次最终资源接口

最小字段：

- `submitPath`
- `taskIdPath`
- `pollPathTemplate`
- `taskStatusPath`
- `finalResultTaskIdPath`
- `finalResultPathTemplate`
- `finalResultVideoPath`
- `requestMapping`
- `requestValueTypes`

样板：

- Agnes

### 4. `adapter_manual_model_catalog`

适用：

- 不适合标准自动拉模型目录
- 不适合标准 OpenAI-like 请求/响应
- 需要更重的 adapter 或手动目录

样板：

- GRSAI 手动模型目录场景

## 受控字段白名单

后台和 AI 助手只能写入以下受控字段：

- `mode`
- `submitPath`
- `taskIdPath`
- `pollPathTemplate`
- `taskStatusPath`
- `resultVideoPath`
- `finalResultTaskIdPath`
- `finalResultPathTemplate`
- `finalResultVideoPath`
- `requestMapping`
- `requestValueTypes`
- `fixedBody`
- `pollIntervalMs`
- `pollTimeoutMs`

禁止：

- shell 命令
- SQL
- 任意脚本
- 未经白名单的动态表达式

## 管理员操作模板

1. 收集文档 URL、示例请求、示例响应、模型名、基础地址
2. 让后台 AI 助手先判断模板类型
3. 检查草案是否补齐最小字段
4. 确认 `inputCapabilities` 与真实输入能力一致
5. 保存 Provider / Model 配置
6. 先做最小真实烟测
7. 记录任务 ID、状态、最终 URL 或最终错误
8. 将结论写入台账

## AI 助手输出要求

后台 AI 助手输出必须包含：

- `summary`
- `protocol`
- `recommendedLayer`
- `asyncTask`
- `chainTemplate`
- `chainTemplateVersion`
- `drafts.provider`
- `drafts.model`
- `drafts.model.advancedConfig`
- `risks`
- `checklist`

如果是 `async_task_poll_then_final_lookup`，必须尽量给出：

- `finalResultTaskIdPath`
- `finalResultPathTemplate`
- `finalResultVideoPath`

## Hermes 协同要求

Hermes 在分析 Provider 文档时必须遵循与后台 AI 助手相同的模板命名：

- `sync_inline_result`
- `async_task_poll_result`
- `async_task_poll_then_final_lookup`
- `adapter_manual_model_catalog`

Hermes 不应输出另一套私有命名，否则后台和管理员无法直接复用结果。

## 当前已验证样板

### ToAPIs

- 模板：`async_task_poll_result`
- 提交：`POST /v1/videos/generations`
- 轮询：`GET /v1/videos/generations/{task_id}`
- 结果：`result.data.0.url`
- 特殊点：`seconds` 必须传字符串

### Agnes

- 模板：`async_task_poll_then_final_lookup`
- 提交：`POST /v1/videos`
- 轮询：`GET /v1/videos/{task_id}`
- 中间资源 ID：`video_id`
- 最终查询：`GET /agnesapi?video_id={video_id}`
- 最终视频：`remixed_from_video_id`

## 验收要求

一个新视频 Provider 只有同时满足以下条件才算接入完成：

1. 能判定模板类别
2. 后台 AI 助手能输出结构化草案
3. Hermes 能输出同模板命名的草案
4. 后台保存后，代理链路能真实提交任务
5. 能拿到最终视频 URL，或拿到明确上游业务错误
6. 台账已写入
