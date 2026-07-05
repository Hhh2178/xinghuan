# 结构改进与性能优化 · 执行计划 - 2026-07-04

## 这份文档是什么

这是 `2026-07-04-structural-improvement-roadmap.md` 的**配套执行手册**。

- 路线图（roadmap）回答：**要做什么、为什么、优先级**。
- 本执行计划回答：**每一批具体怎么开工、怎么收口、怎么测试校验、怎么归档记录**。

本计划完全遵循 `docs/governance/hotspot-decomposition-workflow.md` 的批次流程，
不新造流程，只把它落到本轮六个 Phase 的每一批上。

若与 `docs/governance/` 下任何治理规则冲突，以治理规则为准，本计划让路。

---

## 一、通用批次协议（每一批都必须照做）

每一批（= 一个可回退的 clean commit）都走同一套七步。这是本计划所有 Phase 的公共约束。

### 开工前（收口边界）

1. `git status --short` + `git diff --stat` + `npm run codegraph:status`
   - 确认工作树干净；若已混入无关改动，先收口或记录归属，再开工。
2. 写清本批三问：本批保留什么、下沉/改动哪一层、新职责落到哪个文件。

### 执行中（小步 + 行为零变更）

3. 一批只覆盖一个关注点（一个热点文件 / 一个去重模块 / 一个性能点）。
   结构调整批次严禁夹带功能改动。
4. 先加/更新验证脚本或单测，再改代码（测试先行，锁住行为）。

### 收口前（测试 + 校验）

5. 按顺序跑验证，每批至少满足其中两类：
   - `npm run type-check`（对应 workspace）
   - `npm run build`（对应 workspace）
   - 相关 `verify:*` 合约脚本
   - 新增 vitest 行为测试
   - 入口治理脚本：`npm run verify:file-hotspot-budgets`、`npm run verify:hotspot-watchlist-contract`
6. 记录（归档）：按 `templates/daily-log-template.md` 写入 `docs/logbooks/daily/YYYY-MM-DD.md`，
   含：目标 / 变更 / 验证 / 影响 / 风险 / 下一步。
   - 触碰热点文件的，同步更新 `2026-06-24-hotspot-superfile-decomposition-ledger.md`。
   - 有独立验证证据的，按 `templates/validation-record-template.md` 写入 `docs/logbooks/validations/`。

### 收口（clean commit）

7. 再次 `git status --short` + `git diff --stat` + `npm run codegraph:sync`；
   确认只剩本批预期改动、无临时产物；形成 clean commit。
   无法形成 clean commit 就不算"已完成一批"。

### 每个 Phase 完成后

- 在 roadmap 文档对应 Phase 勾选 checkbox。
- 在本文件"执行进度看板"更新状态。

---

## 二、总体执行顺序

```
批次组 A — Phase 0 工具链安全网      （前置，1~2 天，零业务风险）
        |
批次组 B — Phase 6 P1/P2 后端读取优化 （收益最高，行为零变更）
        |
批次组 C — Phase 1 api/worker 去重    （消除行为漂移，靠 A 的 vitest 兜底）
        |
批次组 D — Phase 6 P4 前端图标瘦身    （纯前端，可与 B/C 并行）
        |
批次组 E — Phase 3 持久化层收口       （承接 B 的读取优化）
        |
批次组 F — Phase 6 P3 任务 SSE / 合并轮询（改动面较大，独立评估）

（Phase 2 server.ts / Phase 4 前端节点：不在本计划新开战线，
  跟随 hotspot-risk-scorecard.md 的评分节奏持续推进。）
```

优先做 A → B：先建安全网，再做零风险高收益的后端读取优化。

---

## 三、逐批执行清单

### 批次组 A — Phase 0 工具链安全网

