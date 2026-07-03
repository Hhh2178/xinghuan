# v0.1.0 Progress

## 当前状态

状态：当前 gray 已运行在 `v0.5.24`，production 仍运行在 `v0.5.22`。早期 `Phase 3` 任务与素材闭环已经完成，不再作为当前阶段口径；当前重点是 ComfyUI RH 风格统一节点验收、机器池与共享工作流链路打磨、项目级 harness、发布链路一致性和主入口状态收口。`2026-07-03` 已完成 ComfyUI RH 风格统一节点灰度发布：单一 `comfyui` 节点、工作流与机器双选择、displayTier / instanceBindings 治理、legacy 节点迁移与 ComfyUI 子 harness 收口。当前 gray 已切到 `20260703-comfyui-rh-node-machine-gray-r1-v0524`，production 仍在 `20260702-envsync-admin-sections-prod-r1-v0522`；当前 `https://canvas-next.hhh2121.xyz/api/status` 返回 `version = 0.5.24`，production `/api/status` 仍返回 `version = 0.5.22`。

当前与本版本最相关的最新状态：

- 2026-07-03 已完成 ComfyUI 后台实例池管理界面重构：新增 `admin-comfyui-overview.tsx`（仪表盘概览页）、`admin-comfyui-detail.tsx`（实例详情页，支持基本配置、工作流管理、执行日志三个标签页）、`admin-comfyui-instances-panel.tsx`（路由组件），完整 CSS 样式已添加到 `apps/admin/src/styles.css`。
- 2026-07-03 已补齐后端测试连接 API：新增 `POST /api/admin/comfyui/instances/:id/test-connection`，支持延迟检测、GPU/VRAM 实时监控、队列状态查询，返回 `systemStats`（devices/vram）和 `queueInfo`（running/pending）。
- 2026-07-03 已补齐服务端 ComfyUI Connector 环境变量配置：`config/.env.example` 新增 `XINGHUAN_COMFYUI_CONNECTOR_TOKEN` 配置项，与机器侧 connector 共享认证 token。
- 2026-07-03 ComfyUI connector 机制已完整实现：机器侧 `@xinghuan/comfyui-connector` 通过 `POST /api/internal/comfyui/connectors/register` 注册实例，每 15 秒发送心跳到 `POST /api/internal/comfyui/connectors/heartbeat`，自动探测健康状态和能力标签。
- 2026-07-02 已在 `xinghuan-integration-clean` 干净整合分支上补齐 `apps/comfyui-connector` 的 harness 工程骨架：新增 connector config 模块、workspace README、`.env.example`、systemd 模板与 `verify:comfyui-connector-harness` 契约脚本，后续多机器接入可以按统一模板继续扩展。
- 2026-07-02 已补齐共享 ComfyUI 工作流的专用执行入口：新增 `POST /api/comfyui/apps/:workflowId/run`，由后台负责实例选择、参数注入、prompt 提交、history 轮询与输出转存，前台 `comfyui-app` 节点不再绕通用图像代理执行。
- 2026-07-02 已补齐项目级 harness 入口层：新增 `docs/systems/harness/`、根级 `harness:verify:*` 聚合命令与 `verify:project-harness-contract`，当前仓库开始具备 workspace / verify / release / integration 四层统一执行地图。
- 2026-06-30 已将旧工作流导入兼容从 `llm` 扩展到 `video` 节点：导入与恢复画布时会清理旧 `status / taskId / taskRuns / videoUrl / remoteVideoUrls` 等运行态，避免视频节点偶发卡死。
- 2026-06-30 已新增前端“性能优化”手动开关：顶栏中部可在正常模式与优化模式间切换，默认关闭，选择会跨刷新与重新登录保留；开启后前端会关闭鼠标光晕、星轨动画与画布磨玻璃，以缓解部分电脑上的严重卡顿。
- 2026-06-26 已完成旧工作流导入兼容轻迁移、画布恢复时旧 `llm` 节点清理、以及 workflow 资源摘要字段补齐，等待人工浏览器验收。
- 2026-06-26 已完成“审计页成功用量统计驾驶舱”第一条实现切面：后台审计页现在会基于成功任务展示组、账号、模型和 RH 条目汇总；图片 / 视频 / LLM 已下钻到模型，RunningHub 已下钻到后台条目快照。
- 2026-06-28 已完成“审计页账号级模型与 RH 条目下钻”第二条实现切面：管理员现在可以先选账号，再查看该账号下各模型与各 RH 条目的成功次数和最近使用时间，同时继续保留模型与 RH 条目的全局总使用次数统计。
- 2026-06-26 已完成“组权限治理第一批基础链路”：新增分组权限策略存储与 API，公共资源库开始按组直接隐藏无权限资源，RunningHub catalog 开始按组直接隐藏无权限 AI 应用 / 工作流，RH submit 保留后端兜底校验。
- 2026-06-26 已完成“组权限治理后台管理端第一版”：用户页已重构为 `账号 / 用户组 / 权限 / 会话` 四段式工作台，权限页已接入分组权限目录与保存能力，为后续节点能力锁定和公共资源后台卡片化改造打下管理端基础。

- 当前灰度 active release：`20260703-comfyui-rh-node-machine-gray-r1-v0524`
- 当前生产 active release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 当前灰度版本：`v0.5.24`
- 当前生产版本：`v0.5.22`
- 当前本地严格验收已通过：
  - `node scripts/verify-project-harness-contract.mjs`
  - `npm run harness:verify:comfyui`
  - `npm run harness:verify:workspace`
  - `npm run harness:verify:project`
  - `npm run harness:verify:release`
- 当前线上运行态已确认：
  - `https://canvas-next.hhh2121.xyz/api/status => version 0.5.24, environment gray`
  - `https://canvas.hhh2121.xyz/api/status => version 0.5.22, environment production`
  - `/opt/apps/xinghuan-canvas-next/current -> 20260703-comfyui-rh-node-machine-gray-r1-v0524`
  - `/opt/apps/xinghuan-canvas/current -> 20260702-envsync-admin-sections-prod-r1-v0522`
- 当前仍需重点处理：
  - ComfyUI 本地 JSON 工作流导入、参数暴露、默认值编辑、共享区发布和画布节点选择仍需端到端验收
  - 当前 gray 已完成代码、打包、部署与运行态校验，仍待浏览器侧人工验收统一 `comfyui` 节点和后台治理体验
- `Phase D` 当前已补齐：
  - 统一任务取消服务
  - `cancelScope / upstreamSupported / upstreamAttempted` 结构化取消结果
  - worker heartbeat
  - stale task reaper
  - 后台任务分页与筛选
  - 本地串行验收入口 `npm run verify:phase-d`
  - gray release-preflight 打包与服务器执行闭环
  - gray runtime 验收脚本随 release package 同步分发
  - production release-preflight 打包与服务器执行闭环
  - production runtime 验收通过
- 当前仍未完成的下一阶段重点：
  - 更完整的任务补偿、上游取消样本与外部通知闭环
  - `requestId` 实际覆盖率继续提升
  - 将生成库素材访问层继续复用到更多素材读取场景
  - 修补 release 目录 `db:migrate` 的 `PG_DRIVER_NOT_INSTALLED` 依赖链缺口

`2026-06-06` 至 `2026-06-12` 的产品能力推进仍保持有效：Worker 输出素材落库、素材空间读取闭环、取消 / 重试、Worker 取消保护、画布 / 素材 PostgreSQL repository 热修复、RunningHub 工作流字段映射第一版、Provider 文件签名短链、后台发布模型统一任务化、Provider 分类队列并发、视频/图像上游 JSON 容错等都已完成落地并保留在本文件下方的时间线中。该时间线继续作为版本内历史推进记录保留，但不再单独承担“当前状态”入口职责。

