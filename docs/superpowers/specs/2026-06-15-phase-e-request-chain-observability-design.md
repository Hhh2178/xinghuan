# Phase E 请求链路观测设计

## 背景

截至 2026-06-15，`Phase D` 已完成本地验收、灰度发布与正式发布，任务取消、heartbeat、reaper、后台任务分页都已经进入当前 gray / production release。

当前剩余的主要问题不再是“功能不可用”，而是“出问题时定位成本高”：

- API 请求没有统一 `requestId`，单次请求难以跨日志、审计、任务状态串联。
- 审计表结构已经有 `ip`、`user_agent`、`request_id` 字段，但代码没有稳定写入和展示。
- Worker 日志存在 `taskId / providerId / modelId / workerId` 的零散输出，但格式不统一，难以按事件检索。
- 后台系统页和审计页缺少请求链路上下文，无法直接回答“是谁在什么时候、从哪个请求触发了哪条任务”。

因此，`Phase E` 的第一步不做完整运维大盘，而是先把请求链路的基础观测闭环补齐。

## 目标

本轮要建立一条可追踪的最小闭环：

1. 每个进入 API 的请求都拥有稳定 `requestId`。
2. API 响应回写 `x-request-id`，方便前端、脚本和灰度验收记录问题。
3. 审计日志在写入时带上：
   - `request_id`
   - `ip`
   - `user_agent`
4. API 关键事件日志采用统一结构，至少带上：
   - `service`
   - `event`
   - `requestId`
   - `userId`
   - `taskId`
   - `providerId`
   - `modelId`
5. Worker 日志采用统一结构，至少带上：
   - `service`
   - `event`
   - `workerId`
   - `taskId`
   - `providerId`
   - `modelId`
   - 可用时补 `requestId` / `userId`
6. 后台审计页可以直接显示新增链路字段，支持人工核对。

## 非目标

本轮明确不做以下内容：

- 不新建完整 observability dashboard。
- 不引入 ELK、OpenTelemetry、Sentry、Prometheus 等外部观测栈。
- 不在本轮内完成“失败任务趋势 / 冲突写入统计 / 回滚演练系统化页面”。
- 不重做现有日志基础设施，只在现有 `console.log(JSON.stringify(...))` 和审计链路上统一字段。

这些内容仍属于 `Phase E` 的后续范围，但不和本次请求链路补强绑定交付。

## 当前代码事实

### API

- `apps/api/src/server.ts` 已有 `appendAudit(...)`，但只写：
  - `actor`
  - `action`
  - `target`
  - `summary`
- `xh_audit_logs` 表已具备：
  - `ip`
  - `user_agent`
  - `request_id`
- 这意味着当前缺口主要是应用层上下文采集与透传，不是数据库迁移缺失。

### Admin

- `apps/admin/src/admin-types.ts` 的 `AuditRecord` 仍未暴露：
  - `requestId`
  - `ip`
  - `userAgent`
- `apps/admin/src/admin-readonly-panels.tsx` 的 `AuditPanel` 仍只展示时间、操作者、动作、对象、说明。

### Worker

- `apps/worker/src/worker.ts` 已有部分 JSON 日志和 `workerId`。
- 但日志风格混合：
  - 有些是纯字符串
  - 有些是 `"prefix" + JSON.stringify(...)`
  - 事件名和字段名不统一
- 当前任务记录中已有 `ownerId`、`providerId`、`modelId`，可作为最小链路字段来源。

## 设计方案

### 1. API 请求上下文

在 API 入口为每个请求生成或接收一个 `requestId`：

- 若请求头已带 `x-request-id`，使用清洗后的值。
- 否则服务端生成新的 `requestId`。
- 响应统一回写 `x-request-id`。

同时构造请求上下文对象，最少包含：

- `requestId`
- `method`
- `path`
- `ip`
- `userAgent`
- `startedAt`

当前用户识别出来后，再补：

- `userId`
- `userEmail`

该上下文应在当前请求作用域内可直接传给：

- 审计写入
- 关键 API 结构化日志
- 任务创建逻辑

### 2. 审计日志增强

`appendAudit(...)` 升级为可接收请求上下文元数据。

写入 PostgreSQL / file-mode 审计记录时，同时落下：

- `request_id`
- `ip`
- `user_agent`

约束：

- 审计上下文缺失时允许为空，不能因为观测字段缺失阻断主流程。
- 但当前 HTTP 请求触发的后台写操作，应默认传入完整上下文，不能继续丢字段。

### 3. API 结构化日志

在 `apps/api/src/server.ts` 内补一个轻量结构化日志 helper，统一输出 JSON。

