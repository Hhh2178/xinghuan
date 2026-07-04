# 结构改进路线图 - 2026-07-04

## 这份文档是什么

这是一份跨阶段的结构改进规划，用于登记**当前热点文件治理体系尚未覆盖的结构性债务**，
并给出分阶段、可回滚的推进方案。

> 逐批**如何开工、收口、测试、校验、归档、记录**见配套执行手册：
> `2026-07-04-structural-improvement-execution-plan.md`。

它**不替代**已有的超大文件治理机制，而是与之互补。已有机制继续负责“单文件过大”这一维度：

- `docs/governance/engineering-guardrails.md`（硬预算护栏）
- `docs/governance/hotspot-risk-scorecard.md`（多维评分与拆分顺序）
- `docs/governance/hotspot-decomposition-workflow.md`（拆分操作手册）
- `docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md`（拆分台账）

本文件负责的是热点台账**没有覆盖的另外五类问题**：

1. `apps/api` 与 `apps/worker` 之间的重复代码（跨包，不是单文件过大）
2. Lint / 格式化 / CI 工具链悬空
3. 测试策略：184 个 `verify:*` 契约脚本是源码字符串匹配，缺少真实行为测试
4. 持久化层（文件仓储 + Postgres）散落在 `server.ts` 内，无仓储抽象
5. 运行时性能：鉴权/任务列表的读取热路径、异步任务实时机制、前端图标包体积

## 与热点台账的分工

| 维度 | 负责文档 | 状态 |
|------|----------|------|
| 单文件过大（server.ts / worker.ts / Canvas.tsx / 节点组件） | 热点台账 + 评分卡 + 硬预算 | 已有成熟机制，持续推进中 |
| 跨包重复代码 | **本文档 Phase 1** | 新登记 |
| 工具链（lint/CI/format） | **本文档 Phase 0** | 新登记 |
| 测试策略转型 | **本文档 Phase 5** | 新登记 |
| 持久化层抽象 | **本文档 Phase 3** | 新登记 |
| 运行时性能（读取热路径/实时/加载） | **本文档 Phase 6** | 新登记 |

说明：本文档的 Phase 2（server.ts 领域拆分）与热点台账高度重叠，
因此本文档**不重复驱动 server.ts 的拆分顺序**——那部分继续以评分卡为准。
本文档只在 Phase 1/3 提供“拆出来的公共逻辑应落到哪个包/层”的目标形态约束。

## 设计原则

1. 每一步可独立发布、可回滚，不做大爆炸式重构。
2. 结构调整阶段严禁夹带功能改动，保证 diff 可审。
3. 沿用现有约定：route handler 模式、`verify:*` 脚本、DEVLOG 台账、迁移编号。
4. 先建安全网（Phase 0），再动大件。

---

## Phase 0 — 工具链安全网（前置，1~2 天）

### 现状问题

- `package.json` 有 `lint`（eslint）与 `format`（prettier）脚本，但 **devDependencies 里既无 eslint 也无 prettier**，
  仓库内也无 `.eslintrc` / `eslint.config.*` / `.prettierrc`。→ `npm run lint` 直接报错，无人在跑。
- 无 CI：`.github/workflows` 不存在，所有校验只靠本地 `.githooks/pre-commit`。
- 无测试框架：找不到任何 vitest/jest。

### 动作

- [ ] 引入 `eslint` + `typescript-eslint`，加最小 `eslint.config.js`（no-unused-vars、no-floating-promises、import 顺序）。
      **先 warn 不 error**，避免 12 万行一次性全红。
- [ ] 补 `prettier` 实体依赖 + `.prettierrc`，或删掉悬空的 `format` 脚本（二选一，不留误导）。
- [ ] 引入 `vitest`，跑通 1 个样板测试，为 Phase 1/5 铺路。
- [ ] 建一个聚合 CI 入口（`npm run ci`：`type-check` -> `build` -> 核心 `verify:*`），
      可先接进 `.githooks`，远端具备条件后再上 Actions。

### 验收

- `npm run lint` 可执行且不报“找不到 eslint”。
- `npm run ci` 可一键跑通现有校验链。

### 风险

极低（不碰业务代码）。

---

## Phase 1 — 消除 api/worker 重复代码（收益最高，2~3 天）

### 现状问题（已精确核对，2026-07-04）

**A. 逐字节相同（md5 完全一致，可直接下沉）**

- `apps/api/src/grsai-reference-images.ts` == `apps/worker/src/grsai-reference-images.ts`
- `apps/api/src/provider-request-body.ts` == `apps/worker/src/worker-provider-request-body.ts`

**B. 已分叉的副本（需先 diff 归一，再下沉）**

- `apps/api/src/apimart-video-adapter.ts`(407) ~ `apps/worker/src/worker-apimart-video-adapter.ts`(398)
- `apps/api/src/audio-provider-adapter.ts`(115) ~ `apps/worker/src/worker-audio-provider-adapter.ts`(115)
- `apps/api/src/task-lifecycle.ts`(87) ~ `apps/worker/src/worker-task-lifecycle.ts`(154) — 差异较大，需人工判断是否本就有意分叉