**A1｜引入 ESLint（先 warn 不 error）**
- 变更：加 `eslint` + `typescript-eslint` 到 devDeps；新增 `eslint.config.js`（no-unused-vars、no-floating-promises、import 顺序，均设 warn）。
- 测试校验：`npm run lint` 可执行且不报"找不到 eslint"；不因存量代码报 error 阻断。
- 记录：daily log 记录基线 warning 数，作为后续下降参照。
- 收口：单独 commit。

**A2｜补齐或清理 Prettier**
- 变更：二选一——补 `prettier` 依赖 + `.prettierrc`；或删掉悬空的 `format`/`format:check` 脚本。
- 校验：`npm run format:check` 可执行或脚本已移除。
- 收口：单独 commit。

**A3｜引入 vitest + 样板测试**
- 变更：加 `vitest` 到 devDeps；根 `vitest.config.ts`；写 1 个样板测试（挑一个已有纯函数，如 `packages/shared` 里的 normalizer）跑通。
- 校验：`npm run test` 绿。
- 记录：daily log 说明测试落点约定（就近 `*.test.ts`）。
- 收口：单独 commit。

**A4｜聚合 CI 入口**
- 变更：加 `npm run ci` 脚本（`type-check` → `build` → 核心 `verify:*` → `test`）；接进 `.githooks` 或新增 Actions workflow。
- 校验：`npm run ci` 一键跑通。
- 收口：单独 commit。

> A 组完成即拥有 lint + 测试 + CI 三道安全网，后续所有批次都在其保护下进行。

---

### 批次组 B — Phase 6 P1/P2 后端读取热路径优化（行为零变更）

**B1｜鉴权改精准查询（P1，最高优先）**
- 现状：`getCurrentUser → readAuthDb → readAuthDbPostgres` 每请求 5 条全表 SELECT + JS `.find()`。
- 变更：新增 `readSessionById($1)` + `readUserById($1)` 精准查询（走已有 `idx_xh_sessions`/主键），
  `getCurrentUser` 改用它们；保留原全表读给需要整表的后台场景。
- 测试先行：vitest 覆盖"有效 session / 过期 session / revoked / 用户 disabled"四种归一化分支。
- 校验：`type-check -w @xinghuan/api`；用 EXPLAIN 或查询日志确认走索引；`verify:*` 鉴权相关脚本全绿。
- 记录：daily log + validation 记录（附 EXPLAIN 走索引证据）。
- 风险：低（行为等价，仅数据访问方式变化）。

**B2｜任务列表分页 + 去大字段（P2）**
- 现状：`readAdminDbPostgres` 每次 `select ... payload,result,logs ... from xh_tasks`（无 LIMIT）。
- 变更：
  - 列表查询新增分页参数，`select` 不含 `payload/result/logs`；大字段仅 `readTaskRecord` 详情取。
  - summary/overview 用 `count(*)`/聚合替代拉全表在 JS 里统计。
- 测试先行：vitest 覆盖分页边界与 summary 聚合结果。
- 校验：接口响应体确认不含大字段且带分页；`verify:admin-task-panel-contract` 等相关脚本；`type-check`。
- 记录：daily log 说明"哪些接口改为分页、大字段收敛到哪里"。
- 风险：中（涉及前端列表消费方，需同步核对 admin/web 调用点）。

**B3｜连接池调参（P5，随手做）**
- 变更：`getPostgresPool` 的 `max`/超时按并发量参数化（env 可配），api 与 worker 区分。
- 校验：本地起服务确认连接正常；记录默认值与可调 env。
- 风险：低。

---

### 批次组 C — Phase 1 api/worker 去重

**C1｜下沉逐字节相同文件（A 类，零风险）**
- 变更：新建 `packages/providers`（或复用 `model-core`），移入并统一 import：
  - `grsai-reference-images.ts`（api == worker，md5 一致）
  - `provider-request-body.ts` == `worker-provider-request-body.ts`
