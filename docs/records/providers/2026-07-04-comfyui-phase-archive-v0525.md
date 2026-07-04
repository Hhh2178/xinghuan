# ComfyUI 阶段封存（v0.5.25）

## 文档定位

这份文档用于封存当前无限画布 2.0 中 ComfyUI 板块截至 `2026-07-04` 的阶段成果、技术设计、接口边界、运行状态和未完成项。

适用场景：

- 后续重新恢复 ComfyUI 板块开发
- 重新接入本机或多机 ComfyUI 算力
- 排查实例池、共享工作流、前台 `comfyui` 节点与 connector 链路问题
- 判断后续继续走 `SSH 反向隧道` 还是 `Tailscale 直连`

## 封存边界

- 产品阶段：ComfyUI 第一轮前后台治理已落地，统一前台节点已收口到单一 `comfyui`
- 代码阶段：当前主开发现场是 `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`
- 线上阶段：
  - gray 当前在线版本：`v0.5.25`
  - gray 当前 release：`20260704-comfyui-machine-first-gray-r1-v0525`
  - production 当前在线版本：`v0.5.22`
  - production 当前 release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 研发现场状态：
  - 已落成并提交的关键批次：
    - `3864e8d feat: unify comfyui node machine governance`
    - `6de781c fix: make comfyui node machine-first`
    - `e88f35e docs: sync v0.5.25 gray release entries`
  - 当前 worktree 还保留一批未发布的地址语义/状态修复改动，尚未推 gray

## 封存结论

截至 `2026-07-04`，ComfyUI 板块可以视为“产品结构已完成第一轮收口，但运行链路尚未闭环”的封存状态：

- 可以封存的部分：
  - 后台实例池、实例下工作流、共享工作流区、前台统一 `comfyui` 节点的形态已经明确
  - 机器优先、工作流次级、共享消费的三层结构已经稳定
  - connector / harness / admin / canvas 的职责分层已经具备继续扩展的基础
- 不能误判为“已完全打通”的部分：
  - gray 当前仍没有真实稳定地跑通本机 ComfyUI 工作流
  - 实例显示在线不等于 gray 后端当前真的可执行
  - 本机 `8188` 与 gray 执行地址 `28188` 的语义虽然在本地修复批次中已经厘清，但这轮修复尚未发布到 gray

因此，本次封存的含义是：

- 把 ComfyUI 的产品设计、接口设计、参数语义、当前运行态和风险完整存档
- 暂停继续扩散修改
- 等后续需求重新开启时，从这份文档恢复推进，而不是重新靠聊天记录回忆

## 目标与思路

当前 ComfyUI 方案的核心思路不是让画布直接治理 ComfyUI 草稿，而是分三层：

1. 机器层
   - 每台 ComfyUI 机器先作为一个 `实例`
   - 机器由后台统一管理连接地址、能力、并发、备注、connector 信息

2. 工作流治理层
   - 每台机器下维护自己的 `实例专属工作流`
   - 上传本地 JSON 后，后台解析输入项、输出项、默认值、可暴露参数、机器绑定
   - 管理员可以编辑暴露参数口、默认值和输出定义

3. 共享消费层
   - 机器工作流通过 `推送到共享区` 进入共享目录
   - 前台画布只消费共享目录，不直接维护工作流草稿
   - 前台最终只保留一个正式可见节点：`comfyui`

这套结构的目标是：

- 后台治理复杂性，前台只消费结构化 schema
- 支持机器级工作流差异化
- 允许未来扩展到多台 ComfyUI 算力实例池
- 避免“一个工作流绑死一个前台定制节点”的长期失控

## 当前已完成的能力

### 1. 后台实例池治理

已落地：

- ComfyUI 实例池概览页
- ComfyUI 实例详情页
- 实例基础配置
- 工作流草稿管理
- 本地 JSON 导入工作流
- `推送到共享区`
- 连接测试 API

关键文件：

