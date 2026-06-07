# MEMORY.md - 无限画布 2.0 项目记忆

## 项目摘要

无限画布 2.0 是公司内部节点式 AIGC 创作平台的新项目。核心目标是让成员在无限画布中通过节点工作流、素材空间和 Agent 辅助创作图片、视频、音频和文本；所有生成能力通过外部 API 调用；管理员在独立后台统一管理用户、项目、Provider、模型、参数、任务、素材、日志、配额和审计。

## 为什么放弃旧项目

旧项目基于 Node Banana 改造后暴露出结构性问题：

- 基础节点数量和节点治理能力不足，后续新增节点困难。
- 节点改造经常只在局部生效，前端入口、执行链路、模型配置和用户可见体验容易脱节。
- 后端治理、模型管理、任务执行、云端保存等能力属于后补，整体一致性不佳。
- 项目在“补节点”和“补后台”之间反复拉扯，已经影响交付速度和可验收性。

结论：旧项目不再作为主干继续投入。2.0 重新立项，旧项目只作为需求、经验和反例来源。

## 2.0 核心需求

- 无限画布：支持节点式工作流、拖拽连接、缩放平移、分组、项目内多画布。
- 生成能力：图片、视频、文本、音频优先走外部 API，不在当前服务器跑本地模型。
- 通用生成节点：一个图像生成节点可选择不同 Provider 和模型；视频、文本、音频同理。
- 模型后台：管理员/开发者配置 Provider API URL、Key、协议、模型发现、手动录入、参数 schema、输入 profile 和能力标签。
- 动态端口：根据模型能力生成参考图、首帧、尾帧、多图、多视频、多文本等输入端口。
- 类型隔离：图片、视频、文本、音频、mask、json、数组、素材引用等连接类型必须明确。
- 云端项目：项目、画布、工作流、素材、任务记录保存到服务器，用户之间隔离。
- 素材空间：每个用户和项目都有可查阅的输入素材、输出素材和生成历史。
- 任务系统：异步队列、worker、状态机、取消、重试、日志、失败原因、成本和耗时统计。
- 独立后台：黑绿科技风 Web 后台，只有管理员和开发者可进入调试与管理页面。
- Agent 模式：吸收 Jaaz 的 Agent 创作模式，但不直接继承旧项目主干。
- T8 参考：吸收 T8 的节点设计、素材管理、运镜批量执行和项目组织经验。
- ComfyUI 参考：吸收插件节点和类型隔离思想，但面向 Web 企业系统重新实现。

## 当前关键决策

- 2.0 是新项目，不在 `node-banana-enterprise` 上继续堆功能。
- 候选基底必须先经过 POC，不允许因为界面像画布就直接采用。
- 不采用“一个服务商一个节点”的模型；采用“通用节点 + 模型目录 + schema 驱动参数和端口”。
- 后台必须独立为 `/admin` 或独立后台应用，不挂在画布侧栏。
- 项目默认云端保存，本地文件夹只作为导入/导出备份能力。
- 所有密钥进入加密存储或环境变量，不能进入文档和 Git。
- 视觉基底采用科技黑，强调色以青绿/荧光绿为主，保持内部生产工具质感。
- 首批测试服务商信息已记录在 `config/provider-test-matrix.md`：GRSAI `gpt-image-2` 为 P0 图像验收，ToAPIs Grok Video 为 P1 低频视频验收。真实 Key 不写入文档，只进入 `.env.local`、服务器环境变量、后台加密字段或密钥管理系统。

## 候选基底评审维度

- 许可证是否允许公司内部商用和二次开发。
- 节点系统是否插件化、注册表化、schema 化。
- 是否有成熟的执行引擎、拓扑排序、异步任务和错误传播。
- 前端画布能力是否稳定，是否支持大画布、多节点、分组和性能优化。
- 后端是否清晰，是否易于接入账号、项目、任务、素材和 Provider。
- 是否容易部署到腾讯云 VPS，并支持 Nginx、HTTPS、worker 和持久化。
- 是否便于后续做热插拔节点、节点市场或内部节点包。

## 服务器记忆

