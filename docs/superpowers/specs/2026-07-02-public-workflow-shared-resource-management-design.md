# Public Workflow Shared Resource Management Design

## 目标

本轮要把“工作流”补齐为公共资源库中的完整可治理类型，但不新开一套独立系统。

明确目标只有三件事：

- 管理员可以把当前画布工作流发布到公共资源库。
- 管理员可以用本地 JSON 文件导入新的公共工作流，或替换已有公共工作流。
- 普通成员只能按现有公共资源权限浏览、插入和另存为个人工作流，不能发布和管理。

## 已确认决策

- 采用“共享资源内的工作流专项治理”路线，不新建独立工作流模板系统。
- 公共工作流继续使用现有 `shared resource kind = workflow`。
- 权限完全复用现有 `公共资源` 权限体系，不新增独立权限域。
- 后台不做工作流拓扑预览。
- 后台不做元数据编辑。
- 后台保留：
  - 列表查看
  - 上传新 workflow JSON
  - 下载 workflow JSON
  - 使用本地 JSON 文件替换已有工作流
  - 删除
- 只有管理员可发布、导入、替换、删除公共工作流。

## 当前问题

### 1. 数据模型已经有 `workflow`，但公共链路没有闭环

当前仓库里：

- 资源类型已包含 `workflow`
- 个人资源库已支持保存工作流
- 公共资源后端已支持 `/api/shared-resources/workflows/add`
- 前台资源库已支持插入工作流资源

但仍缺少两条关键链路：

- 从前台把当前工作流发布到公共资源库
- 在后台围绕公共工作流做最小治理

### 2. 前台公共资源上传仍停留在媒体类型

当前前台公共资源库上传按钮只支持：

- `image`
- `video`
- `audio`

代码里已经明确把：

- `workflow`
- `pose`
- `set`

标成“稍后接入”。

### 3. 后台虽然有 `workflow` 页签，但没有工作流专属动作

后台公共资源管理页已经能切到 `workflow` 类型，但仍按普通资源卡片逻辑处理，缺少：

- workflow JSON 上传
- workflow JSON 下载
- workflow JSON 替换

## 设计原则

### 1. 复用现有资源模型，不拆新系统

本轮不新建独立公共工作流库表意，不新增新的权限对象，不再平行造一个“模板中心”。

工作流公共资源继续复用：

- `shared-resources`
- `workflowFragment`
- 现有资源 revision 机制
- 现有公共资源权限过滤

### 2. 前台负责发布，后台负责治理

前台承担创作现场动作：

- 从当前画布发布公共工作流
- 导入本地 JSON 到公共资源库

后台承担集中治理动作：

- 上传新工作流
- 下载 JSON
- 用本地 JSON 替换
- 删除

### 3. 写权限必须是管理员硬限制

不能只依赖前端隐藏按钮。

所有工作流公共资源写操作在服务端都必须强制 `admin`：

- create
- import
- replace
- delete

### 4. 本轮 deliberately 不做重交互

本轮不做：

- 在线 workflow JSON 编辑器
- 拓扑预览
- 元数据二次编辑工作台
- 独立工作流权限矩阵

## 方案比较

### 方案 A：只补一个前台发布按钮

做法：

- 只在前台加“发布到公共资源库”
- 后台仍不补工作流治理动作

问题：

- 运营和治理仍要靠文件层手工处理
- 无法替换已有公共工作流
- 管理闭环不完整

结论：

- 不采用

### 方案 B：复用共享资源体系，补齐发布、导入、下载、替换、删除

做法：

- 前台补管理员发布/导入
- 后台补管理员上传/下载/替换/删除
- 后端继续复用 shared resource workflow 存储与权限

优点：

- 改动面可控
- 与当前架构最一致
- 能闭合用户要的完整链路

结论：

- 采用本方案

### 方案 C：独立公共工作流模板中心

问题：

- 与“复用现有公共资源权限”冲突
- 会引入新的数据域和治理模型
- 超出本轮目标

结论：