- `apps/admin/src/admin-comfyui-overview.tsx`
- `apps/admin/src/admin-comfyui-detail.tsx`
- `apps/admin/src/admin-comfyui-workflow-card.tsx`
- `apps/api/src/comfyui-instance-routes.ts`
- `apps/api/src/comfyui-workflow-registry.ts`

### 2. 共享工作流公开目录

已落地：

- `GET /api/comfyui/apps`
- 后台共享工作流目录对前台公开
- 前台通过共享 schema 渲染参数和输出

关键文件：

- `apps/api/src/comfyui-public-routes.ts`
- `apps/web/src/services/comfyuiApps.ts`
- `apps/web/src/utils/comfyuiApps.ts`

### 3. 前台统一 `comfyui` 节点

已落地：

- 旧三节点向单一 `comfyui` 节点收口
- 节点选择层级改为 `先机器，后工作流`
- 节点不再内部滚动，参数多时自动增高
- 对外保持单一主输出口
- 后端执行错误翻译不再暴露裸 `fetch failed`

关键文件：

- `apps/web/src/components/nodes/ComfyUIApplicationNode.tsx`
- `apps/web/src/components/nodes/ComfyUINodeSelectorSection.tsx`
- `apps/web/src/components/nodes/comfyuiNodeHelpers.ts`
- `apps/api/src/comfyui-execution.ts`

### 4. Connector 与机器注册

已落地：

- 机器侧 `@xinghuan/comfyui-connector`
- connector register / heartbeat 内部接口
- connector harness、env 模板、systemd 模板、契约脚本

关键文件：

- `apps/comfyui-connector/src/config.ts`
- `apps/comfyui-connector/src/heartbeat.ts`
- `apps/comfyui-connector/src/connector.ts`
- `ops/systemd/xinghuan-comfyui-connector.service.example`

## 技术结构快照

### A. 实例记录

当前实例记录围绕以下字段：

- `id`
- `name`
- `tailscaleAddress`
- `baseUrl`
  - 含义：后端实际执行地址
- `reportedBaseUrl`
  - 含义：connector 上报的机器本地 ComfyUI 地址
- `baseUrlSource`
  - 含义：执行地址来自 `manual` 还是 `connector`
- `health`
- `concurrency`
- `capabilities`
- `lastSeenAt`
- `connectorVersion`
- `note`

说明：

- 当前 gray 线上还未部署 `reportedBaseUrl / baseUrlSource` 这轮修复，所以线上实例记录仍是旧结构
- 本地 worktree 已补齐这组语义

### B. 工作流草稿

每个实例工作流草稿围绕以下字段：

- `id`
- `instanceId`
- `title`
- `description`
- `workflowJson`
- `analysis`
- `inputSchema`
- `defaultValues`
- `hiddenFields`
- `outputSchema`
- `instanceBindings`
- `sharedWorkflowId`
- `publishedAt / publishedBy`

### C. 前台节点状态

统一 `comfyui` 节点当前核心状态：

- `comfyuiWorkflowId`
- `comfyuiInstanceId`
- `comfyuiParamValues`
- `comfyuiSearchQuery`
- `outputs`

## 接口快照

### 后台治理接口

- `GET /api/admin/comfyui/instances`
  - 返回实例列表、共享工作流摘要、工作流总数
- `POST /api/admin/comfyui/instances`
  - 新建实例
- `PATCH /api/admin/comfyui/instances/:instanceId`
  - 修改实例基础信息
- `POST /api/admin/comfyui/instances/:instanceId/test-connection`
  - 测试实例连接
- `POST /api/admin/comfyui/instances/:instanceId/heartbeat`
  - 后台人工/调试用心跳刷新
- `GET /api/admin/comfyui/instances/:instanceId/workflows`
  - 读取实例专属工作流
- `POST /api/admin/comfyui/instances/:instanceId/workflows`
  - 创建工作流草稿
- `PATCH /api/admin/comfyui/instances/:instanceId/workflows/:workflowId`
  - 修改标题、暴露参数、默认值、输出定义
- `POST /api/admin/comfyui/instances/:instanceId/workflows/:workflowId/push-to-shared`
  - 推送到共享区

### 前台消费接口

