# Admin 前端设计资料

本目录记录 Admin 后台前端 UI 的长期设计资料，用于后续在保持统一风格的情况下增减、修改后台功能。

这里不是一次性方案草稿，而是后台前端设计的长期入口。后续涉及 Admin 页面、导航、组件、数据刷新、权限展示、资源预览、任务状态、系统观测等改动时，先看本目录。

## 当前设计方向

Admin 后台采用“科技感可视化运营控制台 + 参数治理后台”的方向。

核心基线：

- 以 `stitch` 设计方案的深色科技风、青色强调、右侧 Inspector、KPI 卡、系统拓扑、任务日志为视觉基础。
- 不直接照搬 `stitch` 的信息架构和页面清单。
- 导航、页面覆盖、权限治理、实时刷新、懒加载和热更新能力，以项目正式 PRD 为准。

## 推荐阅读顺序

1. `README.md`
2. `visual-style-and-stitch-baseline.md`
3. `page-map-and-functions.md`
4. `realtime-loading-and-refresh.md`
5. `change-guidelines.md`

## 与其他文档的关系

- `docs/superpowers/specs/2026-06-27-admin-designer-page-prd.md`
  - 给 UI/UX 设计师画完整后台页面使用的页面 PRD。
- `docs/superpowers/specs/2026-06-26-admin-visual-operations-backend-redesign-design.md`
  - 后台整体架构和分期方案。
- `docs/superpowers/specs/2026-06-26-admin-system-ui-functional-requirements-design.md`
  - 新后台 UI 功能需求清单。
- `docs/systems/admin/ui-and-information-architecture.md`
  - 当前 Admin 已落地信息架构和近期治理记录。

## 后续维护规则

- 新增后台页面时，必须补 `page-map-and-functions.md`。
- 新增自动刷新、实时状态或长任务交互时，必须补 `realtime-loading-and-refresh.md`。
- 调整视觉语言、导航、卡片、表格、Inspector 或状态色时，必须补 `visual-style-and-stitch-baseline.md`。
- 改动只影响某次临时方案时，可以写入 `docs/superpowers/specs/`；一旦成为长期设计约束，就同步沉淀到本目录。