- 本轮不采用

## 范围与非目标

### 范围内

- 管理员从前台当前画布发布公共工作流
- 管理员从前台导入 workflow JSON 到公共资源库
- 管理员从后台上传新的公共工作流 JSON
- 管理员从后台下载已有公共工作流 JSON
- 管理员从后台使用本地 JSON 文件替换已有公共工作流
- 管理员从后台删除公共工作流
- 普通成员浏览、插入、另存为个人工作流
- 现有公共资源权限继续作用于工作流资源

### 非目标

- 不新建独立工作流资源权限系统
- 不做工作流预览
- 不做元数据编辑
- 不做在线 JSON 编辑
- 不做批量替换、批量导入、批量删除
- 不做公共工作流引用分析与删除阻断

## 现状落点

和本轮直接相关的代码入口：

- 前台资源库
  - `apps/web/src/components/ResourceLibraryDrawer.tsx`
  - `apps/web/src/services/sharedResourceApi.ts`
  - `apps/web/src/services/api.ts`
- 个人工作流保存
  - `apps/web/src/components/canvas/useCanvasSendFlow.ts`
  - `apps/web/src/utils/workflowResource.ts`
- 后端共享资源
  - `apps/api/src/shared-resource-routes.ts`
  - `apps/api/src/resource-workflow-helpers.ts`
- 后台公共资源管理
  - `apps/admin/src/admin-public-resources-panel.tsx`
  - `apps/admin/src/admin-public-resource-card.tsx`
  - `apps/admin/src/admin-api-client.ts`
  - `apps/admin/src/admin-types.ts`
- 权限目录与过滤
  - `apps/api/src/group-permission-policy.ts`
  - `apps/api/src/group-permission-policy-routes.ts`

## 详细设计

### 一、数据模型与存储

公共工作流继续存为共享资源条目：

- `kind = workflow`
- 内容载荷放在 `workflowFragment`
- 节点/连线统计继续通过 `enrichWorkflowResourceItem` 自动补齐

保留的主字段包括：

- `id`
- `kind`
- `title`
- `categoryId`
- `tags`
- `workflowFragment`
- `workflowNodeCount`
- `workflowEdgeCount`
- `workflowNodeTypes`
- `revision`
- `publishedBy`
- `publishedAt`
- `createdAt`
- `updatedAt`

因为本轮不做后台元数据编辑，所以标题、分类、标签主要在“发布/导入当下”确定，后续后台只管理 JSON 内容本体和生命周期。

### 二、后端 API 设计

#### 1. 保留现有创建入口

继续保留：

- `POST /api/shared-resources/workflows/add`

支持两类来源：

- 前台从当前画布生成的 `workflowFragment`
- 从本地 JSON 解析得到的 `workflowFragment`

#### 2. 新增下载入口

新增：

- `GET /api/shared-resources/items/:id/workflow-export`

行为：

- 校验该资源存在且 `kind = workflow`
- 返回标准 workflow manifest JSON
- 普通有读取权限的用户可下载

#### 3. 新增替换入口

新增：

- `PUT /api/shared-resources/items/:id/workflow-replace`

行为：

- 仅管理员可调用
- 请求体提交新的 `workflowFragment`
- 服务端替换已有资源的工作流内容
- `revision + 1`
- `updatedAt` 更新时间
- 不修改标题、分类、标签

#### 4. 删除仍走现有资源删除入口

继续使用：

- `DELETE /api/shared-resources/items/:id`

只是前后台在 `kind = workflow` 场景下显式暴露该动作。

### 三、后端校验规则

创建和替换工作流时统一补齐以下校验：

- 调用者必须是管理员
- 资源类型必须是 `workflow`
- `workflowFragment` 必须是对象
- manifest 必须能被识别为合法工作流结构
- 至少包含 1 个节点

下载时补齐：

- 资源必须存在
- 资源类型必须是 `workflow`
- 当前用户必须拥有该公共资源读取权限

### 四、前台交互设计

#### 1. 管理员发布当前工作流