`2026-06-09` 本机继续完成三组问题收口：后台 AI 助手设置页改为本地草稿态 + 明确保存/重置，不再每次输入都触发 PATCH；同时修复关闭态后台助手抽屉仍覆盖主内容点击区的回归，避免真实页面里的“保存 / 重置”按钮被遮挡失效。登录页已去掉默认预填管理员邮箱，前台画布 AI 助手补齐空媒体过滤、可缩放面板和开关后的会话保持；图像、视频、Seedance、音频等生成类节点则新增统一运行态卡片，显示状态、进度和耗时。本机已通过 `verify-admin-assistant-settings-save-contract`、`verify:admin-assistant-ui-contract`、`verify:canvas-assistant-ui-contract`、`verify-login-gate-security-contract`、`verify:admin-auth-passwords`、`verify-node-runtime-card-contract`、`verify:canvas-node-render-smoke` 和 `build:single-port`。浏览器现场已确认：登录页邮箱默认为空、后台 AI 助手设置输入不自动落盘且“重置 / 保存”真实可用、后台顶栏重复入口已移除、前台助手面板支持 `resize: both` 且开关后会话不丢；当前打开的本地验收画布仅含文本节点，因此运行态卡片的真实浏览器观感主要由节点烟测与代码契约覆盖。

`2026-06-09` 同日已将画布助手 UI 自适应修复、模型注意事项移除和可见测试文案清理发布到灰度 release `20260609-152648-canvas-assistant-ui-gray`。服务器新 release 已完成 `npm ci`、`build:single-port`、`db:migrate`、`current` 切换与 API/Worker 重启；服务器本机 `verify:single-port`、`curl http://127.0.0.1:18200/api/status` 和公网 `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz npm run verify:single-port` 均通过。当前灰度浏览器现场已确认：助手空状态下输入框和发送按钮尺寸正常，选中节点后的上下文按钮与“发送当前节点”附件卡片恢复紧凑显示，首页可见画布名称不再显示“测试 / 验收 / smoke”等残留。

`2026-06-08` 同日继续完成 Provider 响应解析模块抽离：聊天文本、图片 URL/base64、视频 URL 和 data URL 转换迁入 `provider-response-parser.ts`，新增 `verify:provider-response-parser-contract`，并在临时单端口服务 `127.0.0.1:18350` 下复验图片、LLM 和视频外部代理。

`2026-06-08` 同日继续修复 GRSAI 图像参考图本地参数问题：此前图像节点把本地上传图作为普通文件短链传给 GRSAI，外部上游可能无法识别或回拉该参考图，导致图生图不参考用户上传图片，并把“unsupported file type”占位提示图当作真实图片保存和下载。现在 API 直连代理和 Worker 的 `grsai_draw` 分支都会把本地 `/files/input/...`、`/files/output/...` 参考图读取并内联为 `data:image/...;base64,...` 后放入 GRSAI `urls` 参数；远程 URL 和已有 data URL 保持原样，OpenAI-like 图像代理继续使用既有 provider-file 签名短链。本机已完成 TDD 红绿验证，并通过 `verify:grsai-reference-images-contract`、`verify-grsai-image-adapter.ts`、API/Worker type-check、API/Worker build、`verify:provider-file-access-contract` 和 `verify:worker-grsai-contract`；当前尚未单独推灰度或生产，旧的已落库占位图也不会被自动清洗。

`2026-06-08` 同日继续完成入口登录页分栏微缩星系 UI 本机收口：登录页桌面端改为左侧轻量伪 3D 微缩星系星图、右侧磨玻璃登录卡片，左侧不再渲染开发描述、标识、说明文字、调试信息或占位入口；移动端回退为登录卡覆盖星云背景，避免横向溢出。本机 `verify:xinghuan-entry-ui`、`type-check -w @xinghuan/web` 和 `build -w @xinghuan/web` 已通过，桌面/移动端临时预览截图已核对，CodeGraph 已同步；当前尚未单独推灰度或生产。

`2026-06-08` 同日继续完成 HTTP 请求与 Session Cookie 工具抽离：`readJsonBody`、Cookie 解析、登录/过期 cookie 构造、Session Cookie 名称和 7 天 TTL 迁入 `http-session-utils.ts`，新增 `verify:http-session-utils-contract`；本机先验证合约脚本红灯为模块缺失，再完成模块抽离并复验绿灯。随后 `type-check -w @xinghuan/api`、`build -w @xinghuan/api` 和 `build:single-port` 通过，并在临时数据目录和临时端口 `127.0.0.1:18352` 下复跑 `verify:single-port`，确认登录、当前用户、管理员接口、成员隔离、文件上传和 SPA fallback 未被破坏。

`2026-06-08` 同日继续完成 API 输入清洗与 MIME 推断工具抽离：`safeText`、`safeEmail`、`safeSlug`、`safeJsonText`、`safeFilename`、`safeUserId` 和 `inferMime` 迁入 `api-sanitizers.ts`，新增 `verify:api-sanitizers-contract`；本机先验证合约脚本红灯为模块缺失，再完成模块抽离并复验绿灯。随后 `type-check -w @xinghuan/api`、`build -w @xinghuan/api` 和 `build:single-port` 通过，并在临时数据目录和临时端口 `127.0.0.1:18353` 下复跑 `verify:single-port`，确认静态资源、上传文件、登录、成员隔离和 SPA fallback 未被破坏；`safeSlug("!!!")` 继续锁定当前返回 `"-"` 的既有行为，后续如需改善应作为行为变更单独验收。

`2026-06-08` 同日继续完成管理后台 API Client 抽离：后台 `api<T>(pathname, options?)` 请求 helper 迁入 `admin-api-client.ts`，新增 `verify:admin-api-client-contract`；本机先验证合约脚本红灯为模块缺失，再完成模块抽离并复验绿灯。随后 `type-check -w @xinghuan/admin`、`build -w @xinghuan/admin` 和 `verify:admin-interaction-guards` 通过，确认后台请求解包、HTTP/业务错误处理、same-origin credentials 和既有危险操作站内弹窗约束未被破坏。

`2026-06-08` 同日继续完成管理后台导航与任务状态 ViewModel 抽离：后台导航项、`titleFor`、`statusText` 和 `taskTone` 迁入 `admin-view-model.ts`，新增 `verify:admin-view-model-contract`；本机先验证合约脚本红灯为模块缺失，再完成模块抽离并复验绿灯。随后 `type-check -w @xinghuan/admin`、`build -w @xinghuan/admin` 和 `verify:admin-interaction-guards` 通过，确认导航顺序、标题 fallback、任务状态文案、状态色和站内确认弹窗约束未被破坏。

`2026-06-08` 同日继续完成管理后台通用展示组件抽离：`DataTable`、`AdminTable`、`FormPanel` 和 `StatusPill` 迁入 `admin-common-components.tsx`，新增 `verify:admin-common-components-contract`；本机先验证合约脚本红灯为模块缺失，再完成组件抽离并复验绿灯。随后 `type-check -w @xinghuan/admin`、`build -w @xinghuan/admin` 和 `verify:admin-interaction-guards` 通过，确认后台通用表格、表单面板、状态胶囊 className/结构和站内确认弹窗约束未被破坏。

