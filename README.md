# 无限画布 2.0

公司内部节点式 AIGC 创作平台当前活跃工作目录。

## 当前推荐入口

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `CONTEXT.md`
4. `docs/systems/README.md`
5. `README.md`
6. `MEMORY.md`
7. `ops/README.md`

## 文档导航

- 总索引：`docs/INDEX.md`
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

- 当前候选版本：`v0.7.3`
- 当前灰度：`canvas-next.hhh2121.xyz`
- 当前灰度版本：`v0.7.3`
- 当前生产：`canvas.hhh2121.xyz`
- 当前生产版本：`v0.7.3`
- 当前灰度 release：`20260717-admin-ten-domain-version-correction-gray-r1-v073`
- 当前生产 release：`20260717-admin-ten-domain-version-correction-prod-r1-v073`
- 当前工作分支：`xinghuan-integration-clean`
- 当前重点：Admin 十域能力保持不变；Gray 与 Production 已按用户明确授权统一为 v0.7.3，后续 Gray 默认仅递增 PATCH
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
