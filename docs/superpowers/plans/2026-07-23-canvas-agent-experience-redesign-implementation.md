# Canvas Agent 体验重构实施计划

## 目标与边界

以 Gray `v0.7.19` 为审计基线，保留服务端运行、路由、质量、恢复和审计底座，退役与新需求冲突的自由规划 Agent 产品面；交付工作流变量、Workflow Region、有限 AI 托管、智能候选选择器、可操控悬浮助手和精简后台。只部署 Gray，不推送 GitHub，不修改、重启或重新配置 Production。

需求与取舍分别以体验需求文档、ADR 0004 和 v0.7.19 审计矩阵为权威。`.planning/2026-07-23-canvas-agent-experience-redesign/` 保存逐步执行状态，本文保存可审查的仓库级阶段合同。

## 阶段

| 阶段 | 交付 | 完成门 |
| --- | --- | --- |
| 0 审计冻结 | 审计矩阵、ADR 0004、数据兼容与回滚策略 | 文档合同、CodeGraph impact、`git diff --check` |
| 1 退役冲突面 | 旧角色/工具/知识/提案不再影响新 Run，旧数据只读 | 兼容读取、弃用响应、无新写入 |
| 2 工作流变量 | registry、稳定 ID、`##变量##` token、文本/上传变量面板、变量总节点、Run input snapshot | parser/AST、类型、权限、发布预检、UI 操控 |
| 3 Workflow Region | 显式成员、实色可调底板、workflow revision、强类型 I/O 和跨边界拒绝 | 几何、隔离、revision、多 workflow 并发 |
| 4 有序执行 | workflow stages、拓扑约束排序、串并行/跳过、Run 锁定 | 冲突边定位、循环、active Run 不漂移 |
| 5 托管与设置 | workflow 切换、状态/失败时间线、owner+workflow 记忆设置、Run snapshot | 设置层级、跨设备恢复、下一次运行生效 |
| 6 恢复运行时 | 分类重试、兼容模型回退、审核改写、预算和未知错误停止 | Gray 已知 modelRecordId 缺失回归、审计证据 |
| 7 候选选择器 | manual/AI、prompt/备注、Top K、置信度、屏障和下游裁剪 | not_selected、skipped_by_selection、人工覆盖 |
| 8 悬浮助手 | 可拖动吸附、邻接展开、面板避让、单一错误分析、语义 Markdown 块复制 | XSS/reasoning、桌面/窄屏真实操控与截图 |
| 9 Admin 精简 | 运行控制、模型/回退、质量/选择、Run/审计工作域 | 保存、审核、发布、回滚、深链和权限 |
| 10 本地总验证 | focused tests、type/build、全 Harness、视觉矩阵、并发/断线/owner 隔离 | 无 blocker；证据写入 validation logbook |
| 11 Gray 发布 | patch release、migration、API/Worker、认证 UI、多类型压力与回归 | Gray 通过；Production `/api/status` 未变；无 GitHub push |

## 执行原则

- 每阶段先写失败测试，再实现，再跑受影响 package 和合同；阶段末同步计划、系统文档、daily/validation logbook。
- 数据只前向迁移。旧 Canvas Run、Agent 配置、知识与 proposal 保持历史读取，不静默重解释。
- 配置和变量只在新 Run 开始时冻结，active Run 不受编辑影响。
- 一个 workflow 默认只允许一个 active Run，不同 workflow 可并发且不得串状态、输入、成本或事件。
- 视觉验收必须使用真实浏览器，覆盖拖动、吸附、缩放、调色、文本 token、排序、设置、切换、滚动、断线和遮挡。
- 计划变化先记录原因和影响，再修改阶段状态；同一失败不重复执行同一无效动作。

## 回滚

- Phase 0 冻结后建立本地 checkpoint，后续每个阶段保持独立本地提交；不重写历史、不推送。
- 新 Workflow Run 使用 Gray feature flag。失败时禁止新 Run，并切回上一 Gray release；不删除失败 release 和历史数据。
- Production 不进入本计划的部署或回滚链，只允许发布后只读状态对照。
