# DEVLOG.md - 无限画布 2.0 开发日志台账

## 兼容入口说明

`DEVLOG.md` 继续保留为逐日推进台账的兼容入口，但详细正文已拆分到 `docs/logbooks/daily/`。

- 当前总索引：`docs/INDEX.md`
- 当前日常台账目录：`docs/logbooks/daily/`
- 当前发布证据目录：`docs/logbooks/releases/`
- 当前验证记录目录：`docs/logbooks/validations/`

## 最近高频入口

- 当前月份说明：`docs/logbooks/daily/2026/2026-07/README.md`
- 当前月份高频事项：`docs/logbooks/daily/2026/2026-07/recent-highlights.md`
- 当前发布索引：`docs/logbooks/releases/current-release-index.md`
- 当前验证索引：`docs/logbooks/validations/`

## 日志规则

- 最新记录放在对应日期文件顶部。
- 每次真实推进都要记录目标、变更、验证、影响、风险、下一步。
- 长期规则不要只留在日台账，应同步收口到 `MEMORY.md`、`docs/memory/`、`docs/systems/` 或 `ops/`。
- 禁止在台账中记录真实密钥、Cookie、Token、SSH Key 和数据库密码。

## 标准记录模板

```md
## YYYY-MM-DD

### 事项标题

目标:
- 

变更:
- 

验证:
- 

影响:
- 

风险:
- 

下一步:
- 
```

## 历史迁移说明

- `2026-06` 的大段旧正文已拆到 `docs/logbooks/daily/2026/2026-06/`。
- 后续新的逐日推进不再回填到本文件。

## 2026-06-30

### 视频节点导入兼容与前端低性能降级

目标:
- 修复旧工作流导入后视频节点偶发不可用的问题
- 对齐前后端导入迁移口径，避免旧运行态把节点卡成“轮询中/不可运行”
- 缓解部分低配电脑上前端科技风画布的严重卡顿

变更:
- `apps/web/src/utils/nodeMigration.ts`
  - 新增视频节点导入迁移，清理 `status / taskId / taskRuns / videoUrl / remoteVideoUrls / startedAt / finishedAt` 等旧运行态
- `apps/api/src/canvas-node-migration.ts`
  - 同步补齐视频节点导入清理，保证后端保存/恢复与前端口径一致
- 新增 `scripts/verify-video-import-migration-contract.ts`
- 新增 `apps/web/src/utils/visualPerformanceMode.ts`
  - 保留 reduced 渲染档位，统一承接前端性能优化模式的轻量视觉渲染
- 新增 `apps/web/src/stores/performanceMode.ts`
  - 新增持久化性能模式 store，默认 `normal`，切到 `optimized` 后跨刷新与重新登录保留
- `apps/web/src/App.tsx`
  - 顶栏中部新增“性能优化”开关，切换后立即刷新页面
  - 启动时按持久化性能模式写入 `data-performance-mode`
- `apps/web/src/styles/index.css`
  - 低性能模式下关闭鼠标光晕与星轨动画
  - 低性能模式下对 `react-flow` 节点与若干浮层统一禁用 `backdrop-filter`
- 新增 `scripts/verify-visual-performance-mode-contract.ts`
- 新增 `scripts/verify-performance-mode-toggle-contract.ts`

验证:
- `npx tsx scripts/verify-video-import-migration-contract.ts`
- `npx tsx scripts/verify-llm-import-migration-contract.ts`
- `npx tsx scripts/verify-visual-performance-mode-contract.ts`
- `npx tsx scripts/verify-performance-mode-toggle-contract.ts`
- `npm run type-check -w @xinghuan/web`

影响:
- 旧视频节点在“导入工作流 / 恢复画布”后不再因为残留运行态而卡死
- 画布顶栏现在可手动切换性能优化模式，开启后会稳定进入较轻的科技风表现，减少鼠标光晕和磨玻璃带来的浏览器压力

风险:
- 这次导入迁移会主动丢弃视频节点的旧输出结果与旧任务状态；如果后续要支持“带结果归档导入”，需要单独设计
- 当前性能优化仍主要压制全局视觉特效和画布节点磨玻璃，节点超多场景下的更深层懒渲染/视口裁剪还需要下一轮继续推进

下一步:
- 在问题工作流上复验“视频节点导入后可立即运行”
- 在出现卡顿的电脑上确认手动性能优化模式是否明显改善
- 如仍有明显卡顿，再继续下探 `CanvasAssistant / LoginGate / 节点级 blur` 的第二层热点

