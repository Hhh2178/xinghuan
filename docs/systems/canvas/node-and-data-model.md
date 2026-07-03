# Canvas 节点与数据模型

## 当前稳定原则

- 节点体系以通用节点 + 模型目录 + schema 驱动
- 数据类型要显式隔离，不能用 `any` 绕过连接校验
- RunningHub 节点、图像/视频/音频节点都应消费结构化条目和参数定义
- ComfyUI 节点优先消费后台治理后的共享工作流，不在画布长期维护草稿
- 画布前台当前只保留一个正式可见节点：`comfyui`
- `comfyui` 节点的执行入口是后台专用 `POST /api/comfyui/apps/:workflowId/run`，不再把共享工作流伪装成通用图像 provider

## 关键建模层

- `packages/canvas-core`
- `packages/model-core`
- `apps/web/src/components/nodes/`
- `apps/web/src/utils/comfyuiApps.ts`

## ComfyUI 节点模型

- `comfyui`
  - 后台共享目录消费节点，也是当前唯一正式可添加的 ComfyUI 前台节点
  - RH 风格壳层，顶部固定 `工作流` 和 `机器` 两级选择
  - 机器候选受共享工作流 `instanceBindings` 约束，默认优先已选机器、默认机器、在线机器
  - 外部保持单一输出口，内部运行结果继续保留结构化 `outputs`
  - 数据状态至少包含：
    - `comfyuiWorkflowId`
    - `comfyuiInstanceId`
    - `comfyuiParamValues`
    - `comfyuiSearchQuery`
    - `outputs`
  - 参数与输出完全来自后台共享工作流 schema
- legacy node migration
  - `comfyui-app` 会迁移到 `comfyui`
  - `comfyui-store` / `comfyui-app-maker` 会迁移到 `comfyui` 并留下“需重新选择共享工作流”的显式提示
  - 旧三节点不再作为长期产品模型继续演进

## 共享 ComfyUI 工作流契约

- 画布通过 `GET /api/comfyui/apps` 拉取共享目录
- 每条共享工作流包含：
  - `workflowJson`
  - `inputSchema`
  - `defaultValues`
  - `outputSchema`
  - `instanceId / sharedWorkflowId`
- 节点只渲染已暴露的参数口与输出口，不自行推断隐藏字段

## 当前重点

- 节点参数区优先消费后台定义
- 上游素材聚合要统一，不在单节点各自手搓
- 统一 `comfyui` 节点继续向纯消费节点收口
