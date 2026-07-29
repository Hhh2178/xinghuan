# Admin 页面视觉审计

## 审计口径

- 时间：2026-07-29。
- 证据：`admin-view-model.ts` 的稳定路由/12 工作域/25 子视图，`apps/admin/src` 页面组件，`apps/admin/src/styles.css`（9,079 行），现有设计资料和用户提供的 Provider 页面截图。
- 非证据：本报告不判断 API 正确性、权限正确性、Provider 配置有效性或生产运行状态。
- 目标视窗：PC 1920×1080。

## 共同发现

1. **基础层分叉（P0）**：`--starlight-*`、原始色值、页面专用渐变和多套控件尺寸并存，设计文档虽齐全但缺少第一阅读入口。
2. **样式集中度过高（P0）**：9,079 行单一 CSS 让 Shell 与页面皮肤相互影响，局部修复容易造成跨域回归。
3. **身份区重复（P1）**：部分页面同时使用顶栏、band、卡片标题和二级导航解释当前页面，压缩有效工作高度。
4. **模板不一致（P1）**：配置页面、数据页面和治理页面各自演化；相同的保存、空态、错误、详情和操作排布不一致。
5. **密度无语义（P1）**：12px/13px/14px、30px/38px/44px 控件混用，造成截图中按钮大小和文字层级不稳定。
6. **状态竞争（P1）**：品牌青与健康/选中/可操作面容易混用，风险和异常无法始终优先。

## 工作域矩阵

| 工作域 | 稳定子视图 | 当前骨架 | 风险 | 目标模板 | 优先级 |
| --- | --- | --- | --- | --- | --- |
| 运营总览 | `/admin/overview` | A-layer frame + C data workbench + 关键摘要 + 中性数据表（v0.8.12 Gray 已验收） | C 共享模板与桌面运行态验收完成 | 运行态势首页 | C（完成） |
| 账号与组织 | 组织总览、账号、用户组、会话 | 子视图 tabs + 工作台 | rail/卡片/表格语法并存 | 治理工作台 | D（active） |
| 权限与安全 | 权限策略 | group rail + 编辑器 | 开关墙缺少影响上下文 | Master-detail + Inspector | D（active） |
| Provider 与模型 | Provider、模型目录 | 共享配置工作台 + Provider rail + 既有表单/结果/模型编辑（v0.8.10 Gray 已验收） | handler/API 由契约锁定；模型页助手上下文标签残余交由后续上下文重构 | 配置工作台 | B（完成） |
| 智能体与自动化 | 助手、托管、运行与审计 | 多编辑器/工作区 | 版本动作与运行状态密集 | 版本化治理工作台 | D（active） |
| RH 管理 | 工作流、AI 应用、Key 池 | 共享对象上下文 + 目录 rail + 原结构化编辑器/分析/Key 池（v0.8.10 Gray 已验收） | 目录、编辑器、长 Schema 和 Key 池密度在桌面视窗内保持受控 | 目录 + 编辑器 + Inspector | B（完成） |
| ComfyUI 管理 | 实例、配置、工作流、日志 | 共享对象上下文/摘要/语义状态 + 原实例卡、配置、工作流、日志（v0.8.10 Gray 已验收） | 仅视觉收敛；冻结 API 数量由契约锁定；长机器名使用受控省略 | 实例治理工作台 | B（仅样式，完成） |
| 公共资源 | 资源目录 | 分类 rail + 卡片网格 | 预览和操作密度失控风险 | 资源网格 + Inspector | D（active） |
| 内容发布 | 公告 | 编辑器 + 列表 | 编辑、预览、发布反馈不连贯 | 内容编辑工作台 | D（active） |
| 任务与运行 | 任务列表 | C realtime workbench + 当前页摘要 + 控制/筛选 + 八列表格 + 完整日志（v0.8.12 Gray 已验收） | 任务行为契约与单行命令布局均已验收 | 实时任务控制台 | C（完成） |
| 数据分析与审计 | 用量、费用、渠道健康、审计 | C analytics workbench + 共享 context + 原筛选/KPI/图表/报告/七列表格（v0.8.12 Gray 已验收） | 数据、刷新所有权及桌面布局均已验收 | 分析驾驶舱 | C（完成） |
| 系统健康 | 健康、运行告警 | C realtime workbench + 告警优先 command + 五领域 + 拓扑/趋势/容量/时间线 + Inspector（v0.8.12 Gray 已验收） | 可观测性语义、刷新与 Inspector 已验收 | 可观测性控制台 | C（完成） |
| 运行参数与环境同步 | 运行参数、gray/production 差异与同步 | 共享配置 context + 既有参数表单/差异 rail/表格（v0.8.10 Gray 已验收） | revision、默认冲突决策、确认 apply 与内部/远端 token 边界均由契约锁定 | 配置工作台 | B（完成） |

## 页面模板审计要点

### 配置工作台

适用 Provider、模型、RH、ComfyUI、运行参数、环境同步、部分自动化配置。必须有对象上下文、字段组、依赖/影响、dirty 状态、保存/重置、测试或预览结果；危险操作独立放置。用户截图的 Provider 页面应保留“左目录 + 主编辑器”的效率，但采用一个渐变页头、统一 40px 字段和单一主操作层级。

