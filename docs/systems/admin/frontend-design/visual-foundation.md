# Admin 统一视觉基础：渐变科技操作台

## 0. Authority And Mandatory Reading

这是 Admin 视觉层的第一权威源。任何新增或修改 Admin 页面、导航、表单、表格、图表、Drawer、Inspector、空/错/加载态之前，必须按下列顺序阅读：

1. 本文件。
2. `admin-page-visual-audit.md`。
3. `redesign-program.md`。
4. `visual-component-registry.md` 与 `functional-component-registry.md`。
5. 与变更类型对应的布局、表单、图表和刷新规范。

`DESIGN.md` 定义跨产品共同原则；本文件定义 Admin 的实现基线。冲突时，先更新 `DESIGN.md`，再同步本文件与 Decisions Log。临时页面局部 CSS 不得建立第二套基础 Token。

## 1. Design Intent

目标是“渐变科技风格的专业操作台”，不是霓虹装饰页。用户应先看到故障、风险、当前对象、操作后果和主动作，再感受到品牌渐变。

- 渐变建立工作域、层级和品牌记忆。
- 中性内容面承载长时间阅读、参数填写、表格、日志和代码。
- 语义颜色表达业务状态，文字与图标补充语义。
- 视觉密度服务于扫描和决策，不能因效果牺牲字段、错误或状态的可读性。

## 2. Foundation Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--admin-bg-base` | `#06111b` | 应用最低背景 |
| `--admin-bg-elevated` | `#0a1626` | Shell 与大区块底层 |
| `--admin-surface-1` | `#0d1a2a` | 普通面板、表格、表单 |
| `--admin-surface-2` | `#101f31` | 抬升面、Inspector、重点区 |
| `--admin-surface-3` | `#14283d` | hover、可编辑子面与选中辅助面 |
| `--admin-border-subtle` | `rgba(123, 174, 210, .18)` | 默认边界 |
| `--admin-border-strong` | `rgba(84, 210, 222, .42)` | 当前选择与焦点边界 |
| `--admin-brand-primary` | `#35e6da` | 兼容强调色与品牌渐变起点 |
| `--admin-brand-secondary` | `#4f9cff` | 品牌渐变终点与次级品牌强调 |
| `--admin-gradient-brand` | `linear-gradient(135deg, #35e6da, #4f9cff)` | 页头、当前导航、主操作高光 |
| `--admin-gradient-shell` | `linear-gradient(135deg, rgba(15, 104, 129, .34), rgba(22, 62, 126, .18))` | Shell 与工作域页头 |
| `--admin-text-primary` | `#eef8ff` | 主要文字 |
| `--admin-text-secondary` | `#a7c0d4` | 说明文字 |
| `--admin-text-muted` | `#7894aa` | 非关键元信息 |
| `--admin-success` | `#3ddc97` | 成功、健康、已连接 |
| `--admin-warning` | `#f2bd5d` | 风险、排队、待处理 |
| `--admin-danger` | `#ff6b7d` | 失败、断开、不可逆操作 |
| `--admin-info` | `#62b9ff` | 非风险性信息、比较序列 |

现有 `--starlight-*` Token 在第一迁移批中映射到上述语义，而不是并存扩张。新增颜色先以语义命名进入 Foundation，再进入代码；不可直接在页面文件写新的十六进制色值。

## 3. Gradient Rules

### 允许

- 应用 Shell 背景的低对比渐变层。
- 每个工作域的唯一页头、当前导航项、关键摘要条和主操作的轻量渐变。
- 不超过一个主方向；默认左上青到右下蓝。
- 在渐变上放置的正文必须满足高对比，背景叠一层中性遮罩后仍可读。

### 禁止