> 影响：改一处漏一处会导致灰度/生产 provider 行为漂移。这是热点台账没覆盖的独立风险。

### 动作

- [ ] 新建 `packages/providers`（或复用 `packages/model-core`），把 A 类文件移入，api/worker 改为 import。
- [ ] B 类先 `diff`，把差异收敛为“同一实现 + 可选参数”，公共核下沉、app 专属差异保留在各自 app。
- [ ] 每下沉一个模块，补一个 vitest 行为测试（Phase 0 就绪后）锁住行为。

### 目标形态

- provider request-body 构造、reference-images、video/audio adapter 的公共核只有一份真相源。

### 验收

- api 与 worker 不再存在 md5 相同的重复文件。
- `npm run type-check` + 相关 `verify:*` + 新增 vitest 全绿。

### 风险

中（B 类需仔细核对），有测试兜底。

---

## Phase 2 — server.ts 领域拆分（以热点台账为准，本文档不重复驱动）

server.ts（约 11,905 行）的拆分**已有成熟机制**：

- 顺序由 `docs/governance/hotspot-risk-scorecard.md` 决定（当前 server.ts 排第 2，下一步 `provider key-pool / import-models residue`）。
- 硬预算由 `scripts/verify-file-hotspot-budgets.mjs` 守护（当前 `<= 11910`）。
- 拆分方式沿用现有 14 个 `handle*Routes({request, response, url, deps}): Promise<boolean>` 模式，**不引入 Express**。

### 本文档对该阶段的唯一补充约束

- 拆分过程中若发现可与 worker 共享的纯逻辑（如 provider 相关），应优先落到 Phase 1 的共享包，而非仅在 api 内部搬家。
- 路由分发最终收口目标：用一张轻量路由表替代当前 108 处手写 `pathname ===`，但这一步排在所有领域搬出之后。

---

## Phase 3 — 持久化层收口（1 周）

### 现状问题

`server.ts` 内混合两种持久化：约 23 处 `readFile/writeFile`（canvas 存文件）+ 约 75 处裸 SQL（用户/provider/model 存 Postgres），
由 `usePostgresRepository()` 开关散落切换，`environment-sync` 还要在两者间搬运。边界不清晰。

### 动作

- [ ] 抽 `repository/` 接口层：`CanvasRepository` / `AuthRepository` / `ProviderRepository` …
- [ ] 文件仓储 vs PG 仓储作为实现细节封在接口后，路由代码不再直接碰 `writeFile` / `pool.query`。
- [ ] 与 Phase 2 协同：领域 handler 搬出时顺带把其数据访问改走 repository。

### 目标形态

- 数据边界清晰，environment-sync 简化，未来切换/加缓存有单一入口。

### 风险

中。依赖 Phase 2 的领域拆分进度。

---

## Phase 4 — 前端节点组件抽象（以热点台账为准）

76 个节点组件 ~41k 行、`Canvas.tsx` 4052 行的拆分**已在热点台账第二~四批规划中**（评分卡已排序）。

本文档不重复驱动，仅补充一条长期方向：

- 抽共享节点脚手架（参数区容器、run 状态、错误翻译展示）到 `packages/ui` 或 `nodes/shared`，
  让 machine-first、auto-height 这类跨节点调整只改一处（当前需在多个节点重复调）。

---

## Phase 5 — 测试策略转型（贯穿 Phase 1/3）

### 现状问题

- 0 个真实单测（无 `.test.ts` / `.spec.ts`）。
- 231 个 npm 脚本中 184 个 `verify:*` 是 `readFileSync` + 正则/`includes` 的**源码字符串匹配**，
  测的是“代码长什么样”而非“代码做什么”：重命名 CSS class 即红，逻辑写错却全绿。

### 动作（增量替换，不推倒重来）

- [ ] 每重构一个纯逻辑模块（provider request-body、workflow normalizer、canvas migration、environment-sync 归一化），
      用 vitest 写行为测试，同步退役对应的脆弱契约脚本。
- [ ] 保留少数守护“架构约束”的 verify（如“main 不再内联某组件”“热点文件未超预算”）。

### 目标形态

- 核心纯逻辑有真实行为测试；契约脚本回归到只守护结构约束这一本职。

## Phase 6 — 运行时性能优化（后端读取热路径 + 前端加载）

> 第二轮性能取证（2026-07-04）结论。前端构建与任务写入路径已优化（`[mimo-perf]` 分包/懒加载/memo、
> `writeTaskRecord` 精准 update、`readTaskRecord` 单行 join、DB 索引齐全），问题集中在**读取热路径与实时机制**。

### 现状问题（按优先级）

**P1. 每个已登录请求 = 5 条全表查询（最值得改）**

