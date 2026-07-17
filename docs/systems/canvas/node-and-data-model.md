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

## 通用工作流节点能力

- `code`
  - 工具节点，使用既有橙色语义和通用节点壳。
  - 接收结构化上游文本、图像、视频和音频输入，通过 `POST /api/code-node/execute` 执行受控 Python。
  - 代码与预设保存在节点数据中，随画布和共享工作流序列化；运行态输出在导出工作流时清理。
  - 服务端使用独立 Python 进程、隔离参数、AST 限制、5 秒超时、64 KB 代码上限、256 KB 输出上限和默认 2 路并发限制；Linux 运行态额外设置 CPU、地址空间、文件大小和文件描述符上限。该边界不等价于容器级隔离，生产启用前仍需灰度验证专用低权限用户与资源观测。
- `label`
  - 辅助节点，使用既有灰蓝语义，无输入和输出端口。
  - 文本、字号、文字色、背景色、宽高和固定状态随节点保存。
  - 选中且未固定时可通过四角独立调整宽高；正文区域随节点尺寸伸缩，固定后同时禁用拖动和缩放。
  - 固定状态同时控制 React Flow `draggable`，不参与批量或组运行。
- `group-box.executionCount`
  - 每个组独立保存 1 到 99 次循环次数，旧数据缺省为 1。
  - 每轮保持拓扑顺序；节点失败达到管理器配置的重试上限后终止当前批次。
- `group-execution-manager.failureRetryCount`
  - 控制管理器批量执行时每个失败节点的额外重试次数，范围 `0-10`，默认 `3`；达到上限仍失败时终止当前批次。
- `text-split`
  - 蓝色“启动”和 `useRunTrigger` 复用默认运行逻辑，按分段顺序创建并连线独立 `output` 节点。
  - 自动创建的 `output` 节点只消费自身 `directOutputText`，不沿展示连线重复收集 TextSplitNode 的完整分段集合。
  - 灰黑色“打散文本节点”是显式兼容路径，只创建独立 `text` 节点，不参与默认组运行。
  - 自动输出带 `autoCreatedBy: text-split-run`、来源节点和顺序标识；两条路径重新运行时都会替换该来源的上一批自动产物。

## 模板数据边界

- 工具栏模板入口只负责打开 `WorkflowTemplateModal`。
- 模板弹层与资源库统一读取公共资源 `kind=workflow`，不再保留静态模板数组。
- 缩略图优先使用资源 `thumbUrl`；缺失时由共享 `WorkflowTopologyCard` 渲染拓扑预览。

## ComfyUI 节点模型

- `comfyui`
  - 后台共享目录消费节点，也是当前唯一正式可添加的 ComfyUI 前台节点
  - RH 风格壳层，当前固定为 `机器 -> 工作流` 两级选择
  - workflow 必须从当前机器上下文内选择，不再允许“先选 workflow 再倒推机器”
  - 机器候选受共享工作流 `instanceBindings` 约束，默认优先已选机器、在线机器、其他可用机器
  - 节点内容区不使用内部滚动条；参数多时由节点高度自然增长
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
- 共享工作流的真实执行归属仍在机器层；如果机器离线或不可达，前台应直接收到带机器名和阶段信息的可操作错误

## 当前重点

- 节点参数区优先消费后台定义
- 上游素材聚合要统一，不在单节点各自手搓
- 统一 `comfyui` 节点继续向纯消费节点收口
