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

- Canvas JSON 顶层 `workflows[]` 保存 workflow registry、稳定 workflow ID/revision、显式成员、变量定义、draft input values 和节点字段 binding。节点 JSON 不是变量权威；画布加载、保存、revision reload、导入导出和离屏写入必须保留该顶层字段。
- Workflow Variable 支持 `text | image | video | audio | number | select`。文本编辑语法为 `##变量名##`，内部 binding 使用稳定 variable ID；`\##字面量##` 表示不参与绑定的字面量。名称按 NFKC、trim 和大小写归一，视觉同名、内部保留名、未知/未闭合 token 和类型不匹配均拒绝运行。
- Text 节点支持固定文本、整段变量和模板文本。变量面板只展示当前字段引用；改名必须同步更新未转义 token 与 binding segment，不能依赖运行时字符串替换。
- Upload 节点可绑定 image/video/audio 强类型变量。当前兼容层把 owner-scoped 上传 URL 放入 `{ kind, assetId }`；待 Resource Asset UUID 成为统一上传权威后再前向迁移，历史 Run snapshot 不回写。
- `workflow-variables` 是不参与连线或执行的控制节点，每个 workflow 最多一个；变量真值仍在顶层 workflow document，删除控制节点不会删除定义。节点展示本次值、引用节点序号和定位动作。
- Workflow Region 使用顶层 workflow document 的显式成员和 `region { x, y, width, height, color }`。区域是不透明实色底板，自动选择前景对比色；拖动标题联动全部成员，缩放、调色和节点内容增高只更新视觉几何，不增加 workflow revision。
- 新成员加入时区域自动扩张并完整包住节点；扩张、创建或缩放若会与另一 Workflow Region 重叠则拒绝。单节点只能属于一个 workflow，选中节点组任一成员创建区域时必须展开完整显式组。
- `workflow-input` / `workflow-output` 是强类型边界节点。普通边不能穿越 workflow 边界；输入节点必须绑定同 workflow、同类型变量，服务端仍在编译时独立验证，不能只信任前端连接提示。

- 节点序号徽标使用单一稳定宿主包装节点组件，宿主以 `display: contents` 保持原布局；不得再用 Fragment 把节点主体和徽标作为 ReactFlow 下的并列根节点，避免运行态条件渲染触发 DOM `insertBefore` 冲突。
- 图片、视频、LLM、音频等后台目录生成节点在同一稳定宿主左上角复用 `NodeCostBadge`：角标位于节点框外，左边缘与节点对齐，底边贴住节点顶边；当前模型无有效价格时完全不渲染；模型/Provider 切换显示当前报价；任务开始后通过 `taskId/taskIds` 切换为价格快照结算状态。
- 费用快照只有在 `model_id_snapshot` 与当前 `backendModelId` 一致时覆盖报价，避免切换模型后继续显示上一轮任务金额。
- 图像操作节点只消费图片。若旧连线或上游上传类型变化后传入视频、音频或文本，运行态必须返回可操作的类型不匹配提示，不得向用户暴露 `UPSTREAM_IMAGE_NOT_FOUND` 等内部错误码。
- 视频需要调整画面尺寸时，当前标准链路是先经过“首尾帧获取”或“视频抽帧”得到图片，再连接“图像尺寸调整”；该节点不承担视频转码职责。
- `/api/image/resize`、`upscale`、`crop`、`combine` 由主 API 的独立图片操作路由承接；输入仅解析当前用户自己的 input/output 文件或图片 data URL，输出写回该用户 output 并登记为生成素材。

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
  - 自动输出带 `autoCreatedBy: text-split-run`、来源节点和顺序标识；重新运行时按来源和分段索引原位更新已有节点，保留用户调整的位置、节点数组顺序和已有下游连线。
  - 分段增加时只追加新索引节点；分段减少时只删除超出新数量的节点及其关联边，不刷新仍然存在的输出拓扑。

## 模板数据边界

- 工具栏模板入口只负责打开 `WorkflowTemplateModal`。
- 模板弹层与资源库统一读取公共资源 `kind=workflow`，不再保留静态模板数组。
- 缩略图优先使用资源 `thumbUrl`；缺失时由共享 `WorkflowTopologyCard` 渲染拓扑预览。

## 模型目录展示顺序

- `/api/models` 先按 Provider `sortOrder`，再按模型 `sortOrder` 输出。
- 图像、视频、音频和 LLM 节点共享该目录顺序，不在各节点维护独立排序副本。
- 后台重排仅改变展示顺序，不改变模型 ID、权限 Subject、执行路由或历史画布选择。

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
