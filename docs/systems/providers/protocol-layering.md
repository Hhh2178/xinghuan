# Provider 协议分层

## 三层结构

1. 默认 provider 结构层
2. 高级配置层
3. 协议 / adapter / connector 层

## 当前判断顺序

- 先看能否落在默认 provider 结构层
- 只是参数和请求体映射差异时优先落高级配置层
- 真正存在机器连接、实例治理、心跳汇报时再新增 adapter 或 connector

## ComfyUI Connector

- `Tailscale` 只负责机器连通，不承担业务治理。
- 机器侧运行 `apps/comfyui-connector`，通过 `XINGHUAN_COMFYUI_CONNECTOR_TOKEN` 调用：
  - `POST /api/internal/comfyui/connectors/register`
  - `POST /api/internal/comfyui/connectors/heartbeat`
- Connector 会把 `baseUrl`（灰度后端可执行地址）与 `reportedBaseUrl`（机器本地 ComfyUI 地址）分层回写到后台实例池。
- 后台手工固定过执行地址后，后续 heartbeat 只继续刷新 `reportedBaseUrl / health / capabilities / connectorVersion`，不再覆盖手工执行地址。
- Connector harness 入口：
  - workspace 说明：`apps/comfyui-connector/README.md`
  - 环境模板：`apps/comfyui-connector/.env.example`
  - systemd 模板：`ops/systemd/xinghuan-comfyui-connector.service.example`
  - 工程契约：`npm run verify:comfyui-connector-harness`

## ComfyUI 分层约束

- 先维护 `实例专属工作流`，不再把长期治理主源塞回 provider 配置。
- 实例草稿可编辑暴露参数口、默认值、输出定义。
- 只有管理员才能执行 `推送到共享区`，把机器草稿发布成共享目录。
- 画布只消费 `GET /api/comfyui/apps` 暴露的共享工作流，节点类型为 `comfyui-app`。
- 画布实际运行不再复用通用图像代理，而是走 `POST /api/comfyui/apps/:workflowId/run` 的专用执行入口。

## 当前典型样本

- ModelScope 图像协议兼容
- RunningHub 条目治理
- ComfyUI Connector + 实例专属工作流 + 推送到共享区
