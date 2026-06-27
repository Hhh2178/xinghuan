# Admin Backend Overall Redesign Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把星幻无限画布 Admin 后台从“旧功能集合”升级为统一的可视化运营后台与参数治理控制台，并在不丢失现有能力的前提下，完成新版信息架构、页面骨架、核心工作区、接口对齐和 UI 质量护栏。

**Architecture:** 采用“五大工作域 + 页面工作台 + 统一 Inspector / 保存条 / 预览弹层 / 筛选区”的分层架构，前端按工作域与对象工作区逐批重画，后端尽量复用现有接口并补齐缺失目录与摘要接口。计划按“壳层 -> 工作域主页 -> 高优先级业务页 -> 系统治理页 -> 全局能力”推进，每批必须带合同验证、构建验证和文档同步。

**Tech Stack:** React 19、TypeScript、Vite、lucide-react、现有 Admin API (`apps/admin/src/admin-api-client.ts`)、后端 `apps/api/src/server.ts` 及相关管理接口、契约脚本 `scripts/verify-*.mjs`

---

## 1. 计划定位

本文件不是单个功能的细分施工单，而是新版 Admin 后台的总控实施计划。它负责定义：

- 哪些页面和能力已经落地
- 哪些页面和能力尚未完成
- 每个工作域需要实现哪些前端功能、后台接口、摘要数据和交互状态
- 哪些 UI 质量问题必须视为功能需求处理，而不是留给“后面修样式”
- 后续分批执行时的边界、顺序、验证和收口方式

本文件与以下文档配套使用：

- 需求与页面 PRD：
  - `docs/superpowers/specs/2026-06-27-admin-designer-page-prd.md`
  - `docs/superpowers/specs/2026-06-26-admin-system-ui-functional-requirements-design.md`
- 整体设计与信息架构：
  - `docs/superpowers/specs/2026-06-26-admin-visual-operations-backend-redesign-design.md`
  - `docs/systems/admin/ui-and-information-architecture.md`
- 前端长期设计基线：
  - `docs/systems/admin/frontend-design/README.md`
  - `docs/systems/admin/frontend-design/visual-style-and-stitch-baseline.md`
  - `docs/systems/admin/frontend-design/page-map-and-functions.md`

## 2. 当前落地状态

### 2.1 已完成

- [x] 后台 `Starlight Shell` 第一阶段骨架
  - 五大工作域导航已落地
  - 顶部状态栏、刷新策略提示、工作区入口卡已落地
  - `Suspense` 加载边界已接入
- [x] 公共资源管理页第二阶段卡片化重画
  - 资源概览条
  - 分类侧栏
  - 四列优先卡片网格
  - 黑底完整预览
  - 图片 / 视频 / 音频完整预览弹层
  - 按钮自动换行
- [x] 用户与权限第一阶段治理收口
  - `账号 / 用户组 / 权限 / 会话` 四分区已拆出
  - 分组创建稳定 ID 改造已落地
  - 权限策略第一批数据链路与前台隐藏逻辑已落地
  - 审计页成功用量驾驶舱第一版已落地

### 2.2 未完成

- [ ] 大部分业务页仍停留在旧布局或第一版治理布局，没有完全进入新的统一后台前端体系
- [ ] 页面级懒加载和按工作域的真实分包尚未完成
- [ ] 全局搜索、告警中心、统一 Inspector 体系尚未完成
- [ ] 多个页面仍缺少“摘要 -> 列表 -> 详情 -> 保存 / 生效”完整链路
- [ ] 多个页面尚未建立专用视觉 / 结构合同脚本

### 2.3 2026-06-27 当前批次新增完成

- [x] `资源与内容` 工作域已补入 `生成库后台治理` 页面入口。
- [x] 生成库后台治理已落地为新版卡片工作台：
  - Hero
  - 类型切换
  - 搜索
  - 概览条
  - 摘要卡
  - 四列资源卡片
  - 完整预览弹层
  - 转公共资源 / 删除动作
- [x] 已新增 `verify:admin-resource-content-phase2` 结构合同，约束生成库后台入口、卡片治理和完整预览链路。

## 3. 工作域与页面范围

### 3.1 运营总览 `Command Center`

必须完成：

- 运营总览首页
- 环境健康条
- KPI 条带
- 能力用量趋势
- 队列运行态
- 风险雷达
- 最近变更

依赖数据：

- `Summary`
- `SystemInfo`
- `AdminUsageSummary`
- 告警聚合摘要
- 最近审计记录

接口需求：

- 复用当前总览和系统接口
- 新增或聚合概览专用摘要接口，避免前端多页拼装过重
- 提供最近变更摘要接口，按对象类型聚合近 N 条记录

### 3.2 能力配置 `Capability Console`

必须完成：

- 能力配置首页
- Provider 管理
- 模型目录
- RH AI 应用
- RH 工作流
- RH Key 池
- 节点能力目录
- AI 助手配置

依赖数据：

- Provider 列表 / 详情
- 模型目录 / 测试状态 / 输入能力 / 参数 schema
- RH catalog / editor metadata / analyze drafts / key pool
- 节点能力目录
- AI 助手设置
- 用量摘要、权限摘要、最近审计