### 组内拓扑执行与科技风收口

目标:
- 让组内执行按画布连线拓扑顺序串行执行
- 新增一个全局组管理节点，只控制组级执行顺序和跳过
- 将前台主题收口为科技风，保留明暗切换，摘掉多风格入口

变更:
- 新增全局组执行管理节点与组执行计划解析逻辑
- 画布运行时改为优先按全局组计划和组内拓扑顺序执行
- 前台主题模板收口为单一科技风，移除主题模板管理入口
- 旧风格预设归档到 `docs/archive/canvas-theme-presets/`
- 前台 `styles/index.css` 去掉旧风格 `@import` 入口

验证:
- 待补：`npm run type-check -w @xinghuan/web`
- 待补：`codegraph sync`

影响:
- 组内执行不再无序并发，后续可按连线结构稳定跑批
- 前台不再暴露多风格主题入口，视觉收口更明确

风险:
- 还需要跑完整编译，确认主题 store 和节点组件的引用都已统一到单模板口径

下一步:
- 跑 type-check、补文档状态、同步 codegraph

### 组执行管理器轮次与每轮重算拓扑

目标:
- 给全局组执行管理器补齐开始执行开关与执行次数
- 让整套组顺序支持重复执行 `N` 轮
- 保证每一轮都按当前画布 `nodes / edges` 重新计算拓扑，而不是复用旧顺序

变更:
- `apps/web/src/components/nodes/GroupExecutionManagerNode.tsx`
  - 新增持续开关、执行次数和开始执行按钮
- `apps/web/src/components/canvas/groupExecutionManager.ts`
  - 管理器数据新增 `enabled / executionCount`
  - 执行计划新增管理器启用态和轮次信息
- `apps/web/src/components/canvas/useCanvasRuntime.ts`
  - 全局运行改为读取最新画布快照
  - 管理器启用时，整套组序列支持按轮次重复执行
  - 每轮开始前重新计算当前拓扑和组执行计划
- `apps/web/src/utils/topologicalSort.ts`
  - 多下游无显式依赖时改为稳定排序，不再随机乱序
- 新增 `scripts/verify-group-execution-manager-contract.ts`

验证:
- `npx tsx scripts/verify-group-execution-manager-contract.ts`
- `npm run type-check -w @xinghuan/web`
- `node scripts/verify-canvas-runtime-split-contract.mjs`

影响:
- 组内执行不再出现同一上游扇出多个下游时的随机顺序
- 全局组执行支持从管理器面板直接开始，并能连续跑多轮
- 画布在运行过程中如果用户修改了连线，下一轮会按最新拓扑生效

风险:
- 真实灰度环境还需要再跑一轮实际交互，重点确认停止批量运行后的轮次收口表现

下一步:
- `codegraph sync`
- gray deploy + runtime verify
- 在线复验组执行管理器与 aicopy 视频链路

### 主入口状态收口

目标:
- 将 `AGENTS.md`、`README.md`、`MEMORY.md`、`docs/prd/README.md`、`ops/README.md` 的当前状态口径统一到最新 release
- 收拢旧的版本号和重复状态正文，减少主入口之间的冲突

变更:
- `AGENTS.md` 的当前状态块改为单一摘要口径，去掉旧阶段叙事型长段落
- `README.md` 的当前状态摘要和当前定位同步到 `v0.5.17`
- `MEMORY.md` 的状态更新补充指向 `docs/memory/` 与 `docs/logbooks/releases/current-release-index.md`
- `docs/prd/README.md` 的当前版本同步到 `v0.5.17`

验证:
- 复核主入口之间版本号与 release 指针一致

影响:
- 主入口文档不再同时保留旧 `v0.5.7` 与新 `v0.5.17` 两套口径

风险:
- `docs/prd/v0.1.0/`、`docs/logbooks/` 与 `ops/current/` 里仍保留历史证据，需要继续按规则分层保留

下一步:
- 如需进一步瘦身，再评估 `AGENTS.md` 里哪些兼容入口说明可以继续压缩

## 2026-06-28

### 分组默认名、共享资源默认关闭与上传节点刷新恢复

目标:
- 按当前批次顺序收口三个问题：新建分组默认名、公共资源权限隐藏、画布刷新后上传素材丢失
- 保持“没有开放权限就不显示”的前台口径
- 让历史画布里缺少 `uploadType` 的上传节点也能在刷新后恢复素材

