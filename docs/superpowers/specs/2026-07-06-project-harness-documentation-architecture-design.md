# 项目 Harness 与文档架构治理设计

## 背景

当前无限画布 2.0 已经完成一轮文档治理和 harness 建设，但根入口、系统文档、视觉规范、计划台账和执行脚本之间仍存在交叉：

- `AGENTS.md` 已经承担“AI 协作宪法”的角色，但继续混入 release 状态、CodeGraph 细则、发布护栏和运行态入口，长期会继续膨胀。
- `README.md` 同时写了“当前状态摘要”“当前定位”“状态更新”，同一事实重复出现，容易让不同窗口读到不一致状态。
- `MEMORY.md`、`DEVLOG.md`、`ops/README.md` 仍保留兼容入口价值，但如果不继续瘦身，会重新变成第二套项目总纲。
- `docs/systems/admin/frontend-design/` 已经有后台视觉入口，但还缺少组件库落地策略、组件使用边界和可验证的视觉规则。
- `docs/systems/canvas/` 还没有等价的画布前台视觉规范入口，导致节点设计、按钮、右键菜单、参数区、输出口和状态展示容易反复打补丁。
- `docs/systems/harness/` 已经记录执行分层，但还需要把“AI/自动化执行”与“人类项目文档”之间的边界固定下来，避免再额外新建一套 `.agent/` 后形成双轨混乱。

本设计目标是把现有结构收束成一套可执行、可审计、可演进的项目辅助工程，而不是新增一堆平行文档。

## 目标

1. 固定项目级 harness 工程的权威入口和执行分层，让 AI、自动化脚本和人类开发都按同一张地图工作。
2. 将 `AGENTS.md` 明确为 AI 宪法，只保留稳定规则、禁止事项、主入口顺序和更新义务。
3. 将 `README.md` 明确为项目概览和当前状态摘要，不承接长历史、细系统设计和逐日流水。
4. 建立画布前台视觉统一规范，覆盖节点、端口、菜单、按钮、参数区、输出区、状态和响应式规则。
5. 完善后台视觉统一规范，覆盖导航、页面壳、表格、表单、抽屉、弹窗、卡片、图标文字对齐和状态色。
6. 明确组件库选型：后台采用成熟业务组件库试点，画布侧保持自研视觉体系和低层无头组件策略。
7. 让接口参数、技术栈、系统能力、计划、日志、发布证据都有唯一主落点，并能通过脚本或清单校验。

## 非目标

- 本设计不恢复 ComfyUI 功能开发；ComfyUI 仍保持暂停封存状态，只允许 crash、security、rollback、docs 级别例外。
- 本设计不立即安装新组件库、不修改业务代码、不重写所有旧文档。
- 本设计不创建独立 `.agent/` 作为新的主文档体系；若未来确实需要本地执行层文件，只能作为 `docs/systems/harness/` 的派生缓存或脚本入口，不能成为第二权威源。
- 本设计不一次性删除历史文档。历史材料按归档规则保留，先压缩入口，再逐批迁移。

## 总体原则

### 单一权威源

同一事实只能有一个主记录：

- 当前版本、gray、production：`docs/logbooks/releases/current-release-index.md`、`ops/current/*.md`、`docs/memory/current-state.md`
- 项目概览：`README.md`
- AI 协作规则：`AGENTS.md`
- 文档治理规则：`docs/governance/`
- 系统如何工作：`docs/systems/<system>/`
- 每天做了什么：`docs/logbooks/daily/`
- 某次发布、验证、事故：`docs/logbooks/releases/`、`docs/logbooks/validations/`、`docs/logbooks/incidents/`
- 设计和执行计划：`docs/superpowers/specs/`、`docs/superpowers/plans/`

其他入口只能做摘要和跳转，不能复制长正文。

### 根入口短而硬

根目录入口文件不再追求“把所有信息放在眼前”，而是追求“把下一步应该看哪里说清楚”。