### 实时任务控制台

适用任务、队列、系统健康。首屏优先告警与影响摘要，再呈现核心数值、趋势、表格和日志 Inspector。失败原因必须高于普通 Provider/模型元信息，重试需要明确是否会重新请求上游。

### 分析驾驶舱

适用用量、费用、渠道健康、审计。图表必须提供口径、单位、窗口、最后更新时间、下钻；图表不使用状态渐变伪装质量，数据明细可筛选并能进入 Inspector。

### 治理工作台

适用组织、安全、资源、公告、自动化。优先让管理员判断范围与影响，再进入编辑和批量操作；列表详情通过 Inspector/Drawer 保留上下文。

## 逐批验收标准

- 无长文本越界、按钮重叠、双滚动条或卡片随动态内容失控。
- 每页只有一个 H1 和一个主操作语义。
- 页面使用 Foundation 色域和尺寸，不新增裸色值/同义尺寸。
- 加载、空、错误、dirty、冲突、成功、风险操作状态完整。
- 1920×1080 下表格、页头、Inspector、rail 和主编辑器同时可用。

## 更新规则

每个已重构子视图必须在本文件把“当前骨架”和“风险”改为已验收状态，并链接对应变更/验证记录；未实施的子视图不能标记为完成。

## 已验收试点

- `/admin/overview`：复用 `AdminWorkspaceFrame`、`AdminSummaryStrip`、`DataTable`、`StatusPill`；唯一 H1、summary 首屏、中性表格、长文本、空态、Shell loading/error 与主区独立滚动已在 `../../../logbooks/validations/2026-07-29-admin-foundation-a-v089-r1.md` 记录。A-layer 试点通过不等于 C 批趋势、告警与下钻能力完成。

## 已验收配置批次

- B 批六个路由已在 old-server Gray `v0.8.10` 以登录态 `1920x1080` 验收：Provider、模型目录、RunningHub、ComfyUI、运行参数、环境同步。唯一 H1、共享 context、主区滚动、侧栏并存、长文本和无横向溢出证据见 `../../../logbooks/validations/2026-07-29-admin-configuration-b-v0810-r1.md`。

## C 批验收结果

- `/admin/overview` 已接入 `AdminDataWorkbench mode="overview"`，保留 A-layer 摘要、三张中性数据表及 Shell loading/error 边界。
- `/admin/runtime/tasks` 已接入 `mode="realtime"`、共享 context、明确标注的当前页摘要、原创建/筛选控制、八列表格空态及共享分页工具栏；创建、查询、恢复、取消、重试和完整日志行为未迁移所有权。
- Task 2 本地证据：3 个聚焦测试文件共 9 项通过，Overview/Tasks 契约通过，Admin TypeScript/Vite 构建和 `git diff --check` 通过。C 整批 Gray 与登录态 `1920x1080` 验收尚未执行。
- `/admin/system/health` 已在不改动 `useAdminSystemHealth` 的前提下接入 `mode="realtime"`。告警排序、五领域真值、失败/取消分离、拓扑、趋势、容量、时间线、15 秒可见页刷新、AbortController 与 Inspector 继续由原组件和契约所有。
- Task 3 本地证据：健康 workbench 与 view-model 共 2 项测试、健康可视化契约、authority state、agent environment readiness、Admin TypeScript/Vite 构建及 `git diff --check` 均通过。Authority 仅保留 Production 版本落后 Gray 的既有警告；本批未修改 Production。
- `/admin/analytics/usage`、`costs`、`reliability`、`audit` 已接入 `mode="analytics"` 和共享 context。Usage 保留父级筛选与账号下钻；Cost 保留 CNY 请求、active-result guard 和历史价格不可回算提示；Reliability 保留 ETag、最后成功报告、stale 提示、默认关闭的五分钟刷新与页面可见性暂停；Audit 保留七列原始值。
- Task 4 本地证据：analytics workbench 与 channel refresh 共 8 项测试、Cost API 测试、Usage/Audit/Cost 数据契约、Admin TypeScript/Vite 构建、视觉文档、组件注册及 `git diff --check` 均通过。C 整批 Gray 与登录态 `1920x1080` 验收尚未执行。
- `v0.8.11` 运行态通过但因 Tasks 创建命令换行、Reliability 刷新按钮使用白色默认样式而拒绝视觉验收；`v0.8.12` 修复后，七个登录态路由在 `1920x1080` 下全部通过唯一 H1/data template、滚动、溢出、助手并存、筛选/表格/图表和 Inspector 验收。证据见 `../../../logbooks/validations/2026-07-29-admin-realtime-data-c-v0812-r1.md`。
- C 已完成，D 治理/内容工作台现为 active。模型目录助手上下文仍显示 `providers` 标签，Analytics 助手上下文标签仍需后续统一；ComfyUI 长机器名采用单行省略。这些上下文残余不改变当前路由内容或数据权威。
