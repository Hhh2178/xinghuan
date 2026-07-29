# Admin 全域视觉重构程序

## 目标

以 `visual-foundation.md` 为单一基础，将 12 个工作域和 25 个稳定子视图逐步收敛为同一套渐变科技操作台，不改变页面职责、路由、权限、数据和刷新策略。

## 发布顺序

| 批次 | 范围 | 可交付结果 | 发布约束 |
| --- | --- | --- | --- |
| Foundation（本批） | 文档、索引、契约、Canvas 表现层回撤 | 统一入口与不可回归的文档守卫 | 仅 Gray |
| A | Shell、导航、顶栏、工作域页头、通用面板/按钮/表单/表格/Inspector | 共享视觉骨架与迁移适配层 | 先选一个低风险页面试点 |
| B | Provider/模型、RH、ComfyUI、运行参数、环境同步 | 配置工作台模板 | guarded 草稿保护不变 |
| C | 概览、任务、健康、分析、审计 | 实时/数据模板 | 异常优先、实时刷新不闪烁 |
| D | 组织、安全、资源、公告、自动化 | 治理/内容模板与全域收口 | 高风险操作保持确认 |

## 每批固定步骤

1. 阅读 Foundation、Audit、Program 和 Registry，确认目标模板。
2. 为共享组件/样式边界写测试或契约，先验证失败。
3. 只抽取本批重复至少两次且语义稳定的 Token/组件；不顺手重构无关页面。
4. 实现加载、空、错误、长文本、focus、dirty/冲突和危险动作状态。
5. 在 1920×1080 下做视觉验收，检查 H1、行动层级、表格/Inspector、文本和滚动。
6. 运行 package build、相关测试、视觉文档/Token/Registry 契约；Gray 验证通过后更新 Audit 状态。

## Shared Component Boundaries

| Component | Responsibility | Must not own |
| --- | --- | --- |
| `AdminWorkspaceFrame` | Shell、页头、面包屑、状态与唯一主操作位置 | 域业务数据或保存逻辑 |
| `AdminSummaryStrip` | 异常/关键摘要与状态语义 | 具体图表数据计算 |
| `AdminFormPanel` | 字段分组、帮助、dirty/save feedback 视觉 | API mutation 语义 |
| `AdminDataTable` | 密度、列、筛选、loading/empty/error、行进入 Inspector | 领域筛选规则 |
| `AdminInspector` | 保留列表上下文的详情/关联/操作容器 | 作为唯一数据权威 |
| `AdminConfirmDialog` | 高风险影响说明与确认 | 代替权限/服务端校验 |

实现前先查 `visual-component-registry.md` 和 `functional-component-registry.md`；已有同义组件优先扩展，不创建新的页面专用基础组件。

## Migration Rules

- 渐变只进入 Shell、页头、选中态、摘要和主操作；表单、表格、日志、错误详情保持中性面。
- 一次迁移一个工作域模板或少量同模板子视图；任何 API/数据链路改动另开任务。
- `apps/admin/src/styles.css` 继续按域拆分到 `styles/` 下的有边界模块，不能在其末尾持续追加通用规则。
- 所有 legacy class 的移除都需有对应页面构建和截图验收；避免跨域 CSS 无意回归。
- ComfyUI 保持功能冻结：本程序只允许既有页面视觉收敛，不新增实例、工作流或连接器功能。

## Definition Of Done

一个工作域只有同时满足下列条件才可在 Audit 标记完成：

- 使用 Foundation Token 与目标模板，未引入裸色值/同义尺寸。
- 子视图的加载、空、错误、长文本、键盘焦点和风险操作有明确表现。
- 既有稳定 URL、权限、刷新与草稿保护行为未变化。
- 1920×1080 页面截图通过设计验收。
- package build、相关测试和设计文档契约通过；Gray 运行态验证记录已更新。