- `AGENTS.md`：规则、边界、禁止事项、默认阅读顺序、更新义务。
- `README.md`：项目一句话、当前状态摘要、工作根、文档导航。
- `MEMORY.md`：长期记忆摘要和主题入口。
- `DEVLOG.md`：兼容入口，只指向 `docs/logbooks/daily/`。
- `ops/README.md`：当前运行态摘要和 gray / production 运维入口。

### Harness 是执行地图，不是文档副本

`docs/systems/harness/` 只回答“执行时如何组合规则、脚本、文档和验证命令”，不复制系统设计正文。

执行分层固定为：

- Workspace harness：工作树、依赖、CodeGraph、包导出、类型检查。
- Verification harness：`verify:*` 契约、热点预算、source size、release 文档一致性。
- Release harness：gray / production prepare、package、deploy、runtime verify、logbook 同步。
- Integration harness：RunningHub、Provider、ComfyUI 等外部接入的子 harness 模板。
- Documentation harness：入口文件、系统文档、台账、发布证据之间的一致性校验。

### 视觉规范必须能落地到组件

视觉规范不是审美描述，要能指导实现和验收：

- 明确布局、字号、圆角、间距、状态、动效、图标尺寸和对齐。
- 明确哪些组件来自公共库，哪些必须项目内封装。
- 明确哪些场景禁止临时写一次性 UI。
- 关键视觉规范要逐步沉淀成 `@xinghuan/ui` 组件、tokens 和 contract 验证脚本。

## 目标文档架构

```text
AGENTS.md
README.md
MEMORY.md
DEVLOG.md
ops/
  README.md
  current/
docs/
  INDEX.md
  governance/
  systems/
    README.md
    harness/
    canvas/
      README.md
      frontend-design/
    admin/
      README.md
      frontend-design/
    api/
    worker/
    runninghub/
    providers/
    auth-and-users/
    storage-and-data/
    observability-and-ops/
  memory/
  logbooks/
    daily/
    releases/
    validations/
    incidents/
  records/
  superpowers/
    specs/
    plans/
```

### `AGENTS.md` 目标结构

保留：

- 项目定位和当前默认工作根。
- 默认阅读顺序。
- 文档层级和主记录原则。
- 安全规则、密钥规则、禁止破坏性命令。
- AI/自动化执行规则：开工看状态、先查系统文档、提交前校验、发布前校验。
- 必须同步的文档和台账规则。

下沉：

- 详细 release 状态下沉到 `docs/logbooks/releases/current-release-index.md` 和 `ops/current/*.md`。
- CodeGraph 详细说明下沉到 `docs/governance/codegraph-and-repo-navigation.md`。
- 热点预算和拆分流程下沉到 `docs/governance/engineering-guardrails.md`、`docs/governance/hotspot-decomposition-workflow.md`。
- release gate 细节下沉到 `docs/systems/observability-and-ops/release-gates.md`。

### `README.md` 目标结构

保留：

- 项目定位。
- 当前活跃版本、gray、production、工作分支、当前工作重心。
- 5 到 8 个主入口链接。
- 当前工作根说明。
- 与旧目录关系。

删除或合并：

- 重复的“当前状态摘要 / 当前定位 / 状态更新”。
- 重复的 RunningHub、环境同步、版本对齐说明。
- 逐日性质的更新段落。

### `MEMORY.md`、`DEVLOG.md`、`ops/README.md` 目标结构

- `MEMORY.md`：只保留长期判断摘要，正文迁往 `docs/memory/`。
- `DEVLOG.md`：只保留台账写法和当月入口，正文迁往 `docs/logbooks/daily/`。
- `ops/README.md`：只保留当前运行态摘要、当前 gray / production 指针和归档入口。

## 画布前台视觉规范

新增长期入口：

```text
docs/systems/canvas/frontend-design/
  README.md
  canvas-visual-language.md
  node-design-standard.md
  interaction-and-overlay-standard.md
  component-usage-policy.md
  verification-checklist.md
```

### 设计方向

画布侧不是后台管理系统，不能套用普通表单后台风格。它的核心是“节点式创作工作台”：