- `GET /api/comfyui/apps`
  - 返回共享工作流目录和关联实例摘要
- `POST /api/comfyui/apps/:workflowId/run`
  - 共享工作流执行专用入口
  - 后端负责选择实例、注入参数、上传输入、提交 prompt、轮询 history、转存输出

### Connector 内部接口

- `POST /api/internal/comfyui/connectors/register`
- `POST /api/internal/comfyui/connectors/heartbeat`

Header：

- `x-comfyui-connector-token`

## 关键载荷语义速查

### 1. connector register / heartbeat 请求体

当前 connector 上报的核心字段：

- `id`
- `name`
- `tailscaleAddress`
- `baseUrl`
  - 后端实际执行地址
- `reportedBaseUrl`
  - 机器本地 ComfyUI 地址，通常是 `http://127.0.0.1:8188`
- `baseUrlSource`
  - 当前约定为 `connector`
- `concurrency`
- `connectorVersion`
- `note`
- `capabilities`
- `health`
- `heartbeatIntervalMs`

本地修复批次的关键语义是：

- connector 继续可以上报执行地址
- 但当后台实例已经被管理员手工切成 `manual` 地址后，heartbeat 不应再覆盖 `baseUrl`
- `reportedBaseUrl` 只负责保留“机器本地 ComfyUI 实际监听口径”

### 2. 后台实例修改请求体

`PATCH /api/admin/comfyui/instances/:instanceId`

关键字段：

- `name`
- `tailscaleAddress`
- `baseUrl`
  - 后台可编辑字段，含义是“后端执行地址”
- `reportedBaseUrl`
  - 只读/辅助展示语义，表示机器本地地址
- `concurrency`
- `capabilities`
- `note`

关键约束：

- 只要后台这次 PATCH 带了新的 `baseUrl`，本地修复批次就会把 `baseUrlSource` 切成 `manual`
- 这样后续 connector heartbeat 不会把管理员确认过的执行地址冲掉

### 3. 后台工作流草稿创建 / 更新请求体

实例工作流的核心结构围绕：

- `workflowJson`
- `inputSchema`
- `exposedFields`
- `defaultValues`
- `hiddenFields`
- `outputSchema`
- `instanceBindings`

这组字段的目标是：

- `workflowJson` 保留原始 ComfyUI 工作流
- `inputSchema / exposedFields / hiddenFields` 负责“哪些输入参数暴露到前台节点”
- `defaultValues` 负责节点默认值
- `outputSchema` 负责“哪些输出被收束到前台单一主输出口及其命名输出”
- `instanceBindings` 负责共享工作流允许跑在哪些实例上

### 4. 前台共享工作流运行请求体

`POST /api/comfyui/apps/:workflowId/run`

请求体核心字段：

- `instanceId`
  - 可选；前台明确选择某台机器时传入
- `userParams`
  - 前台节点当前暴露参数值
- `inputs`
  - 画布上传入的图片、视频、音频等素材引用

执行链路语义：

- 后端按共享工作流定义装配 prompt
- 先处理媒体输入上传
- 再提交 ComfyUI prompt
- 再轮询 history
- 最后把输出素材转存到平台输出区并回传统一输出

### 5. 前台运行成功响应

核心返回字段：

- `workflowId`
- `sharedWorkflowId`
- `instanceId`
- `instanceName`
- `promptId`
- `outputs`
- `imageUrls`
- `videoUrls`
- `audioUrls`
- `text`

当前前台节点的目标不是暴露 ComfyUI 原生 history 细节，而是把结果收束成和 RH 类似的消费口径。

## 技术参数与环境参数

### Gray / Production

- gray 域名：`canvas-next.hhh2121.xyz`
- gray 服务地址：`127.0.0.1:18200`
- production 域名：`canvas.hhh2121.xyz`
- production 服务地址：`127.0.0.1:18100`

### 本机 ComfyUI 现状

用户当前机器上的 ComfyUI 本地监听口径：

- 本机 ComfyUI 地址：`http://127.0.0.1:8188`

### 当前反向隧道口径

