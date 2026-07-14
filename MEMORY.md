# MEMORY.md - 无限画布 2.0 项目记忆

## 兼容入口说明

> 本文件是长期记忆兼容入口。当前状态、发布证据和系统事实请优先跟随下方权威链接。

`MEMORY.md` 继续保留为长期记忆兼容入口，但不再承担全部历史正文。

- 当前主工作根：`D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`
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

## 当前状态摘要

- 当前活跃版本：`v0.6.2`（gray 发布准备中）；生产稳定版本为 `v0.5.22`
- 当前生产版本：`v0.5.22`
- 当前 gray release：`20260714-ops-task-window-gray-v062` (发布准备中)
- 当前 production release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 当前工作分支：`xinghuan-integration-clean`
- 最新完成：`v0.6.2` 已完成任务监控最近 2,000 条活动窗口、终态时间持久化与紧凑单行列表的本地验证；生产继续保持 `v0.5.22`，等待灰度运行态与后台交互验收。
- 2026-07-14 15:44 运行态调整：production 已回退至 `20260702-envsync-admin-sections-prod-r1-v0522`，详见 `docs/logbooks/incidents/2026-07-14-production-rollback-auth-and-rh-catalog.md`。
- 2026-07-14 发布推进：`v0.6.2` gray release 准备切到 `20260714-ops-task-window-gray-v062`，详见 `docs/logbooks/releases/gray/2026-07-14-ops-task-window-gray.md`。
- 当前工作重心：environment-sync-local 专门抽取计划、F1 task realtime decision；ComfyUI 功能开发已暂停封存
- 当前状态细节统一看 `docs/memory/current-state.md`、`docs/memory/deployment-state.md`、`docs/logbooks/releases/current-release-index.md`
- 当前策略：长期判断继续写入 `docs/memory/`，日常推进继续写入 `docs/logbooks/`