- 渐变不得表达状态：成功、警告、失败、离线、删除、发布风险必须使用独立语义色和文字。
- 不在数据表格、长表单、日志、代码、错误详情、输入框内部使用品牌渐变。
- 不把青、紫、洋红同时作为后台默认强调色；紫色只可在明确的智能体专题插图中作为弱辅助色。
- 不新增闪烁、流光或持续发光动画；动效只解释状态变化。

## 4. Typography, Spacing And Density

| Role | Size / line height | Weight | Constraint |
| --- | --- | --- | --- |
| Page H1 | `24 / 32px` | 650 | 每页只有一个 |
| Section H2 | `18 / 26px` | 650 | 主要区块 |
| Panel title | `16 / 24px` | 600 | 面板、Inspector |
| Body | `14 / 22px` | 400 | 正文、表单值、普通列表 |
| Label | `13 / 20px` | 600 | 字段、表头、按钮 |
| Meta | `12 / 18px` | 400 | 时间、来源、辅助信息 |

- 11px 只用于非关键图表刻度或极紧凑状态标记。
- 间距阶梯：`4 / 8 / 12 / 16 / 24 / 32 / 48px`。
- 圆角：控件 `8px`，面板 `12px`，状态标签 `9999px`。不使用多套近似圆角。
- 字段与主要动作高度 `40px`；紧凑表格动作 `32px`；不可混用 30、34、38、44px 作为无语义差异的常规高度。
- 任意动态文本必须安全换行：URL、ID、错误、Schema、日志进入 Meta block、Inspector 或可横向滚动的代码区，不能撑破网格。

## 5. Layout And Component Language

- Shell：左侧工作域导航、顶部全局状态、主工作区、按需右侧 Inspector；一个页面只有一个身份页头。
- 配置模板：上下文摘要 → 字段组 → 影响/依赖 → dirty/save/reset → 结果反馈。
- 数据模板：异常摘要 → 核心指标 → 趋势/对比 → 可筛选明细 → 详情 Inspector。
- 主动作每个上下文最多一个；保存、测试、刷新、删除、发布、同步不可争夺同一层级。
- 面板不是默认分组工具；可用标题、留白、细分隔线时，不叠卡片。
- 卡片只用于独立对象、指标或需要独立操作边界的内容。
- Icon button 必须有 tooltip、可读名称和 focus；不把图标当作唯一风险提示。

## 6. State, Feedback And Motion

- 所有状态同时包含颜色、文字和图标/形状。
- 保存必须有 dirty、saving、success、conflict、error；受保护刷新不得覆盖草稿。
- 加载、空、错误为每个表格、卡片网格、Inspector 的必备状态。
- 动效：press/focus `100ms`，控件 `180ms`，Drawer/路由 `240ms`；`prefers-reduced-motion` 下关闭装饰动效。
- 指标刷新只更新数值，不整卡闪烁；告警切换必须清晰。

## 7. Accessibility And Review Gate

- 主要文字和控件满足可读对比；焦点不能仅用背景微亮表达。
- 键盘可到达 rail、tabs、表格动作、Drawer、确认对话框和保存栏。
- 每次 Admin UI 变更在实现前记录：所用页面模板、Foundation Token、复用组件、长文本策略、空/错/加载态、风险操作确认方式。
- 每次变更至少运行视觉文档契约、Token 契约、组件注册表契约、对应 package build 和 1920×1080 截图验收。

## 8. Decisions Log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-07-29 | 深海青—天蓝作为后台品牌渐变 | 匹配现有深色控制台和用户提供的目标图，同时不侵占语义状态色 |
| 2026-07-29 | Foundation/Audit/Program 成为 Admin UI 改动强制入口 | 解决 Token、页面皮肤与组件规则分散导致的视觉漂移 |
| 2026-07-29 | 先统一基础和模板，再逐工作域迁移 | 避免全量换肤中重复制造样式分叉和运行风险 |
| 2026-07-29 | A 批用 `admin-foundation.css` 映射既有 Starlight Token | 保持旧页面兼容，同时让新迁移页面只消费 Foundation 语义 Token |