- 信息层级要围绕节点、连接线、参数、输出、运行状态组织。
- 节点应像工具模块，而不是表格卡片。
- 节点参数不能默认用内部滚轴藏起来；参数多时优先由节点高度自适应、折叠区和分组解决。
- 节点选择、运行、失败、等待、输出完成要有一致状态。
- 输入口、输出口、拖拽柄、节点标题、工作流选择区必须有固定几何规则。

### 规范内容

- 节点外形：默认宽度、最小高度、自适应高度、圆角、边框、阴影、背景层级。
- 节点标题区：图标尺寸、标题字号、副标题、provider / workflow 标签、下拉选择位置。
- 参数区：label / control 对齐、说明文本、必填/可选、默认值、错误提示。
- 端口区：单输出口、多输入口、端口标签、连接态、高亮态。
- 右键菜单：菜单分组、保存到资源库、发布到公共库、权限限制提示。
- 运行状态：排队、执行中、成功、失败、取消、重试、输出物料可用。
- Overlay：资源库、工作流选择、确认框、toast、浮层菜单、快捷键提示。
- 响应式：桌面优先，移动端至少保证可查看、可保存、可退出危险操作。

### 组件策略

画布侧以 `@xinghuan/ui` 为项目设计系统承载层，避免把完整后台组件库直接塞进节点。

推荐：

- `@xinghuan/ui` 承接按钮、标签、徽标、状态芯片、节点壳、参数行、空状态、加载态。
- 对 Select、Dialog、Popover、Tooltip、Context Menu 等高交互组件，可参考 Radix Primitives 的低层可访问模式；Radix 官方定位是低层、可访问、可自定义 primitives，适合逐步作为设计系统底座。
- 可参考 shadcn/ui 的“开放代码 / 复制组件到项目内维护”模式，但不把它当成直接 npm 依赖式组件库。shadcn/ui 官方也明确它更像“如何构建自己的组件库”。

禁止：

- 禁止在画布节点内直接大面积引入 Ant Design / MUI 这类完整后台组件视觉。
- 禁止每个节点单独写一套按钮、下拉、参数行、运行态。
- 禁止为了短期塞参数在节点内部默认加滚轴，除非有明确的最大高度和交互设计。

## 后台视觉规范

现有入口：

```text
docs/systems/admin/frontend-design/
```

需要补强：

```text
docs/systems/admin/frontend-design/
  component-library-policy.md
  layout-and-density-standard.md
  form-table-drawer-standard.md
  icon-text-alignment-standard.md
  verification-checklist.md
```

### 设计方向

后台继续沿用“科技感可视化运营控制台 + 参数治理后台”，但实现层面要更标准化：

- 页面壳：左侧导航、顶部状态、主内容区、右侧 Inspector / Drawer。
- 业务页：表格、筛选、表单、权限、上传、任务状态、审计日志。
- 视觉：深色科技基线、青色强调、清晰分区、适度玻璃和描边，但避免过度装饰影响表格和表单可读性。
- 操作：主按钮、次按钮、危险操作、只读状态、禁用状态、权限不足提示必须一致。
- 图标文字：统一图标尺寸、垂直居中、行高、gap、按钮高度，解决当前图标和文字容易错位的问题。

### 组件库决策

后台推荐采用 Ant Design 6 作为业务组件库试点，不立即全量迁移。

理由：

- 后台需要大量成熟业务组件：Table、Form、Select、Upload、Drawer、Modal、Tabs、Pagination、Notification、Empty、Skeleton、Descriptions。
- 项目当前是 React 19 + Vite，Ant Design v6 官方迁移文档说明 `antd@6` 支持 React 18 及以上，并且不再需要 React 19 兼容补丁。
- Ant Design changelog 当前显示 `6.5.0`，且 v6 已经提供 design token、现代浏览器和 CSS variables 方向，适合作为后台 token 化主题底座。
- 国内/中文企业后台生态中，Ant Design 的维护、文档、招聘可获得性和团队认知成本更优。

约束：

- 先做一个后台页面或一个组件岛试点，例如“任务列表筛选 + 表格 + Drawer 详情”。
- 必须通过 `ConfigProvider` 和项目 tokens 统一主题，不能直接使用默认浅色 AntD。
- 不能把 AntD 视觉扩散到画布节点内部。
- 如果引入 `@ant-design/icons`，需与 Ant Design v6 版本匹配。
- 试点完成前，禁止大面积替换后台页面，避免一次性迁移造成不可控回归。

