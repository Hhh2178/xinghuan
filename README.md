# 无限画布 2.0

公司内部节点式 AIGC 创作平台当前活跃工作目录。

## 当前推荐入口

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `DESIGN.md`
4. `CONTEXT.md`
5. `docs/systems/README.md`
6. `README.md`
7. `MEMORY.md`
8. `ops/README.md`

## 文档导航

- 总索引：`docs/INDEX.md`
- 视觉设计总入口：`DESIGN.md`
- 领域语言与不变量：`CONTEXT.md`
- 架构决策索引：`docs/adr/README.md`
- 协作与归档规则：`docs/governance/`
- 系统知识：`docs/systems/`
- 长期记忆：`docs/memory/`
- 台账与发布证据：`docs/logbooks/`
- 设计与演进记录：`docs/records/`
- 当前发布索引：`docs/logbooks/releases/current-release-index.md`
- Gray 当前入口：`ops/current/gray.md`
- Production 当前入口：`ops/current/production.md`

## 当前状态摘要

- 当前候选版本：`v0.7.20`
- 当前灰度：`canvas-next.hhh2121.xyz`
- 当前灰度版本：`v0.7.20`
- 当前生产：`canvas.hhh2121.xyz`
- 当前生产版本：`v0.7.18`
- 当前灰度 release：`20260723-canvas-agent-governance-gray-r1-v0720`
- 当前生产 release：`20260722-canvas-revision-observability-prod-r1-v0718`
- 当前开发分支：`feature/canvas-agent-runtime`
- 当前重点：Gray 候选已升级为 Canvas Agent Governance v0.7.20：悬浮助手与托管面板彻底分离，Canvas/Admin 共用安全 Markdown 与 reasoning 隔离；节点目录、安全模型投影、发布文档和工作流引用被锁定到不可变 Knowledge Snapshot；Admin 角色、LLM Pool、工具、知识、质量和恢复均采用结构化版本化编辑，并真实驱动运行时提示词、路由、知识、预算和策略。
- 下一阶段方向：完成 Gray 认证视觉、并发 Run、路由回退、质量恢复和压力回归；Production 仍运行 `v0.7.18`，不部署、不重启、不改配置，也不推送 GitHub。
- ComfyUI 状态：功能开发暂停封存，仅允许 crash/security/rollback/docs 级别例外

详细运行态以 `docs/logbooks/releases/current-release-index.md`、`ops/current/gray.md`、`ops/current/production.md`、`docs/memory/current-state.md` 为准。

## 当前工作根

当前默认开发入口：

- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`

这不是另一份独立项目副本，而是主仓库 `D:/codex/无限画布2.0` 挂出的 Git worktree，用于承载当前里程碑的大量未合并改动。

结构说明见：

- `docs/repo-structure.md`
- `docs/runtime-artifacts.md`

## 快速入口

- `AGENTS.md`：AI 协作规则、默认阅读顺序和安全边界。
- `docs/INDEX.md`：第一跳总索引。
- `CONTEXT.md`：领域语言、实体边界和跨系统不变量。
- `docs/adr/README.md`：架构决策状态与历史索引。
- `docs/systems/README.md`：系统知识地图。
- `MEMORY.md`：长期记忆兼容入口。
- `DEVLOG.md`：旧开发台账兼容入口。
- `ops/README.md`：运维、验收和归档材料入口。
- `development/README.md`：临时方案、开发过程资料和归档规则。

## 目录边界

- 正式源码与长期文档：`apps/`、`packages/`、`scripts/`、`config/`、`docs/`、`ops/`、`development/`
- 运行产物与辅助目录：`output/`、`releases/`、`dist-release/`、`logs/`、`.tmp/`、`.codex-temp/`、`.codegraph/`、`.playwright-cli/`

运行产物详细边界见 `docs/runtime-artifacts.md`。

## 与旧目录的关系

- `D:/codex/服务器/无限画布/` 现在只作为旧主干、历史方案和旧部署记录参考。
- `D:/codex/无限画布2.0` 是当前 worktree 所属主仓库。

如果旧目录与本目录文档冲突，以当前 worktree 为准。