- 腾讯云 VPS：`101.33.75.38`
- SSH：`ssh -i Tencent_Cloud_Server.pem -p 728 ubuntu@101.33.75.38`
- 密钥位置：`D:\codex\服务器\Tencent_Cloud_Server.pem`
- 当前灰度域名：`canvas-next.hhh2121.xyz`（HTTPS，代理到 `127.0.0.1:18200`）
- 正式预留域名：`canvas.hhh2121.xyz`（未启用）
- DNS 权威：Cloudflare（`hasslo.ns.cloudflare.com`、`rosemary.ns.cloudflare.com`）
- HTTPS 证书：Let's Encrypt，到期 `2026-08-31`，自动续期
- 不要修改内部代理服务和端口（`internal-proxy-ss.service` 端口 `8443`）。
- `2026-06-04` 旧无限画布已清理，根分区可用空间恢复到 `33G`。
- `2026-06-05` 灰度基础设施状态：
  - API 服务：`xinghuan-canvas-next.service`（`127.0.0.1:18200`）
  - Worker 服务：`xinghuan-canvas-next-worker.service`
  - PostgreSQL 16.14：`127.0.0.1:5432`，数据库 `xinghuan_canvas_next`，账号 `xinghuan_canvas_next`
  - Redis：`127.0.0.1:6379`，队列 `xinghuan:tasks`
  - 存储驱动：`postgres`
  - 当前 release：`20260607-0218-phase3-runninghub-workflow-gray`
- 部署目录：`/opt/apps/xinghuan-canvas-next/`
  - `current` 符号链接指向当前 release
  - `shared/canvas-next.env` 存放环境变量（密钥，不入 Git）
- 密钥管理：
  - `XINGHUAN_SECRET_KEY`：Provider Key AES-256-GCM 加密
  - `XINGHUAN_DATABASE_URL`：PostgreSQL 连接串
  - `XINGHUAN_REDIS_URL`：Redis 连接串
  - 真实密钥只存于服务器环境文件和本机 `.env.local`
- 详细连接信息见 `ops/server-connection.md`

## 当前阶段