备选：

- shadcn/ui + Radix：更适合项目自研视觉系统，灵活但维护成本更高，后台复杂表格和表单要补大量工程。
- MUI：成熟稳定，但 Material Design 视觉语言与当前“科技运营控制台”方向冲突较大。
- 继续纯自研：短期无依赖变化，但表格、表单、弹窗、上传、可访问性和一致性成本会继续累积。

## 接口参数与技术栈文档

每个长期系统目录应逐步补齐以下结构：

```text
docs/systems/<system>/
  README.md
  interface-map.md
  data-model.md
  runtime-flow.md
  permissions-and-roles.md
  verification.md
```

并统一记录：

- API 路径、方法、权限、请求参数、响应结构、错误码。
- 前端调用入口、后端 route、service、repository、worker 之间的链路。
- 环境变量、运行依赖、灰度/生产差异。
- 对应验证脚本和验收方式。
- 哪些内容是 Agent 已验证，哪些需要用户人工验收。

对于新增 provider / workflow / 节点能力，必须补：

- 输入参数表。
- 输出结构表。
- 权限规则。
- 后台配置入口。
- 画布节点映射规则。
- 任务执行状态流。
- 失败和重试策略。

## 日志、计划与审计规则

### 日志

日常推进写入：

```text
docs/logbooks/daily/YYYY/YYYY-MM/YYYY-MM-DD.md
```

日志必须包含：

- 本轮做了什么。
- 为什么做。
- 影响范围。
- 验证结果。
- 后续事项。

### 计划

正式执行计划写入：

```text
docs/superpowers/plans/YYYY-MM-DD-<topic>.md
```

计划必须包含：

- 批次。
- 文件范围。
- 验证命令。
- 回退策略。
- 每批提交边界。

### 发布证据

发布证据写入：

```text
docs/logbooks/releases/gray/
docs/logbooks/releases/production/
ops/current/gray.md
ops/current/production.md
```

发布记录必须区分：

- Agent 已验证。
- 待用户验收。
- 已知风险。
- 回滚入口。

## 清理与迁移策略

### Phase 0：审计现状

目标：不改正文，先列清楚哪些文件职责交叉。

检查对象：

- `AGENTS.md`
- `README.md`
- `MEMORY.md`
- `DEVLOG.md`
- `ops/README.md`
- `docs/INDEX.md`
- `docs/systems/harness/README.md`
- `docs/systems/admin/frontend-design/`
- `docs/systems/canvas/`

产出：

- 入口职责矩阵。
- 重复事实清单。
- 需要下沉的段落清单。

### Phase 1：根入口瘦身

目标：让根入口短、硬、不会误导。

动作：

- 压缩 `AGENTS.md` 到规则和指针。
- 合并 `README.md` 的重复当前状态段落。
- 将 release 细节统一指向 release index 和 `ops/current/`。
- 将 CodeGraph、热点、发布护栏细节转成链接。

校验：

- 根入口里不再出现多个互相重复的版本段。
- 当前状态只保留一个摘要块。
- 所有细节都有明确下游链接。

### Phase 2：视觉规范补齐

目标：让前后台 UI 有可执行标准。

动作：

- 新增 `docs/systems/canvas/frontend-design/`。
- 补强 `docs/systems/admin/frontend-design/`。
- 写明节点、菜单、按钮、表格、表单、抽屉、图标文字对齐规则。
- 写明 Ant Design 6 后台试点策略和画布侧自研策略。

校验：

- 新节点设计必须能从 canvas 规范找到落点。
- 新后台页面必须能从 admin 规范找到布局和组件规则。

### Phase 3：接口参数模板

目标：让每个系统的技术文档格式一致。

动作：

- 给 `docs/systems/` 增加接口文档模板。
- 为 API、Worker、RunningHub、Providers、Canvas、Admin 建立缺口清单。
- 后续功能改动必须同步对应系统接口文档。

