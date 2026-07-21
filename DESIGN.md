# Design System — 星幻无限画布

本文件是项目视觉设计的总入口。它定义跨产品的共同原则，并把具体实现约束路由到 Canvas 与 Admin 的长期设计资料。

## 1. Product Context

- 产品：公司内部节点式 AIGC 创作与运营治理平台。
- 用户：创作人员、模型与 Provider 管理员、运营人员、系统维护人员。
- 产品形态：桌面优先的无限画布创作工具与独立 Admin 运营后台。
- 设计记忆点：**这是一个状态可信、异常醒目、操作可控的专业生产工具。**

## 2. Source Of Truth

| 范围 | 权威入口 | 职责 |
| --- | --- | --- |
| 全项目共同原则 | `DESIGN.md` | 品牌气质、设计原则、共享语义与治理规则 |
| Canvas | `docs/systems/canvas/frontend-design/README.md` | 节点、画布、浮层、交互与画布 Token |
| Admin | `docs/systems/admin/frontend-design/README.md` | 后台布局、组件、数据密度、表单、表格与可视化 |
| Admin 系统健康 | `docs/systems/admin/frontend-design/system-health-visualization-standard.md` | 健康指标、图表、告警、下钻与刷新口径 |

下级文档可以细化本文件，但不能改变共同语义。产生冲突时，先修改本文件并在 Decisions Log 记录原因。

## 3. Aesthetic Direction

- 方向：Industrial / Utilitarian Technology Console。
- 装饰：克制。深色层级、细边框和轻量网格用于建立精密感，不使用大面积光晕抢占业务信息。
- 布局：严格栅格。运营页优先比较和扫描，配置页优先字段归属和保存状态。
- 色彩：受限色板。青色表示主操作与当前选择，健康、警告、危险使用独立语义色。
- 动效：最小功能动效。只解释状态变化、层级切换和异步进度。

## 4. Design Principles

1. **异常先于装饰**：critical 和 warning 必须比品牌纹理、图标和普通 KPI 更早被看到。
2. **状态必须可解释**：任何健康、失败、计费、权限或同步状态都必须提供口径、时间和下钻。
3. **一个页面只保留一个身份区**：面包屑、标题、状态和主操作放在统一页头；不得再叠加重复的大标题卡。
4. **一个动作只有一个主位置**：保存、重试、删除、发布等动作不能在同一上下文重复出现。
5. **详情不挤掉上下文**：列表详情优先使用 Inspector 或 Drawer，保留原筛选与滚动位置。
6. **颜色表达语义，不表达装饰**：同一种颜色在同一页面只能承担一种主要职责。
7. **数据可视化必须可行动**：图表需要时间范围、单位、阈值、对比基线、数据新鲜度和下钻目标。

## 5. Typography

### Target Font Stack

- 中文与正文：`Source Han Sans SC`, `Microsoft YaHei`, sans-serif。
- 拉丁 UI：`Source Sans 3`，与中文字体共享紧凑、清晰的后台气质。
- 数字、ID、日志与代码：`JetBrains Mono`, monospace，并启用 tabular numbers。
- 字体必须优先自托管；字体加载失败不能引起布局跳变或阻塞后台使用。

### Type Scale

| Role | Size / line-height | Weight | Usage |
| --- | --- | --- | --- |
| Page title | `24 / 32px` | 650 | 每页唯一 H1 |
| Section title | `18 / 26px` | 650 | 页面主要分区 H2 |
| Panel title | `16 / 24px` | 600 | 卡片、Drawer、表格标题 |
| Body | `14 / 22px` | 400 | 正文、表单与普通列表 |
| Label | `13 / 20px` | 600 | 字段标签、表头、按钮 |
| Meta | `12 / 18px` | 400 | 次要说明、时间、图表刻度 |

11px 仅可用于非关键图表刻度或紧凑状态标记，不得承载操作说明、错误原因或关键状态。

## 6. Color

现有 Starlight 色板继续作为 Admin 基线，具体值见 `docs/systems/admin/frontend-design/design-tokens.md`。

| Semantic role | Baseline | Rule |
| --- | --- | --- |
| App background | `#0b0c10` | 页面最底层，不作为卡片背景重复使用 |
| Surface 1 | `#171920` | 普通内容面 |
| Surface 2 | `#1f2128` | 抬升面、Drawer、重点面板 |
| Border | `#2d2f36` | 默认边界；焦点态单独使用 accent |
| Primary | `#66fcf1` | 主操作、当前选择、关键链接 |
| Success | `#2ecc71` | 正常、成功、连接健康 |
| Warning | `#f1c40f` | 风险、排队、需要关注 |
| Danger | `#e74c3c` | 失败、断开、不可逆动作 |
| Text | `#f4f7fb` | 主要文字 |
| Muted | `#9aa7ad` | 次要信息，不承载关键结论 |