`2026-06-08` 同日继续完成管理后台只读面板抽离：`AuditPanel` 和 `SystemPanel` 迁入 `admin-readonly-panels.tsx`，新增 `verify:admin-readonly-panels-contract`；本机先验证合约脚本红灯为模块缺失，再完成面板抽离并复验绿灯。随后 `type-check -w @xinghuan/admin`、`build -w @xinghuan/admin` 和 `verify:admin-interaction-guards` 通过，确认审计日志表格、系统状态表格、共享 DataTable 使用和站内确认弹窗约束未被破坏。

`2026-06-08` 同日根据用户提供的 `stitch_ui_optimization_and_transitions/` 设计文件继续补强入口 UI 交付 Brief：`entry-ui-google-brief.md` 新增设计源使用矩阵、项目接入落点、推荐组件拆分和 Google/Gemini 代码接入顺序，明确设计包只作为视觉语言来源，不直接逐像素照搬；后续入口页仍必须保持左侧无文字/无 logo、右侧深色磨玻璃登录卡、无外链资源、无 SSO/组织网络占位、无坐标/延迟调试文字、无白闪爆发，并在接入代码时重新运行入口 UI 验证、Web type-check 和 Web build。本轮仅做文档收口，未推灰度或生产。

`2026-06-08` 同日按当前讨论新增项目专属 Hermes 助手候选方案备忘：`development/canvas-hermes-assistant-candidate-2026-06-08.md` 记录“复用 Hermes 作为底层内核，但为无限画布建立独立隔离实例”的当前倾向，同时保留前端创作助手与后台审计/配置助手两套能力面的职责划分、权限边界和运行时隔离建议。该文件明确标注为 `候选方案 / 未批准实施`，本轮仅做思路归档，不代表当前版本已经立项、排期或开始开发。

`2026-06-08` 同日继续完成 Provider 灵活配置与视频输入能力开关方案归档：基于当前视频节点失败排查，已确认现有发布模型视频链路并不适合直接覆盖 APIMart 这类异步任务协议。后续 Provider 扩展采用“结构化默认配置 + 受控高级配置 + 专用 adapter”三层方案：模型元数据将从单纯 `inputProfile` 升级为结构化 `inputCapabilities`，后台视频模型补“多参考图 / 首帧 / 尾帧”开关，画布视频节点改为按模型能力动态渲染输入区域，APIMart 视频类模型则通过专用 adapter 处理提交、轮询和结果提取。本轮已将方案同步到 `development/provider-flex-config-and-input-capabilities-2026-06-08.md`、`provider-model-framework.md`、`decisions.md`、`MEMORY.md` 和 `DEVLOG.md`，当前仍是文档归档阶段，尚未进入代码实现或灰度发布。

`2026-06-08` 同日继续完成 Provider 视频能力与 APIMart 适配正式实现和灰度修复：模型元数据已升级为结构化 `inputCapabilities` / `advancedConfig`，后台视频模型可配置 `多参考图 / 首帧 / 尾帧` 开关，画布视频节点可按当前发布模型能力动态切换输入方式；APIMart 视频类模型已通过专用 adapter 处理提交、轮询和结果提取。本机已通过 `type-check -w @xinghuan/model-core`、`@xinghuan/api`、`@xinghuan/admin`、`@xinghuan/web`，并通过 `verify:apimart-video-adapter-contract`、`verify:model-catalog`、`verify:external-video-proxy`、`verify-video-node-backend-inputs-contract` 和 `verify:generic-node-catalog`。灰度首次发布 `20260608-1515-provider-video-capability-gray` 后暴露 PostgreSQL schema 漏迁移：历史 `002_provider_model_framework.sql` 已执行过，新增列 `input_capabilities` / `advanced_config` 不会自动补库；随后新增前向迁移 `004_provider_model_framework_backfill.sql`，发布修复 release `20260608-1535-provider-video-capability-gray-fix` 并在灰度执行 `npm run db:migrate`，成功应用 `004_provider_model_framework_backfill.sql`。修复后灰度服务器已通过 `verify:single-port`、`verify:model-catalog`、`verify:external-video-proxy`、`verify:apimart-video-adapter-contract`、`verify-video-node-backend-inputs-contract` 和 `verify:generic-node-catalog`，公网 `https://canvas-next.hhh2121.xyz/`、`/admin`、`/api/status` 均返回 `200`。

`2026-06-08` 同日继续完成 APIMart 图像异步任务适配和轮询时长配置收口：通过灰度真实 Provider 记录与 APIMart 官方文档共同确认，APIMart `gpt-image-2` 图像接口并不是同步返回图片，而是先返回 `task_id`，再通过 `GET /v1/tasks/{task_id}` 轮询完成态，最终图片位于 `data.result.images[].url[]`。本轮已把图像代理补成“提交返回 `task_id` 则自动轮询”的通用异步模式，同时将视频轮询默认上限提升到 `360s`，后台模型编辑器新增“最大轮询时长（秒）”结构化配置位，保存时写入 `advancedConfig.pollTimeoutMs`。本机已通过 `verify-provider-response-parser-contract`、`verify-admin-api-layout-contract`、`verify-external-image-proxy`、`type-check -w @xinghuan/api`、`type-check -w @xinghuan/admin`、`build -w @xinghuan/admin` 和 `build:single-port`；灰度发布与真实图像/视频回归进入当前收口阶段。

`2026-06-08` 同日继续完成管理后台任务面板抽离：`TasksPanel` 迁入 `admin-task-panel.tsx`，`main.tsx` 导出 `TaskRecord` 供面板复用，并新增 `verify:admin-task-panel-contract`；本机先验证合约脚本红灯为模块缺失、主文件仍内联和类型未导出，再完成面板抽离并复验绿灯。随后 `type-check -w @xinghuan/admin`、`build -w @xinghuan/admin` 和 `verify:admin-interaction-guards` 通过，确认创建测试任务、任务监控列、状态文案/颜色、取消/重试动作、日志摘要、更新时间展示和站内交互守卫未被破坏。当前尚未单独推灰度或生产。

`2026-06-08` 同日继续完成管理后台用户面板抽离：`UsersPanel` 迁入 `admin-users-panel.tsx`，`main.tsx` 导出 `AdminUser` 供面板复用，并新增 `verify:admin-users-panel-contract`；本机先验证合约脚本红灯为模块缺失、主文件仍内联和类型未导出，再完成面板抽离并复验绿灯。随后 `type-check -w @xinghuan/admin` 首次暴露 `Plus` 仍被 Provider/模型/LoRA 区域复用，恢复 import 后 `type-check -w @xinghuan/admin`、`build -w @xinghuan/admin` 和 `verify:admin-interaction-guards` 均通过，确认新增成员、用户表格列、角色/状态展示、重置密码、启用/禁用和站内交互守卫未被破坏。当前尚未单独推灰度或生产。

`2026-06-08` 同日继续完成管理后台总览面板抽离：`Overview` 迁入 `admin-overview-panel.tsx`，`main.tsx` 导出 `Summary`、`ProviderRecord` 和 `ModelRecord` 供面板复用，并新增 `verify:admin-overview-panel-contract`；本机先验证合约脚本红灯为模块缺失、主文件仍内联和类型未导出，再完成面板抽离并复验绿灯。随后 `type-check -w @xinghuan/admin`、`build -w @xinghuan/admin` 和 `verify:admin-interaction-guards` 均通过，确认总览指标卡、Provider 状态、最近任务、模型目录、任务状态文案和站内交互守卫未被破坏。当前尚未单独推灰度或生产。

