# Canvas Agent v0.7.19 至当前审计矩阵

## 范围与基线

- 审计基线：Gray `v0.7.19` 代码提交 `40953b4112b99865d04f0222394df4fb5cbf8204`。
- 当前实现：`feature/canvas-agent-runtime` / Gray `v0.7.28`。
- 需求权威：`docs/superpowers/specs/2026-07-23-canvas-agent-experience-redesign-requirements.md`。
- 标签：`KEEP` 保留，`ADAPT` 改造，`RETIRE` 停止新入口/新写入但兼容读取，`REMOVE` 删除无兼容价值实现，`FORWARD-MIGRATE` 只做前向数据演进。

## 决策矩阵

| 模块或路径 | 决策 | 依据 | 依赖与迁移 | 验证 |
| --- | --- | --- | --- | --- |
| `apps/api/db/026_canvas_agent_runtime.sql` Canvas Run/Step/Event/Command | KEEP + ADAPT | 服务端权威、幂等与断线恢复是新方案基础 | 前向增加 workflow ID、workflow revision、input/settings snapshot；旧 Run 兼容读取 | owner、幂等、事件顺序、租约接管、多 workflow 并发 |
| Workflow compiler、kernel、Worker coordinator | KEEP + ADAPT | 已具拓扑、分组顺序、恢复与任务调度能力 | 编译输入从 Canvas 收敛为 Workflow Region 子图；保留旧 canvas scope adapter | 循环、跨阶段依赖、区域外节点隔离、revision conflict |
| `apps/api/db/027_internal_agent_llm_routing.sql` LLM pool、health、decision | KEEP | 已发布 chat 模型的能力/健康/预算回退仍必需 | 角色键收敛为 assistant、recovery、candidate-evaluator 等实际用途 | 发布资格、熔断、预算、确定性路由、fallback |
| Agent Run/Action 审计账本 | KEEP + ADAPT | 恢复和候选评估仍需要可追踪 LLM 决策 | 不再用 parent role network 表达自由规划；关联 workflow/run/step/selection | owner、输入快照、输出摘要、隐藏 reasoning |
| planner/manager/checker 自由角色网络 | RETIRE | 与“成熟工作流上的有限监督”冲突，增加不可预测性 | 旧 definition/config/run 只读；新 Run 不解析这些发布配置 | 新运行无旧角色依赖；历史 Run 可查询 |
| `apps/api/src/agent-orchestrator.ts` | ADAPT | LLM 路由、不可变配置和审计有用，通用 role orchestration 过宽 | 拆为 assistant diagnosis、recovery rewrite、candidate evaluation 的有界调用 | 每种调用独立 schema、预算、工具与超时 |
| `packages/agent-core/src/agent-tool-catalog.ts` | ADAPT + REMOVE | pause/cancel/retry/evaluate/select 有价值；自由读取/搜索/patch 工具超出 MVP | 移除 `canvas.workflow.search`、`canvas.patch.propose` 等新运行权限；兼容旧审计名 | 工具白名单合同；新配置无法发布退役工具 |
| Node Capability Catalog | KEEP + ADAPT | 是预检、模型兼容、诊断与恢复的代码权威 | 增加 workflow I/O、变量、候选选择器能力；保持 serverRuntime 迁移状态 | 注册表、端口、失败码、模型能力合同 |
| 安全模型投影与 `queryAgentModels` | KEEP + ADAPT | 可解决 legacy model name 到唯一发布模型记录的安全解析 | 预检必须唯一匹配；歧义、未发布或环境不符直接阻止 Run | `gpt-image-2` 复现、唯一/歧义/缺失模型测试 |
| `apps/api/db/029_agent_governance.sql` 控制开关 | ADAPT | 平台安全上限和环境开关仍需要 | 重命名/投影为 assistant、workflow run、recovery、candidate evaluation 控制 | revision 冲突、环境隔离、运行时生效 |
| 自由知识集合、发布文档检索 | RETIRE | 节点报错诊断首版不需要广泛知识 CMS，且容易把内部内容当产品能力 | 保留历史数据与只读 API；新 Run 默认不检索自由文档 | 新 Run snapshot 不含退役文档；历史记录可读 |
| migration `035` 与不可变 Knowledge Snapshot | ADAPT | 不可变事实投影有复现价值，但当前 snapshot 范围过宽 | 不回滚 migration；新 snapshot 只保留节点目录、模型投影和明确诊断事实 | hash、不可变触发器、owner、环境投影 |
| workflow template reference、workflow inspect/search/validate、patch proposal | RETIRE + REMOVE | 新 MVP 明确禁止 AI 创建节点、改变连线和自由改工作流 | 停止新写入/入口；历史 proposal 只读；删除无外部依赖 helper 和 UI | CodeGraph 影响复核；proposal API 弃用响应 |
| `apps/api/db/028_artifact_quality_and_recovery.sql` | KEEP + ADAPT | 质量评分、选择和恢复决策是智能候选门和失败恢复基础 | 增加 selection gate、not_selected、skipped_by_selection、prompt/variable provenance | 候选屏障、Top K、置信度、人工覆盖、审计 |
| 旧 `pick-from-set` | KEEP | 用户可预测的索引选择与语义选优不同 | 不改变其节点类型和运行语义 | 原有确定性测试继续通过 |
| Canvas-wide group ordering | ADAPT | 排序交互和拓扑冲突校验可复用，但作用域错误 | 投影为 workflow-scoped execution stages；active Run 锁定 | 合法/非法拖动、并行、跳过、锁定测试 |
| Canvas-level Supervision view model/UI | REMOVE + REBUILD | 没有 workflow 目标、设置、恢复解释和候选门，不符合需求 | 用 workflow target switcher、状态时间线、设置和动作替换 | 多 workflow 切换、设置记忆、失败解释、无重叠 |
| Assistant API、会话分离、安全 Markdown、reasoning filter | KEEP + ADAPT | 安全边界正确，现有产品视觉和内容结构不合格 | 保留协议/渲染底座；重做 launcher、几何、空态和语义块 | XSS、跨 chunk reasoning、块复制、拖动/吸附/避让 |
| 当前助手上下文滑轨、内部 JSON、小字说明、固定位置 | REMOVE | 造成调试窗口观感且不可操控 | 以单一错误分析动作和上下文自动关联替换 | 桌面/窄屏截图、overflow、keyboard、pointer |
| 十一项等权 Agent Admin 导航 | REMOVE + REBUILD | 以内部实体组织，不对应管理员高频任务 | 收敛为运行控制、模型/回退、质量/选择、Run/审计；旧深链临时重定向 | 路由、保存/发布、窄屏、权限、错误态 |
| 数据库 migration `026-035` 与 Gray 数据 | FORWARD-MIGRATE | 直接回退会破坏已部署 schema 与历史证据 | 绝不 down migration 或删除；只新增 schema/adapter/弃用标记 | migration 重跑、旧数据兼容、rollback release |

## 删除与退役判定规则

- 数据、发布记录和审计事件只退役，不物理删除。
- 没有外部消费者、没有历史读取价值的 UI、helper、文案和测试可删除。
- 任何被 CodeGraph 或合同脚本发现仍有运行依赖的 `REMOVE` 项先降级为 `RETIRE` 或 `ADAPT`。
- 不使用整仓 `git revert`。每个阶段以目标化 diff 和本地 checkpoint commit 保持可回退性。

## 已关闭的基线缺陷

- Gray `v0.7.19` Run `canvas_run_46450a74-1e3d-4635-849c-cefa24768829` 曾因 legacy 节点只有 `model: gpt-image-2`、缺少 `modelRecordId` 而以 `CANVAS_RUN_MODEL_UNAVAILABLE` 失败。
- 当前创建预检只在启用、授权、能力与输入均兼容且唯一命中时解析 legacy 名称；否则在开始前失败关闭并要求重新选择模型或新建 Run Plan。Gray `v0.7.27/v0.7.28` 已证明显示的 catalog Provider/model identity 被持久化并冻结到不可变 Plan。
