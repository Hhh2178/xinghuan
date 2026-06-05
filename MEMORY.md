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
- SSH：`ubuntu@101.33.75.38 -p 728`
- 当前灰度域名：`canvas-next.hhh2121.xyz`（HTTPS，代理到 `127.0.0.1:18200`）
- 正式预留域名：`canvas.hhh2121.xyz`（未启用）
- 不要修改内部代理服务和端口。
- `2026-06-04` 旧无限画布已清理，根分区可用空间恢复到 `33G`。
- `2026-06-05` 灰度基础设施状态：
  - API 服务：`xinghuan-canvas-next.service`（`127.0.0.1:18200`）
  - Worker 服务：`xinghuan-canvas-next-worker.service`
  - PostgreSQL 16.14：`127.0.0.1:5432`，数据库 `xinghuan_canvas_next`
  - Redis：`127.0.0.1:6379`，队列 `xinghuan:tasks`
  - 存储驱动：`postgres`
  - 当前 release：`20260605-1505-xinghuan-worker-queue-gray`
- 环境变量文件：`/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
- 密钥管理：`XINGHUAN_SECRET_KEY` 用于 Provider Key AES-256-GCM 加密

## 当前阶段

- 当前版本：`v0.1.0`
- 状态：Phase 1 基础平台已完成，进入 Phase 2 节点与模型治理
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
- 当前重点：Provider Adapter、真实模型调用、任务输出素材落库
- 下一步：
  - 实现 GRSAI Provider Adapter（P0 图像验收）
  - Worker 接入真实 Provider 调用替换 mock 执行器
  - 任务成功后写入输出素材和资源库
  - 画布/素材元数据 PostgreSQL repository
