# RunningHub Runtime / Queue Governance Release - 2026-06-18

## 目标

- 将 RunningHub 运行时修复、普通 Provider 用户级并发治理、RH 平台级并发治理完成到可追溯发布状态。
- 用真实 gray 任务验证“等待窗口存在、自动递进成立、结果读取不丢失”。

## 发布结果

- gray release：
  - `20260618-runninghub-runtime-queue-gray-r6-v034-d9b653c`
- production release：
  - `20260618-runninghub-runtime-queue-prod-r1-v034-d9b653c`
- 对外版本：
  - `v0.3.4`

## 关键修复

- RH query 结果读取修复：
  - 统一暴露 `image/video/audio` 三类输出数组
  - 避免 RH 实际返回图像，但查询链路只看视频数组导致前台误判为空
- RH queued task 外键修复：
  - RH 任务不再误把 workflow/page id 写入 `xh_tasks.model_id`
  - 避免触发普通模型外键约束
- 队列治理：
  - 普通 Provider 按 `capability + ownerId` 独立并发与排队
  - RunningHub 按平台并发窗口独立排队与自动递进

## gray gate

- `verify:release-preflight = ok`
- `verify:request-chain-observability = ok`
- `verify:system-observability = ok`

## production gate

- `verify:release-preflight = ok`
- `verify:request-chain-observability = ok`
- `verify:system-observability = ok`

## gray 实链验证

### 普通 Provider 用户窗口

- 模型：
  - provider `grsai`
  - model record `grsai-gpt-image-2`
  - model id `gpt-image-2`
- 样本任务：
  - `task-1781787483910-nxtenx`
  - `task-1781787484073-900frn`
  - `task-1781787484217-1vdo6q`
- 已观察到：
  - `waitReason = waiting_user_window`
  - `waitDetail = 用户 usr-admin 的 image 并发已满 (1/1)`
- 结论：
  - 同用户会等待
  - 跨用户可独立推进
  - 前序任务结束后等待任务会自动进入运行

### RunningHub 平台窗口

- RH 单任务成功：
  - `task-1781788410710-ndki99`
  - upstream task id `2067597917841219585`
- RH 批量三任务成功：
  - `task-1781789036588-mqrk4c`
  - `task-1781789036735-jvltj3`
  - `task-1781789036892-eglgtt`
- 第三个任务已观察到：
  - `waitReason = waiting_runninghub_window`
  - `waitDetail = RunningHub 平台并发已满 (2/2)`
- 结论：
  - RH 平台窗口 `2` 生效
  - 等待任务可在前序 RH 任务结束后自动递进执行

## 已知补记

- 本轮不包含新的数据库 migration。
- gray / production release 目录执行 `db:migrate` 仍暴露 `PG_DRIVER_NOT_INSTALLED`。
- 该问题不影响本轮无 migration 发布，但后续凡是带 migration 的 release，必须先修补 release 包迁移依赖链。