接口需求：

- 保持 `adminRunningHubApi`、现有 Provider 与模型接口可复用
- 补齐节点能力目录聚合接口
- 补齐模型用量摘要、权限摘要、最近失败测试摘要
- 为能力配置首页增加跨对象摘要接口

### 3.3 资源与内容 `Resource & Content`

必须完成：

- 资源与内容首页
- 公共资源管理
- 生成库后台治理
- 公告中心
- 分类与标签治理

依赖数据：

- 公共资源分类与条目
- 资源上传
- 公告记录
- 任务结果 / 生成结果
- 权限摘要 / 最近变更

接口需求：

- 现有 `adminSharedResourceApi` 继续复用
- 为公共资源补充权限摘要接口或在权限目录内提供资源维度关联结果
- 新增后台生成库治理接口：
  - 结果列表
  - 结果详情
  - 标记 / 归档 / 删除 / 转公共资源
- 分类与标签接口需要统一入口，避免继续分散在页面内部生成

### 3.4 组织与治理 `Governance Center`

必须完成：

- 组织与治理首页
- 账号管理
- 用户组管理
- 权限策略
- 会话管理
- 用量分析
- 审计日志

依赖数据：

- `AdminUser`
- `AdminUserGroup`
- `AdminSessionRecord`
- `AdminGroupPermissionPolicy`
- `AdminPermissionCatalog`
- `AdminUsageSummary`
- `AuditRecord`

接口需求：

- 现有账号、用户组、会话、权限接口继续复用
- 为组织与治理首页补齐概览摘要接口
- 用量分析支持时间 / 组 / 账号 / 模型 / RH 条目筛选扩展
- 权限页需补“影响预览”或在前端基于目录实时汇总

### 3.5 系统与发布 `Ops Center`

必须完成：

- 系统与发布首页
- 系统健康
- 运行参数
- 任务队列
- 任务列表
- 环境同步
- 发布状态

依赖数据：

- `SystemInfo`
- `TaskListPage`
- `TaskQueueSettings`
- `EnvironmentSync*`
- release 当前索引与 gate 摘要

接口需求：

- 复用系统只读接口、任务接口、环境同步接口
- 补齐发布状态只读摘要接口
- 补齐系统主页专用摘要聚合接口

## 4. 全局前端结构要求

### 4.1 页面统一骨架

所有后台页面必须遵循同一骨架：

- 页面标题区
- 页面说明区
- KPI / 摘要条
- 筛选 / 操作区
- 主内容区
- 详情 Inspector 或详情弹层
- 保存条或操作确认条

禁止：

- 把整页做成单块表格或单块大表单
- 把多个对象的编辑器塞在一个横向滚动面板里
- 通过单独的小滚动槽承载整个对象列表

### 4.2 全局组件体系

必须建立和统一的组件：

- `Shell`
- `Workspace home`
- `Hero / summary strip`
- `KPI card`
- `Toolbar / filter rail`
- `Card grid`
- `Inspector`
- `Preview modal`
- `Savebar`
- `Confirm dialog`
- `Empty / loading / error states`

### 4.3 页面级懒加载

必须做：

- 工作域级或页面级动态 import
- 页面加载 skeleton
- 保证正在编辑的表单不被静默刷新覆盖

不要求本轮先做：

- 每一个小组件都拆成懒加载

## 5. UI 质量硬约束

以下内容视为功能需求，不是“最后再补样式”：

### 5.1 文字与内容展示

- 所有长文本必须有边界：
  - 省略
  - 换行
  - 复制
  - 进入详情查看
- 中文标题允许自然换行，但不得压缩到不可读
- 英文 ID、URL、邮箱、requestId、catalogId、workflowId 必须支持：
  - `overflow-wrap`
  - 或单行省略 + tooltip / Inspector
- 任何按钮中的文字都不能被挤压到只剩 1-2 个字符

### 5.2 卡片与表格

- 卡片必须有稳定最小宽度和预览区稳定高度 / 比例
- 卡片内动态内容不能导致同排布局剧烈跳动
- 表格长字段不能撑爆页面，必须进入受控滚动或省略展示
- 表格横向滚动只允许发生在完整表格容器，不允许出现页面和表格双重横滚

### 5.3 滚动与布局

- 页面不能出现无意义双滚动条
- 列表滚动区域必须是完整列表面板，而不是只剩局部小窗
- Inspector 如独立滚动，必须有清晰边界和固定高度策略
- 页面在 1280 / 1440 / 1920 下都不能出现主要内容遮挡

### 5.4 状态颜色与高亮

- 选中态、成功态、警告态、危险态不能混色
- 白字 / 深背景的对比度必须足够
- 高亮不能依赖低对比浅色背景
- 资源分类、权限分组、任务状态等列表项都要以“能扫读”为先

### 5.5 媒体预览

- 图片、视频、音频必须支持完整预览
- 缩略区与弹层一律优先 `contain`
- 不允许为了“铺满”而裁切 9:16 或 16:9 主体

## 6. 后端接口与数据工作清单

### 6.1 现有可复用接口

