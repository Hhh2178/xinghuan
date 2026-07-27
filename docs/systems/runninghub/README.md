# RunningHub 系统

## 这个系统负责什么

RunningHub 系统负责两类执行：把 RH Workflow 与 AI App 作为外部运行目标接入画布，以及把 RunningHub 标准图像/视频模型作为通用 Provider 模型执行。两类执行共享 Provider 身份，但拥有不同的任务描述、参数和 Key 资格。

## 建议阅读顺序

1. `integration-architecture.md`
2. `catalog-and-entry-model.md`
3. `workflow-app-differences.md`
4. `node-runtime-flow.md`

## 关键代码入口

- 后台工作台：`apps/admin/src/admin-runninghub-workspace.tsx`
- 后台条目编辑器：`apps/admin/src/admin-runninghub-item-editor.tsx`
- 后台列表面板：`apps/admin/src/admin-runninghub-panel.tsx`
- API catalog：`apps/api/src/runninghub-catalog.ts`
- API 执行描述：`apps/api/src/runninghub-execution-descriptor.ts`
- 画布节点：`apps/web/src/components/nodes/RunningHubNode.tsx`
- 共享类型：`packages/shared/src/runninghub.ts`
- worker 执行：`apps/worker/src/worker.ts`
- worker 协议 client：`apps/worker/src/worker-runninghub-client.ts`
- worker poll 响应护栏：`apps/worker/src/worker-runninghub-response.ts`
- 标准模型 adapter：`apps/worker/src/worker-runninghub-standard-adapter.ts`
- 标准模型媒体上传：`apps/worker/src/worker-runninghub-standard-media.ts`
- Key 池调度：`apps/worker/src/worker-runninghub-dispatch.ts`

## 当前重点边界

- RH 条目必须区分 `workflow` 与 `app`
- `runTargetId` 必须与 `kind` 对应
- `allowsEmptyInputs=true` 的 workflow 允许 `fields=0`
- 节点参数区优先消费后台条目定义，而不是继续在前端猜
- RH Key 池是 RunningHub 的真实并发来源：
  - 后台 Provider 可维护多 Key
  - RH 总并发自动汇总所有启用 Key 的 `maxConcurrency`
  - API 入队只固定 `preferredRhKeyId`
  - Worker 执行前才实时抢占并写入 `assignedRhKeyId`
  - 只有全部 Key 满载时才进入 `all_keys_busy`
  - 抢占顺序是 `preferredRhKeyId -> 其他 default Key -> 其他启用 Key`
  - 若根本不存在启用 Key，worker 会直接回写 `model_config` 失败，而不是伪装成排队
- 标准模型 Key 资格：
  - Admin Key 池用 `standardModelApi` 明确标记企业级共享 Key
  - 旧记录缺少该字段时，Worker 兼容识别 `企业级` / `enterprise` 备注
  - 标准模型只从合格 Key 中抢占；App/Workflow 目录任务继续使用全部既有 Key
  - 无合格 Key 时直接显示 `RunningHub 标准模型需要企业级-共享 API Key`
- 标准模型执行：
  - Generic image/video task 创建时冻结 `runningHubExecutionMode` 与 `runningHubModelPath`
  - 本地或受保护媒体只能在 owner 边界内读取，再上传 `/openapi/v2/media/upload/binary`
  - 提交 `/openapi/v2/<model-path>`，查询 `/openapi/v2/query`
  - 最终远端 URL 必须由统一 output materializer 转存为平台产物
  - 标准模型提交保持单次调用，避免网络超时导致重复计费；查询阶段复用有截止时间的瞬态重试（408/425/429/5xx/网络错误），并将重试与恢复写入 sanitized poll heartbeat
- Worker 第二阶段收口方向：
  - `worker.ts` 逐步退回 orchestration glue
  - RunningHub 协议解析已开始下沉到独立 helper / client
  - Key 池调度、取消同步、统一诊断会继续按模块拆分
- RH 节点阶段进度统一口径：
  - 提交中或排队中：`5%`
  - 已开始生成：`45%`
  - 成功完成：`100%`
  - 排队文案：`任务队列排队中`
  - poll heartbeat 会持续回写 `upstreamStatus / upstreamMessage / rhTargetType / rhRunTargetId`
  - App/Workflow 目录执行同样保持提交单次调用；查询遇到 408/425/429/5xx 或网络瞬断时，在任务超时截止点内做有界重试，并把恢复次数与上游状态回写到运行态

## 工程治理要求

- RunningHub 新增能力时，后台条目、API descriptor、worker 协议执行、前端节点运行态必须按层落点，禁止继续在单一文件里跨层堆逻辑。
- 后台分析草案、真实执行 descriptor、画布运行时状态，必须优先复用共享类型和已有 helper，不允许再复制一套本地私有协议。
- RH / RH Tools 的共享运行时逻辑，后续优先抽 hook / helper，避免双实现继续漂移。

## 兼容正文来源

- `docs/project-atlas/runninghub-integration-and-node-design.md`

## 更新规则

- 新的 RunningHub 正文优先写当前系统目录
- atlas 文件只保留兼容层方案正文
