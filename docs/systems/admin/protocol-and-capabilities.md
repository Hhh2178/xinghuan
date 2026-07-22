# Admin 协议与能力边界

## 当前高频后台能力

- Provider 与模型治理
- RunningHub 条目治理
- ComfyUI 实例池治理
- 系统并发与运行态观测
- 环境同步
- 用户、会话、任务、审计查看

## ComfyUI 后台治理模型

- `管理员` 才能创建、编辑、删除 ComfyUI 机器实例。
- `管理员` 才能管理实例工作流草稿、修改暴露参数口、默认值、输出口，并执行 `推送到共享区`。
- 每台机器先拥有自己的实例工作区，不直接把共享区当主编辑源。
- 实例记录至少包含：
  - `id / name / tailscaleAddress`
  - `baseUrl`：灰度 / production 后端实际执行地址
  - `reportedBaseUrl`：connector 上报的机器本地 ComfyUI 地址
  - `baseUrlSource`：当前执行地址来自 `manual` 还是 `connector`
  - `health / concurrency / capabilities`
  - `connectorVersion / lastSeenAt`

## 实例工作流卡片能力

- 编辑标题与描述
- 编辑暴露参数口
- 编辑默认值
- 编辑输出定义
- 查看当前共享发布状态
- 一键 `推送到共享区`

## RunningHub 后台能力

- 新建 / 删除 / 另存为 / 启停
- 测试条目
- AI 分析并填写
- 同步输入槽
- 输出定义与执行规则编辑

## 系统页能力

- 修改并发设置
- 查看按类别并发
- 查看实际生效并发
- 查看 Worker 数与槽位数
- 查看 RH 平台窗口
- 查看 ComfyUI 机器 heartbeat 与健康状态
- 区分查看“机器本地地址”和“后端执行地址”，避免把 `8188` 与隧道 / 反向代理地址混为一谈

## 智能体与自动化工作域

- 使用独立 `/admin/automation/*` 深链，不与“后台 AI 助手显示设置”混用。
- 角色、LLM 路由、质量和知识采用不可变版本；审核状态与 Gray/Production publication 分离。
- LLM 路由池只接受已启用的 `chat` 模型，不能添加图片、视频或音频生成模型。
- 路由模拟读取当前健康状态并复用生产路由器，但不写真实路由决策。
- 工具列表来自代码固定注册表；Admin 只能收紧平台/用户组/用户策略，不能注册任意 Shell 或 HTTP。
- 节点能力页读取代码维护的 Node Capability Catalog，展示节点用途、计划/runtime 状态、端口 cardinality、推荐上下游、模型提示、失败码与 Agent 动作；它同时是 planner/manager/checker/recovery 的受控上下文来源，不允许后台把 legacy 节点标记为 native。
- 环境 kill switch 默认关闭，分别控制 Agent、Canvas Run、质量评估和自动恢复；暂停和取消保持可用。
- 失败恢复页面展示同配置重试、参数修复、节点已有备选生成模型、审批和停止决策。
- 所有创建、审核、发布、回滚、策略、开关和审批写操作追加后台审计。

## 权限治理交互

- Subject 发布状态使用 revision 并发保护。
- metadata 同步必须语义幂等，JSON 对象键顺序变化不得增加 revision。
- `409 PERMISSION_SUBJECT_REVISION_CONFLICT` 返回最新 revision；后台刷新当前 Subject，并仅在目标状态仍未达成时安全重试一次。
- 发布/受限操作的成功或失败必须显示在对应 Subject 行内，不能只在页面顶部显示全局错误。

## 边界说明

- ComfyUI 主编辑面在后台，不回退到画布节点里治理。
- 画布里的 `comfyui-app` 节点只消费共享 schema，不拥有治理权。
- 内部 Agent 的 Provider 分析和 RH 工作台里的规则辅助分析共享受控数据契约，但只有 Agent 路径使用已发布的 LLM Routing Pool。
- RH 的当前分析能力以本项目内代码推断为主，再结合样例结构生成草案。