当前 gray 历史上实际执行使用过的后端执行地址：

- gray 后端执行地址：`http://127.0.0.1:28188`

说明：

- 这个 `28188` 不是用户机器上 ComfyUI 自己的监听端口
- 它是 gray 服务器本地访问用的转发入口
- 当前这条链路原本依赖 `SSH reverse tunnel`

### Connector 相关环境变量

关键变量：

- `XINGHUAN_COMFYUI_CONNECTOR_API_BASE_URL`
- `XINGHUAN_COMFYUI_CONNECTOR_TOKEN`
- `XINGHUAN_COMFYUI_INSTANCE_ID`
- `XINGHUAN_COMFYUI_INSTANCE_NAME`
- `XINGHUAN_COMFYUI_TAILSCALE_ADDRESS`
- `XINGHUAN_COMFYUI_BASE_URL`
  - 机器本地 ComfyUI 地址，默认 `http://127.0.0.1:8188`
- `XINGHUAN_COMFYUI_REGISTER_BASE_URL`
  - 注册到后台的执行地址
- `XINGHUAN_COMFYUI_CONCURRENCY`
- `XINGHUAN_COMFYUI_CONNECTOR_VERSION`
- `XINGHUAN_COMFYUI_NOTE`
- `XINGHUAN_COMFYUI_HEARTBEAT_MS`

## 当前运行状态快照（2026-07-04）

以下状态已在封存前重新验证：

### A. gray API 状态

- `https://canvas-next.hhh2121.xyz/api/status`
  - `version = 0.5.25`
  - `environment = gray`

### B. gray 实例池注册表

当前 gray 注册表快照：

- `revision = 3872`
- `instanceCount = 1`
- `workflowCount = 1`
- `sharedWorkflowCount = 1`

当前实例：

- `id = comfyui-chinami-lrlmfij-gray`
- `name = Local ComfyUI CHINAMI-LRLMFIJ`
- `baseUrl = http://127.0.0.1:28188`
- `health = online`
- `connectorVersion = 0.5.22`

### C. 连通性实测

在 gray 服务器上直接验证：

- `http://127.0.0.1:28188/system_stats`
  - 结果：`Connection refused`
- `http://100.83.71.85:8188/system_stats`
  - 结果：`timeout`

结论：

- gray 当前虽然显示有 1 台在线 ComfyUI 实例
- 但截至封存时，这台实例并不能真实执行工作流
- 当前线上 `health=online` 与真实可执行状态不一致

### D. Tailscale 直连现状

gray 服务器当前未安装 `Tailscale`，因此：

- 服务器不能直接通过 tailnet 地址访问用户本机 `8188`
- 当前若想使用本机 ComfyUI，仍只能依赖反向隧道或其它转发方式

### E. 当前恢复前的硬前提

如果后续要重新恢复 ComfyUI 推进，必须先确认下面三件事中的至少一条已经成立：

- gray 后端存在一个真实可达的执行地址，并且 `POST /api/admin/comfyui/instances/:id/test-connection` 通过
- 反向隧道已经常驻化，且 `127.0.0.1:28188/system_stats` 可达
- gray 服务器已经接入 tailnet，且目标机器 `8188` 可直连

在这三件事都没成立之前，不应再把问题归因到前台节点 UI 本身。

## 当前问题与风险

### 1. 线上状态与真实连通性不一致

现象：

- 后台实例卡片可能显示“在线”
- 测试连接实际报 `ECONNREFUSED`
- 真实运行会失败

原因：

- 旧线上逻辑主要信任 connector 心跳写入的 `health`
- 未把 stale heartbeat 或实际连接失败强约束成 `offline / degraded`

### 2. 地址语义混淆

混淆点：

- 用户认知里的机器地址：`8188`
- gray 实际执行地址：`28188`
- 旧后台 UI 只展示一个 `Base URL`

结果：

- 容易误以为“后台应该直接填 8188”
- 容易误判“地址修改没生效”其实是被 heartbeat 冲回

### 3. 反向隧道方案未工程化

当前风险：