`2026-06-08` 同日继续完成管理后台手动模型弹窗抽离：`ManualModelDialog` 迁入 `admin-manual-model-dialog.tsx`，`main.tsx` 导出 `Capability` 类型供弹窗 type-only 复用，并把 `capabilityLabel` 从主文件迁入 `admin-view-model.ts` 统一管理；新增 `verify:admin-manual-model-dialog-contract` 并扩展 `verify:admin-view-model-contract`。本机先验证手动模型弹窗合约红灯为模块缺失、主文件仍内联和 helper 边界不满足，再完成抽离并复验绿灯；随后 `verify:admin-view-model-contract`、`type-check -w @xinghuan/admin`、`build -w @xinghuan/admin` 和 `verify:admin-interaction-guards` 均通过，确认手动新增模型弹窗的标题/说明、placeholder、submit/disabled、cancel/loading 图标、能力文案和站内交互守卫未被破坏。当前尚未单独推灰度或生产。

`2026-06-08` 同日继续完成管理后台确认动作弹窗抽离：`ConfirmActionDialog` 迁入 `admin-confirm-action-dialog.tsx`，`main.tsx` 导出 `ConfirmAction` 类型供弹窗 type-only 复用，并新增 `verify:admin-confirm-action-dialog-contract`。本机先验证确认动作弹窗合约红灯为模块缺失、主文件仍内联和类型未导出，再完成抽离并复验绿灯；随后 `type-check -w @xinghuan/admin`、`build -w @xinghuan/admin` 和 `verify:admin-interaction-guards` 均通过，确认 Provider/模型删除的站内确认弹窗、标题/说明/详情/确认文案、cancel/confirm 行为、危险图标、loading 状态和后台交互守卫未被破坏。当前尚未单独推灰度或生产。

`2026-06-08` 同日按用户要求建立当前修复与清理进度文档：新增 `ops/current-fix-cleanup-progress-2026-06-08.md`，集中记录最近后台拆分提交、验证状态、未提交运行期数据和文档清理原则；同时重写 `ops/README.md`，把入口从早期灰度/生产准备材料改为当前运行态、当前灰度材料、当前生产材料和历史发布记录，并将 6 月 4 日旧域名/旧服务器状态、6 月 5 日早期灰度材料从当前入口降级为历史审计证据。本轮清理的是活跃索引中的废旧表述，未批量删除历史发布文件，未触碰运行期 JSON，也未单独推灰度或生产。

无限画布 2.0 已作为新项目初始化文档。旧 Node Banana 改造项目被明确放弃作为后续主干。当前已建立星幻正式工程基线，并将 T8 成熟画板 UI 迁入 `apps/web`；本机生产形态已收敛为 `apps/api` 单端口服务，灰度与生产入口均已建立。后续重点是继续完成后台模块拆分、真实业务验收补齐和按需灰度/生产发布。

## 已完成