- 当前版本：`v0.1.0`
- 状态：Phase 2 节点与模型治理已完成灰度验收，进入 Phase 3 任务与素材闭环
- 已完成能力：
  - Monorepo 工程基线（apps/web、apps/admin、apps/api、apps/worker、packages/*）
  - T8 成熟画板 UI 迁入 apps/web
  - 本机 18200 单端口生产服务
  - 灰度部署到 `canvas-next.hhh2121.xyz`（HTTPS）
  - 认证系统：登录、退出、session cookie、用户隔离
  - 统一后台 `/admin`：用户、Provider、模型、任务、系统状态、审计日志
  - PostgreSQL 16.14：auth/admin repository，存储驱动 postgres
  - Redis/Worker 任务队列：queued -> running -> succeeded/failed 状态机
  - Provider Key AES-256-GCM 加密落盘
  - Web 分包优化：vendor-react/flow/mediapipe/icons
  - 后台 Provider/模型框架：验证、拉取模型、选择导入、手动维护三类模型
  - `/api/models` 登录用户模型目录
  - `/api/proxy/external/image`、`/llm`、`/video` 后端代理
  - 图像、视频、LLM 通用节点读取后台模型目录
  - 图像/视频节点参数由模型 schema 动态驱动，schema 更新后自动归一化旧参数
  - 后台模型高级设置：显示名、模型 ID、能力分类、协议覆盖、输入 Profile、参数 Schema JSON
  - Worker 图像 Adapter 与任务 payload/result
  - 灰度 release `20260606-0945-phase2-complete-gray` 通过服务器自动验收和公网真实画布验收
  - GRSAI `grsai_draw` 同步代理与 Worker 异步链路均已打通
  - 灰度 release `20260606-2335-grsai-worker-gray` 通过真实双链路验收与测试清理
- 任务成功后输出素材落库到用户 `/files/output/...`，并写入资源库，14 天保守清理 timer 已接入灰度
- 灰度 release `20260606-2358-phase3-lifecycle-gray` 已完成“取消 / 重试”语义、Worker 取消保护和素材空间读取闭环
- 画布 / 素材 PostgreSQL repository 已在灰度热修复后完成真实导入验收：`verify:canvas-resource-api` 返回 `canvasCount=13`、`imageResourceCount=2`，PostgreSQL `xh_canvases=13`、`xh_assets=2`
- RunningHub 工作流字段映射第一版已进入灰度：后台可保存 `runTargetId`、工作流 JSON、字段映射；画布 `RunningHubNode` 可读取 `/api/runninghub/catalog` 作为预设目录
- `2026-06-07` 用户已明确要求暂缓 RunningHub 真实工作流卡片录入、字段展开和预览运行类测试；当前只保留目录/字段映射第一版在灰度
- `2026-06-07` 本机与灰度 `npm run verify:single-port` 已重新复验通过，历史 `POST /api/admin/providers` `401` 未再复现
- `2026-06-07` 已补齐生产位 `canvas.hhh2121.xyz` / `127.0.0.1:18100` 的独立运维模板：生产 env、runbook、验收清单、Nginx 和 systemd 示例
- `2026-06-07` 已在服务器创建 `/opt/apps/xinghuan-canvas/` 目录骨架，并放置 `/opt/apps/xinghuan-canvas/shared/canvas.env.example`
- `2026-06-07` 生产 Nginx 和 systemd 模板已安装到服务器，但仍保持未启用；`canvas.env` active 文件与 `current` release 链接仍不存在
- `2026-06-07` 生产 active env 已创建，生产 release `20260606-1604-phase3-prod-prep` 已设为 `/opt/apps/xinghuan-canvas/current`
- `2026-06-07` 生产 `18100` 本机 smoke 已通过，API/Worker/timer 已 `active` / `enabled`；生产 Nginx 站点仍未启用，公网域名仍未切换
- `2026-06-06` `canvas.hhh2121.xyz` 已正式切到生产 release `20260606-1604-phase3-prod-prep`，HTTPS 证书已签发，公网 smoke 已通过
- `2026-06-06` 生产已更新到 release `20260606-1810-provider-signed-refs-xinghuan-empty`：图像/视频/LLM 代理会把本地素材引用转换为带过期时间和 HMAC 签名的 `/api/provider-files/...` 供应商短链；生产后台已启用 `toapis-grok-video`，`/api/models` 返回 `imageCount=1`、`videoCount=1`
- `2026-06-06` 灰度已更新到 release `20260606-1818-provider-signed-refs-xinghuan-empty-gray`，同步供应商短链和星幻空态修复
- `2026-06-07` 本机已补齐全节点验收矩阵、浏览器真实渲染烟测、去 AI 水印 API 结构化兜底和 `verify:local-acceptance-chain`；46 个注册节点全部通过真实画布渲染，完整本地验收链路在 `127.0.0.1:18333` 输出 `ok=true`
- `2026-06-07` 灰度已更新到 release `20260607-1545-node-acceptance-gray`：API/Worker 均为 `active`，服务器核心验收通过，公网灰度 46/46 节点浏览器渲染烟测通过
- `2026-06-07` 生产已更新到 release `20260607-1610-node-acceptance-prod`：API/Worker 均为 `active`，服务器核心验收通过，公网生产 46/46 节点浏览器渲染烟测通过
- 灰度与生产当前区分：`canvas-next.hhh2121.xyz -> 127.0.0.1:18200 -> /opt/apps/xinghuan-canvas-next/`，`canvas.hhh2121.xyz -> 127.0.0.1:18100 -> /opt/apps/xinghuan-canvas/`
- 灰度与生产当前共用同一 PostgreSQL 连接串；两个域名是两套入口/release，但不是两套独立数据底座
- 当前重点：完整验收目标最终审计；RunningHub 真实工作流测试仍暂缓
- 下一步：
  - 汇总本机、灰度、生产的完整测试链路证据
  - 明确生产级剩余风险：大 chunk、密钥轮换、RH 真实工作流暂缓
  - 待用户恢复后，再补 RunningHub 首条真实工作流卡片与预览运行验收
