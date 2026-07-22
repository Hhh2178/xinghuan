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

- 当前候选版本：`v0.7.19`
- 当前灰度：`canvas-next.hhh2121.xyz`
- 当前灰度版本：`v0.7.18`
- 当前生产：`canvas.hhh2121.xyz`
- 当前生产版本：`v0.7.18`
- 当前灰度 release：`20260722-canvas-revision-observability-gray-r1-v0718`
- 当前生产 release：`20260722-canvas-revision-observability-prod-r1-v0718`
- 当前开发分支：`feature/canvas-agent-runtime`
- 当前重点：本地候选已完成 Canvas Agent Runtime Phase 1-6，并在 Phase 7 接入 Canvas Run Worker、PostgreSQL lease、独立 chat 队列、批次质量选择及下游输入绑定；`text`、`text-split`、`upload`、`material-set`、`pick-from-set`、`relay`、`output` 已作为不调用 Provider 的原生确定性步骤进入服务端 Run Plan。`text-split` 的前端预览与 Worker 共用同一算法，支持分镜、正则、编号、字符切块和手工覆写。视频理解不依赖 FFmpeg，采用两条受控路径：当前启用的 Gemini 路径将 owner-scoped 视频字节上传至 Gemini Files API，并用其临时 `fileUri` 分析完整视频；未来仅对明确支持主动拉取媒体的 Provider 允许单产物、只读、短时签名 URL 直传。后者需要独立媒体访问网关、传输上限、撤销与审计快照，当前默认未启用，内部鉴权 URL 和任意客户端 URL 均不得外发。隔离 PostgreSQL 多 Worker 与 API/Redis/Worker 联合验收均已在本机通过，后者覆盖 SSE 重连、启动、暂停/恢复、取消和任务结算；认证 UI Playwright 验收流程已建立，仍缺一次性测试账号与环境。
- 下一阶段方向：完成认证 UI runbook 的真实登录态视觉验收，再执行 Gray 发布就绪验证。当前未推送、未部署，Gray 与 Production 仍运行 `v0.7.18`
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