- 已完成 ComfyUI 后台实例池管理界面重构：新增仪表盘概览页、实例详情页（基本配置/工作流管理/执行日志三个标签页）、连接测试功能、完整 CSS 样式。
- 已补齐后端测试连接 API：`POST /api/admin/comfyui/instances/:id/test-connection`，支持延迟检测、GPU/VRAM 监控、队列状态查询。
- 已补齐服务端 ComfyUI Connector 环境变量配置：`config/.env.example` 新增 `XINGHUAN_COMFYUI_CONNECTOR_TOKEN`。
- 已完成后台 AI 助手设置页草稿态保存流，支持”保存 AI 助手配置 / 重置未保存修改”。
- 已移除后台顶栏重复 AI 助手入口，仅保留侧栏页签和右侧抽屉开关。
- 已修复关闭态后台 AI 助手抽屉遮挡主内容点击的问题。
- 已移除登录页默认预填管理员邮箱。
- 已完成前台 AI 助手空媒体过滤、可缩放面板和开关后会话保持。
- 已为图像、视频、Seedance、音频等生成类节点接入统一运行态卡片。
- 创建 2.0 项目目录。
- 建立 `AGENTS.md`。
- 建立 `MEMORY.md`。
- 建立 `DEVLOG.md`。
- 建立 `docs/prd/v0.1.0/` 文档集。
- 明确旧项目不再作为继续开发主干。
- 明确核心产品方向：通用生成节点、模型后台、云端项目、用户隔离、任务系统和素材空间。
- 建立首批测试服务商矩阵：GRSAI `gpt-image-2` 和 ToAPIs Grok Video。
- 已归档 Provider 灵活配置与视频输入能力开关方案，确认后续以结构化 `inputCapabilities`、后台视频能力开关和异步视频 adapter 为扩展主线。
- 建立 `.env.local.example`，明确真实 Key 只进本地未提交环境文件、服务器环境变量或后台加密字段。
- 记录 `2026-06-04` 腾讯云服务器状态和旧项目空间占用。
- 创建 Milestone B 独立 worktree：`D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b`。
- 建立星幻 monorepo 工程骨架。
- 建立 Web 工作台占位页。
- 建立 Admin 统一后台占位页。
- 建立 API health/version。
- 建立 Worker 占位服务。
- 建立共享包：`shared`、`ui`、`canvas-core`、`model-core`。
- 迁入 T8 成熟画板 UI 到 `apps/web`。
- 修复 T8 前端迁移后的 Tailwind/PostCSS 样式散乱问题。
- 默认主题切换为星幻科技风。
- 顶部品牌改为 `星幻无限画布`，顶部外部推广入口不再渲染。
- 实现星幻 API 兼容层，画布列表、创建、读取、保存已切到 `apps/api`。
- `/files`、`/input`、`/output` 和资源库最小 CRUD 已切到星幻 API。
- 实现 `apps/api` 托管 `apps/web/dist` 的本机单端口生产服务。
- 关闭 `18300`、`18310`、`18766` 后，`18200` 单端口命令验收和 Chrome 浏览器验收通过。
- 新增 `build:single-port`、`start:single-port`、`verify:single-port` 脚本。
- 新增本机/服务器复用的单端口启动脚本和自动验收脚本。
- 新增灰度环境模板 `config/canvas-next.env.example`。
- 新增灰度部署 runbook、灰度验收清单、Nginx 示例和 systemd 示例。
- 已部署灰度 release `20260605-0903-xinghuan-gray` 到 `canvas-next.hhh2121.xyz`。
- 已启用服务器 systemd 服务 `xinghuan-canvas-next.service`。
- 已配置 Nginx HTTP/HTTPS 到 `127.0.0.1:18200`。
- 已完成公网 HTTP/HTTPS、API、Web、文件上传、SPA fallback 和 Chrome 视觉验收。
- 已实现本机最小登录、退出和当前用户接口。
- 已实现 Web 登录守卫，未登录时展示星幻科技风登录页。
- 已实现画布、输入素材、输出素材和资源库的用户目录隔离。
- 已将自动验收脚本升级为认证流，覆盖未登录拒绝、管理员登录、成员登录和跨用户画布不可见。
- 已明确登录、后台和新增管理界面统一采用星幻科技风；T8 画板主体暂不重做 UI。
- 已部署灰度认证版 release `20260605-1135-xinghuan-auth-gray`。
- 已在服务器灰度环境配置管理员/成员 bootstrap secret，未写入仓库和文档明文。
- 已完成服务器认证流验收和公网 HTTPS 视觉验收。
- 已实现统一后台 `/admin`。
- 已实现后台管理员权限守卫，未登录返回 401，成员返回 403。
- 已实现用户管理、Provider 管理、模型目录、任务监控和系统状态。
- 已部署灰度后台版 release `20260605-1215-xinghuan-admin-gray`。
- 已完成服务器后台自动验收和公网后台视觉验收。
- 已实现 Provider Key 加密落盘和脱敏返回。
- 已实现后台用户密码重置入口。
- 已实现后台审计日志 API 和审计页面。
- 已部署灰度后台安全增强 release `20260605-1245-xinghuan-admin-sec-gray`。
- 已验证本机和服务器 `admin.json` 不包含测试 Key 明文，并包含 `enc:v1` 加密字段。
- 已新增 PostgreSQL 基础 schema `apps/api/db/001_admin_core.sql`。
- 已新增数据库迁移脚本 `scripts/db-migrate.mjs` 和 `npm run db:migrate`。
- 已在 `/api/admin/system` 和后台系统页展示数据库状态。
- 已将自动验收脚本扩展到后台系统数据库状态字段。
- 已部署灰度数据库 readiness release `20260605-1315-xinghuan-db-ready-gray`。
- 已验证本机和服务器未配置数据库时 `npm run db:migrate` 返回 `DATABASE_NOT_CONFIGURED`，退出码 2，符合预期。
- 已验证灰度公网管理员登录后 `/api/admin/system` 返回 `databaseStatus=not_configured`。
- 已在灰度服务器安装并启用 PostgreSQL 16.14。
- 已创建灰度数据库 `xinghuan_canvas_next` 和应用账号 `xinghuan_canvas_next`。
- 已将数据库连接串写入服务器环境文件，未写入仓库或文档。
- 已执行服务器 `npm run db:migrate`，应用 `001_admin_core.sql`。
- 已验证公网管理员登录后 `/api/admin/system` 返回 `databaseStatus=connected`、`databaseConfigured=true`、`migrations=["001_admin_core.sql"]`。
- 已实现 auth/admin PostgreSQL repository，并保留 file fallback。
- 已新增 `scripts/db-import-files.mjs` 和 `npm run db:import-files`。
- 已在后台系统页展示 `storageDriver`。
- 已部署灰度 repository release `20260605-1410-xinghuan-pg-repo-gray`。
- 已导入灰度现有 users=2、sessions=2、providers=5、models=2、tasks=1、auditLogs=3。
- 已将灰度 `XINGHUAN_STORAGE_DRIVER` 切换为 `postgres`。
- 已验证服务器 `npm run verify:single-port` 在 PostgreSQL repository 下全部 PASS。
- 已实现 Redis 任务入队和系统状态探测。
- 已将 `apps/worker` 升级为 Redis 队列消费者。
- 已新增 `npm run verify:worker`。
- 已部署灰度任务队列 release `20260605-1505-xinghuan-worker-queue-gray`。
- 已新增并启用 `xinghuan-canvas-next-worker.service`。
- 已验证服务器 `npm run verify:worker` 通过，worker 将任务回写为 `succeeded`。
- 已验证公网系统接口返回 `redisStatus=connected`、`redisQueue=xinghuan:tasks`、`redisDepth=0`。
- 已移除画布前端 API/服务商设置入口，服务商配置后续只保留在统一后台。
- 已新增 `provider-model-framework.md`，明确后台 Provider CRUD、Key/Base URL、模型拉取、选择导入、语言/图像/视频三类模型目录和画布消费边界。
- 已按 `D:\AI canvas\Infinite-Canvas` 参考项目重做后台 `API 设置` 第一版：合并 Provider/模型 Tab，提供左侧平台列表、右侧编辑器、验证地址、拉取模型、选择导入弹窗和三类模型列表。
- 已新增 `002_provider_model_framework.sql`，为 PostgreSQL Provider/模型框架补齐 `protocol`、探测状态、最近拉取时间、`protocol_override` 和 `chat/image/video` 能力约束。
- 已新增后台 Provider probe、fetch-models、import-models、Provider 删除和模型删除接口。
- 已按用户要求跳过火山方舟高级配置，并加入 RunningHub 应用/工作流、ModelScope LoRA 后台配置。
- 已完成 `/api/models` 登录用户模型目录，按 `chat/image/video` 返回后台已启用模型且不泄露 Key。
- 已完成 `/api/proxy/external/image`、`/api/proxy/external/llm`、`/api/proxy/external/video`。
- 已完成图像、视频、LLM 三类通用节点接入后台模型目录。
- 已完成图像节点动态比例、尺寸、参考图上限，视频节点动态比例、时长、分辨率、参考图上限。
- 已完成后台模型高级设置：显示名、模型 ID、能力分类、协议覆盖、输入 Profile、参数 Schema JSON。
- 已完成 schema 更新后的节点旧参数自动归一化，避免界面显示和真实请求参数不一致。
- 已修复 API 创建任务后覆盖 Worker 状态的 PostgreSQL 全库写回竞态。
- 已部署灰度 release `20260606-0945-phase2-complete-gray`。
- 已完成公网真实节点联通验收：文本连接图像/视频/LLM，图像和视频生成输出文件，LLM 返回成功文本。
- 已补齐 `grsai_draw` Provider 协议。
- 已部署灰度 release `20260606-2140-grsai-draw-gray`。
- 已完成灰度 GRSAI `gpt-image-2` 真实生图复验，输出本地文件 `/files/output/external_image_1780715075124_joztk5.png`。
- 已补齐 Worker `grsai_draw` 图像 Adapter。
- 已新增 `verify:grsai-draw`、`verify:grsai-draw-gray`、`verify:worker-grsai-contract`、`verify:worker-grsai-image-adapter`。
- 已部署灰度 release `20260606-2335-grsai-worker-gray`。
- 已完成灰度 GRSAI 同步/异步双链路复验：同步 `/api/proxy/external/image` 与异步 `/api/admin/tasks` + Worker 均成功。
- 已清理灰度残留测试 Provider：`verify-provider-*`、`phase2-e2e-provider`。
- 已新增 `003_canvas_resource_repository.sql`，为资源分类和资源库扩展 `category_id`、`tags`、`favorite`、`last_used_at`。
- 已实现画布 / 素材 PostgreSQL repository，并保留首次读取时的文件导入 fallback。
- 已新增 `verify:postgres-canvas-resource-contract` 和 `verify:canvas-resource-api`。
- 已部署灰度 release `20260607-0038-phase3-canvas-resource-pg-gray`，随后以 `20260607-0115-phase3-canvas-pg-hotfix-gray` 修复画布 SQL 列名不一致问题。
- 已验证灰度 `verify:canvas-resource-api` 通过，返回 `canvasCount=13`、`imageResourceCount=2`，且 PostgreSQL `xh_canvases=13`、`xh_assets=2`。
- 已扩展 RunningHub 工作流结构，支持 `runTargetId`、工作流 JSON 和字段映射。
- 已新增公开目录接口 `GET /api/runninghub/catalog`。
- 已新增 `verify:runninghub-workflow-contract` 与 `verify:runninghub-workflow-api`。
- 已部署灰度 release `20260607-0218-phase3-runninghub-workflow-gray`。
- 已验证灰度 `verify:runninghub-workflow-api` 通过，当前返回 `workflowCount=0`、`appCount=0`，说明目录链路已通但尚无真实卡片数据。
- 已完成后台模型编辑器说明收口：明确“Provider 决定协议、参数来自 schema、输入口来自 `inputProfile`”，并加入 image/video/chat 示例。
- 已部署灰度 release `20260606-1150-admin-schema-gray`。
- 已完成输出素材节点单图/单视频自适应预览修复，避免媒体两侧黑边正常但节点下方被历史固定高度撑出大块空面板。
- 已新增 `scripts/verify-output-node-preview-layout.mjs`，覆盖单张竖图、单条横视频和多图网格三种输出预览高度规则。
- 已部署灰度 release `20260606-1217-output-preview-layout-gray`。
- 已将灰度管理员数据库密码重新对齐到服务器 `canvas-next.env` 中的 bootstrap 管理员密码，并验证服务器本地登录成功。
- 已新增全节点验收矩阵 `scripts/verify-node-acceptance-matrix.mjs`，覆盖 46 个注册节点的组件映射、端口声明、默认数据、可执行节点和关键代理节点合同。
- 已新增浏览器真实渲染烟测 `scripts/verify-canvas-node-render-smoke.mjs`，临时创建含 46 个节点的画布并验证真实页面渲染、旧空态、登录残留、错误边界和运行时错误。
- 已新增去 AI 水印 API 兜底：`GET /api/ai-watermark/status` 返回未配置状态，`POST /api/ai-watermark/process` 返回结构化 `AI_WATERMARK_NOT_CONFIGURED`。
- 已新增 `scripts/verify-ai-watermark-api.mjs` 与 `scripts/verify-local-acceptance-chain.mjs`。
- 已补齐根脚本 `verify:node-acceptance-matrix`、`verify:canvas-node-render-smoke`、`verify:ai-watermark-api`、`verify:local-acceptance-chain` 和 `verify:output-node-preview-layout`。
- 已完成本机 `npm run verify:local-acceptance-chain`，20 项核心验收均通过，最终输出 `ok=true`。
- 已将全节点验收链路发布到灰度 release `20260607-1545-node-acceptance-gray`。
- 已将全节点验收链路同步到生产 release `20260607-1610-node-acceptance-prod`。
- 已修复 `verify-worker-output-materializer.ts` 在 PostgreSQL 灰度环境中的测试 owner 和存储断言问题，PostgreSQL 模式验证 `xh_assets`，文件模式验证 `resource-library.json`。
- 已修复 `verify-output-material-prune.ts`，避免生产/灰度 PostgreSQL 环境变量影响临时文件模式清理沙盒。
- 灰度 release `20260607-1545-node-acceptance-gray` 已通过服务器核心验收和公网 46 节点浏览器烟测。
- 生产 release `20260607-1610-node-acceptance-prod` 已通过服务器核心验收、真实 Worker 输出素材落库和公网 46 节点浏览器烟测。
- 已新增 `apps/worker/src/output-materials.ts`，将 Worker 图像结果转存到用户输出目录并写入资源库索引。
- 已将 `apps/worker/src/worker.ts` 接入输出素材落库：任务成功后会补写 `resourceItemIds`、`resourceCount`、`materializedImageUrls` 到任务 `result`。
- 已扩展资源项结构，支持 `sourceUrl`、`originalName`、`sourceNodeId`、`sourceCanvasId`、`taskId`、`providerId`、`modelId`。
- 已新增 `scripts/verify-worker-output-materializer.ts`，覆盖 data URL 输出转存、资源库写入和同任务去重。
- 已新增 `scripts/verify-worker-output-materials.mjs`，用于 Redis/worker 可用时验证“任务成功后资源库出现输出素材”的联调链路。
- 已新增 `scripts/prune-old-output-materials.mjs`，支持 14 天保守清理、dry-run 和 `--apply` 两种模式。
- 已新增 `scripts/verify-output-material-prune.ts`，覆盖“删除旧任务输出、保留收藏/已归类/最近使用/非任务输出素材、共享文件不误删”。
- 已新增 `ops/systemd/xinghuan-canvas-next-output-prune.service.example` 与 `.timer.example`，用于服务器每日自动清理。
- 已在 `config/canvas-next.env.example` 增加 `XINGHUAN_OUTPUT_MATERIAL_RETENTION_DAYS=14`。
- 已部署灰度 release `20260606-1515-phase3-output-prune-gray`。
- 已验证灰度真实 Worker 输出素材落库：`npm run verify:worker-output-materials` 返回 `ok=true`，任务 `task-1780725769684-pvlouq` 成功生成资源项 `res-1780725770036-i16lge`。
- 已验证灰度清理脚本 dry-run：`npm run cleanup:output-materials:dry-run` 返回 `ok=true`，当前扫描 `users=2`、`items=1`，无误删候选。
- 已启用 `xinghuan-canvas-next-output-prune.timer`，当前状态 `active (waiting)`。

