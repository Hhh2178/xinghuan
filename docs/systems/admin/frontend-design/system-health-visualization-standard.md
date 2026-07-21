# Admin 系统健康数据可视化标准

## 1. Purpose

系统健康页应让管理员在 10 秒内回答四个问题：

1. 当前是否有事故或高风险？
2. 哪个环境、服务或能力受影响？
3. 影响正在扩大、稳定还是恢复？
4. 下一步应进入哪个对象、任务或日志定位？

页面不是原始配置与运行字段的平铺表，也不是装饰性驾驶舱。所有图表都必须支持判断或下钻。

## 2. Desktop Information Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 面包屑 / 系统健康       环境 · 版本 · 数据新鲜度              刷新 / 时间范围 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Critical / Warning 事件条：影响范围、开始时间、当前状态、建议动作、确认入口   │
├───────────────────────┬───────────────────────┬─────────────────────────────┤
│ API                   │ PostgreSQL            │ Redis / Queue               │
│ 状态、延迟、错误率     │ 连接、查询、容量       │ 深度、等待、阻塞客户端       │
├───────────────────────┴───────────────────────┴─────────────────────────────┤
│ 服务拓扑：入口 → API → DB/Redis → Worker → Provider                         │
├───────────────────────────────────┬─────────────────────────────────────────┤
│ 吞吐 / 成功率 / P95 延迟趋势       │ 队列深度 / 等待时间 / Worker 使用率       │
├───────────────────────────────────┼─────────────────────────────────────────┤
│ 能力与 Provider 健康热力图         │ 失败原因 / 取消 / 超时堆叠柱              │
├───────────────────────────────────┴─────────────────────────────────────────┤
│ 事件时间线与最近变更                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                             [右侧 Inspector：原始详情与下钻]
```

页面顺序固定为：异常 → 当前状态 → 系统关系 → 趋势 → 对象对比 → 事件与技术详情。

## 3. Header And Global Controls

页头只出现一次，必须包含：

- 当前环境：Gray / Production，禁止跨环境数据混合。
- 当前版本与 release 标识。
- 数据更新时间与刷新状态。
- 时间范围：1h / 24h / 7d / 30d；默认 24h。
- 手动刷新；自动刷新默认 15 秒，仅更新实时区块。

环境切换必须重新加载全页数据并清空上一环境缓存。页面任何统计都必须携带环境或 queue namespace。

## 4. Alert Summary Rail

告警条位于页头下方，是页面最高视觉优先级。

每条告警包含：

- 严重度：critical / warning / info。
- 简短结论，例如“Gray 视频队列有 13 条孤立任务”。
- 开始时间、持续时间、影响对象与影响量。
- 判断口径与当前值/阈值。
- 建议动作和下钻入口。
- 已确认、处理中、已恢复状态。

没有告警时显示一行克制的“当前无活动告警”，不得使用大面积绿色空卡。

## 5. Health Cards

首屏只保留五个领域健康卡：API、PostgreSQL、Redis、Worker、Storage。

每张卡必须包含：

- 总状态与一句原因。
- 2–4 个关键指标，不展示全部原始字段。
- 与前一时间窗口的变化。
- 数据更新时间。
- 点击后打开 Inspector。

推荐指标：

| Domain | Primary metrics |
| --- | --- |
| API | request rate、5xx rate、P95 latency、active requests |
| PostgreSQL | active/idle connections、pool wait、slow query count、database size |
| Redis | connected/blocked clients、used memory、ops/s、rejected connections |
| Worker | live workers、busy slots、task throughput、heartbeat age |
| Storage | disk usage、artifact growth、prune status、write failure |

卡片不能直接显示内部文件路径、完整 migration 列表或密钥相关信息。原始详情进入 Inspector 的“技术详情”。

## 6. Service Topology

拓扑固定表达请求与任务执行链：

`Browser/Admin → API → PostgreSQL / Redis → Worker → Provider`。

节点规则：

- 节点颜色表示健康状态，边线动画只表示当前有流量。
- 节点显示短名称、状态和一个主指标。
- 边线显示 request rate 或 task rate，不显示无意义动画。
- 点击节点打开 Inspector；点击连线查看该链路的延迟、错误与最近事件。
- Gray 和 Production 不在同一拓扑叠加；对比场景使用并排视图。

拓扑不是自动布局的自由关系图。节点位置稳定，便于管理员形成空间记忆。

## 7. Chart Specification

### 7.1 Throughput, Success Rate And Latency

- 图形：共享时间轴的三条小型折线图，不使用三轴混画。
- 指标：tasks/min、success rate、P50/P95 latency。
- 默认粒度：1h=1m，24h=5m，7d=1h，30d=6h。
- 必须显示当前值、基线、异常区间和缺失数据区间。

### 7.2 Queue And Capacity

- 队列深度：按能力使用分组柱状图，图片/视频/音频/RH 分开。
- 等待时间：P50/P95 折线，不能只看 depth。
- Worker 容量：使用 horizontal bullet bar，依次显示 busy、available、configured limit 和 safe threshold。
- 配置并发与实际有效并发并列展示，禁止把跨环境槽位相加。

### 7.3 Provider And Capability Health

- 图形：热力图。
- 行：Provider；列：能力或模型。
- 色值：成功率或健康等级；单元格文字显示任务量，避免小样本误判。
- 小于最小样本量时显示“样本不足”，不标 critical。
- 点击单元格下钻到对应 Provider、模型、任务和时间范围。

### 7.4 Failure Composition

- 图形：按时间堆叠柱状图。
- 分类：upstream error、timeout、validation、cancelled、queue/runtime、unknown。
- failed 与 cancelled 必须分开；用户取消不能被计入系统失败率。
- 图例顺序稳定，unknown 始终最后且需要可下钻。

### 7.5 Incident Timeline

- 内容：告警触发、配置变更、发布、Worker 重启、Provider 禁用、恢复。
- 每条事件显示 requestId/releaseId/actor，支持复制。
- 默认只展示影响健康判断的事件，原始审计日志通过下钻查看。

## 8. Health Semantics

健康状态必须基于比例、基线、持续时间和最小样本量，不得直接比较不同长度时间窗口的累计总数。

推荐状态模型：

| State | Meaning |
| --- | --- |
| healthy | 指标在 SLO 内，且无数据一致性问题 |
| info | 有变化或样本不足，但尚无用户影响证据 |
| warning | 超过 warning 阈值并持续两个采样周期，或出现可恢复的一致性问题 |
| critical | 超过 critical 阈值并持续，或关键链路不可用/数据状态不可恢复 |
| unknown | 数据源缺失、过期或统计失败；不能伪装成 healthy |

示例：任务失败健康应比较 `failed / finalized`、24h 相对 7d/30d 同粒度基线、最小样本量和持续时间。`7d failed total > 24h failed total × N` 不能作为健康规则。

## 9. Data Correctness Contract

- 所有 Redis runtime key 必须包含环境/queue namespace。
- Worker 槽位必须按 exact queue 过滤，而不是只按 capability。
- PostgreSQL queued 与 Redis queue 必须定期 reconciliation。
- 图表数据使用服务端聚合，前端不得下载整段任务 payload/result/logs 再计算。
- 数据响应必须包含 `generatedAt`、统计区间、粒度和 environment。
- 指标超过两倍刷新周期未更新时标记 stale。
- 统计查询失败时保留上一份数据并标注 stale，不清空成 0。

## 10. Inspector And Drill-down

右侧 Inspector 负责承载主页面不应平铺的信息：

- 当前对象完整指标与阈值。
- 最近 20 条关联事件。
- 技术详情：key、migration、内部路径、原始状态。
- 关联任务、Provider、模型、账号或 release。
- 复制、筛选跳转和诊断动作。

关闭 Inspector 后，主页面的时间范围、筛选和滚动位置必须保持。

## 11. Loading, Empty, Error And Stale States

- 初次加载：保留页面骨架，图表使用与最终结构一致的 skeleton。
- 局部刷新：不遮挡整页，不让图表归零闪烁。
- 无数据：说明是“无任务”“未接入指标”还是“筛选后为空”。
- 请求失败：区块级错误、重试按钮和 requestId；其他健康区块继续工作。
- stale：展示最后成功时间和明显的 stale 标签。
- 图表少于两个点时退化为数值/列表，不绘制误导性趋势。

## 12. Performance Budget

- 首屏健康摘要响应目标：P95 小于 500ms，不包含第三方 Provider 实时探测。
- 图表数据按聚合桶返回；单图默认不超过 500 个点。
- 实时区块 15 秒刷新，趋势区块 60 秒刷新；页面不可见时暂停。
- 同一刷新周期复用一次系统快照，避免每张卡独立重复查询。
- 快速切换时间范围或环境时取消旧请求，旧响应不得覆盖新状态。
- Provider 实时探测必须独立触发，带超时、并发限制和清晰的“探测时间”。

## 13. Visual Rules

- 图表背景使用 Surface 1，绘图区不再叠加发光卡片。
- 网格线低对比，零线和阈值线高于普通网格线。
- 同一指标跨页面保持同一颜色；语义色不用于普通系列区分。
- 数值使用 tabular numbers，单位紧邻数值但降低权重。
- tooltip 使用完整时间、数值、单位和状态原因。
- critical 动画只允许短暂状态变化提示，不持续闪烁。

## 14. Component Registration

系统健康页优先建立并复用：

- `AdminHealthSummaryRail`
- `AdminHealthDomainCard`
- `AdminServiceTopology`
- `AdminMetricTrendChart`
- `AdminQueueCapacityChart`
- `AdminProviderHealthHeatmap`
- `AdminIncidentTimeline`
- `AdminObservabilityInspector`

组件必须从统一 Token 和 chart palette 读取样式，不允许在业务页硬编码独立色板。

## 15. Acceptance Checklist

- 管理员能在首屏识别最严重问题、影响对象和建议动作。
- Gray/Production 数据不会混算。
- 每张图显示单位、范围、数据新鲜度和空/错/stale 状态。
- 每个 critical/warning 都能解释阈值与计算口径。
- 每个图表都能下钻到对应对象或任务列表。
- 技术字段与内部路径不占据主页面视觉层级。
- 失败、取消、排队、孤立任务使用不同语义。
- 数据由服务端聚合，页面不加载全部历史任务。
- 页面契约、Admin type-check、Admin build 与桌面浏览器验收通过。