- 测试先行：为下沉模块补 vitest 行为测试。
- 校验：`type-check` 全 workspace；`verify:package-exports`；api 与 worker 不再有 md5 相同文件（可加一个 `verify:no-cross-app-dup` 脚本固化）。
- 记录：daily log + 若新建包则补 `packages/providers/README`。
- 风险：低。

**C2｜归一并下沉分叉副本（B 类）**
- 对象：`apimart-video-adapter`(407/398)、`audio-provider-adapter`(115/115)、`task-lifecycle`(87/154)。
- 变更：逐个先 `diff`，公共核下沉、app 专属差异保留为参数/钩子；`task-lifecycle` 差异大，先判断是否本就有意分叉，是则不强合。
- 测试先行：每个 adapter 下沉前补 vitest 锁住 request-body/响应归一化行为。
- 校验：`type-check`；provider 相关 `verify:*`；新增 vitest。
- 记录：daily log 逐个说明"合并了什么、保留了什么差异、为什么"。
- 风险：中（有测试兜底），一次一个 adapter，独立 commit。

---

### 批次组 D — Phase 6 P4 前端图标瘦身（纯前端，可并行）

**D1｜消除 `import *` 图标导入**
- 对象：`Canvas.tsx:46`、`nodes/PlaceholderNode.tsx:3`、`Sidebar.tsx:2` 的 `import * as ... from 'lucide-react'`。
- 变更：改为显式图标映射表（只登记实际用到的图标名）。
- 校验：`npm run build -w @xinghuan/web`；确认 `vendor-icons` chunk 体积显著下降（记录前后 KB）。
- 记录：daily log 附前后体积对比。
- 风险：低（需回归确认动态图标名场景无缺失，先清点使用面）。

---

### 批次组 E — Phase 3 持久化层收口

**E1｜抽 repository 接口骨架**
- 变更：定义 `CanvasRepository` / `AuthRepository` / `ProviderRepository` 接口 + 文件/PG 两套实现；先接一个领域（建议 auth，承接 B1）。
- 测试先行：接口层 vitest（文件实现用临时目录，PG 实现可 mock/集成）。
- 校验：`type-check`；对应领域 `verify:*`。
- 记录：daily log + `docs/systems/` 补持久化边界说明。
- 风险：中，依赖 Phase 2 领域拆分进度，按领域逐个迁移。

---

### 批次组 F — Phase 6 P3 任务实时机制

**F1｜统一任务状态 SSE / 合并轮询**
- 现状：image/video/audio 各节点独立 `setInterval` 轮询。
- 变更（二选一，需先做小设计）：
  - 方案甲：新增任务状态 SSE（复用 `announcement-sse.ts` 模式），前端订阅替代逐节点轮询。
  - 方案乙：前端合并为共享轮询器，一次请求批量查多个 taskId。
- 测试先行：SSE/批量查询接口的 vitest + 前端订阅逻辑。
- 校验：`type-check`；多节点并发场景手工验收（记录请求数下降）。
- 记录：daily log + validation（附并发下请求数对比）。
- 风险：中偏高（改动实时链路），单独立项、独立评估后再排期。

---

## 四、测试与校验矩阵

| 批次 | type-check | build | verify 合约 | vitest | 治理脚本 | 手工验收 |
|------|-----------|-------|-------------|--------|----------|----------|
| A1~A4 | ✓ | ✓ | 核心集 | 样板 | — | — |
| B1 | api | — | 鉴权相关 | ✓ | — | EXPLAIN 走索引 |
| B2 | api | — | task-panel | ✓ | — | 接口体无大字段 |
| B3 | api | — | — | — | — | 连接正常 |
| C1 | 全部 | ✓ | package-exports | ✓ | — | 无 md5 重复 |
| C2 | api/worker | — | provider 相关 | ✓ | — | — |
| D1 | web | web | — | — | — | vendor-icons 体积↓ |
| E1 | api | — | 领域相关 | ✓ | — | — |
| F1 | api/web | — | — | ✓ | — | 并发请求数↓ |