在前台 `公共资源库 -> 工作流` 下，管理员可见：

- `发布当前工作流到公共资源库`

发布语义：

- 优先发布当前选中节点片段
- 若没有选中节点，则发布当前整张工作流
- 继续复用现有 `createWorkflowResourceManifest` 生成“干净模板”

发布表单只收：

- 标题
- 分类
- 标签

#### 2. 管理员导入本地 JSON

在前台 `公共资源库 -> 工作流` 下，管理员可见：

- `导入 workflow JSON`

行为：

- 选择本地 `.json` 文件
- 前端先做一次基础解析
- 解析成功后提交到后端创建公共工作流

#### 3. 普通成员能力

普通成员不显示发布和导入入口，只保留：

- 浏览
- 插入画布
- 另存为我的资源

### 五、后台交互设计

后台公共资源管理页在 `kind = workflow` 时，切换为最小治理模式。

#### 1. 页面保留的动作

- 上传新工作流 JSON
- 下载 workflow JSON
- 使用本地 JSON 文件替换
- 删除

#### 2. 上传新工作流

管理员在 `workflow` 页签可选择本地 JSON 文件上传。

上传时收集：

- 标题
- 分类
- 标签

#### 3. 下载 workflow JSON

管理员点击“下载 JSON”后，直接下载当前条目的 manifest 文件。

#### 4. 使用本地 JSON 文件替换

这是本轮必须明确支持的路径。

替换动作要求：

- 通过本地文件选择器选中 `.json`
- 读取并解析本地文件
- 调用替换接口更新已有公共工作流
- 成功后刷新列表

本轮不支持：

- 文本粘贴替换
- 在线编辑后保存

#### 5. 删除

管理员可直接删除公共工作流条目。

### 六、权限设计

本轮完全复用现有公共资源权限。

含义如下：

- 公共工作流是否可见：
  - 继续由 `sharedResourceCategoryIds`
  - `sharedResourceItemIds`
  两层 deny 规则共同决定
- 不新增 `workflow shared resource` 专属 deny 字段

权限结果：

- 普通成员
  - 可读：受公共资源权限过滤
  - 不可写
- 管理员
  - 可读
  - 可写

## 错误处理

### 1. JSON 文件解析失败

提示：

- `不是合法的工作流 JSON`

### 2. 结构为空或无节点

提示：

- `工作流至少包含 1 个节点`

### 3. 文件类型错误

提示：

- `请选择 workflow JSON 文件`

### 4. revision 冲突

提示：

- `资源已被其他页面更新，请刷新后重试`

### 5. 非管理员写操作

服务端统一返回：

- `403 / ADMIN_REQUIRED`

## 测试与验证

### 代码与契约层

至少覆盖：

- 管理员可创建公共工作流
- 管理员可上传 workflow JSON
- 管理员可下载 workflow JSON
- 管理员可使用本地 JSON 替换已有工作流
- 普通成员无法创建/替换/删除
- 公共工作流仍可插入画布
- 公共工作流仍可另存为个人资源
- 公共资源权限过滤对 `workflow` 仍然生效

### 运行态验证

重点验证：

- 前台发布的公共工作流可在公共资源库中出现
- 下载出的 JSON 可再次导入
- 替换后的工作流重新插入画布时内容已更新
- 普通成员端仍只看到被允许的公共工作流

## 实施建议

建议按以下顺序推进：

1. 先补后端 workflow export / replace 接口与校验
2. 再补前台管理员发布与 JSON 导入入口
3. 再补后台 workflow 类型下的上传 / 下载 / 替换 / 删除
4. 最后补 contract / smoke / 权限验证脚本

## 决策总结

- 公共工作流继续复用 `shared resource kind = workflow`
- 权限继续复用现有公共资源权限体系
- 只有管理员可以发布、导入、替换、删除
- 前台负责发布与导入
- 后台负责上传、下载、本地 JSON 替换、删除
- 后台不做预览，不做元数据编辑，不做在线 JSON 编辑
