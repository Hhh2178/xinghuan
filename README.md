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

- 当前活跃版本：`v0.4.4`
- 当前灰度：`canvas-next.hhh2121.xyz`
- 当前生产：`canvas.hhh2121.xyz`
- 当前多用户正式化阶段：`Phase A-E` 已完成灰度/生产收口
- 当前 `Phase E` 状态：长期观测治理第三批已完成 gray / production 真实执行
- 当前 `Phase E` rollback 状态：gray / production 样本都已补齐
- 当前 `Phase E` 本地补强：高频后台读接口已纳入 requestId 审计补样，后续重点更集中在外部通知闭环
- 当前灰度 release：`20260622-runninghub-app-v2-gray-r1-v044-36415e9`
- 当前生产 release：`20260619-runninghub-slot-sync-prod-r1-v040-local`
- 当前架构：前后端与 worker 统一在本项目 2.0 worktree 中推进
- 当前生成能力：统一通过外部 API 接入，不在 VPS 跑本地 GPU 推理
- 当前生成库状态：图片/视频预览与下载已完成，本地素材访问已统一走生成库内容路由
- 当前 Provider 热修复状态：柏拉图 `grok-1.5-video-6s/10s/15s` 的 multipart 视频接入与后台结构化接入方案输出已完成 gray / production 实装和真实 6 秒任务验收
- 当前环境同步状态：gray / production 已上线后台“环境同步”页，并完成双向差异预览与真实服务商+模型写回 smoke
- 当前 RunningHub 状态：RH 工作台、单一 RH 节点、RH 任务代理和平台级并发窗口治理已完成 gray / production 发布
- 当前 RH 工作台结构状态：
  - 后台已补齐 `新建 / 删除 / 另存为 / 启停 / 测试 / AI 分析并填写`
  - 左侧目录区已改成接近 API 设置页的搜索 + 分类 + 状态筛选布局
  - `2026-06-19` 已补 RH 工作台滚动吸顶收口：筛选条独立吸顶，编辑器头部独立吸顶，避免顶部与正文区重叠
  - RH 节点当前已收口为“条目选择 + 输入摘要 + 参数区 + 状态摘要”，不再对用户展示 `Webapp ID` 文案
  - `2026-06-19` 已补 RH 节点运行目标提交流程：节点提交会显式携带 `pageId / workflowId / runTargetId / targetType / taskCapability`
  - `2026-06-19` 已补 RH 条目空字段自动补参链路：当本地条目未定义字段时，会自动尝试拉取远端 `app-info`
  - `2026-06-22` 已补 RH App / Workflow 运行态归一化：
    - 后台条目与前台运行时开始按 `kind` 持有各自归属的 `appId / workflowId / runTargetId`
    - 画布 RH 节点会阻止 `app + workflowId` 或 `workflow + appId` 的混合态条目直接运行
    - 命中混合态时会给出显式提示，要求先回后台重新保存条目
  - `2026-06-19` 已补 RH 工作台“从运行目标同步输入槽”能力：
    - 后台条目可直接读取运行目标返回的真实 `nodeInfoList`
    - 生成或补齐 `nodeId / fieldName / fieldType / options`
    - 保存后画布 RH 节点即可按后台条目自动展开可执行参数区
  - 如果某个 RH 运行目标本身不返回 `nodeInfoList`，当前仍需要后台人工补录字段；前端不会再伪造不可执行表单
- 当前 RH 队列治理状态：
  - 普通 Provider 队列已按 `capability + user` 做独立并发与排队
  - RunningHub 已按平台窗口做独立并发与排队
  - gray 已用真实 `GRSAI gpt-image-2` 和真实 RH workflow 完成实链验证
- 当前 RH AI App 协议状态：
  - worker 已切到 RunningHub 官方 AI App v2 提交/查询协议
  - AI App submit 使用 `/openapi/v2/run/ai-app/{id}`
  - AI App query 使用 `/openapi/v2/query`
  - 旧的 `taskType=ASYNC` AI App 提交体已移除
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