变更:
- `apps/web/src/stores/groupBus.ts`
  - 新建分组默认名改为 `未命名组`
- `apps/api/src/group-permission-policy.ts`
  - 成员组在缺少权限策略时改为默认关闭
  - 共享资源 / RH 条目 / 节点能力支持 `["*"]` 作为默认关闭哨兵
- `apps/api/src/server.ts`
  - 新建用户组时同步写入默认关闭的权限策略，避免新组默认全开放
- `apps/web/src/components/nodes/UploadNode.tsx`
  - 新增 `inferUploadKindFromData`
  - 当旧节点数据缺少 `uploadType` 但仍保留 `imageUrl/videoUrl/audioUrl` 等素材字段时，节点会自动恢复类型并回写
- 新增验证脚本：
  - `scripts/verify-group-default-name-contract.mjs`
  - `scripts/verify-shared-resource-visibility-contract.mjs`
  - `scripts/verify-upload-node-material-persistence-contract.mjs`
- 新增实施计划：
  - `docs/superpowers/plans/2026-06-29-group-default-permission-refresh-plan.md`

验证:
- `node scripts/verify-group-default-name-contract.mjs`
- `node scripts/verify-shared-resource-visibility-contract.mjs`
- `node scripts/verify-upload-node-material-persistence-contract.mjs`
- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/api`

影响:
- 新建画布分组不再出现异常默认文案
- 没有权限策略的普通成员组，前台默认不会再看到公共资源 / RH / 节点能力
- 老画布里只剩素材 URL、但缺少 `uploadType` 的上传节点，刷新后能自动恢复预览与类型

风险:
- 这轮把“缺少策略”解释为“默认关闭”，更贴近当前产品口径；如果后续要回到显式 allow-list 模型，需要同步重画后台权限页的交互文案
- 旧的、已经存在的“空 deny 列表策略”仍然表示全开放；如果要把历史组也全部切到默认关闭，需要单独做迁移或后台批量调整

下一步:
- 在灰度环境用真实成员账号复验公共资源与 RH 可见性
- 重点复验“画布插入图片/视频素材 -> 刷新页面 -> 上传节点仍能完整显示”链路

### 审计页账号级模型与 RH 条目下钻

目标:
- 在保留当前全局成功用量驾驶舱的前提下，新增“先选账号，再查看该账号模型与 RH 条目使用明细”的能力
- 保证账号下钻与全局汇总继续共用同一套 `succeeded` 统计口径
- 为后续更细的账号审计、按组分析和导出能力预留稳定结构

变更:
- 新增实现计划 `docs/superpowers/plans/2026-06-28-admin-audit-account-model-rh-usage-drilldown.md`
- 新增回归脚本 `scripts/verify-admin-usage-summary-selected-user.ts`
- `apps/api/src/admin-usage-analytics.ts`
  - `AdminUsageSummary` 新增 `selectedUser`
  - 新增账号模型明细与 RH 条目明细聚合
  - 选中账号后不再把全局统计缩成单账号统计，而是保留全局总量并额外返回账号下钻块
- `apps/admin/src/admin-types.ts`
  - 同步补齐 `UsageSelectedUserSummary`、账号模型明细和账号 RH 明细类型
- `apps/admin/src/admin-api-client.ts`
  - `adminAuditApi.readUsageSummary()` 改为支持 `range/groupId/userId/capability/providerId/...` 查询参数
- `apps/admin/src/main.tsx`
  - 审计页新增独立筛选状态、选中账号状态和独立刷新链路
- `apps/admin/src/admin-readonly-panels.tsx`
  - 审计面板向成功用量驾驶舱透传筛选、账号选择和加载错误状态
- `apps/admin/src/admin-usage-dashboard.tsx`
  - 审计页升级为“筛选区 + 账号下钻区 + 全局汇总区 + 审计日志区”
  - 账号下钻拆为“账号模型使用明细”和“账号 RH 条目使用明细”两张表
  - 保留“模型总使用次数”和“RH 条目总使用次数”两张全局表
- `apps/admin/src/styles.css`
  - 新增审计筛选条、账号摘要卡、空态和长字段表格的响应式样式
- `scripts/verify-admin-usage-dashboard-contract.mjs`
  - 契约检查升级为覆盖账号选择、账号下钻和全局表保留

验证:
- `npx tsx scripts/verify-admin-usage-summary-selected-user.ts`
- `node scripts/verify-admin-usage-dashboard-contract.mjs`
- `npm run build -w @xinghuan/api`
- `npm run build -w @xinghuan/admin`

影响:
- 后台现在可以先选账号，再看到该账号使用了哪些模型、用了多少次、最近一次使用时间
- 后台现在可以先选账号，再看到该账号使用了哪些 RH 条目、用了多少次、最近一次使用时间
- 选中账号后，全局模型与 RH 总使用次数统计仍会保留，不会退化成单账号视图

风险:
- 本轮完成了数据结构、筛选链路和桌面布局收口，但还没有做 gray 浏览器人工验收
- 若后续要支持自定义时间、导出或更深层模型/条目 drilldown，需要继续扩展筛选栏和表格操作区

下一步:
- 在 gray 环境验证真实账号数据、长 ID 展示和账号切换交互
- 继续扩展更细的账号 / 用户组审计统计与导出能力

## 2026-06-26

### 组权限治理第一批基础链路

目标:
- 先把按组治理的基础能力落地到真实代码，而不是只停留在计划
- 让公共资源库和 RunningHub 目录先具备“无权限直接不显示”的真实行为
- 保留后端兜底，防止旧画布残留引用或绕过前端直调继续使用受限条目

变更:
- 新增 `apps/api/db/019_group_permission_policies.sql`
- 新增 `apps/api/src/group-permission-policy.ts`
- 新增 `apps/api/src/group-permission-policy-routes.ts`
- 新增契约脚本 `scripts/verify-group-permission-governance-contract.mjs`
- `apps/api/src/server.ts`
  - auth storage 新增 `groupPermissionPolicies`
  - 新增分组权限策略、权限目录、当前用户有效权限接口
  - RunningHub public catalog/detail 开始按用户组过滤
  - RunningHub submit 增加后端兜底校验
- `apps/api/src/shared-resource-routes.ts`
  - 公共资源分类与条目开始按用户组直接过滤
- `apps/web/src/components/ResourceLibraryDrawer.tsx`
  - 删除“另存为我的资源 / 发送到我的资源库”入口
  - 公共资源卡片操作区改为自动换行
- `apps/web/src/services/sharedResourceApi.ts`
  - 删除前端已废弃的 copy-to-personal 调用
- `apps/admin/src/admin-types.ts`、`apps/admin/src/admin-api-client.ts`
  - 预埋分组权限策略、权限目录、有效权限接口类型与 client
- 同步更新 `docs/systems/api/interface-map.md`、`docs/systems/admin/ui-and-information-architecture.md`、`docs/systems/runninghub/catalog-and-entry-model.md`

验证:
- `node scripts/verify-group-permission-governance-contract.mjs`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/admin`

