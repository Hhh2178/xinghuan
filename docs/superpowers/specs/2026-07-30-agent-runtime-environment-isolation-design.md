# Agent Runtime 环境隔离设计

## 已确认的现状

- Gray 与 Production 已使用独立 PostgreSQL 数据库和独立任务队列。
- 每个部署实例的 Agent 治理 API 仍会返回 `gray` 与 `production` 两套控制项；缺失项会被构造成全关闭默认值。
- 后台在同一个实例中允许选择另一个环境，却不会真正读取该目标环境的数据。因此另一环境的默认关闭状态会被误显示为真实故障。
- Production 的 Canvas Run API 与 Worker feature gate 当前均未启用，服务日志记录 `CANVAS_RUN_DISABLED`；这正是 Canvas 的 AI 托管面板显示“运行环境未启用”的原因。

## 决定

1. Agent 运行数据、控制、配置、路由、审计和运行记录只属于当前部署环境。所有读取和写入由服务端的 `XINGHUAN_APP_ENV` 决定，浏览器不得指定或切换目标环境。
2. `/api/admin/agent-runtime/overview` 与 `/controls` 只返回当前环境的控制项，并带回 `environment` 作为只读事实。发布与控制写入若指定另一环境，返回拒绝错误。
3. 后台移除本地的 Gray / Production 伪切换控件，只显示当前服务环境。跨环境发布或对比必须是单独的、显式的只读发布摘要，不能把任一环境的失败合成为另一个环境的失败。
4. Agent readiness 保留静态契约校验；实时 Cookie 探针改为可选，调用方可显式选择 `--readiness=skip`，输出须标明 `skipped`，不得伪称 Agent 已验证。
5. Production 仅在升级到包含隔离修复的 release、数据库迁移已验证、服务与 Worker 正常后，启用 Canvas Run API 和 Worker gate；运行控制先采用 `observe`（Agent 与 Canvas Run 启用，质量评估与自动恢复关闭）。

## 不在本轮执行的设计

- 不删除现有数据库中历史的另一环境控制行；它们改为不可读取和不可写入，以避免破坏审计。
- 不执行跨环境 Agent 数据同步，也不引入新的同步服务。
- 不在没有明确发布验证证据时宣称 Production 已启用或可用。

## 验收

- 在 Gray API 上，治理 overview 和 controls 只返回 `gray`。
- 在 Production API 上，治理 overview 和 controls 只返回 `production`。
- 对另一环境的发布或控制写入被服务端拒绝。
- Admin 页面没有会读取错误环境的切换入口。
- readiness 的静态契约、可选跳过、实际 Cookie 检查均有测试。
- Production 面板仅在启用两个 feature gate 后不再显示运行环境不可用；发布前后以独立线上证据核实。