状态不能只依赖颜色，必须同时使用文字、图标或形状。大面积背景色应降低饱和度，文字和关键线条保持对比。

## 7. Spacing, Radius And Density

- 基础单位：4px。
- 间距阶梯：`4 / 8 / 12 / 16 / 24 / 32 / 48px`。
- 页面区块间距：24px；同组控件：8–12px；字段行：16px。
- 圆角只使用：小 `6px`、标准 `8px`、容器 `12px`、胶囊 `9999px`。
- 胶囊仅用于状态、筛选 token 和紧凑标签，不用于普通容器或主要按钮。
- Admin 桌面端标准字段高度 40px，紧凑表格动作 32–36px，主要动作 40px。

## 8. Layout

- Admin 以桌面端为主，左侧导航、顶部状态区、主工作区、右侧 Inspector 各司其职。
- 页面页头只出现一次，包含面包屑、H1、简短说明、状态和主操作。
- 二级导航使用紧凑 tabs；不得使用大卡片重复页面标题和导航。
- 运营页内容顺序：异常摘要 → 核心状态 → 趋势与对比 → 明细 → 技术详情。
- 配置页内容顺序：上下文 → 字段组 → 影响说明 → 保存差异 → 操作结果。
- 卡片不是默认分组方式。普通分组优先使用标题、留白和分隔线。

## 9. Components And Actions

- Primary：每个操作上下文最多一个，使用实心主色或高对比主样式。
- Secondary：普通编辑、测试、刷新、导出。
- Ghost：低频、非关键的行内动作。
- Danger：与保存/启用分离，必须描述影响范围并二次确认。
- 图标按钮必须有可见 tooltip、focus 状态和可读名称。
- 表格默认提供 loading、empty、error、pagination；长详情进入 Drawer，不在每一行永久展开。
- 多字段编辑必须提供 dirty state、修改 diff、保存、重置、冲突与失败状态。

## 10. Data Visualization

- 图表必须显示标题、单位、时间范围、最后更新时间和数据来源提示。
- 趋势使用折线或面积线；离散比较使用柱状图；构成使用堆叠柱；密度使用热力图。
- 不使用难以精确比较的 3D 图、装饰性饼图或无刻度仪表盘。
- 容量/配额优先使用 bullet bar：当前值、建议值、上限和风险区同时可见。
- 健康状态的详细规则见 `system-health-visualization-standard.md`。

## 11. Motion

- Micro：100ms，用于 press/focus。
- Standard：180ms，用于 tab、hover、状态变化。
- Panel：240ms，用于 Drawer、Inspector 和路由内容。
- 实时指标更新不得整卡闪烁；数值可平滑变化，但告警状态切换必须清晰。
- 尊重 `prefers-reduced-motion`，关闭非必要动画。

## 12. Content And Language

- 中文为主语言，英文用于协议名、代码、ID 或简短副标题。
- 页面标题使用业务名，不使用设计实现术语，如“能量条”“占比环”。
- 状态文案采用“发生了什么 + 影响什么 + 下一步做什么”。
- “活跃”“在线”“并发”“排队”“健康”必须附带统计窗口或口径。

## 13. Governance

- 新页面先声明复用哪些 Visual/Functional Registry 组件。
- 新颜色、字号、圆角、间距重复两次前必须进入 Token 文档或改用既有 Token。
- 新图表必须定义指标口径、聚合周期、空状态、错误状态、下钻和性能预算。
- UI 变更至少运行：
  - `npm run verify:visual-design-docs-contract`
  - `npm run verify:design-token-docs-contract`
  - `npm run verify:component-registry-docs-contract`
- Admin 页面实现还需执行对应 package type-check、build 与页面契约测试。

## 14. Decisions Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-07-21 | 建立根级 `DESIGN.md` | 给分散的 Canvas/Admin 规范提供唯一入口，防止同一项目出现多套设计口径 |
| 2026-07-21 | Admin 延续深色工业控制台方向 | 与现有产品、用户习惯和高密度运营场景一致，避免无收益的整体换肤 |
| 2026-07-21 | 系统健康以异常、解释和下钻为核心 | 运维页面的任务是缩短判断与处理时间，不是展示最多原始字段 |
