# Phase E 系统观测与放行门槛设计

## 背景

`Phase E` 第一阶段已经补齐 `requestId`、审计来源字段和 Worker 关键生命周期结构化日志，但后台系统页仍缺少“当前运行是否健康”的最小观测项，运维放行材料也还没有把这些观测检查写成固定 gate。

如果继续只依赖零散发布记录，会再次出现两个问题：

- 协作者不知道 `/api/admin/system` 里哪些字段才是当前必须看的运行指标。
- gray / production 放行时，容易只验证功能可用，却漏掉请求链路、数据库目标和审计覆盖率这些运行态基线。

因此第二阶段不做完整 dashboard，而是把系统页和放行 gate 统一到一套最小、稳定、可重复执行的口径。

## 目标

本轮补齐以下内容：

1. `/api/admin/system` 返回稳定的系统观测字段。
2. 后台系统页直接展示数据库目标、任务状态概览和审计 `requestId` 覆盖率。
3. 生产验收清单和 Phase E gate 文档明确要求：
   - `x-request-id` 回写
   - `/api/admin/system` 观测字段存在
   - gray / production 都按同一 gate 验证
4. release package 带上当前 Phase E 关键验证脚本，避免服务器 current release 缺脚本。

## 非目标

- 不做完整趋势图。
- 不引入外部监控平台。
- 不为了冲突统计单独增加新表或新迁移。
- 不把本轮写成“gray / production 已完成 Phase E 发布”，除非真实执行过服务器放行。

## 观测字段范围

### 数据库目标

直接复用现有数据库连接信息和 `XINGHUAN_EXPECTED_DATABASE_NAME`：

- `database.currentDatabase`
- `database.expectedDatabase`
- `database.targetMatched`

用途：

- 判断当前服务是否连到了预期库。
- 避免 gray / production release 指向错误数据库而文档未及时反映。

### 任务运行概览

当前无需新表，直接从 `xh_tasks` 或 file-mode 任务列表汇总：

- `total`
- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`
- `failedLast24h`

用途：

- 系统页能快速看到 backlog、正在执行和最近失败量。
- 放行时可以确认队列没有明显堆积或异常失败抬升。

### 审计请求链路覆盖率

从最近 100 条审计记录汇总：

- `total`
- `sampled`
- `withRequestId`
- `requestIdCoveragePercent`

用途：

- 验证 request-chain 并不是只在单个接口存在，而是已经进入最近真实写操作样本。

## 为什么暂不做冲突统计

当前代码里虽然已有：

- `CANVAS_REVISION_CONFLICT`
- `RESOURCE_REVISION_CONFLICT`
- `ADMIN_SETTINGS_REVISION_CONFLICT`

但这些冲突还没有统一沉淀成稳定、可回放、低歧义的统计口径。如果这一轮强行把它写进系统页，很容易把“最近一次异常日志”误写成“可信趋势”。

因此本轮先把冲突统计明确列为下一步，而不是伪造一个看起来完整但不可依赖的指标。

## 放行 gate 约束

gray / production 在进入 active release 前，至少要固定执行：

1. `verify:release-preflight`
2. `verify:request-chain-observability`
3. `verify:system-observability`
4. `/api/admin/system` 人工核对：
   - 当前数据库
   - 目标数据库
   - 数据库目标校验
   - 队列深度
   - 任务概览
   - 请求 ID 覆盖率

## 文档落点

- 设计：本文件
- 实施计划：`docs/superpowers/plans/2026-06-15-phase-e-system-observability-and-release-gates.md`
- 当前 gate 主文档：`ops/phase-e-observability-release-gate-2026-06-15.md`
- 生产验收清单：`ops/production-acceptance-checklist.md`

## 完成标准

本轮完成的判断标准：

- `/api/admin/system` 新字段可通过脚本验证。
- 后台系统页展示新的数据库目标、任务概览和审计覆盖率行。
- release package 契约确保 Phase E 关键验证脚本随包分发。
- 放行 gate 文档和 `ops/README.md` 已把当前入口对齐。

仍未完成的部分：

- gray / production 真实执行记录
- 回滚演练样本
- 冲突统计与趋势化展示
