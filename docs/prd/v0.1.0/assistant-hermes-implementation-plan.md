# 无限画布 AI 助手实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为无限画布建立“前端创作助手 + 后台审计助手 + 项目专属 Hermes 执行内核”的可控落地路径，第一阶段完成草案生成与人工确认链路。

**Architecture:** 产品层在现有画布与后台中内嵌实现，统一通过助手编排层调 Hermes；Hermes 仅通过白名单工具访问画布上下文、模型目录、任务状态和安全联网测试接口，所有高风险动作保留审批闸门。

**Tech Stack:** Monorepo TypeScript, apps/web, apps/admin, apps/api, apps/worker, PostgreSQL, Redis, Hermes runtime, internal HTTP tools, gray deployment

---

## 一、实施拆分

本计划拆成五个实施包：

1. 助手边界与接口基线
2. 后台助手最小工作台
3. Hermes runtime 隔离接入
4. 前端助手最小交互壳
5. 草案审批与灰度验收闭环

## 二、文件与模块规划

建议新增或改造的责任区如下：

### 文档

- 新增：`docs/prd/v0.1.0/assistant-hermes-plan.md`
- 新增：`docs/prd/v0.1.0/assistant-hermes-implementation-plan.md`

### 前端

- 新增：`apps/web/src/components/assistant/`
- 新增：`apps/web/src/hooks/useAssistantContext.ts`
- 可能修改：`apps/web/src/components/Canvas.tsx`
- 可能修改：`apps/web/src/store/...` 当前画布状态模块

### 后台

- 新增：`apps/admin/src/features/assistant/`
- 可能修改：`apps/admin/src/App.tsx`
- 可能新增：后台导航或管理页注册文件

### API / 编排层

- 新增：`apps/api/src/assistant/`
- 新增：`apps/api/src/assistant/tools/`
- 新增：`apps/api/src/assistant/runtime/`
- 新增：`apps/api/src/routes/assistant*.ts`
- 可能修改：现有认证、中间件、审计日志和 provider/model repository 相关模块

### 配置 / 运维

- 新增：Hermes 专属 env 模板
- 新增：Hermes runtime 部署 runbook
- 新增：灰度助手验收脚本

## 三、执行任务

### Task 1：冻结助手边界与接口清单

**Files:**
- Create: `docs/prd/v0.1.0/assistant-hermes-plan.md`
- Create: `docs/prd/v0.1.0/assistant-hermes-implementation-plan.md`
- Modify: `docs/prd/v0.1.0/decisions.md`
- Modify: `docs/prd/v0.1.0/progress.md`

- [ ] **Step 1: 确认方案文档入库**

写入本次已确认的方案、阶段、权限分层、Hermes 隔离原则和执行路线。

- [ ] **Step 2: 在决策记录中追加正式结论**

补一条 AI 助手接入决策，明确采用“方案 C 的产品层思路 + 项目专属 Hermes 内核接入”。

- [ ] **Step 3: 在进度记录中追加后续实施入口**

标记该方案已完成文档冻结，后续实施以本计划为准。

- [ ] **Step 4: 检查文档引用一致性**

确保 `assistant-hermes-plan.md` 与后续 `provider-model-framework`、`decisions.md` 的术语一致，统一使用：

- `前端创作助手`
- `后台审计 / 配置助手`
- `项目专属 Hermes runtime`
- `草案生成 + 人工确认后应用`

### Task 2：定义助手编排层与工具协议

**Files:**
- Create: `apps/api/src/assistant/types.ts`
- Create: `apps/api/src/assistant/policy.ts`
- Create: `apps/api/src/assistant/tools/index.ts`
- Create: `apps/api/src/assistant/service.ts`
- Test: `apps/api/src/assistant/__tests__/policy.test.ts`

- [ ] **Step 1: 写权限模型失败测试**

测试至少覆盖：

- 普通用户不可访问后台助手
- 后台助手不可申请禁止动作
- 草案动作会被标记为 `requiresApproval`

- [ ] **Step 2: 跑测试验证失败**

运行相关 API 单测，确认权限模块尚未实现。

- [ ] **Step 3: 写最小类型定义**

定义：

- `AssistantRole`
- `AssistantActionLevel`
- `AssistantToolName`
- `AssistantExecutionPolicy`
- `AssistantDraftResult`

- [ ] **Step 4: 实现策略判断**

实现角色与动作级别的映射，明确：

- 前端助手只能使用用户态上下文工具
- 后台助手可用分析与草案工具
- 禁止动作直接 reject

- [ ] **Step 5: 跑测试验证通过**

确保权限分层与草案标记行为生效。

- [ ] **Step 6: 提交**

提交信息建议：`feat: add assistant policy baseline`

