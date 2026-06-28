# 后台审计统计账号模型与 RH 条目下钻设计

**日期：** 2026-06-28  
**范围：** Admin 后台 `审计` 页成功用量驾驶舱扩展  
**状态：** 设计完成，待评审后进入实施计划  
**目标：** 在保留现有全局成功用量统计结构的前提下，新增“先选账号，再查看该账号下各模型与各 RH 条目使用次数”的下钻能力，并继续保留模型与 RH 条目各自的全局总使用次数统计。

---

## 1. 背景

当前后台 `审计` 页已经有一版成功用量驾驶舱，能够展示：

- 成功总数
- 能力占比
- 分组排行
- 账号排行
- 每日趋势
- 模型矩阵
- RH 条目矩阵

现有数据结构和实现入口已经覆盖：

- 前端展示：
  - `apps/admin/src/admin-usage-dashboard.tsx`
  - `apps/admin/src/admin-readonly-panels.tsx`
- 后端聚合：
  - `apps/api/src/admin-usage-analytics.ts`
  - `apps/api/src/admin-audit-routes.ts`
- 请求入口：
  - `GET /api/admin/audit/usage-summary`

现有统计已经能看见：

- 各模型的总使用次数
- 各 RH 条目的总使用次数
- Top 账号和 Top 分组

但还缺少一个关键治理视角：

> 管理员需要先选中某一个账号，再看这个账号下面分别用了哪些模型、各用了多少次；用了哪些 RH 条目、各用了多少次。

也就是说，当前后台已经有“全局汇总”，但还没有“账号级明细下钻”。

---

## 2. 当前结构诊断

### 2.1 当前统计骨架是可复用的

后端 `buildAdminUsageSummary()` 已经具备以下稳定能力：

- 只统计 `status === "succeeded"` 的任务
- 能按时间范围过滤
- 能按组、账号、能力、Provider、模型、RH 条目过滤
- 能识别：
  - 图像模型
  - 视频模型
  - LLM 模型
  - 音频模型
  - RunningHub AI 应用
  - RunningHub 工作流

现有返回结构已经包括：

- `groups`
- `users`
- `models`
- `runningHubEntries`
- `daily`
- `totals`

诊断结论：

- 当前不是“没有统计能力”，而是“统计能力还停留在全局层，没有给账号下钻的展示结构”。

### 2.2 当前前端是全局驾驶舱，不是下钻工作台

现有 `AdminUsageDashboard` 更像一个总览页：

- 上方 KPI
- 中部能力占比 / 排行 / 趋势
- 下方模型矩阵 / RH 条目矩阵

但它没有：

- 账号选择器
- 当前选中账号摘要
- 账号级模型明细表
- 账号级 RH 条目明细表

诊断结论：

- 当前页面适合看“整体发生了什么”
- 不适合看“某个账号具体做了什么”

### 2.3 当前接口已经支持 `userId`，但前端没有真正利用它做双层视图

`/api/admin/audit/usage-summary` 现有 query 已支持：

- `from`
- `to`
- `groupId`
- `userId`
- `capability`
- `providerId`
- `modelId`
- `rhCatalogId`

诊断结论：

- 这次不需要重做一套新接口体系
- 更合适的路线是基于现有接口继续扩展返回结构和前端分区

---

## 3. 设计目标

本轮扩展必须同时满足四个目标：

1. **保留现有全局统计能力**  
   继续能看到模型和 RH 条目的总使用次数，不破坏当前驾驶舱。

2. **新增账号下钻能力**  
   允许管理员先选账号，再看到该账号的模型使用明细和 RH 条目使用明细。

3. **口径统一**  
   账号明细和全局汇总必须使用同一套筛选条件和同一套“只统计 succeeded”的口径。

4. **结构可扩展**  
   后续如果增加导出、按组联动、最近使用时间、更多排序、更多资源类型，不需要再推翻重构。

---

## 4. 方案对比

### 方案 A：新增独立账号明细接口

做法：

- 保留当前 `/api/admin/audit/usage-summary`
- 再新增一个账号详情接口，例如：
  - `/api/admin/audit/usage-user-detail`

优点：

- 语义清晰
- 后端响应结构可以完全按账号详情单独设计

缺点：

