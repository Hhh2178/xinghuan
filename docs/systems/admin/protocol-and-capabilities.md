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

## 边界说明

- ComfyUI 主编辑面在后台，不回退到画布节点里治理。
- 画布里的 `comfyui-app` 节点只消费共享 schema，不拥有治理权。
- Hermes 接入的 AI 分析和 RH 工作台里的辅助分析不是同一套外部接入。
- RH 的当前分析能力以本项目内代码推断为主，再结合样例结构生成草案。
