# 后台重构规划发现

> **责任范围：** 保存本次重构中可复用的结构发现与迁移判断。
> **读取时机：** 修改 Admin 路由、页面边界或数据加载模型前。
> **更新触发：** 发现现有实现与总计划存在新的结构偏差时。
> **反重复规则：** 已稳定生效的规则最终回写 `docs/systems/admin/`，本文件保留演进证据。

## 代码现状

- `apps/admin/src/admin-view-model.ts` 目前定义 12 个主页面标签，并压缩到 5 个工作域。
- `apps/admin/src/main.tsx` 的 `AdminApp` 集中承担认证、导航、数据加载与全部页面分发。
- `loadAdminData()` 会通过 `Promise.all` 一次加载多个域的数据，未按路由职责拆分。
- 用户治理页面内部继续嵌套总览、账号、用户组、权限、会话页签。
- RunningHub 工作台内部混合工作流、AI 应用、Key 池和编辑分析能力。
- ComfyUI 详情内部继续嵌套配置、工作流和日志。
- `AdminTabId` 的主要影响范围集中在 `admin-view-model.ts`、`main.tsx` 与类型定义，适合先建立路由模型再渐进迁移。

## 可复用资产

- 已有 Starlight 深色控制台视觉基线和设计 Token。
- 已有 `AdminWorkspaceBand`、表格、状态标签、Inspector/抽屉等公共结构。
- 已有表单、表格、抽屉、加载刷新和组件准入规范。
- 已有组织治理、资源内容、RunningHub、ComfyUI、任务和审计等业务组件。
- 已有权限 revision 冲突保护、审计反馈和环境同步等业务约束。

## 主要问题

- 一级工作域按宽泛概念分组，无法反映管理员实际任务。
- 二级页面被隐藏在组件本地状态中，无法深链、收藏、刷新恢复或精确授权。
- 页面对象、配置编辑、运行观测和审计分析混用同一页面层级。
- 全量数据加载增加首屏成本，也扩大失败影响范围。
- 视觉规范存在，但分散且缺少完整动效、字体尺度、无障碍与页面状态矩阵。
- 历史计划以五大工作域为核心，需要由本次十域结构替代，而不是继续补丁式扩展。

## 最终规划结论

- 采用十个一级业务域，RH 管理与 ComfyUI 管理独立。
- 统一使用“业务域 → 页面 → 对象 → 对象子视图”的四层结构。
- 页面级导航使用稳定路由；页签只允许表达同一对象的子视图。
- 新壳只加载身份、权限摘要、环境和版本，各业务域按路由加载。
- 视觉体系延续 Starlight 方向，补齐字号、状态、组件、动效、响应式和可访问性。
- 迁移采用九个阶段，先冻结基线和建立新壳，再逐域迁移，最后退役旧 `activeTab` 分发。

## 实施基线

- 当前路由状态完全由 `AdminApp.activeTab` 管理，浏览器 URL 未参与恢复。
- 现有 `adminWorkspaces` 是唯一一级导航数据源，影响范围集中在 `admin-view-model.ts` 和 `main.tsx`。
- 当前 `UsersPanel` 的账号、用户组、权限和会话由组件内部 `activeTab` 管理；安全域需要先通过受控初始视图兼容，再在后续阶段拆成独立路由。
- 第一批可以安全引入 `AdminDomainId` 与 URL 映射，同时继续复用现有 `AdminTabId` 页面组件。
- 现有后台已有专用合同脚本 `verify:admin-view-model-contract` 与 `verify:admin-starlight-shell`，应扩展而不是另起重复测试体系。

## Harness 复核结论

- 根目录规划辅助文件不属于项目权威层，已迁移到 plans、records 与 validations 标准目录。
- 本轮触碰 `main.tsx` 和 `styles.css`；两者需要避免继续膨胀，实施中优先下沉 navigation、route registry、data loader 和 design-system 样式。
- Gray 发布前必须形成干净提交，并通过 project/workspace/release 三层 Harness。
- ComfyUI 长期功能开发处于冻结状态；本轮只允许信息架构拆分和既有页面迁移，不扩展新的 ComfyUI 业务能力。