- 前后端要维护两套路由和两套返回结构
- 同一筛选口径容易出现重复逻辑
- 后续做联动筛选更容易漂移

结论：

- 不推荐作为本轮主方案。

### 方案 B：复用现有 `usage-summary`，增加账号详情块

做法：

- 继续只使用 `/api/admin/audit/usage-summary`
- 当未选择账号时，返回全局汇总
- 当选择账号时，在同一返回结构中增加 `selectedUser` 详情块

优点：

- 后端逻辑集中
- 前端状态结构统一
- 同一筛选条件天然一致
- 改动小，风险低

缺点：

- 返回结构比现在稍复杂
- 需要把当前 summary 模型向“总览 + 下钻”扩一层

结论：

- **推荐采用方案 B。**

---

## 5. 最终设计

### 5.1 页面定位

`审计` 页仍然是：

- 成功用量驾驶舱
- 审计日志页

但结构从“纯全局总览”升级为：

1. 顶部筛选区
2. 账号下钻区
3. 全局汇总区
4. 审计日志区

### 5.2 页面布局

```md
审计页
├─ 筛选区
│  ├─ 时间范围
│  ├─ 用户组
│  ├─ 能力类型
│  ├─ Provider
│  └─ 账号选择器
│
├─ 账号下钻区
│  ├─ 空态：请选择账号查看明细
│  ├─ 账号摘要卡
│  ├─ 模型使用明细表
│  └─ RH 条目使用明细表
│
├─ 全局汇总区
│  ├─ KPI 条带
│  ├─ 能力占比
│  ├─ 分组排行
│  ├─ 账号排行
│  ├─ 每日趋势
│  ├─ 模型总使用次数表
│  └─ RH 条目总使用次数表
│
└─ 审计日志区
```

### 5.3 筛选区设计

筛选区负责控制“全局汇总”和“账号下钻”的共同口径。

字段：

- 时间范围
  - 今天
  - 7 天
  - 30 天
  - 自定义
- 用户组
- 能力类型
  - 图像
  - 视频
  - RH AI 应用
  - RH 工作流
  - LLM
  - 音频
- Provider
- 账号选择器

交互规则：

- 账号选择器放在筛选区最后，语义上表示“在当前筛选口径下，进一步查看某个账号”。
- 不默认展开所有账号明细。
- 如果当前筛选条件下账号列表为空，则账号选择器显示空态。

### 5.4 账号下钻区设计

#### 空态

未选择账号时显示：

```md
请选择账号查看模型与 RH 条目使用明细
```

不显示空表格，不占用过高空间。

#### 账号摘要卡

选择账号后，顶部展示账号摘要：

- 账号邮箱
- 名称
- 备注
- 所属组
- 成功总次数
- 最近成功时间
- 是否为已删除账号

展示规则：

- 如果账号已删除但历史任务仍在，摘要卡继续显示该账号桶，名称使用 `已删除账号`。
- 摘要卡保持一屏内清晰可扫，不堆过多辅助指标。

#### 模型使用明细表

表字段：

| 字段 | 说明 |
|---|---|
| 能力类型 | image / video / llm / audio 的业务展示名 |
| Provider | Provider 名称 |
| 模型名称 | `displayName` |
| 模型 ID | `modelId` |
| 使用次数 | 当前账号在当前筛选下的成功次数 |
| 最近使用时间 | 当前账号最近一次成功使用该模型的时间 |

排序默认规则：

1. 使用次数降序
2. 最近使用时间降序
3. 模型名称字典序

#### RH 条目使用明细表

表字段：

| 字段 | 说明 |
|---|---|
| RH 类型 | AI 应用 / 工作流 |
| Provider | Provider 名称 |
| 条目名称 | `title` |
| Catalog ID | 后台 catalogId |
| RunTarget ID | RH runTargetId |
| 使用次数 | 当前账号在当前筛选下的成功次数 |
| 最近使用时间 | 当前账号最近一次成功使用该条目的时间 |

排序默认规则：

1. 使用次数降序
2. 最近使用时间降序
3. 条目名称字典序

### 5.5 全局汇总区设计

现有全局驾驶舱保留，但文案和结构统一成“总量层”。

保留内容：

