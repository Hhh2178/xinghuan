# Canvas Agent Runtime 与 LLM 路由实施计划

> **Branch:** `feature/canvas-agent-runtime`
> **Architecture:** `docs/adr/0003-canvas-agent-runtime-and-llm-routing.md`
> **Specification:** `docs/superpowers/specs/2026-07-22-canvas-agent-runtime-and-llm-routing.md`

## Goal

以可回滚的分阶段迁移替换 Hermes 和浏览器画布编排，完成内部 Agent Runtime、服务端 Canvas Run、仅 LLM 路由池、质量评估、恢复、Admin 和画布交互闭环。

## Execution Rules

- 每个阶段先完成行为测试，再实现，再执行结构/Harness gate。
- 新领域逻辑不得继续堆入 `apps/api/src/server.ts`、`apps/worker/src/worker.ts` 或 `apps/web/src/components/Canvas.tsx`。
- legacy browser runtime 与新内核并行，按节点能力逐类迁移。
- 当前运行态文档只在能力真实落地后更新。
- Gray 只在完整本地门禁通过后准备；Production 需要用户单独授权。

## Phase 7 Video Understanding Workstream

1. 在 `agent-core` 路由请求中加入模型输入能力硬约束，区分 `native_video` 与 `sampled_frames`，并增加纯行为测试。
2. 新建独立 Worker chat/media adapter；Gemini 路径负责 owner-scoped 文件解析、Files API 上传/等待、`generateContent` 和临时文件清理，禁止任意命令与任意 URL。
3. Quality Coordinator 优先构造 native video task；只有产物已有合法时间戳帧且原生候选不可用时才使用 sampled-frame task。
4. Admin 模型与 LLM 路由界面显示 `videoReference`、传输方式、限制和模拟拒绝原因；不新增图片/视频生成模型路由池。
5. 覆盖 owner 隔离、URL/路径穿越、超限、Provider File 超时、技术回退、取消、预算和 single-input 下游选择测试。

本工作流不引入 FFmpeg。内部 `/files/output/...` 不是 Provider 可访问 URL；直接 URL 仅在 Provider 网关显式支持且服务端签发短期受控访问时使用。

## Phase Map

1. Architecture contracts：领域、ADR、规格、系统基线和验证入口。
2. Persistence/kernel：`packages/agent-core`、迁移、repositories、compiler、kernel、API。
3. Agent/LLM routing：Orchestrator、Tool Gateway、Policy、LLM pools、simulation、Hermes removal。
4. Quality/recovery：media evaluators、candidate selection、failure classification、retry budgets。
5. Admin：workspace、roles、routing、knowledge、policies、runs、approvals、audit。
6. Canvas UI：floating assistant、Agent node、supervision panel、SSE projections。
7. Integration/release：owner fair dispatch、multi-user、lease takeover、security, load, full Harness, Gray readiness。

### Phase 7 Node Capability And Deterministic Steps

- `node-execution-capabilities.ts` is the code-owned Node Capability Catalog. It must describe node purpose, ports/cardinality, recommended connections, model/service hints, failure codes, Agent actions, plan eligibility and actual runtime migration state.
- Admin and planner/manager/checker/recovery consume the same bounded catalog projection. A catalog entry cannot make a browser-only node server-runnable.
- `text`、`text-split`、`upload`、`material-set`、`pick-from-set`、`relay`、`output` are native deterministic Canvas Run steps. They write output bindings and Run Events inside the Worker transaction and never create a Provider task or execute arbitrary browser/script code. `text-split` shares its pure splitting algorithm between Web and Worker and freezes only executable options plus explicit segment overrides in the Run Plan.
- Remaining transform/workflow nodes remain `legacy_browser` until their concrete server executor and behavior evidence are added.

## Phase Gates

每阶段必须完成：

- `git diff --check`
- CodeGraph impact 与依赖方向检查
- 定向 test / type-check / build
- `npm run verify:file-hotspot-budgets`
- 相关 contract 与 Harness 聚合入口
- 系统文档和 `.planning/2026-07-22-canvas-agent-runtime/` 状态同步

## Rollback

- Phase 2-4 使用 feature gate，关闭后停止创建新 Agent/Canvas Run，不影响已有 Generation Task 收口。
- legacy runtime 在端到端迁移完成前保留。
- Agent 配置与 LLM 路由发布版本可回滚，运行中的 snapshot 不回写。
- 数据迁移只前向新增表和索引；回滚应用时保留数据，不执行批量删除。
