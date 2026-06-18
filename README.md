# 无限画布 2.0

公司内部节点式 AIGC 创作平台当前活跃工作目录。

## 当前工作根

当前默认开发入口：

- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`

这不是另一份独立项目副本，而是主仓库 `D:/codex/无限画布2.0` 挂出的 Git worktree，用于承载当前里程碑的大量未合并改动。

结构说明见：

- `docs/repo-structure.md`
- `docs/runtime-artifacts.md`

## 快速入口

- `AGENTS.md`
  - 当前协作规则、文档路由规则、更新义务和归档边界。
- `MEMORY.md`
  - 当前项目长期记忆、部署状态、当前 release 和阶段结论。
- `docs/project-atlas/README.md`
  - AI 与协作者的总纲入口，先看结构、环境、接口、排障和台账规则。
- `DEVLOG.md`
  - 最近推进、验证、部署与回滚台账。
- `docs/prd/README.md`
  - 当前 2.0 产品文档索引与当前版本状态。
- `docs/documentation-governance.md`
  - 文档路由、更新触发条件、归档规则和入口维护规范。
- `ops/README.md`
  - 运维、验收和归档材料入口。
- `development/README.md`
  - 临时方案、开发过程资料和归档规则。

## 当前定位

- 当前活跃版本：`v0.3.2`
- 当前灰度：`canvas-next.hhh2121.xyz`
- 当前生产：`canvas.hhh2121.xyz`
- 当前多用户正式化阶段：`Phase A-E` 已完成灰度/生产收口
- 当前 `Phase E` 状态：长期观测治理第三批已完成 gray / production 真实执行
- 当前 `Phase E` rollback 状态：gray / production 样本都已补齐
- 当前 `Phase E` 本地补强：高频后台读接口已纳入 requestId 审计补样，后续重点更集中在外部通知闭环
- 当前灰度 release：`20260618-runninghub-workspace-gray-r1-6b65dbc`
- 当前生产 release：`20260618-v032-ui-fixes-prod-r1`
- 当前架构：前后端与 worker 统一在本项目 2.0 worktree 中推进
- 当前生成能力：统一通过外部 API 接入，不在 VPS 跑本地 GPU 推理
- 当前生成库状态：图片/视频预览与下载已完成，本地素材访问已统一走生成库内容路由
- 当前 Provider 热修复状态：柏拉图 `grok-1.5-video-6s/10s/15s` 的 multipart 视频接入与后台结构化接入方案输出已完成 gray / production 实装和真实 6 秒任务验收
- 当前环境同步状态：gray / production 已上线后台“环境同步”页，并完成双向差异预览与真实服务商+模型写回 smoke
- 当前 RunningHub 状态：RH 工作台与单一 RH 节点第一阶段已发布到 gray，前台已开始优先消费 `inputSlots`
- 当前本地验收链状态：`npm run verify:local-acceptance-chain` 已恢复全绿

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