### Task 3：实现后台助手最小分析入口

**Files:**
- Create: `apps/api/src/routes/assistant-admin.ts`
- Create: `apps/api/src/assistant/tools/fetch-api-doc-page.ts`
- Create: `apps/api/src/assistant/tools/run-safe-api-probe.ts`
- Create: `apps/api/src/assistant/tools/generate-provider-draft.ts`
- Create: `apps/api/src/assistant/tools/generate-model-draft.ts`
- Test: `apps/api/src/assistant/__tests__/admin-assistant-tools.test.ts`

- [ ] **Step 1: 写后台助手工具失败测试**

覆盖：

- 管理员可调用文档抓取工具
- 非管理员被拒绝
- 安全探活禁止危险方法
- 草案输出结构完整

- [ ] **Step 2: 跑测试验证失败**

确认路由、工具、鉴权都还不存在。

- [ ] **Step 3: 实现最小只读工具**

包括：

- 文档抓取
- 安全探活
- provider 草案
- model 草案

其中联网工具仅允许白名单方法和受控超时。

- [ ] **Step 4: 接入后台路由**

新增管理员专用助手分析入口，例如：

- `POST /api/admin/assistant/analyze-provider`
- `POST /api/admin/assistant/draft-model`

- [ ] **Step 5: 跑测试验证通过**

确保管理员链路可用，成员和游客被拒绝。

- [ ] **Step 6: 提交**

提交信息建议：`feat: add admin assistant draft endpoints`

### Task 4：搭建后台助手工作台最小界面

**Files:**
- Create: `apps/admin/src/features/assistant/AssistantWorkbenchPage.tsx`
- Create: `apps/admin/src/features/assistant/components/ProviderAnalysisForm.tsx`
- Create: `apps/admin/src/features/assistant/components/DraftResultPanel.tsx`
- Create: `apps/admin/src/features/assistant/components/ApprovalPreviewPanel.tsx`
- Modify: `apps/admin/src/App.tsx`
- Test: `apps/admin/src/features/assistant/__tests__/assistant-workbench.test.tsx`

- [ ] **Step 1: 写工作台渲染失败测试**

覆盖：

- 管理员能进入工作台
- 表单可提交分析请求
- 草案结果能显示
- diff / 风险说明区域可见

- [ ] **Step 2: 跑测试验证失败**

确认页面与路由尚不存在。

- [ ] **Step 3: 实现最小页面结构**

包含：

- 文档/样例输入区
- 分析按钮
- 草案结果区
- 风险与待确认区

- [ ] **Step 4: 接入后台导航**

将助手工作台作为管理员专用入口挂入 `/admin`。

- [ ] **Step 5: 跑测试验证通过**

确保页面可访问、提交成功、结果结构正确展示。

- [ ] **Step 6: 提交**

提交信息建议：`feat: add admin assistant workbench`

### Task 5：接入项目专属 Hermes runtime

**Files:**
- Create: `apps/api/src/assistant/runtime/hermes-client.ts`
- Create: `apps/api/src/assistant/runtime/hermes-session.ts`
- Create: `config/hermes/canvas-assistant.env.example`
- Create: `ops/hermes-runtime-runbook.md`
- Test: `apps/api/src/assistant/__tests__/hermes-runtime.test.ts`

- [ ] **Step 1: 写 Hermes runtime 集成失败测试**

覆盖：

- 编排层可向 Hermes 发送受控请求
- 工具调用必须经过白名单校验
- 会话日志可落审计结构

- [ ] **Step 2: 跑测试验证失败**

确认 runtime 客户端和会话层尚不存在。

- [ ] **Step 3: 实现最小 Hermes 客户端封装**

封装：

- runtime endpoint
- session id
- timeout
- tool call wrapper

- [ ] **Step 4: 接入策略层**

确保 Hermes 只能看到允许的工具和裁剪后的上下文。

- [ ] **Step 5: 补运维模板**

写入：

- 独立 env
- 独立日志
- 独立 token
- 部署注意事项

- [ ] **Step 6: 跑测试验证通过**

确保工具白名单和会话审计链路成立。

- [ ] **Step 7: 提交**

提交信息建议：`feat: integrate isolated hermes runtime`

### Task 6：实现前端助手最小交互壳

**Files:**
- Create: `apps/web/src/components/assistant/AssistantLauncher.tsx`
- Create: `apps/web/src/components/assistant/AssistantPanel.tsx`
- Create: `apps/web/src/components/assistant/AssistantSidebar.tsx`
- Create: `apps/web/src/hooks/useAssistantContext.ts`
- Modify: `apps/web/src/components/Canvas.tsx`
- Test: `apps/web/src/components/assistant/__tests__/assistant-ui.test.tsx`

