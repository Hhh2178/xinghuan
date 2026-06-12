# Provider 生成任务标准化 Rollout Checklist

日期：`2026-06-12`

适用范围：

- 后台发布模型的 `image / video / audio`
- 标准执行模式：
  - `worker_queue`
  - `async_poll`
  - `async_poll_then_final_lookup`
  - `sync_inline` 仅保留少量真正低时延同步能力

## 发布前代码验收

- 执行 `npm run build:single-port`
- 执行 `npm run verify:provider-generation-task-contract`
- 执行 `npm run verify:provider-generation-task-service`
- 执行 `npm run verify:provider-generation-worker`
- 执行 `npm run verify:provider-generation-web-task-consumption`
- 执行 `npm run verify:provider-generation-admin-contract`
- 执行 `node scripts/verify-admin-assistant-structured-analysis-contract.mjs`
- 执行 `node scripts/verify-admin-task-panel-contract.mjs`

## 灰度发布后验收

- 确认 `https://canvas-next.hhh2121.xyz/api/status` 返回 `environment=gray`
- 确认 `xinghuan-canvas-next.service` 为 `active`
- 确认 `xinghuan-canvas-next-worker.service` 为 `active`
- 确认 Redis 队列可用，任务没有持续堆积
- 登录灰度后台，检查模型编辑器存在 `executionMode` 选择器
- 登录灰度后台，检查 AI 协助配置能展示 `executionMode` 和 `chainTemplate`
- 登录灰度后台，检查任务面板能按能力 / Provider / 状态筛选，并能看到清晰失败原因

## 灰度任务链路验收

- 图片后台发布模型发起一次低成本任务
- 视频后台发布模型发起一次低成本任务
- 音频后台发布模型发起一次低成本任务
- 确认每次提交都先返回 `taskId`
- 确认任务状态至少经历 `queued / running / succeeded` 或明确 `failed`
- 确认成功任务会把结果素材化，并进入输出节点或资源库
- 确认失败任务会在后台任务面板显示 `failureReason / error / last log`

## 取消与重试验收

- 对一条运行中的生成任务执行取消
- 确认前端节点状态与后台任务状态同步变为 `cancelled` 或显示清晰取消结果
- 对一条失败任务执行重试
- 确认会创建新的任务执行记录，而不是覆写旧任务

## 生产发布门禁

- 灰度图片 / 视频 / 音频三类任务都通过
- API / Worker 服务都为 `active`
- 队列健康，没有持续异常失败
- 后台 AI 协助配置能继续输出结构化草案
- 至少完成一次正式环境低成本 smoke

## 后续接入规则

- 新增 `image / video / audio` Provider 时，默认先按 `worker_queue` 设计
- 只有真正短时、同步、无上游 taskId 的能力才允许保留 `sync_inline`
- 若上游是“提交任务 + 轮询状态”，优先使用 `async_poll`
- 若上游还需要二段最终结果查询，使用 `async_poll_then_final_lookup`
- `advancedConfig.mode` 只描述 Provider 适配细节，不替代 `executionMode`