- 成功总数
- 图像 / 视频 / RH App / RH Workflow / LLM / 音频占比
- Top 分组
- Top 账号
- 每日趋势

保留并强化两张总量表：

#### 模型总使用次数表

| 字段 | 说明 |
|---|---|
| 能力类型 | image / video / llm / audio |
| Provider | Provider 名称 |
| 模型名称 | displayName |
| 模型 ID | modelId |
| 总使用次数 | 全局成功次数 |
| Top 组 | 使用最多的组 |
| Top 账号 | 使用最多的账号 |

#### RH 条目总使用次数表

| 字段 | 说明 |
|---|---|
| RH 类型 | AI 应用 / 工作流 |
| Provider | Provider 名称 |
| 条目名称 | title |
| Catalog ID | catalogId |
| RunTarget ID | runTargetId |
| 总使用次数 | 全局成功次数 |
| Top 组 | 使用最多的组 |
| Top 账号 | 使用最多的账号 |

### 5.6 审计日志区

继续保留现有审计日志表，不与成功用量统计混表。

原因：

- 成功用量是聚合数据
- 审计日志是后台操作记录
- 两者职责不同，不应混成一个区域

---

## 6. 数据结构设计

### 6.1 保留现有 `AdminUsageSummary`

当前结构继续保留：

- `totals`
- `groups`
- `users`
- `models`
- `runningHubEntries`
- `daily`

### 6.2 新增 `selectedUser` 详情块

建议在 `AdminUsageSummary` 中新增：

```ts
selectedUser?: {
  userId: string;
  email: string;
  name: string;
  remark?: string;
  groupId?: string;
  groupName?: string;
  ownerDeleted?: boolean;
  successful: number;
  lastSucceededAt?: number;
  modelBreakdown: UsageSelectedUserModelRow[];
  runningHubBreakdown: UsageSelectedUserRunningHubRow[];
}
```

### 6.3 新增账号模型明细类型

```ts
export interface UsageSelectedUserModelRow {
  capability: "image" | "video" | "llm" | "audio";
  providerId: string;
  providerName: string;
  modelRecordId: string;
  modelId: string;
  displayName: string;
  total: number;
  lastUsedAt?: number;
}
```

### 6.4 新增账号 RH 明细类型

```ts
export interface UsageSelectedUserRunningHubRow {
  kind: "app" | "workflow";
  providerId: string;
  providerName: string;
  catalogId: string;
  title: string;
  runTargetId: string;
  total: number;
  lastUsedAt?: number;
}
```

### 6.5 聚合规则

账号模型明细按以下维度聚合：

- `capability`
- `providerId`
- `modelRecordId`

账号 RH 明细按以下维度聚合：

- `kind`
- `providerId`
- `catalogId`

统计口径：

- 只统计 `status === "succeeded"`
- 只统计当前筛选时间范围内的记录
- 只统计当前筛选组 / 能力 / Provider 下仍命中的记录

---

## 7. 后端改造设计

### 7.1 保留现有路由

继续使用：

```md
GET /api/admin/audit/usage-summary
```

不新增第二条账号明细路由。

### 7.2 现有 query 继续保留

继续支持：

- `from`
- `to`
- `groupId`
- `userId`
- `capability`
- `providerId`
- `modelId`
- `rhCatalogId`

### 7.3 聚合函数扩展

在 `buildAdminUsageSummary()` 中新增账号详情构建逻辑：

- 当没有 `userId` 时：
  - 只返回全局汇总
- 当有 `userId` 时：
  - 在返回结果中增加 `selectedUser`

这样不改变原有主路径，只在命中账号下钻时补额外块。

### 7.4 已删除账号兼容

如果 `userId` 对应账号已从用户表删除，但任务仍存在：

- 允许继续生成该账号统计桶
- `ownerDeleted = true`
- `email / name` 使用历史任务中的 fallback 值

### 7.5 RH 历史条目兼容

如果 RH 条目已不在最新 catalog 中：

- 保留历史 `catalogId`
- 标题 fallback 到任务快照中的 `rhCatalogTitle`
- 如果再缺失，显示 `未知 RH 条目`

### 7.6 模型历史条目兼容

如果模型已下线或已删除：

- 保留历史 `modelId`
- `displayName` fallback 到任务快照
- 如果仍缺失，显示 `未知模型`