影响:
- 公共资源库现在会按组直接隐藏无权限资源与分类
- RunningHub catalog 现在会按组直接隐藏无权限 AI 应用 / 工作流
- 旧画布残留 RH 引用如果已经被禁用，提交时会被后端兜底拦截
- 公共资源库导致 foreign-key 报错的“另存为我的资源”前端路径已被移除

风险:
- 后台完整权限矩阵 UI 还没落地，目前先完成基础存储、接口和前台真实过滤行为
- 节点能力显式隐藏/锁定 UI 还在后续切片
- 这轮还没有进行灰度部署和线上人工验收

下一步:
- 继续补后台“账号 / 用户组 / 权限 / 会话”权限治理 UI
- 继续补节点能力显式限制与前端锁定状态
- 完成灰度部署后让你做真实业务验收

### 组权限治理后台管理端第一版

目标:
- 把用户页从“账号 + 分组挤在窄侧栏”的旧形态改成真正可管理的工作台
- 让后台管理员可以直接配置分组权限，而不是只有底层接口已经存在
- 先把公共资源、RH 应用、RH 工作流和节点能力四类限制统一收口到一个权限面板

变更:
- 新增 `apps/admin/src/admin-permissions-panel.tsx`
  - 独立承载分组权限治理矩阵
  - 支持 `公共资源 / RH AI 应用 / RH 工作流 / 节点能力` 四个子区块
  - 支持搜索、当前筛选批量允许/禁用、缺失 ID 保留展示、底部保存条
- `apps/admin/src/admin-users-panel.tsx`
  - 用户页改为 `账号 / 用户组 / 权限 / 会话` 四段式工作台
  - 账号页保留创建成员和账号治理
  - 用户组页改为大卡片式管理，不再依赖小范围滚动条
  - 权限页接入 `adminPermissionApi.readCatalog / listPolicies / updatePolicy`
  - 会话页独立出来，避免继续和分组编辑混排
