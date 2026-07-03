# MEMORY.md - 无限画布 2.0 项目记忆

## 兼容入口说明

`MEMORY.md` 继续保留为长期记忆兼容入口，但不再承担全部历史正文。

- 当前主工作根：`D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`
- 当前长期记忆目录：`docs/memory/`
- 当前系统知识目录：`docs/systems/`
- 当前逐日台账与发布证据目录：`docs/logbooks/`

## 推荐恢复顺序

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/systems/README.md`
4. `docs/memory/current-state.md`
5. `docs/memory/deployment-state.md`
6. `docs/memory/recent-release-index.md`
7. `ops/README.md`

## 当前项目摘要

无限画布 2.0 是公司内部节点式 AIGC 创作平台，目标是用统一后台治理图片、视频、音频、文本的节点工作流、素材空间、Provider 与任务执行链路，并支撑灰度/生产双环境持续发布。

## 当前高频入口

- 当前状态：`docs/memory/current-state.md`
- 部署状态：`docs/memory/deployment-state.md`
- 最近运行态索引：`docs/memory/recent-release-index.md`
- 当前发布索引：`docs/logbooks/releases/current-release-index.md`
- 最近日常事项：`docs/logbooks/daily/2026/2026-07/recent-highlights.md`

## 主题记忆入口

- 产品范围：`docs/memory/product-and-scope.md`
- 架构决策：`docs/memory/architecture-decisions.md`
- RunningHub：`docs/memory/runninghub-memory.md`
- Provider：`docs/memory/provider-memory.md`
- Worktree 与运行上下文历史：`docs/memory/worktree-and-runtime-history.md`
- 运行产物与归档规则历史：`docs/memory/runtime-artifacts-and-archive-rules.md`
- 项目起源与核心需求历史：`docs/memory/project-origin-and-core-requirements.md`
- 决策历史：`docs/memory/decision-history.md`
- 基底评审维度历史：`docs/memory/base-evaluation-criteria.md`
- 服务器与阶段历史：`docs/memory/server-and-stage-history.md`

## 使用边界

- 新的长期有效判断优先写入 `docs/memory/` 对应主题文件。
- 系统结构、协议、接口和执行链路优先写入 `docs/systems/`。
- 发布、验证、视觉复查和逐日推进优先写入 `docs/logbooks/`。
- `MEMORY.md` 只保留摘要、导航和兼容说明，不再继续堆积长历史正文。

## 2026-07-03 状态更新

- 当前活跃版本：`v0.5.22`
- 当前 gray release：`20260703-comfyui-dashboard-redesign-gray-r1-v0522` (已部署)
- 当前 production release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 当前工作分支：`xinghuan-integration-clean`
- 最新完成：ComfyUI 后台实例池管理界面重构已完成并部署到灰度（仪表盘概览页、实例详情页、连接测试 API、完整 CSS 样式）
- 部署时间：2026-07-03 12:00
- 部署状态：✅ 服务运行正常，API 响应正常，HTTPS 访问正常
- 2026-07-03 12:26 补充修复：ComfyUI 图标一致性修复（`.error-banner` 全站选择器冲突、按钮圆角/图标尺寸统一）+ 补齐灰度 `apps/api/dist` 遗漏内容并配置 `XINGHUAN_COMFYUI_CONNECTOR_TOKEN`，connector 注册/心跳在灰度正式生效，详见 `docs/logbooks/releases/gray/2026-07-03-comfyui-icon-fix-and-connector-harness-activation-gray.md`
- 当前工作重心：ComfyUI 后台已部署待用户验收，等待用户本机 connector 接入验证、工作流端到端验收、项目级 harness、主入口状态收口
- 当前状态细节统一看 `docs/memory/current-state.md`、`docs/memory/deployment-state.md`、`docs/logbooks/releases/current-release-index.md`
- 当前策略：长期判断继续写入 `docs/memory/`，日常推进继续写入 `docs/logbooks/`
