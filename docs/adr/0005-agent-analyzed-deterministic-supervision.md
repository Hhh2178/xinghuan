# ADR 0005: Agent 分析与确定性托管执行分层

> **Status:** Accepted
> **Date:** 2026-07-24
> **Owners:** Canvas / API / Worker / Admin / Auth / Storage
> **Decision Scope:** Assistant / AI Supervision / Workflow Run / Scheduling / Diagnostics / Provider Runtime
> **Supersedes:** None

## Context

ADR 0004 将 AI 托管收敛为工作流级确定性执行和有限恢复，保留了可靠的拓扑编译、不可变 Run snapshot、Worker lease 与事件账本。当前产品仍缺少运行前的智能分析：用户看不到哪些前置分支可以并行、哪些节点必须等待，也不能从托管错误直接进入 AI 助手获得基于真实 Run 证据的解释。

让 LLM 直接创建或改写执行顺序会破坏 ADR 0004 的确定性边界。完全不用 LLM 又无法提供用户需要的风险解释、并发建议和故障分析。因此需要把 Agent 分析、确定性校验和实际调度分成不同权威层。

## Decision

- Workflow snapshot、节点端口、显式边、阶段约束与编译器产出的依赖图是执行顺序的权威源。
- `supervision-planner` Agent 在 Run 计划阶段读取脱敏工作流摘要和确定性依赖图，只能输出并发建议、串行原因、风险和建议并发上限。
- Agent 输出必须经过结构、节点身份、依赖、预算和策略校验。它不能增加不存在的步骤、移除依赖、把有依赖的步骤放进同一并发层，也不能修改画布。
- 确定性编译器生成 Execution Layer。有效并发取 workflow 设置、已发布策略、Provider 配额和 ready step 数量的最小值；Worker 只领取依赖已成功的 ready step。
- Agent 不可用、超时或输出无效时，Run 以确定性分析降级继续。降级原因、Agent Run ID、冻结建议和最终执行层进入不可变 Run snapshot 与事件账本。
- AI 助手与 AI 托管继续保持独立身份。前台助手、后台助手和托管 planner 使用不同 Agent definition 与 LLM route pool，可分别发布和回滚。
- Canvas Run 失败统一投影为脱敏 `Canvas Run Failure Diagnostic`。Canvas 和助手消费同一投影；原始事件与任务记录继续保持权威且不可由助手改写。
- 助手可以解释证据、提出修复步骤和标注不确定性，但不得声称已重试、执行或修改工作流，除非存在对应的已审计动作记录。
- RunningHub 通用标准模型执行与 RH app/workflow catalog 执行保持两个显式模式；二者共享 Provider 身份与密钥治理，不共享请求合同。

## Alternatives

- 让 LLM 直接生成和执行任意 DAG：灵活但无法证明拓扑、权限、预算和幂等正确性，不采纳。
- 只展示确定性拓扑，不增加 Agent：运行可靠但不能提供用户要求的语义分析、风险说明和错误帮助，不采纳。
- 把 Agent 建议直接写回 workflow stages：会把一次运行建议变成静默结构修改，与快照和审批边界冲突，不采纳。
- 为 Canvas 和助手分别维护错误映射：短期改动小，但会产生用户看到一种错误、助手分析另一种错误的漂移，不采纳。

## Consequences

### Positive

- 用户能在执行前看到真实依赖、可并行入口、风险和预计请求数。
- 实际并发仍由确定性规则与 Worker 约束，Agent 误判不会破坏工作流。
- AI 托管在 Agent 服务降级时仍可运行。
- Canvas 错误与助手诊断共享事实，故障分析可复现、可审计。
- 前后台助手和托管 planner 可以独立选择模型、提示词、知识范围和预算。

### Negative

- Run plan、事件和 Admin 治理需要增加分析、执行层和配置版本投影。
- 真实验收必须同时覆盖 Agent 模型、Worker 并发、Provider 任务和浏览器状态，测试成本上升。
- 旧 Run 没有分析与共享诊断字段，需要兼容投影。

## Verification

- 编译器测试证明独立分支进入同一层、汇合节点等待全部依赖、循环和阶段冲突被拒绝。
- Agent 输出校验测试覆盖未知步骤、依赖违规、并发超限、超时和确定性降级。
- Worker 集成测试证明 ready-step 领取、并发上限、暂停/恢复、取消和收敛顺序。
- 共享诊断测试覆盖 workflow、input、model、provider、queue、budget、permission、runtime 与 unknown，并证明 secrets 和签名 URL 被移除。
- 使用真实 Agent 和真实图像任务运行一个双上游分支、一个汇合步骤和一个下游步骤，核对任务时间重叠、节点可见状态和最终产物。
- 制造一次安全的真实失败，确认 Canvas 文案明确，并由真实 Canvas 助手基于同一诊断给出证据化分析。
- 只验收 `1920x1080` 与 `2560x1440`；不增加移动端验收。

## Migration And Rollback

- 新分析、执行层和诊断字段前向添加到 JSON snapshot/projection，历史 Run 缺失时由确定性兼容投影补齐。
- `supervision-planner` 受环境开关和已发布配置控制；关闭后恢复确定性计划，不中断已开始 Run。
- 助手新 Agent key 保留旧 `assistantAgentKey` 读取回退，旧 Admin 深链重定向到新治理入口。
- RunningHub task snapshot 冻结 `standard_model` 或 `catalog_target`；回滚 adapter 不重写历史 task。
- Gray 失败时切回上一个 Gray release；不撤销前向 migration，不触碰 Production。