当前前端客户端已有：

- `adminAuditApi`
- `adminPermissionApi`
- `adminRunningHubApi`
- `adminAnnouncementApi`
- `adminSharedResourceApi`
- 主 `mutate` 体系

这些接口优先复用，不要为视觉改造无意义重写。

### 6.2 需要补齐的接口能力

- 运营总览聚合摘要接口
- 组织与治理首页聚合摘要接口
- 资源与内容首页聚合摘要接口
- 系统与发布首页聚合摘要接口
- 模型目录用量 / 权限摘要接口
- 节点能力目录接口
- 后台生成库治理接口
- 公共资源权限摘要接口
- 发布状态 / release gate 摘要接口
- 最近变更摘要接口
- 告警中心聚合接口

### 6.3 接口设计要求

- 只读摘要接口优先聚合，减少前端拼装多源请求
- 写接口保持 revision / 当前生效值 / 审计链路兼容
- 错误返回统一走 `AdminApiError`
- 冲突型接口继续支持 `currentRevision`

## 7. 分阶段实施顺序

### Phase A: 壳层与主页

范围：

- `Starlight Shell` 完整收口
- 五个工作域主页
- 全局搜索预埋位
- 告警中心预埋位

目标：

- 建立统一导航与主页节奏
- 每个工作域先有“可视化首页”

### Phase B: 组织与治理

范围：

- 组织与治理首页
- 用户组管理第二阶段重画
- 权限策略第二阶段重画
- 账号管理第二阶段重画
- 会话管理统一化
- 用量分析页继续升级

目标：

- 先解决用户最关心的账号 / 分组 / 权限 / 用量问题

当前推进补记：

- `用户组` 第二阶段卡片工作台已落地。
- `权限策略` 第二阶段已完成第一轮治理工作台升级，并继续补齐了 section overview、四项影响摘要、稳定元信息卡和空状态提示。
- `账号管理` Inspector 化和 `会话管理` 仪表重画仍待后续子计划继续推进。

### Phase C: 资源与内容

范围：

- 公共资源权限摘要与 Inspector
- 生成库后台治理
- 公告中心重画
- 分类与标签治理

目标：

- 建立统一内容资产后台

### Phase D: 能力配置

范围：

- 能力配置首页
- Provider 管理重画
- 模型目录重画
- RH AI 应用 / 工作流重画
- RH Key 池
- 节点能力目录
- AI 助手配置

目标：

- 把 Provider / 模型 / RH / 节点 / 助手统一收进能力目录

### Phase E: 系统与发布

范围：

- 系统与发布首页
- 系统健康
- 运行参数
- 任务队列
- 任务列表
- 环境同步
- 发布状态

目标：

- 把运维与发布视图彻底从旧表格页升级成治理工作台

### Phase F: 全局能力收口

范围：

- 全局搜索
- 告警中心
- 统一 Inspector 体系
- 页面级懒加载
- 合同脚本补齐

目标：

- 完成新后台的一致性和扩展能力收口

## 8. 每批实施要求

每一批必须同时满足：

- 一组明确页面范围
- 一套新或更新的合同脚本
- 至少一个用户可见工作台真实升级
- `@xinghuan/admin` 构建通过
- 相关设计文档同步更新
- clean commit

每批禁止：

- 同时混做多个互不相干工作域
- 只改样式不补结构合同
- 只改页面不补文档

## 9. 验证与交付要求

每批至少验证：

- 该批次新增合同脚本
- 相关既有合同脚本
- `npm run build -w @xinghuan/admin`

按页面需要追加：

- 相关 API 合同
- 资源权限合同
- 用户 / 权限合同
- 系统观测合同

交付说明必须包含：

- `Agent 已验证`
- `待用户验收`

不能把代码通过构建描述成“页面已完整验收”。

## 10. 文档同步要求

执行本总计划时，后续每批至少同步：

- `docs/systems/admin/frontend-design/page-map-and-functions.md`
- `docs/systems/admin/frontend-design/visual-style-and-stitch-baseline.md`
- 如涉及 IA 变更，同步 `docs/systems/admin/ui-and-information-architecture.md`
- 如涉及总计划状态，同步本文件阶段进度

## 11. 下一步执行建议

建议按下面顺序正式开工：

1. `Phase B-1 用户组管理第二阶段重画`
2. `Phase B-2 权限策略第二阶段重画`
3. `Phase C-1 生成库后台治理`
4. `Phase D-1 能力配置首页 + Provider 管理`

原因：

- 这条顺序最贴近当前用户反馈和已有设计资产
- 先把组织治理做顺，后续资源和能力页可以直接复用治理页的摘要条、卡片密度和 Inspector 语言
- 公共资源页已完成卡片基线，生成库能直接继承其媒体预览方案

## 12. 计划拆分策略

本总计划不直接用于一次性编码，应继续拆成子计划：

- `组织与治理第二阶段计划`
- `资源与内容第二阶段计划`
- `能力配置第二阶段计划`
- `系统与发布第二阶段计划`
- `全局能力收口计划`

每个子计划再按 `TDD + 合同脚本 + 页面批次` 细化为可执行施工单。