- [ ] **Step 1: 写前端助手 UI 失败测试**

覆盖：

- 悬浮入口可见
- 点击后展开浮窗
- 可切换为固定态
- 可显示当前节点上下文摘要

- [ ] **Step 2: 跑测试验证失败**

确认组件和接入点尚不存在。

- [ ] **Step 3: 实现最小 UI 壳**

包含：

- 悬浮按钮
- 浮窗态
- 固定态
- 上下文摘要区
- 快捷动作区

- [ ] **Step 4: 接入画布上下文桥**

至少读取：

- 当前选中节点类型
- 当前模型显示名
- 最近任务错误摘要

- [ ] **Step 5: 跑测试验证通过**

确保交互不破坏画布现有行为。

- [ ] **Step 6: 提交**

提交信息建议：`feat: add canvas assistant shell`

### Task 7：实现草案审批与灰度预验收闭环

**Files:**
- Create: `apps/api/src/assistant/tools/create-acceptance-checklist.ts`
- Create: `apps/api/src/assistant/tools/apply-draft-to-staging.ts`
- Create: `apps/api/src/assistant/audit-log.ts`
- Modify: `apps/admin/src/features/assistant/components/ApprovalPreviewPanel.tsx`
- Test: `apps/api/src/assistant/__tests__/draft-approval.test.ts`

- [ ] **Step 1: 写草案审批失败测试**

覆盖：

- 草案默认不生效
- 管理员确认后只写入草稿区
- 生成灰度验收 checklist
- 审计记录完整

- [ ] **Step 2: 跑测试验证失败**

确认审批与审计链尚不存在。

- [ ] **Step 3: 实现审批与审计最小逻辑**

包括：

- 草稿确认写入
- 审计日志落盘 / 入库
- 验收清单生成

- [ ] **Step 4: 接入后台确认按钮**

让管理员可在工作台内完成：

- 查看 diff
- 确认应用到草稿
- 获取灰度验收建议

- [ ] **Step 5: 跑测试验证通过**

确保“生成草案 + 人工确认后应用”闭环成立。

- [ ] **Step 6: 提交**

提交信息建议：`feat: add assistant draft approval flow`

### Task 8：补齐验证、文档和灰度验收脚本

**Files:**
- Create: `scripts/verify-assistant-admin-workbench.mjs`
- Create: `scripts/verify-canvas-assistant-shell.mjs`
- Modify: `docs/prd/v0.1.0/progress.md`
- Modify: `docs/prd/v0.1.0/changelog.md`
- Modify: `docs/prd/v0.1.0/release.md`

- [ ] **Step 1: 写后台助手验收脚本**

验证：

- 管理员入口
- 分析请求
- 草案结构
- 审批流

- [ ] **Step 2: 写前端助手验收脚本**

验证：

- 悬浮入口显示
- 浮窗展开
- 固定态切换
- 上下文摘要显示

- [ ] **Step 3: 本机跑通验收**

至少覆盖：

- 类型检查
- 单元测试
- 构建
- 两条助手验收脚本

- [ ] **Step 4: 灰度验证**

在灰度确认：

- 后台工作台可访问
- Hermes runtime 可用
- 审批链可追溯
- 前台助手不破坏主画布操作

- [ ] **Step 5: 更新文档**

补齐：

- progress
- changelog
- release

- [ ] **Step 6: 提交**

提交信息建议：`docs: record assistant acceptance and release status`

## 四、执行顺序建议

推荐实际开发顺序：

1. Task 2
2. Task 3
3. Task 4
4. Task 5
5. Task 6
6. Task 7
7. Task 8

Task 1 已由本次文档工作预先完成。

## 五、最小上线范围

建议首个可验收版本只包含：

- 后台助手工作台最小版
- 项目专属 Hermes runtime 接入
- 前端助手 UI 壳与上下文摘要
- 草案生成与人工确认写入草稿

暂不包含：

- 自动改正式配置
- 自动部署
- 自动大规模代码修改
- 多智能体协作编排

## 六、完成判定

满足以下条件即可判定首阶段完成：

1. 画布页存在可用的助手入口和固定侧栏
2. `/admin` 存在可用的助手工作台
3. 后台助手可联网分析 API 文档并生成草案
4. Hermes 已以项目专属 runtime 方式接入
5. 草案只能在管理员确认后写入草稿区
6. 全链路具备审计记录和灰度验收脚本

## 七、实施提醒

- 始终优先保持当前项目单体完整性
- 避免为了助手功能引入第二套过重平台
- 任何高风险自动化都必须后置
- 所有实现优先服务当前 Provider / 模型接入与画布创作场景，不做泛化过度设计