- `getCurrentUser()` 几乎每请求都调用 -> `readAuthDb()` -> `readAuthDbPostgres()`
  并行全表读 `users / sessions / login_attempts / user_groups / group_policies`，再在 JS 里 `.find()` 定位 session。
- `idx_xh_sessions_user_id` 及主键索引已建**但未被使用**（不是 `where id=$1`，而是拉全表内存查找）。
- 影响：每请求 O(N)，用户/会话越多越慢。

**P2. `readAdminDb` 每次全量读任务表（含大 JSON 字段）**

- `readAdminDbPostgres` 每次执行 `select ... payload, result, logs ... from xh_tasks order by created_at desc`（**无 LIMIT**）。
- 全库共 12 处无 `LIMIT` 的 `order by` 全表查询；overview/summary 一刷新就把全部历史任务连大字段拉出。

**P3. 异步媒体任务无统一推送，各节点独立轮询**

- LLM 有 SSE 流式、公告有 SSE，但 image/video/audio 异步任务是 submit+poll，
  每个生成节点各自 `setInterval`（`ImageNode/VideoNode/AudioNode/SeedanceNode/RHToolsNode/RunningHubNode`）。
- 影响：画布并发 N 个节点 = N 个轮询循环 + N 倍后端查询，负载随节点数线性增长。

**P4. 575KB 图标包（tree-shaking 被破坏）**

- `vendor-icons` 打出约 575KB（最大 chunk），根因是 3 处命名空间导入把整个 lucide 库拉入：
  - `apps/web/src/components/Canvas.tsx:46` `import * as LucideIcons`
  - `apps/web/src/components/nodes/PlaceholderNode.tsx:3` `import * as Icons`
  - `apps/web/src/components/Sidebar.tsx:2` `import * as Icons`
- 其余 92 个文件均为规范具名导入（可 tree-shake）。

**P5. 连接池偏小**

- `getPostgresPool` `max: 5`；灰度够用，生产放量（多用户并发 + worker 也连库）时可能成瓶颈。

### 动作

- [ ] P1：鉴权改两条精准查询（`where id=$1`），或加短 TTL（5~10s）会话内存缓存。**行为零变更、风险最低。**
- [ ] P2：任务列表查询分页 + 列表不 select `payload/result/logs`（大字段仅详情查询取）；summary 用聚合/`count(*)` 代替拉全表在 JS 里算。
- [ ] P3：新增统一任务状态 SSE（复用 `announcement-sse.ts` 模式），或前端合并为共享轮询器（一次请求批量查多个 taskId）。
- [ ] P4：3 处 `import *` 改为显式图标映射表（只登记实际使用的图标），首屏 JS 瘦身。
- [ ] P5：按并发量调 `max`，区分 api 与 worker 的池配置。

### 优先级与风险

| 优化点 | 影响面 | 风险 | 收益 |
|--------|--------|------|------|
| P1 鉴权精准查询/缓存 | 每个请求 | 低 | 高 |
| P2 任务列表分页+去大字段 | overview/列表刷新 | 低 | 高 |
| P3 统一任务 SSE / 合并轮询 | 多节点并发 | 中 | 高 |
| P4 修 3 处 `import *` 图标 | 首屏加载 | 低 | 中 |
| P5 连接池调参 | 生产高并发 | 低 | 中 |

### 与其他阶段的关系

- P1/P2 是纯后端读取优化，可独立于结构重构先行；若已进入 Phase 3（持久化层），应把这两项优化直接落进 repository 实现。
- P4 是纯前端、与热点台账无冲突，可随时单独做。

### 验收

- P1：鉴权路径不再出现全表 SELECT（可用查询日志/EXPLAIN 核对走索引）。
- P2：任务列表接口响应体不含 `payload/result/logs`，且带分页参数。
- P4：`vendor-icons` chunk 体积显著下降。

---

## 里程碑顺序

```
Phase 0 (工具链安全网)
   |
   +--> Phase 1 (api/worker 去重 · 收益最高) --> Phase 3 (持久化层收口)
   |            |
   |            +-(Phase 5 测试增量替换 · 贯穿)
   |
   +--> (Phase 2 server.ts / Phase 4 前端节点 · 由热点台账按评分卡持续推进)

Phase 6 (性能优化) · P1/P2/P4 可独立先行；P1/P2 若进入 Phase 3 则落进 repository 实现
```

## 推进建议

- 立即可做且零业务风险：Phase 0。
- 收益最高：Phase 1（消除已确认的跨包重复）。
- Phase 2 / Phase 4 不新开战线，跟随现有热点台账节奏。
- 性能上优先做 Phase 6 的 P1/P2（纯后端读取优化，行为零变更、风险最低）。

## 使用规则

- 本文档每完成一个 checkbox，需在 DEVLOG.md 记录“逻辑落到哪里、还剩什么、下一步”。
- 若某阶段与热点台账产生顺序冲突，以热点台账（评分卡）为准，本文档让路。
