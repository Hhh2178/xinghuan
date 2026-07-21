# Architecture Decision Records

本目录记录会长期约束系统的架构决定及其理由。治理规则以 `docs/governance/domain-context-and-adr-standard.md` 为准；当前实现仍以 `docs/systems/` 为准。

## 状态

- `Proposed`：评审中，尚未成为实现约束。
- `Accepted`：已批准，实施与评审必须遵循。
- `Superseded`：已被另一 ADR 取代，历史保留。
- `Rejected`：已决定不采纳，理由保留。

## 创建与变更

1. 复制 `0000-template.md`，使用下一个未占用的四位编号。
2. 写清上下文、选择、替代方案、代价、验证和回滚。
3. 在下方索引登记文件和状态。
4. 状态变化时同步修改文件和索引。
5. 新决定推翻旧决定时新增 ADR，并用 `Supersedes` 链接；不要抹掉旧记录。

## 索引

| ADR | 标题 | 状态 | 日期 | 范围 |
| --- | --- | --- | --- | --- |
| [0001](0001-generation-artifact-authority-and-lifecycle.md) | 生成产物权威源与生命周期 | Accepted | 2026-07-17 | API / Worker / Storage / Canvas |
| [0002](0002-task-cost-ledger-and-pricing-snapshots.md) | 任务费用台账与价格版本快照 | Accepted | 2026-07-21 | Admin / API / Worker / Storage |

## 模板

- `0000-template.md`