- 隧道断开后，后台还可能继续显示在线
- 隧道没有形成稳定的长期守护链路
- connector、隧道、ComfyUI 本体的启动顺序和恢复顺序未固定

## 已完成但尚未推 gray 的修复批次

当前 worktree 内已完成、已验证但尚未发布的修复方向：

1. 实例地址语义分层
   - `baseUrl` 作为后端执行地址
   - `reportedBaseUrl` 作为机器本地地址
   - `baseUrlSource` 区分 `manual / connector`

2. connector 心跳不再覆盖手工执行地址

3. 概览页和详情页分开展示：
   - `后端执行地址`
   - `机器本地 ComfyUI 地址`
   - `地址来源`

4. 健康状态显示收口
   - stale heartbeat 应判离线
   - 连接测试失败应降为 `degraded`

对应验证脚本：

- `scripts/verify-comfyui-instance-address-semantics.ts`
- `scripts/verify-admin-comfyui-instance-address-ui-contract.mjs`
- `npm run harness:verify:comfyui`

说明：

- 这批修复当前只在 `xinghuan-integration-clean` 工作树中成立
- gray 线上当前尚未包含这轮修复

## 适合后续继续推进的两个方案

### 方案 A：继续走 SSH 反向隧道

优点：

- gray 服务器不用安装 Tailscale
- 可以较快恢复一条可执行链路

要求：

- 固定执行地址为服务器侧转发口
- 隧道常驻、自动重连、自动恢复
- connector、ComfyUI、本机隧道形成固定启动顺序
- 健康检查必须绑定真实执行地址

### 方案 B：改为 Tailscale 直连

优点：

- 地址语义更直观
- 更适合多机实例池长期管理
- 排障更直接

要求：

- gray / production 服务器都要接入 tailnet
- 安全和 ACL 需要单独治理
- 服务器侧运维复杂度会上升

## 当前建议

如果后面短期只是为了先恢复可执行链路：

- 优先把反向隧道方案工程化

如果后面目标是长期接多台不同电脑的 ComfyUI 算力：

- 逐步迁移到 Tailscale 直连

建议的节奏：

1. 先把当前 worktree 中的地址语义修复推 gray
2. 选定一条稳定执行链路
3. 重新做一次共享工作流真实执行验收
4. 再继续做多机实例池和工作流共享区深化

## 后续恢复工作时的第一跳

建议恢复顺序：

1. `AGENTS.md`
2. `docs/INDEX.md`
3. 本文档
4. `docs/systems/providers/protocol-layering.md`
5. `docs/systems/admin/protocol-and-capabilities.md`
6. `docs/systems/api/interface-map.md`
7. `docs/systems/canvas/node-and-data-model.md`
8. `docs/logbooks/releases/gray/2026-07-04-comfyui-machine-first-gray.md`

## 关键参考材料

系统知识：

- `docs/systems/providers/protocol-layering.md`
- `docs/systems/admin/protocol-and-capabilities.md`
- `docs/systems/api/interface-map.md`
- `docs/systems/canvas/node-and-data-model.md`
- `docs/systems/canvas/project-and-material-flow.md`
- `docs/systems/harness/subharness-convention.md`

发布与运行态：

- `docs/logbooks/releases/current-release-index.md`
- `docs/logbooks/releases/gray/2026-07-04-comfyui-machine-first-gray.md`
- `docs/logbooks/releases/gray/2026-07-03-comfyui-icon-fix-and-connector-harness-activation-gray.md`
- `ops/current/gray.md`

当前研发现场：

- `apps/api/src/comfyui-instance-routes.ts`
- `apps/api/src/comfyui-workflow-registry.ts`
- `apps/api/src/comfyui-public-routes.ts`
- `apps/api/src/comfyui-execution.ts`
- `apps/admin/src/admin-comfyui-overview.tsx`
- `apps/admin/src/admin-comfyui-detail.tsx`
- `apps/web/src/components/nodes/ComfyUIApplicationNode.tsx`
- `apps/comfyui-connector/src/connector.ts`
- `apps/comfyui-connector/src/heartbeat.ts`