校验：

- 任意系统能从 `README.md` 找到接口、数据、运行、权限和验证入口。

### Phase 4：Harness 校验增强

目标：把规则变成可执行检查。

候选脚本：

- `verify:documentation-entry-contract`：检查根入口不重复承接长状态。
- `verify:visual-design-docs-contract`：检查 canvas/admin 视觉规范入口存在且索引完整。
- `verify:system-doc-template-contract`：检查系统文档基础模板完整。
- `verify:harness-doc-sync-contract`：检查 harness README 与 package scripts 中的关键入口一致。

### Phase 5：组件库试点

目标：小范围验证后台组件库，不污染画布。

动作：

- 在后台选择一个低风险页面做 Ant Design 6 试点。
- 建立 `AdminThemeProvider` 或等价封装，把 token、暗色主题、圆角、间距和字体收口。
- 抽一个表格 + 筛选 + Drawer 的标准样例。
- 记录 bundle、样式冲突、可访问性和交互收益。

准入条件：

- 试点页面完成设计规范对齐。
- `type-check` 和对应 contract 通过。
- 没有影响画布侧视觉。

## 风险与防护

- 风险：文档越补越多，形成新混乱。
  - 防护：任何新增文档必须声明主落点和非职责；根入口只允许摘要和链接。
- 风险：Ant Design 引入后与现有后台视觉冲突。
  - 防护：先试点、主题封装、禁止默认样式裸用、禁止扩散到画布节点。
- 风险：画布侧自研组件继续碎片化。
  - 防护：画布视觉规范必须映射到 `@xinghuan/ui`，新增节点优先复用节点壳和参数行。
- 风险：计划和日志只写不查。
  - 防护：新增 documentation contract，把入口、索引、日志和系统文档作为提交前检查的一部分。
- 风险：AI 读取旧入口后误判状态。
  - 防护：旧入口顶部必须标注“兼容入口”，并指向当前权威文件。

## 验证策略

文档阶段：

- `git status --short`
- 人工检查 spec 中无临时标记、未完成章节和互相矛盾的主落点。
- 检查本 spec 与 `docs/governance/documentation-governance-standard.md` 不冲突。

实施阶段：

- `npm run verify:quick`
- `npm run harness:verify:project`
- `npm run verify:current-release-entry-consistency`
- 新增文档 contract 后执行对应 `verify:*`。
- 如果引入 Ant Design 试点，额外执行 `npm run type-check`、`npm run build -w @xinghuan/admin`。

## 参考来源

- Ant Design changelog 当前显示 `6.5.0`，发布时间为 `2026-06-27`，并说明 v6 继续围绕组件 token、可访问性和 AI agent 支持迭代：https://ant.design/changelog/
- Ant Design v6 迁移文档说明 `antd@6` 要求 React 18 及以上，支持 React 19 不再需要 v5 patch，并默认面向现代浏览器：https://ant.design/docs/react/migration-v6/
- shadcn/ui 官方说明它不是传统 npm 组件库，而是帮助团队构建自己的组件库的开放代码方式：https://ui.shadcn.com/docs
- Radix Primitives 官方说明其定位是低层、可访问、可自定义的 UI primitives，可作为设计系统底层逐步采用：https://www.radix-ui.com/primitives/docs/overview/introduction

## 决策摘要

采用“现有文档体系增强”方案：

- 不新建 `.agent/` 作为主体系。
- `AGENTS.md` 成为短而硬的 AI 宪法。
- `README.md` 成为项目概览和当前状态摘要。
- `docs/INDEX.md` 继续作为第一跳索引。
- `docs/systems/harness/` 成为 AI/自动化执行地图。
- `docs/systems/canvas/frontend-design/` 承接画布视觉规范。
- `docs/systems/admin/frontend-design/` 承接后台视觉规范和组件库策略。
- 后台采用 Ant Design 6 试点，画布采用 `@xinghuan/ui` + Radix/shadcn 风格的自研组件体系。
- 日志、计划、接口、权限、运行态和发布证据全部按现有 `docs/` 分层落地，并逐步加 contract 校验。