---

## 8. 前端改造设计

### 8.1 API Client 扩展

当前 `adminAuditApi.readUsageSummary()` 无 query 参数。

改为：

```ts
readUsageSummary(filters?: {
  from?: number;
  to?: number;
  groupId?: string;
  userId?: string;
  capability?: UsageCapability;
  providerId?: string;
  modelId?: string;
  rhCatalogId?: string;
})
```

### 8.2 状态结构

在 `main.tsx` 中新增：

- `usageFilters`
- `selectedUsageUserId`
- `usageSummaryLoading`
- `usageSummaryError`

不建议把审计驾驶舱继续完全塞进一次 `loadAdminData()` 的无参总拉取里。

建议拆成：

- 页面基础数据总拉取
- 审计统计按筛选独立拉取

### 8.3 驾驶舱组件拆分建议

当前 `admin-usage-dashboard.tsx` 可继续承载主入口，但建议拆出：

- `admin-usage-filters.tsx`
- `admin-usage-selected-user-panel.tsx`
- `admin-usage-global-summary.tsx`
- `admin-usage-audit-shell.tsx`

原因：

- 当前文件已经承载 KPI、排行、趋势、表格
- 再直接追加账号下钻逻辑会继续膨胀
- 下钻区和全局区天然是两个 section

### 8.4 交互规则

1. 初始进入审计页  
   - 展示全局统计
   - 账号下钻区为空态

2. 选中账号  
   - 维持全局区显示
   - 账号下钻区展示明细

3. 修改筛选条件  
   - 全局区刷新
   - 若账号已选中，则账号下钻区同步刷新

4. 如果账号在当前筛选范围下无成功记录  
   - 账号摘要仍保留
   - 两张明细表显示空态

5. 如果切换用户组导致账号不在当前筛选组  
   - 清空账号选择
   - 回到空态

---

## 9. 视觉与布局约束

本次设计不要求重做整页视觉风格，但必须遵守现有后台改造约束：

1. 账号下钻区和全局区必须分层，不得形成卡片互压。
2. 两张账号明细表默认纵向堆叠，不做超宽双表并排，避免 1080 宽度下压缩难读。
3. 长邮箱、长模型 ID、长 catalogId 必须：
   - 有最大宽度
   - 省略展示
   - hover 可见全量
4. 空态不要用高亮大色块，不与 KPI 争焦点。
5. 筛选区支持换行，账号选择器不能把其他筛选项挤爆。

---

## 10. 验收标准

### 10.1 功能验收

- 审计页默认能看到现有全局成功用量驾驶舱。
- 选择账号后，能看到该账号的：
  - 模型使用明细表
  - RH 条目使用明细表
- 仍然能看到：
  - 模型总使用次数表
  - RH 条目总使用次数表

### 10.2 数据口径验收

- 所有统计都只统计 `succeeded`。
- 全局总量与账号明细使用同一时间范围和筛选条件。
- 账号总次数应等于该账号模型明细 + RH 明细 + 其他能力统计汇总的统一口径结果。

### 10.3 兼容验收

- 删除账号后历史统计仍可看。
- 删除模型后历史模型统计仍可看。
- 删除 RH 条目后历史 RH 统计仍可看。
- 未分组账号仍归入 `未分组`。

### 10.4 UI 验收

- 未选择账号时，账号下钻区空态清晰。
- 选择账号后，两张明细表不重叠、不溢出。
- 在 1080 和 2K 宽度下，长 ID 不挤坏布局。
- 筛选区在 AI 助手展开和收起两种状态下都能正常显示。

---

## 11. 本方案决议

本轮采用：

- **在现有 `/api/admin/audit/usage-summary` 结构上扩展 `selectedUser` 账号下钻块**
- **审计页增加“先选账号，再展示模型与 RH 两张明细表”的交互**
- **继续保留模型与 RH 条目的全局总使用次数统计**

本轮不采用：

- 单独新建第二条账号明细接口
- 默认展开所有账号明细
- 将模型与 RH 混合成一张账号明细表

后续进入实施时，应优先以本设计为准拆出实现计划，并保持与当前后台审计驾驶舱、权限治理和 RH 条目治理的一致口径。
