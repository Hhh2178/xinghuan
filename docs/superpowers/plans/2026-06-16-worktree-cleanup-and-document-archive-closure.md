# Worktree Cleanup And Document Archive Closure Plan

> **For agentic workers:** Keep this plan scoped to documentation governance, archive closure, and dirty-worktree batching strategy. Do not revert unrelated dirty files. Any file removal must still follow the repository single-file deletion rule.

**Goal:** 在不打乱当前实现改动的前提下，先把当前 worktree 的脏工作区分批策略、热点文件归属、文档主入口和历史归档批次收口清楚，避免后续继续出现“状态已推进但入口仍挂旧材料”的问题。

**Architecture:** 以 `README.md`、`AGENTS.md`、`MEMORY.md`、`docs/prd/README.md`、`ops/README.md` 五个主入口为当前状态唯一来源；`ops/archive/` 与 `development/_archive/` 只承担历史证据职责；脏工作区按主题批次处理，热点文件通过“先定归属、再合并验证”的方式收束。

**Tech Stack:** Markdown, Git worktree discipline, existing docs/ops archive structure, CodeGraph-aware repo governance.

---

## File Structure Map

- Create: `docs/superpowers/plans/2026-06-16-worktree-cleanup-and-document-archive-closure.md`
- Modify: `ops/README.md`
- Modify: `ops/archive/README.md`
- Create: `ops/archive/2026-06-assistant-and-ui-rollout/README.md`
- Create: `ops/archive/2026-06-provider-and-infra-rollout/README.md`
- Modify: `docs/documentation-governance.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `MEMORY.md`
- Modify: `DEVLOG.md`

## Task 1: 固定脏工作区分批策略

- [ ] 把当前 dirty worktree 分成明确批次，至少覆盖：
  - `Phase D + Phase E runtime / observability`
  - `generation-library material access`
  - `GRSAI nano / error passthrough / output text flow`
  - `CodeGraph + docs governance + ops archive`
- [ ] 标明热点文件不能简单整文件归入单批：
  - `apps/api/src/server.ts`
  - `apps/worker/src/worker.ts`
  - `apps/admin/src/admin-types.ts`
  - `apps/admin/src/admin-readonly-panels.tsx`
  - `package.json`
  - `DEVLOG.md`
  - `MEMORY.md`
- [ ] 规定后续批次推进顺序：
  1. 先补文档入口和归档批次
  2. 再按运行时能力批次做验证和落地
  3. 最后处理跨批热点文件的一致性验证

## Task 2: 收束 `ops/README.md` 当前入口

- [ ] 把 `ops/README.md` 重新拆成：
  - 当前状态摘要
  - 当前运行态 / 当前放行入口
  - 当前灰度材料
  - 当前生产材料
  - 历史归档批次
- [ ] 从“当前运行态入口”移出明显已被后续阶段覆盖的历史记录，只保留：
  - 当前 active release 仍直接依赖的 runbook / checklist / gate / rollback / 最新阶段 release 记录
- [ ] 为被移出的历史记录补归档批次索引，不让文件游离在 archive 中没有说明

## Task 3: 补齐新的归档批次说明

- [ ] 新增 `ops/archive/2026-06-assistant-and-ui-rollout/README.md`
  - 收口 `2026-06-08` 到 `2026-06-10` 的 Hermes、助手 UI、生成数量、清理进度等早期产品闭环记录
- [ ] 新增 `ops/archive/2026-06-provider-and-infra-rollout/README.md`
  - 收口 `2026-06-12` 的 Cloudflare、files 域名、Provider 任务化早期灰度、并发治理、ModelScope 协议修复等已被后续阶段覆盖但仍有审计价值的材料
- [ ] 更新 `ops/archive/README.md`，列出所有归档批次及各自职责

## Task 4: 固定治理规则，避免旧信息长期滞留

- [ ] 在 `docs/documentation-governance.md` 中补充明确规则：
  - `ops/README.md` 当前入口最多保留“当前 active release 仍需要直接引用”的材料
  - 同一主题出现新 release / 新阶段后，旧 release 记录必须在同轮推进内判断是否归档
  - 新增归档批次时必须同步更新 `ops/archive/README.md`
- [ ] 在 `AGENTS.md` 中补充：
  - 查看当前状态优先看五个主入口
  - 文档收尾未完成前，不应宣称阶段记录已收口
  - 每轮真实推进后要做入口一致性核对
- [ ] 如当前主入口口径变化，再同步更新 `README.md`、`MEMORY.md`

## Task 5: 验证与记录

- [ ] 运行文档一致性检查：
  - `rg -n "当前运行态入口|历史归档批次|ops/archive" ops/README.md ops/archive/README.md docs/documentation-governance.md AGENTS.md`
  - `git status --short`
- [ ] 执行 `codegraph sync`
- [ ] 在 `DEVLOG.md` 追加本轮“文档治理与归档收束”记录：
  - 目标
  - 入口调整
  - 新增归档批次
  - 后续维护要求

## Success Criteria

- `ops/README.md` 不再平铺大量已经脱离当前运行态的历史灰度/正式材料。
- `ops/archive/README.md` 能解释每个归档批次收了什么、为什么归档。
- `AGENTS.md` 与 `docs/documentation-governance.md` 对入口更新和归档动作的要求一致。
- 后续恢复上下文时，可先看五个主入口，不再需要从旧 release 记录里猜当前状态。
