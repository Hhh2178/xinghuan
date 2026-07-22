# Canvas Agent Runtime Gray v0.7.19

- release：`20260722-canvas-agent-runtime-gray-r1-v0719`
- source commit：`40953b4`
- archive：`20260722-canvas-agent-runtime-gray-r1-v0719.tar.gz`
- rollback：`20260721-admin-health-visual-resource-domain-gray-r1-v0717`

## 范围

- 以本项目内部 Agent Runtime 替代 Hermes 依赖：Canvas Run、Agent Run、工具政策、LLM 路由、审计与并发治理都由服务端持久化管理。
- Canvas Run Worker 按用户组顺序和组内拓扑编排；确定性节点在服务端执行，生成任务继续复用既有 Provider、模型和参数链路。
- 启用 LLM-only 路由池、质量评估/下游选择、失败恢复与预算护栏；生成节点模型备选仍来自冻结的节点计划，而非 LLM 路由池。
- 提供重新设计的悬浮助手和画布托管工作台。助手自动附带当前画布的有界、脱敏上下文；协作与托管 Tab 不再发生层叠遮挡。
- 视频理解不引入 FFmpeg。Gemini 原生完整视频走 owner-scoped 文件上传；受控 URL 直传保持默认关闭。

## 环境边界

- 仅 Gray 部署。Production 保持 `v0.7.18 / 20260722-canvas-revision-observability-prod-r1-v0718`，未部署、未重启、未改配置。
- 未推送 GitHub。
- Gray release retention 已按每环境最多 5 个执行受控 dry-run/apply；服务器仅有 4 个保留项，未删除目录。
