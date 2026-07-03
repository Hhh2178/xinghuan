# Canvas 节点与数据模型

## 当前稳定原则

- 节点体系以通用节点 + 模型目录 + schema 驱动
- 数据类型要显式隔离，不能用 `any` 绕过连接校验
- RunningHub 节点、图像/视频/音频节点都应消费结构化条目和参数定义
- ComfyUI 节点优先消费后台治理后的共享工作流，不在画布长期维护草稿
- `comfyui-app` 节点的执行入口是后台专用 `POST /api/comfyui/apps/:workflowId/run`，不再把共享工作流伪装成通用图像 provider

## 关键建模层

- `packages/canvas-core`
- `packages/model-core`
- `apps/web/src/components/nodes/`
- `apps/web/src/utils/comfyuiApps.ts`

## ComfyUI 节点模型

- `comfyui-app`
  - 后台共享目录消费节点
  - 数据状态至少包含：
    - `comfyuiAppWorkflowId`
    - `comfyuiAppInstanceId`
    - `comfyuiAppParamValues`
    - `comfyuiAppSearchQuery`
  - 参数与输出完全来自后台共享工作流 schema
- `comfyui-store`
  - 当前保留作兼容路径
  - 不再作为长期主治理入口

## 共享 ComfyUI 工作流契约

- 画布通过 `GET /api/comfyui/apps` 拉取共享目录
- 每条共享工作流包含：
  - `workflowJson`
  - `exposedFields`
  - `defaultValues`
  - `outputSchema`
  - `instanceId / sharedWorkflowId`
- 节点只渲染已暴露的参数口与输出口，不自行推断隐藏字段

## 当前重点

- 节点参数区优先消费后台定义
- 上游素材聚合要统一，不在单节点各自手搓
- ComfyUI 应用节点继续向纯消费节点收口
