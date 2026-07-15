# AGENTS.md - 无限画布 2.0 项目协作规则

## 项目定位

无限画布 2.0 是公司内部节点式 AIGC 创作平台的新立项项目。旧 `node-banana-enterprise` 项目不再作为产品主干，只作为失败经验、需求来源和迁移参考。

本项目目标是建立可扩展节点系统、独立后台、模型与服务商管理、云端项目存储、用户隔离、素材空间和任务执行链路，避免继续在节点基础薄弱的项目上补丁式改造。

## 默认阅读顺序

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/systems/README.md`
4. `README.md`
5. `MEMORY.md`
6. `ops/README.md`
7. `DEVLOG.md`

## 当前工作根

当前无限画布 2.0 默认工作入口：

- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`

当前工作树是主仓库 `D:/codex/无限画布2.0` 挂出的 Git worktree。`D:/codex/服务器/无限画布/` 只作为旧主干和历史方案参考，不作为当前 2.0 的主说明来源。

## 当前运行态摘要

- Gray 版本：`v0.6.12`
- Gray release：`20260715-aifork-grok-fast-preprocess-v0612`
- Production 版本：`v0.5.22`
- Production release：`20260702-envsync-admin-sections-prod-r1-v0522`
- `v0.6.12` 已部署灰度；AIFork Grok FAST 使用独立通用请求契约，并按插件规则预处理 Data URL 多参考图。生产仍保持 `v0.5.22`。
- 当前状态以 `docs/logbooks/releases/current-release-index.md`、`ops/current/gray.md`、`ops/current/production.md`、`docs/memory/current-state.md` 为准。
- ComfyUI 功能开发已暂停封存；仅允许 crash、security、rollback、docs 级别例外。

## 文档权威层级

- 项目概览：`README.md`
- 文档总索引：`docs/INDEX.md`
- 根入口职责：`docs/governance/root-entry-responsibility-matrix.md`
- 协作和归档规则：`docs/governance/`
- 系统知识：`docs/systems/`
- 长期记忆：`docs/memory/`
- 日常台账、发布证据与验证记录：`docs/logbooks/`
- 设计和执行计划：`docs/superpowers/specs/`、`docs/superpowers/plans/`

根入口文件只保留摘要和跳转。系统细节、运行历史、发布证据和逐日推进必须写入对应权威目录。

## AI / 自动化执行规则

- 开工先看 `git status --short`，确认工作树是否干净，以及脏改动是否属于本轮任务。
- 先通过 `docs/INDEX.md` 判断要找的是治理规则、系统知识、长期记忆、台账证据，还是历史方案。
- 涉及具体系统时，先读 `docs/systems/<system>/`，再读代码。
- 做完真实改动后，同步检查对应系统文档、台账和必要的入口摘要。
- 发现热点文件继续膨胀时，先判断应该新增模块、hook、helper 或 section，而不是默认继续往原文件堆。
- `1200+` 行 source 文件属于 watchlist；触碰既有热点时必须同步对应计划、台账或发布记录，并保持在既定预算内。
- 不要只依赖聊天上下文判断版本、部署态或历史结论；以当前 worktree 文件和运行态证据为准。

## 安全规则

- 禁止批量删除文件或目录。
- 不要使用 `del /s`、`rd /s`、`rmdir /s`、`Remove-Item -Recurse`、`rm -rf`。
- 需要删除文件时，只能一次删除一个明确路径的文件。
- 不要把 API Key、Token、Cookie、SSH Key、数据库密码写入文档、Git、日志、截图或聊天输出。
- 真实服务商 Key 只能放入服务器环境变量、密钥管理系统或后台加密字段。
- 设计和代码尽量使用相对路径，避免绑定单机绝对路径。

## 提交与发布护栏

- `.githooks/pre-commit` 会执行提交前治理检查；不要通过跳过 hook 的方式绕过热点、release logbook 或运行产物护栏。
- 发布前必须确认工作树与运行产物边界：
  - `npm run verify:no-runtime-artifacts-staged`
  - `npm run verify:staged-source-size-guard`
  - `npm run verify:file-hotspot-budgets`
  - `npm run verify:hotspot-watchlist-contract`
  - `npm run verify:hotspot-doc-sync-staged`
  - `npm run verify:release-worktree-clean`
- release logbook 与当前运行态入口必须同步：
  - `npm run verify:release-logbook-sync-staged`
  - `npm run verify:current-release-entry-consistency`
- 项目 harness 入口：
  - `npm run harness:verify:project`
  - `npm run harness:verify:workspace`
  - `npm run harness:verify:release`

## 详细规则入口

- CodeGraph 详细规则：`docs/governance/codegraph-and-repo-navigation.md`
- 热点文件治理：`docs/governance/engineering-guardrails.md`
- 热点风险评分：`docs/governance/hotspot-risk-scorecard.md`
- 热点拆分流程：`docs/governance/hotspot-decomposition-workflow.md`
- 发布 gate：`docs/systems/observability-and-ops/release-gates.md`
- Harness 执行地图：`docs/systems/harness/README.md`
- 根入口职责矩阵：`docs/governance/root-entry-responsibility-matrix.md`