- `apps/admin/src/styles.css`
  - 新增分段切换、分组卡片、权限矩阵、权限卡片、保存条与响应式样式
- 同步更新 `docs/systems/admin/ui-and-information-architecture.md`、`docs/prd/v0.1.0/progress.md`、`docs/prd/v0.1.0/changelog.md`

验证:
- `npm run type-check -w @xinghuan/admin`
- `node scripts/verify-group-permission-governance-contract.mjs`

影响:
- 后台现在已经能真实管理分组权限，而不只是底层接口可用
- 用户组列表不再被限制在很小的内部滚动区里，适合继续扩充更多分组
- 权限治理开始有明确的管理端承载面，后续节点锁定和公共资源后台卡片改造可以继续接在这套结构上

风险:
- 节点能力前台显式隐藏 / 已存在节点锁定状态还没做完
- 公共资源后台卡片化预览与完整素材预览仍在后续切片
- 这轮仍未做灰度部署与真实浏览器人工验收

下一步:
- 继续补节点能力在前台画布的显式隐藏与锁定
- 继续改公共资源后台为自适应预览卡片
- 收口后再做 gray 发布和你的人工验收

### 审计页成功用量统计驾驶舱第一版

目标:
- 把审计页从纯日志表升级为“成功用量驾驶舱 + 审计日志”双层结构
- 按组、账号、模型、RunningHub 后台条目统计成功次数
- 为后续组权限治理和 RH 条目管控准备稳定的数据下钻口径

变更:
- 新增 `apps/api/src/admin-usage-analytics.ts`，集中处理成功任务分类、模型/RH 条目聚合和日趋势汇总
- `apps/api/src/server.ts` 新增 `GET /api/admin/audit/usage-summary`
- 同步把 `/api/proxy/external/llm` 成功调用补写为 task-backed 成功记录
- RunningHub 新任务补写 `rhCatalogId / rhCatalogTitle / rhCatalogKind` 快照
- 新增 `apps/admin/src/admin-usage-dashboard.tsx`，在审计页顶部展示 KPI、能力占比、分组/账号排行、模型矩阵、RH 条目矩阵和每日趋势
- 新增契约脚本 `scripts/verify-admin-usage-dashboard-contract.mjs`
- 同步更新 `docs/systems/api/interface-map.md`、`docs/systems/admin/ui-and-information-architecture.md`、`docs/systems/runninghub/catalog-and-entry-model.md`