每批还需常跑：`verify:file-hotspot-budgets`、`verify:hotspot-watchlist-contract`（确保没把新逻辑堆回热点文件）。

---

## 五、归档与记录清单（每批产出物）

- 逐日台账：`docs/logbooks/daily/YYYY-MM-DD.md`（必写，用 daily-log-template）
- 验证记录：`docs/logbooks/validations/`（有独立验证证据时，用 validation-record-template）
- 热点台账：`2026-06-24-hotspot-superfile-decomposition-ledger.md`（触碰热点文件时同步）
- 系统知识：`docs/systems/<system>/`（有长期架构影响时）
- 路线图勾选：`2026-07-04-structural-improvement-roadmap.md` 对应 checkbox
- 发布证据：若某批推灰度/生产，按 `templates/release-record-template.md` 记 `docs/logbooks/releases/`

记录禁止只写"已优化""已重构"，必须写清：下沉/改动了什么、还保留什么、下一步最小落点。

---

## 六、执行进度看板

> 2026-07-05 update: this board is now tracked from the active clean worktree `xinghuan-integration-clean`.
> ComfyUI feature development is frozen separately and is not part of the remaining structural execution batches.

| Phase | 批次 | 状态 | Clean commit | 记录归档 | 备注 |
|-------|------|------|--------------|----------|------|
| 0 | A1 ESLint | 已完成 | `53f8ee8` | `2026-07-05 daily` | warn-first baseline |
| 0 | A2 Prettier | 已完成 | `53f8ee8` | `2026-07-05 daily` | 移除误导性 format 入口，避免 1060 个历史格式差异阻断 |
| 0 | A3 vitest | 已完成 | `53f8ee8` | `2026-07-05 daily` | 根 test 入口已跑通 |
| 0 | A4 CI 聚合 | 已完成 | `53f8ee8` | `2026-07-05 daily` | `npm run ci` 已通过 |
| 6 | B1 鉴权精准查询 | 部分完成 | `9e27bc7` | `2026-07-05 daily` | current-user 精准查询已完成；login email lookup 延后到 E1 auth repository |
| 6 | B2 任务列表分页 | 已完成并灰度验证 | `f9d7fff` / gray `c549e71` | `2026-07-05 daily` / gray release log | 列表响应去除 `payload/result/logs`；`20260705-admin-task-list-heavy-fields-gray-r1-v0525` live verify 已通过 |
| 6 | B3 连接池调参 | 已完成 | 本批提交 | `2026-07-05 daily` | API/Worker pool 默认值不变，可通过 shared/service env 覆盖 |
| 1 | C1 去重(A类) | 已完成 | `7966bd1` | `2026-07-05 daily` | shared/node 子路径导出，避免污染 Web/Admin bundle |
| 1 | C2 去重(B类) | 已完成 | `7966bd1` | `2026-07-05 daily` | audio provider adapter 共用逻辑已下沉 |
| 6 | D1 图标瘦身 | 已完成 | `619fcdd` | `2026-07-05 daily` | `vendor-icons` 从约 588 KB 降到约 58 KB |
| 3 | E1 repository 骨架 | 部分完成 | `9e27bc7` | `2026-07-05 daily` | auth current-user slice 已落地；其余 repository 仍需分批 |
| 6 | F1 任务 SSE | 待决策 | — | — | 先写 decision/deferral record，不直接实现 |

每完成一批，更新本表 + roadmap checkbox + daily log。

---

## 七、启动建议

- 下一步执行或明确延期 **B3**（连接池调参）。
- 再继续 **E1** 剩余 repository 边界；每个领域单独提交、单独校验。
- **F1** 先写任务实时机制 decision/deferral record，不在迁移期间直接开新实时链路。
- 进入下一轮灰度或正式推进前，先跑迁移完整性校验，确认成果没有只停留在 `xinghuan-milestone-b`。
