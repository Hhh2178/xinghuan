# Domain Context 与 ADR 治理规范

生效日期：`2026-07-17`

## 目的

本规范把领域语言、当前实现、架构决策、实施计划和执行证据拆到不同权威源，避免方案被误认为现状，也避免同一个概念在多个系统里各自定义。

## 单一事实来源

| 问题 | 权威源 | 不应承载 |
| --- | --- | --- |
| 领域词汇和跨系统不变量是什么 | `CONTEXT.md` | 版本、发布记录、详细实现 |
| 系统现在如何工作 | `docs/systems/` | 尚未采纳的目标架构 |
| 为什么选择或拒绝某个架构方案 | `docs/adr/` | 执行流水、当前部署状态 |
| 准备分几步实施 | `docs/superpowers/plans/` | 永久架构决策正文 |
| 跨会话仍有效的阶段判断 | `docs/memory/` | 每日过程证据 |
| 实际做了什么、如何验证 | `docs/logbooks/` | 领域定义和系统规范 |

其他文件可以摘要和链接，不得复制成长正文。

## CONTEXT.md 规则

- 只定义稳定领域词汇、实体边界和跨系统不变量。
- 新增或重命名核心概念、改变 ownership 或生命周期语义时必须更新。
- 当前实现路径只做导航，正文仍落在对应系统文档。
- 目标方案必须链接 ADR，并标明其状态；Proposed 不得写成已实现事实。
- 不写 secrets、用户数据、版本号、release ID 或单次事故细节。

## ADR 生命周期

ADR 状态只允许：`Proposed`、`Accepted`、`Superseded`、`Rejected`。

- `Proposed`：正在评审，不具备强制实现效力。
- `Accepted`：已批准，后续实现和评审必须遵循；若代码尚未落地，要在 ADR 中明确迁移阶段。
- `Superseded`：被新的 ADR 取代，旧文件保留，只增加替代关系。
- `Rejected`：明确不采纳，保留上下文和理由，防止重复讨论。

状态变化必须同时更新 ADR 文件和 `docs/adr/README.md` 索引。Accepted ADR 不因新方向直接改写历史决定；应新增 ADR 并通过 `Supersedes` 建立替代关系。

## 何时必须新增 ADR

- 改变数据权威源、ownership、事务边界或生命周期。
- 引入或替换数据库、队列、对象存储、认证模型等基础设施。
- 改变跨系统 API/事件协议或部署拓扑。
- 选择一个会长期限制后续实现的方案，且存在有意义的替代方案。
- 需要记录为何不采纳某条高成本路径。

局部重构、纯视觉调整、可逆的小型实现选择通常不需要 ADR。

## ADR 文件合同

- 命名：`docs/adr/NNNN-kebab-title.md`，编号四位且只增不复用。
- 模板：`docs/adr/0000-template.md`。
- 必填元数据：`Status`、`Date`、`Owners`、`Decision Scope`。
- 必填正文：Context、Decision、Alternatives、Consequences、Verification、Migration And Rollback。
- 索引：每个 ADR 必须登记在 `docs/adr/README.md`。

## Agent 执行规则

- 涉及领域模型或跨系统架构时，按 `AGENTS.md -> docs/INDEX.md -> CONTEXT.md -> docs/adr/README.md -> 对应系统文档` 阅读。
- 实施前检查是否存在 Accepted ADR；实现不得静默违背它。
- 新方案若尚未获得批准，记录为 Proposed，不得把未来表、服务或迁移写成当前事实。
- 实现 Accepted ADR 后，同轮更新对应系统文档与验证证据。
- 发现新需求与 Accepted ADR 或 CONTEXT 不变量冲突时，停止扩大变更范围并先提出新 ADR。

## Harness

运行：

```bash
npm run verify:domain-context-and-adr-contract
```

该契约检查入口接线、ADR 元数据与章节、索引登记和核心领域词汇，不替代人工架构评审。

