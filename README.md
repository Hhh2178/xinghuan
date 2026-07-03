# 无限画布 2.0

公司内部节点式 AIGC 创作平台当前活跃工作目录。

## 当前推荐入口

从本轮文档治理重构开始，建议按下面顺序恢复上下文：

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/systems/README.md`
4. `README.md`
5. `MEMORY.md`
6. `ops/README.md`

## 文档导航

- 总索引：`docs/INDEX.md`
- 协作与归档规则：`docs/governance/`
- 系统知识：`docs/systems/`
- 长期记忆：`docs/memory/`
- 台账与发布证据：`docs/logbooks/`
- 设计与演进记录：`docs/records/`

## 当前状态摘要

- 当前活跃版本：`v0.5.22`
- 当前灰度：`canvas-next.hhh2121.xyz`
- 当前生产：`canvas.hhh2121.xyz`
- 当前灰度 release：`20260702-comfyui-shared-app-and-workflow-upload-gray-r1-v0522`
- 当前生产 release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 当前重点系统：ComfyUI 机器池与工作流治理、项目级 harness、后台 Admin、API、Worker

## 当前工作根

当前默认开发入口：

- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`

这不是另一份独立项目副本，而是主仓库 `D:/codex/无限画布2.0` 挂出的 Git worktree，用于承载当前里程碑的大量未合并改动。

结构说明见：

- `docs/repo-structure.md`
- `docs/runtime-artifacts.md`

## 快速入口

- `AGENTS.md`
  - 当前协作规则、项目总纲和阅读顺序。
- `docs/INDEX.md`
  - 新的第一跳总索引。
- `docs/systems/README.md`
  - 当前系统地图。
- `MEMORY.md`
  - 当前项目长期记忆兼容入口。
- `docs/project-atlas/README.md`
  - 兼容层总纲入口，保留旧的结构化导航正文。
- `docs/project-atlas/*.md`
  - 兼容层主题正文，新内容优先写入 `docs/systems/`、`docs/governance/`、`docs/logbooks/`。
- `DEVLOG.md`
  - 旧开发台账兼容入口。
- `docs/prd/README.md`
  - 当前 2.0 产品文档索引与当前版本状态。
- `ops/README.md`
  - 运维、验收和归档材料入口。
- `development/README.md`
  - 临时方案、开发过程资料和归档规则。

## 当前定位

- 当前活跃版本：`v0.5.22`
- 当前灰度：`canvas-next.hhh2121.xyz`
- 当前生产：`canvas.hhh2121.xyz`
- 当前灰度 release：`20260702-comfyui-shared-app-and-workflow-upload-gray-r1-v0522`
- 当前生产 release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 当前工作重心：ComfyUI 机器池与工作流治理、项目级 harness、主入口状态收口与 ComfyUI 后台体验重设计
- 当前架构：前后端与 worker 统一在本项目 2.0 worktree 中推进
- 当前 RunningHub、环境同步、版本对齐、账号级审计能力等细节，统一看 `docs/logbooks/`、`docs/memory/`、`ops/README.md`

## 目录边界

- 正式源码与长期文档：
  - `apps/`
  - `packages/`
  - `scripts/`
  - `config/`
  - `docs/`
  - `ops/`
  - `development/`
- 运行产物与辅助目录：
  - `output/`
  - `releases/`
  - `dist-release/`
  - `logs/`
  - `.tmp/`
  - `.codex-temp/`
  - `.codegraph/`
  - `.playwright-cli/`

运行产物详细边界见 `docs/runtime-artifacts.md`。

## 与旧目录的关系

- `D:/codex/服务器/无限画布/`
  - 现在只作为旧主干 / 历史方案 / 旧部署记录参考
- `D:/codex/无限画布2.0`
  - 当前 worktree 所属主仓库

如果旧目录与本目录文档冲突，以当前 worktree 为准。

## 2026-07-03 状态更新

- 当前活跃版本：`v0.5.22`
- 当前 gray release：`20260702-comfyui-shared-app-and-workflow-upload-gray-r1-v0522`
- 当前 production release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 当前工作重心：ComfyUI 管理体验重设计、机器池与工作流治理、项目级 harness 与主入口状态收口
- 详细变更和验证继续看 `docs/logbooks/`