## 进行中

- ComfyUI 共享工作流从后台管理到画布节点运行的端到端验收。
- 当前工作树的 ComfyUI 后台重构、连接测试 API 和环境配置批次收口。
- 主入口状态一致性治理，避免代理继续从旧 `progress.md` 摘出过期版本。

## 待办

- 补齐 ComfyUI 工作流本地 JSON 导入、输入/输出参数识别、参数暴露编辑、默认值编辑和共享发布验收。
- 收口当前 `xinghuan-integration-clean` 工作树，提交 ComfyUI 后台重构批次。
- 灰度验证 ComfyUI 后台新界面和连接测试功能。

## 风险

- 选型错误会再次导致后续改造失效。
- 旧项目中部分已实现能力可能诱导继续复用，但复用成本未必低。
- 外部 API 文档和模型参数可能经常变化，需要后台 schema 有足够弹性。
- Web 生产包存在大 chunk 警告，后续需要分包和资源体积优化。
- RH 节点分组仍可见，本阶段按用户要求暂不处理。
- 当前画布内容和素材资源库仍是文件型运行数据，后续需要迁移到 PostgreSQL repository。
- Worker 已补齐 `grsai_draw` 图像异步执行；后续风险转为输出素材落库、资源库联动、取消/重试与更多厂商专用 Adapter。
- 本机 `18200` 当前未连 Redis/worker，Phase 3 新增的真实队列联调必须放到灰度或补齐本机 Redis 环境后再复验。
- 自动清理当前刻意走“保守模式”，不会清收藏/归类/最近使用素材；如果后续想扩大清理范围，需要单独再做产品规则确认。
- bootstrap 密码只适合初始化阶段，后续需要正式密码轮换、审计扩展和数据库迁移。
- `XINGHUAN_SECRET_KEY` 需要纳入正式密钥备份和轮换流程。
- 当前灰度管理员密码已重新对齐 bootstrap 环境，但正式生产前仍需完成独立密码轮换策略，不能长期依赖 bootstrap 凭据。
- RunningHub 目录接口当前为空列表，这符合“链路已通但尚无真实卡片”的现状；若后续恢复 RH 真实测试，仍需补真实配置数据。
- 当前视频节点对 APIMart 一类异步视频协议仍未完成真实修复；如果继续沿用同步视频 URL 假设，后续新增视频模型仍可能失败。

## 验证状态