字段标准：

- `service: "xinghuan-api"`
- `event`
- `environment`
- `requestId`
- `userId`
- `taskId`
- `providerId`
- `modelId`
- `status`
- `durationMs`
- `message`

第一批覆盖的事件：

- 请求进入 / 完成
- 任务创建
- 任务取消
- 后台关键写操作审计落库失败

这样可以先把真正高频、难定位的链路统一起来，而不是一开始追求全量覆盖。

### 4. 任务链路上下文透传

为了让 Worker 能继续看到来源请求，需要在任务创建时把最小请求链路信息写入任务运行时可读区域。

建议透传字段：

- `requestId`
- `userId`
- `providerId`
- `modelId`

优先写入任务 `result` / `payload` 中已有可扩展结构，不新增高风险数据库结构改动。

原则：

- 优先复用现有 JSON 字段。
- 不为了观测性单独做一轮 schema 变更，除非实现时发现现有结构无法稳定承载。

### 5. Worker 结构化日志

Worker 新增统一日志 helper，输出 JSON 事件，至少覆盖：

- `task.received`
- `task.claimed`
- `task.skipped`
- `task.succeeded`
- `task.failed`
- `task.cancelled_detected`
- `task.reaped`

统一字段：

- `service: "xinghuan-worker"`
- `environment`
- `workerId`
- `event`
- `taskId`
- `requestId`
- `userId`
- `providerId`
- `modelId`
- `capability`
- `message`
- `error`

兼容原则：

- 现有人类可读日志不要求全部删除。
- 但新加或改动的关键执行链路日志应统一走结构化 helper。

### 6. 后台审计展示

`AuditPanel` 增加链路字段列，但保持可扫描性，不把面板做成超宽难读表：

- 时间
- 操作者
- 动作
- 对象
- 请求
- 来源
- 说明

展示策略：

- 请求列显示 `requestId`
- 来源列显示 `ip` + `userAgent` 的紧凑摘要
- 当字段为空时显示 `-`

本轮不做复杂筛选，只把关键字段看得见。

## 技术边界与取舍

### 为什么先做轻量结构化日志，而不是完整监控平台

因为当前最急迫的问题是线上排障链路缺字段，不是缺大盘外壳。

如果现在直接做系统页大盘：

- 前台能看到更多表格
- 但底层请求和任务链路仍然串不起来

先把 `requestId -> audit -> task -> worker log` 打通，后续做大盘时才有可靠数据来源。

### 为什么不先做数据库迁移

因为 `xh_audit_logs` 已经有目标字段。

当前真正的工程收益来自：

- 代码层统一上下文
- 管理后台显示
- 验证脚本

只有当实现时发现任务链路上下文无法稳定落到现有 JSON 字段，才考虑后续补迁移。

### 为什么把范围收窄到审计页，不直接改系统页大盘

审计页是当前最直接的人类排障入口。

系统页扩展涉及更多指标采样、汇总口径和趋势统计，这一轮会明显放大实现范围，不适合作为 `Phase E` 第一刀。

## 验收标准

本轮完成后，至少要满足：

1. 任意 API 请求响应头都能读到 `x-request-id`。
2. 后台写操作产生的审计记录包含：
   - `requestId`
   - `ip`
   - `userAgent`
3. 后台审计页能显示这些字段。
4. 创建任务后，API / Worker 日志都能看到同一任务相关的核心标识：
   - `taskId`
   - `providerId`
   - `modelId`
   - `requestId`（可用时）
5. 新增验证脚本或契约测试能证明：
   - 请求头回写存在
   - 审计记录字段持久化成功
   - 后台审计视图契约已更新
   - Worker 结构化日志包含约定字段

## 风险与注意事项

- `server.ts` 已经较大，本轮尽量采用“小型 helper + 局部接线”，避免顺手做大拆分。
- 不能为了补日志字段破坏现有任务创建、取消、后台写操作行为。
- 审计字段属于长期信息，展示时要防止超长 `userAgent` 把后台表格撑坏。
- 生产与灰度当前数据库目标并未完全分离，验证记录时不能再写成“gray/prod 完全独立 PostgreSQL”。

## 本轮交付范围

本设计对应的实现只覆盖以下内容：

1. API 请求上下文与 `x-request-id`
2. 审计持久化增强
3. 后台审计展示增强
4. Worker 结构化日志统一
5. 针对上述能力的本地验证与文档更新

后续 `Phase E` 再继续补：

- 系统页观测指标
- 上线门槛清单
- 回滚演练记录模板
- 灰度 / 正式放行 gate 标准