验证:
- `node scripts/verify-admin-usage-dashboard-contract.mjs`
- `npm run verify:admin-readonly-panels-contract`
- `npm run verify:admin-api-client-contract`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/api`

影响:
- 后台现在可以直接看到成功任务的组/账号/模型/RH 条目统计，不再只能靠审计日志人工数
- LLM 成功调用开始进入 `xh_tasks` 统计口径
- RunningHub 成功调用开始具备更稳定的后台条目级审计能力

风险:
- 当前驾驶舱第一版还没有加入时间范围和多条件交互筛选 UI，只先交付默认汇总视图
- 这轮还没有开始灰度部署，线上数据与视觉表现仍需灰度环境复验

下一步:
- 继续落地组权限治理、用户组/权限 UI 改造和公共资源/RH 管控
- 在灰度环境验证真实统计结果与现网任务是否一致

### 工作流资源保存后不可见修复

### Web 版本号展示与 release 对齐

目标:
- 修复前端显示版本号长期停留在 `0.5.6` 的问题
- 保证 Web 端版本角标与根版本、API 状态、gray / production release 一致

变更:
- `apps/web/vite.config.ts` 改为从根 `package.json` 读取版本并注入 `__APP_VERSION__`
- 新增 `scripts/verify-web-app-version-define.mjs`，阻止回退为硬编码版本
- 在根 `package.json` 新增 `verify:web-app-version-define`
- monorepo 与共享版本常量统一推进到 `v0.5.15`

验证:
- `npm install --package-lock-only --ignore-scripts`
- `npm run verify:web-app-version-define`
- `npm run build -w @xinghuan/web`

影响:
- Web UI 中的版本号会跟随正式版本推进自动同步
- 后续 gray / production 批次不再需要手动改前端展示版本

风险:
- 仍需在 gray / production 实机刷新前端确认缓存没有残留旧 bundle

下一步:
- 执行 `v0.5.15` 的 gray 与 production 发布，并验证远端状态返回与前端版本展示

目标:
- 修复“框选节点保存到资源库后，在工作流资源库里看不到”的问题
- 修复 workflow 资源后续插入画布时对 `fileUrl` 的错误强依赖

变更:
- `apps/web/src/services/api.ts` 中的 `getResourceItems` 不再把默认分类态 `all` 当成真实 `categoryId` 发给后端
- `apps/web/src/utils/workflowResource.ts` 新增 `resolveWorkflowResourceFragment`，优先从内嵌 `workflowFragment` 恢复工作流，缺失时才回退到 `fileUrl`
- `apps/web/src/App.tsx` 改为走统一工作流资源解析逻辑
- 新增回归脚本 `scripts/verify-resource-items-query-contract.ts`
- 新增回归脚本 `scripts/verify-workflow-resource-resolver-contract.ts`

验证:
- `npx tsx scripts/verify-resource-items-query-contract.ts`
- `npx tsx scripts/verify-workflow-resource-resolver-contract.ts`
- `npm run type-check -w @xinghuan/web`

影响:
- 资源库“工作流”分类现在可以正常看到刚保存的工作流
- 这类 workflow 资源后续插入画布时不再依赖额外生成 json 文件

风险:
- 仍需你在灰度环境亲测一次“保存工作流到资源库 -> 打开工作流资源库 -> 点击插入”的完整交互

下一步:
- 提交并推送 gray，等待真实画布链路验收

### 旧工作流兼容与资源库可见性修复

目标:
- 修复旧工作流导入后 LLM 节点兼容性问题
- 降低画布刷新后回退风险
- 让工作流资源保存后在资源库中稳定可见

变更:
- 新增 `apps/web/src/utils/nodeMigration.ts`，导入与恢复画布时对旧 `llm` 节点做轻迁移，清理运行态残留字段
- `apps/web/src/components/Canvas.tsx` 与 `apps/web/src/components/canvas/useCanvasPersistence.ts` 接入迁移层
- `apps/api/src/server.ts` 对 workflow 资源项补齐摘要与预览字段，确保资源卡片能稳定展示
- 新增 `docs/records/canvas/2026-06-26-canvas-compatibility-and-persistence-risk-analysis.md`

验证:
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/web`

影响:
- 旧工作流更容易直接运行
- 资源库中的 workflow 卡片预览和摘要可见性提升

风险:
- 仍需真实导入旧工作流、刷新画布、保存工作流做浏览器验收

下一步:
- 继续做本地浏览器真实验收，并视情况补充更细的节点 schema 迁移
### LLM 导入残留会话状态清理
目标:
- 修复“旧工作流导入后 LLM 节点无法正常使用，复制节点也无效，必须重建节点”的问题
- 让工作流资源库保存/恢复后的 LLM 节点不再携带旧会话和旧输出残留

变更:
- 收紧 `apps/web/src/utils/nodeMigration.ts` 的 `llm` 导入迁移，只保留模型配置与用户输入，清理旧的 `reply / prompt / history / generatedImages / imageUrls / taskRuns` 等残留运行态
- 同步收紧 `apps/api/src/canvas-node-migration.ts`，保证后端保存/恢复画布时与前端迁移口径一致
- 确认 `apps/web/src/utils/workflowResource.ts` 创建与恢复 workflow fragment 时会走模板运行态清理和 `LLM` 导入迁移，避免资源库里的旧工作流再次带回脏状态
- 新增回归脚本 `scripts/verify-llm-import-migration-contract.ts`

验证:
- `npx tsx scripts/verify-llm-import-migration-contract.ts`
- `npx tsx scripts/verify-workflow-resource-resolver-contract.ts`
- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/api`
- `codegraph sync`

影响:
- 旧工作流导入、从后端恢复、从资源库插入时，LLM 节点会被还原成“保留配置但不保留旧会话”的干净状态
- 之前因为旧多模态历史和旧输出地址被重复带入而导致的兼容性问题会被收口在迁移层，不需要用户手工重建节点

风险:
- 这次有意不再保留 LLM 节点的历史聊天内容和旧生成结果；如果后续需要“带会话复制/带会话归档”，要设计成显式能力，不能继续复用导入链路

下一步:
- 由你在灰度或当前环境中重点验证“旧工作流导入 / 资源库插入 / 刷新后重新打开画布”这三条链路里的 LLM 节点是否恢复正常