- 已执行 `npm install`、`npm run type-check`、`npm run build`。
- 已验证 API `/health`、`/api/version`。
- 已验证 Web/Admin 本机浏览器首屏。
- 已执行 `npm run type-check -w @xinghuan/api`。
- 已执行 `npm run build -w @xinghuan/api`。
- 已执行 `npm run build -w @xinghuan/web`。
- 已验证关闭 `18300`、`18310`、`18766` 后仅 `18200` 监听。
- 已验证 `http://127.0.0.1:18200/`、`/api/status`、静态 JS、SPA fallback、画布创建/保存/读取、文件上传/访问。
- 已通过 Chrome headless 生成 `output/playwright/single-port-18200-chrome.png`，DOM dump 确认品牌、后端连接和 ReactFlow 画布存在。
- 已执行 `node --check scripts/start-single-port.mjs`。
- 已执行 `node --check scripts/verify-single-port.mjs`。
- 已执行 `npm run build:single-port`。
- 已使用 `npm run start:single-port` 启动单端口服务。
- 已执行 `npm run verify:single-port`，8 项自动验收全部 PASS。
- 已静态扫描灰度文档和配置，未发现禁止使用的批量删除命令。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- `systemctl is-active xinghuan-canvas-next` 返回 `active`。
- `systemctl is-active nginx` 返回 `active`。
- `sudo nginx -t` 通过。
- `https://canvas-next.hhh2121.xyz/` 和 `/api/status` 返回 200。
- Chrome headless 公网截图和 DOM dump 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/web` 通过。
- 本机 `node --check scripts/verify-single-port.mjs` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机认证版 `npm run verify:single-port` 通过，包含管理员/成员隔离验收。
- Chrome headless 本机截图 `output/playwright/auth-login-gate.png` 确认科技风登录门禁存在，未登录时画布不渲染。
- 灰度服务器 `npm ci` 通过，0 vulnerabilities。
- 灰度服务器 `npm run build:single-port` 通过。
- 灰度服务器 `npm run verify:single-port` 通过，包含认证和用户隔离验收。
- 灰度公网 `/api/canvas` 未登录返回 401 `AUTH_REQUIRED`。
- 灰度公网未登录截图 `output/playwright/gray-auth-login-gate-https-cdp.png` 通过。
- 本机 `node --check scripts\db-migrate.mjs` 通过。
- 本机 `npm run db:migrate` 在未配置数据库时按预期返回 `DATABASE_NOT_CONFIGURED`。
- 本机后台系统页 DOM 验证可见 `数据库状态 not_configured`。
- 灰度服务器 release `20260605-1315-xinghuan-db-ready-gray` 已部署并 active。
- 灰度服务器 `npm run verify:single-port` 通过，包含 `GET /api/admin/system database status`。
- 灰度服务器 `npm run db:migrate` 在未配置数据库时按预期返回 `DATABASE_NOT_CONFIGURED`。
- 公网管理员登录后 `/api/admin/system` 返回 `databaseStatus=not_configured`、`databaseConfigured=false`、`migrations=0`。
- `systemctl is-active postgresql` 返回 `active`。
- `psql --version` 返回 PostgreSQL 16.14。
- 服务器 `npm run db:migrate` 返回 `applied: ["001_admin_core.sql"]`。
- 数据库 `xh_schema_migrations` 包含 `001_admin_core.sql`。
- 公网管理员登录后 `/api/admin/system` 返回 `databaseStatus=connected`、`databaseConfigured=true`、`migrations=["001_admin_core.sql"]`。
- 本机 `node --check scripts\db-import-files.mjs` 通过。
- 本机 file driver 下 `npm run verify:single-port` 通过。
- 服务器 `npm run db:import-files` 通过。
- 服务器 PostgreSQL repository 下 `npm run verify:single-port` 全部 PASS。
- 公网管理员登录后 `/api/admin/system` 返回 `storageDriver=postgres`。
- PostgreSQL `xh_providers` 明文测试 Key 计数为 0。
- 本机 `node --check scripts\verify-worker-queue.mjs` 通过。
- 本机 `npm run type-check -w @xinghuan/worker` 通过。
- 本机 `npm run build:single-port` 通过，包含 worker 构建。
- 服务器 `xinghuan-canvas-next-worker.service` 为 `active`。
- 服务器 `npm run verify:worker` 通过。
- 公网管理员登录后 `/api/admin/system` 返回 `redisStatus=connected`、`redisDepth=0`。
- 本机静态扫描确认画布前端不再渲染 `API 设置` 入口。
- 本机 `npm run type-check -w @xinghuan/web` 通过。
- 本机 `npm run build -w @xinghuan/web` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机临时 `127.0.0.1:18220` 执行 `npm run verify:single-port` 全部 PASS。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机后台 API 设置重做后 `npm run build:single-port` 通过。
- 本机临时 `127.0.0.1:18221` 执行 `npm run verify:single-port` 全部 PASS。
- 本机新 Provider 接口烟测通过：`/api/admin/providers` 返回 `protocol`，草稿 `/probe` 与 `/fetch-models` 返回稳定结构。
- 本机新版单端口服务已启动在 `127.0.0.1:18200`。
- 本机 RH/LoRA 字段保存烟测通过，临时 Provider 已删除，测试数据文件已恢复。
- 本机修复 Provider 拉取模型误显示预设模型问题：拉取请求会携带当前未保存的 Base URL、API Key 和协议；选择模型弹窗仅展示本次上游返回的模型。
- 本机空 Key/拉取失败烟测通过：`/api/admin/providers/grsai/fetch-models` 返回 `ok=false`、`modelCount=0`、空模型数组，不再打开预设模型选择器。
- 本机后台 API 设置视觉已统一为科技风深色管理台样式，服务商区域与其他后台区域保持一致。
- 本机修复拉取模型点击无感问题：模型列表卡片内新增即时状态反馈，按钮拉取中显示 spinner 且禁用，失败原因会直接显示在按钮所在卡片。
- 本机 `npm run verify:model-catalog` 通过：验证临时 Provider/图像模型可进入 `/api/models`，返回动态参数元数据且不泄露 Key。
- 本机 `npm run verify:external-image-proxy` 通过：mock OpenAI 兼容上游返回图片后，后端代理成功转发模型、prompt、授权头并转存 `/files/output/...`。
- 本机 Chrome headless 动态 UI smoke 通过：`output/playwright/phase2-canvas-ui-dynamic-model-clean.png` 确认图像节点显示后台模型、服务商名、动态比例和尺寸，并隐藏 MJ 专属面板。
- 本机 `npm run verify:worker-adapter-contract` 通过：Worker 不再调用 `executeMockTask`，已读取任务 provider/model/payload，具备图像 Adapter、Key 解密和 result 回写合约。
- 本机 `npm run verify:task-payload-api` 通过：后台任务 API 可创建并读回 `payload/result`。
- 本机 `npm run verify:worker` 未通过：本地 Redis 未连接；worker 当前仍需在灰度服务器和真实 Adapter 下继续验收。
- 本机 `npm run verify:generic-node-catalog` 通过：图像/视频/LLM 通用节点均消费后台目录，图像/视频会在 schema 变化后自动归一化旧参数。
- 本机 `npm run verify:model-catalog` 通过：模型 `inputProfile` 和 `parameterSchema` 编辑后 `/api/models` 返回动态 UI 元数据。
- 本机 `npm run verify:node-acceptance-matrix` 通过：`totalRegistryNodes=46`、`visibleNodes=34`、`hiddenNodes=12`、`executableNodes=33`，所有注册节点均有组件映射和端口声明。
- 本机 `npm run verify:canvas-node-render-smoke` 通过：真实浏览器中 `expectedNodeCount=46`、`renderedNodeCount=46`、`missingIds=[]`、`classMismatches=[]`、`legacyFound=[]`、`runtimeErrors=[]`。
- 本机 `npm run verify:ai-watermark-api` 通过：去 AI 水印节点状态接口返回未配置结构，处理接口返回 `AI_WATERMARK_NOT_CONFIGURED`。
- 本机 `npm run verify:local-acceptance-chain` 通过：临时服务 `http://127.0.0.1:18333` 串联 20 项核心验收，最终输出 `ok=true`。
- 灰度服务器 `20260606-0945-phase2-complete-gray` 已部署并 active。
- 灰度服务器完整自动验收通过：`verify:single-port`、`verify:model-catalog`、`verify:external-image-proxy`、`verify:external-chat-proxy`、`verify:external-video-proxy`、`verify:generic-node-catalog`、`verify:task-payload-api`、`verify:worker-adapter-contract`、`verify:worker-image-adapter`、`verify:worker`。
- 公网画布视觉/操控验收通过：后台模型高级设置保存新 schema 后，图像节点显示 `3:4`、`800x1200`、`prompt,image_reference,multi_image`、`图像 (0/5)`，并再次生成 `/files/output/external_image_...png`，控制台 0 error。
- 本机 `npx tsx scripts/verify-grsai-image-adapter.ts` 通过，覆盖 GRSAI Draw 提交后轮询与立即成功两种响应。
- 本机真实 GRSAI smoke 通过，返回 1 张可访问图像 URL。
- 灰度 release `20260606-2140-grsai-draw-gray` 已部署并 active。
- 灰度公网 `grsai_draw` 真实图像代理复验通过：`/api/proxy/external/image` 返回 `/files/output/external_image_1780715075124_joztk5.png`，下载状态 `200 image/png`。
- 灰度公网登录后截图 `output/playwright/gray-auth-logged-canvas-https.png` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机后台版 `npm run verify:single-port` 通过，包含后台静态页、后台 API 和成员拒绝验收。
- 灰度服务器后台版 `npm run verify:single-port` 通过。
- 公网后台截图 `output/playwright/gray-admin-dashboard-https.png` 通过。
- 灰度服务器后台安全增强版 `npm run verify:single-port` 通过。
- 公网审计页截图 `output/playwright/gray-admin-audit-https.png` 通过。
- 公网审计页 DOM 确认不包含测试 Key 明文。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过，包含后台 schema 编辑器说明收口和输出节点预览修复。
- 本机 `npx tsx scripts/verify-output-node-preview-layout.mjs` 通过。
- 灰度 release `20260606-1150-admin-schema-gray` 已部署并切换。
- 灰度 release `20260606-1217-output-preview-layout-gray` 已部署并切换。
- `readlink /opt/apps/xinghuan-canvas-next/current` 返回 `20260606-1217-output-preview-layout-gray`。
- `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment=gray`。
- 服务器本地使用 bootstrap 管理员邮箱/密码登录 `/api/auth/login` 成功，证明灰度管理员凭据已重新对齐环境。
- 本机 `npm run verify:worker-output-materializer` 通过，覆盖输出转存、资源库写入和同任务去重。
- 本机 `npm run verify:output-material-prune` 通过，覆盖 14 天保守清理与共享文件保护。
- 本机 `npm run cleanup:output-materials:dry-run` 通过。
- 本机 `npm run type-check -w @xinghuan/worker` 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run build:single-port` 通过，包含 Worker 输出素材落库改动。
- 本机 `npm run verify:worker` 仍因 `redis is not connected` 无法作为 Phase 3 联调凭据。
- 灰度 `readlink /opt/apps/xinghuan-canvas-next/current` 返回 `20260606-1515-phase3-output-prune-gray`。
- 灰度 `systemctl is-active xinghuan-canvas-next`、`xinghuan-canvas-next-worker`、`xinghuan-canvas-next-output-prune.timer` 均为 `active`。
- 灰度 `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment=gray`。
- 灰度 `npm run verify:worker-output-materials` 通过，确认真实任务成功后资源库新增输出素材。
- 灰度 `npm run cleanup:output-materials:dry-run` 通过。

## 更新日志

- 2026-06-08：完成无限画布 AI 助手正式方案与实施计划归档，确定采用“产品层自有 + 项目专属 Hermes runtime”路线；前端为悬浮 / 可固定创作助手，后台为安全审计 / 配置工作台，第一阶段只做“分析 + 草案生成 + 人工确认后应用”。
- 2026-06-08：完成 Provider 灵活配置与视频输入能力开关方案归档，明确视频模型后续走结构化 `inputCapabilities`、后台能力开关和 APIMart 异步 adapter，不再把异步视频协议继续塞进同步代理假设里。
- 2026-06-06：落下 Phase 3 第一刀本地实现，Worker 图像结果现在会 materialize 成用户输出文件并写入资源库索引，附带任务/来源节点/画布/模型追踪字段和按 `taskId` 去重逻辑；本地定向验证、类型检查和单端口构建通过，灰度真实队列联调待下一轮执行。
- 2026-06-06：新增 14 天输出素材保守清理脚本与 systemd timer 模板，只清 `task-output` 旧素材，默认保护收藏、分类、最近使用和共享文件引用；本地清理回归与 dry-run CLI 已通过。
- 2026-06-06：建立并同步本项目 CodeGraph 索引后，将 Phase 3 输出素材落库和 14 天自动清理一起发布到灰度 `20260606-1515-phase3-output-prune-gray`；灰度真实 Worker 落库验收通过，清理 dry-run 与 systemd timer 启用通过。
- 2026-06-06：完成灰度收口补充，新增管理后台 schema 说明、输出素材节点自适应预览修复、灰度管理员密码环境对齐，并按实际状态把计划切换到 Phase 3 任务与素材闭环。
- 2026-06-06：完成 Phase 2 灰度收口，三类通用节点接入后台模型目录，图像/视频参数 schema 动态驱动，后台模型高级设置、LLM/视频代理、Worker 图像 Adapter、真实画布联通和服务器自动验收均通过。
- 2026-06-06：完成图像通用节点接入后台模型目录第一版，新增成员可见 `/api/models`、后端图像代理 `/api/proxy/external/image`、动态比例/尺寸 UI 和自动验收。
- 2026-06-06：完成 Worker 图像 Adapter 第一版，任务 `payload/result` 已贯通 API/PostgreSQL repository/Worker。
- 2026-06-05：完成后台安全增强，Provider Key 加密、密码重置和审计日志已灰度部署并验收。
- 2026-06-05：校正 Phase 1 状态，新增后台 Provider/模型框架设计，移除画布前端 API 设置入口。
- 2026-06-05：按 Infinite-Canvas 参考项目重做后台 API 设置第一版，完成 Provider/模型统一管理、验证、拉取、选择导入和三类模型目录。
- 2026-06-05：按要求跳过火山方舟高级配置，加入 RunningHub 应用/工作流和 ModelScope LoRA 后台配置。
- 2026-06-05：完成统一后台 `/admin` 和灰度部署，后台总览、用户、Provider、模型、任务和系统状态已通过验收。
- 2026-06-05：完成灰度认证版部署，`canvas-next.hhh2121.xyz` 已通过 HTTPS 登录门禁、用户隔离、文件上传和公网视觉验收。
- 2026-06-05：本机完成最小登录、退出、用户隔离和科技风登录门禁，自动验收脚本升级为认证流。
- 2026-06-05：完成灰度服务器部署，`canvas-next.hhh2121.xyz` 已通过 HTTP/HTTPS、API、Web 和浏览器视觉验收。
- 2026-06-05：完成灰度部署准备材料，补齐启动脚本、自动验收脚本、环境模板、Nginx/systemd 示例、runbook 和验收清单。
- 2026-06-05：完成本机单端口生产服务实现和验收，`18200` 可独立服务 Web、API、文件和前端路由。
- 2026-06-04：补充测试服务商矩阵、密钥存放策略和服务器状态快照。
- 2026-06-04：启动 Milestone B，创建星幻正式工程基线。
- 2026-06-04：初始化 v0.1.0 文档和项目记忆。
