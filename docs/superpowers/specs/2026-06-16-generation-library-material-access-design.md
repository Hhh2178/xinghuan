# 生成库素材访问能力与预览下载设计

## 背景

当前生成库已经具备“短期生成素材列表”能力，但仍停留在最小可展示状态：

- 前端 `GenerationLibraryDrawer` 只支持 `插入` 与 `删除`
- 列表项只暴露 `fileUrl`
- 图片和视频只能在卡片缩略图上看一眼，无法查看完整内容
- 无法从生成库直接下载素材

从结构上看，当前问题不只是“少两个按钮”，而是生成库素材仍然被当成“一个裸文件 URL”，而不是“一个带访问能力的素材对象”。如果继续只在前端硬补 `查看 / 下载`，后续资源库、输出素材、其他素材面板仍会各自重复一套逻辑，权限、文件名、过期、下载头和行为口径也会继续分散。

因此本轮采用中等收口方案：先为生成库补齐图片/视频的查看与下载能力，同时从后端抽出一层可复用的“统一素材访问能力”，但暂不进行生成库、资源库、输出素材的大重构。

## 目标

本轮要完成的目标：

1. 生成库中的图片支持：
   - 抽屉内大图预览
   - 下载原文件
2. 生成库中的视频支持：
   - 抽屉内视频预览
   - 下载原文件
3. 后端不再只返回裸 `fileUrl`，而是返回统一的素材访问描述。
4. 后端新增统一的素材内容访问路由，明确区分：
   - `inline` 预览
   - `attachment` 下载
5. 这套后端能力在设计上可扩展到资源库和输出素材，但本轮只先接入生成库。

## 非目标

本轮明确不做：

- 不把生成库并入资源库或统一资产表
- 不改生成库的 3 天 TTL 口径
- 不改资源库 UI
- 不做图片编辑、批量下载、批量操作
- 不做音频预览增强
- 不新增独立预览页

## 现状分析

### 前端现状

生成库抽屉位于：

- `apps/web/src/components/GenerationLibraryDrawer.tsx`

当前卡片行为：

- 缩略图展示
- `插入`
- `删除`

问题：

- 图片只能看缩略图，无法查看完整比例与细节
- 视频没有完整预览体验
- 列表没有下载入口
- 卡片只能拿 `item.fileUrl` 直接渲染，缺少标准访问元数据

### 前端接口现状

生成库接口位于：

- `apps/web/src/services/api.ts`

当前 `GenerationLibraryItem` 只有：

- `id`
- `kind`
- `title`
- `url`
- `fileUrl`
- `mime`
- `size`
- `createdAt`
- `updatedAt`
- `expiresAt`

问题：

- 没有 `previewUrl`
- 没有 `downloadUrl`
- 没有标准 `filename`
- 没有“允许下载/是否过期”的视图字段

### 后端现状

生成库数据与接口当前都在：

- `apps/api/src/server.ts`

当前特点：

- 生成库按用户存储一份 `GenerationLibraryDb`
- 列表接口直接返回 `GenerationLibraryItem`
- item 中的 `fileUrl` 仍是使用侧直接消费的地址

问题：

- 生成库没有独立的素材访问层
- 预览、下载、权限和过期判断还没被统一表达
- 后续如果资源库也要支持相同能力，逻辑会继续散在多处

## 方案选择

### 方案 A：只在前端卡片补按钮

做法：

- 直接基于 `fileUrl` 增加 `查看 / 下载`

优点：

- 实现快

缺点：

- 继续依赖裸 URL
- 不利于统一权限和下载头
- 后续资源库仍会重复实现

结论：

- 不采用

### 方案 B：抽统一素材访问能力，这次先接生成库

做法：

- 后端新增一层“素材访问能力”
- 生成库列表接口返回标准访问字段
- 新增统一内容访问路由
- 前端预览和下载都走统一访问字段

优点：

- 范围可控
- 后端结构更稳
- 可复用到资源库/输出素材

缺点：

- 相比纯前端补按钮，后端改动稍大

结论：

- 采用本方案

### 方案 C：直接统一生成库、资源库、输出素材的底层数据模型

做法：

- 把生成库直接并入统一资产模型

结论：

- 本轮不采用，范围过大

## 总体设计

本轮新增一个轻量的“素材访问能力层”，职责是：

- 输入：素材来源、素材 id、当前用户、访问意图
- 输出：
  - 该素材是否存在
  - 当前用户是否有权访问
  - 是否过期
  - 素材本地文件路径
  - `inline` 预览访问方式
  - `attachment` 下载访问方式
  - 统一文件名、MIME、尺寸等元数据

第一阶段只支持：

- `source = generation-library`

但接口设计保留扩展位，后续可继续支持：

- `resource-library`
- `task-output`

## 后端设计

### 新增模块边界

建议新增：

- `apps/api/src/material-access-types.ts`
- `apps/api/src/material-access-service.ts`

职责划分：

#### `material-access-types.ts`

定义稳定的类型：

- `MaterialSource`
- `MaterialAccessDisposition`
- `MaterialAccessDescriptor`
- `ResolvedMaterialAccess`

#### `material-access-service.ts`

负责：

- 根据 `source + id + user` 解析素材
- 校验 owner
- 校验过期
- 生成标准访问描述
- 为内容路由提供文件定位结果

这层不要掺 UI 文案，只做访问与元信息判断。

### 生成库列表接口增强

当前接口：

- `GET /api/generation-library/items`

返回的单项结构增强为：

- 保留现有字段
- 新增：
  - `filename`
  - `previewUrl`
  - `downloadUrl`
  - `openUrl`
  - `canDownload`
  - `isExpired`

说明：

- `previewUrl`：供图片大图和视频预览直接使用
- `downloadUrl`：强制下载
- `openUrl`：与 `previewUrl` 一致或保留给后续扩展
- `filename`：用于下载名称、预览头部展示

这些字段不需要落库，服务端在返回列表时组装即可。

### 新增统一内容访问路由

建议新增：

- `GET /api/materials/generation-library/:id/content?disposition=inline`
- `GET /api/materials/generation-library/:id/content?disposition=attachment`

行为：

#### `inline`

- 图片：
  - 返回正确 `Content-Type`
  - 浏览器内联展示
- 视频：
  - 返回正确 `Content-Type`
  - 支持浏览器播放器直接加载

#### `attachment`

- 返回：
  - `Content-Type`
  - `Content-Disposition: attachment; filename*=UTF-8''...`

用途：

- 前端点击下载时不直接碰裸 `fileUrl`
- 统一文件名、下载行为和访问权限

### 权限与有效期控制

内容路由与列表增强都要统一走素材访问能力层：

1. 未登录：返回 `401`
2. 非 owner：返回 `403`
3. 素材不存在：返回 `404`
4. 素材已过期：返回明确错误

生成库当前是按用户维度单独存储的，所以 owner 校验是必要的，不能只靠文件路径隐式隔离。

### 文件名策略

当前生成库标题常是：

- `task_output_task-...`

本轮不强制改底层落盘命名，但下载时应给出更合理的文件名：

- 优先 `originalName`
- 否则 `title`
- 再否则从 URL basename 推导

并保证扩展名与 MIME 一致。

### 为什么不继续直接暴露 `fileUrl`

继续直接暴露 `fileUrl` 的问题：

- 前端难以区分“预览用 URL”和“下载用 URL”
- 无法稳定控制下载文件名
- 后续若改素材真实存储结构，会影响多个调用方
- 权限与统计能力都只能临时补丁式接入

因此本轮应该把“文件路径”降级为服务端内部实现细节，把“访问描述”作为外部契约。

## 前端设计

### 生成库卡片动作

当前：

- 插入
- 删除

调整为：

- 查看
- 下载
- 插入
- 删除

建议：

- 点击缩略图默认等同于 `查看`
- `查看` 与 `下载` 是显式按钮

### 抽屉内预览弹层

按已确认方案，使用抽屉内弹层预览，不跳新页面。

新增一个局部预览层组件，建议放在：

- `apps/web/src/components/GenerationLibraryPreviewOverlay.tsx`

职责：

- 接收当前 items、activeIndex、onClose
- 渲染图片或视频预览
- 支持：
  - 关闭
  - 下载
  - 上一项
  - 下一项

### 图片预览

- 居中展示
- 保持比例
- 不能拉伸
- 显示标题、MIME、尺寸
- 支持下载当前图片

### 视频预览

- 使用现有视频能力或标准 `video` 标签
- 弹层中展示播放器
- 支持播放/暂停
- 支持下载

### 为什么不用新页面

生成库是工作流抽屉，不是媒体中心。用户核心路径是：

1. 看完整内容
2. 判断是否要插入或下载
3. 关闭继续挑下一条

因此抽屉内弹层比新页面更符合当前工作流，也更适合后续复用到资源库。

## API 契约建议

### 列表项返回结构

```json
{
  "id": "gen-123",
  "kind": "image",
  "title": "task_output_task-123",
  "fileUrl": "/files/output/xxx.png",
  "mime": "image/png",
  "size": 2254013,
  "filename": "task_output_task-123.png",
  "previewUrl": "/api/materials/generation-library/gen-123/content?disposition=inline",
  "downloadUrl": "/api/materials/generation-library/gen-123/content?disposition=attachment",
  "openUrl": "/api/materials/generation-library/gen-123/content?disposition=inline",
  "canDownload": true,
  "isExpired": false,
  "createdAt": 1781600000000,
  "updatedAt": 1781600000000,
  "expiresAt": 1781859200000
}
```

### 内容路由返回

`inline`

- 200 + 正确 `Content-Type`

`attachment`

- 200 + 正确 `Content-Type`
- `Content-Disposition`

错误态：

- 401 `AUTH_REQUIRED`
- 403 `MATERIAL_ACCESS_DENIED`
- 404 `MATERIAL_NOT_FOUND`
- 410 `MATERIAL_EXPIRED`

## 测试方案

### 后端测试

新增验证脚本或契约测试，至少覆盖：

1. 生成库列表返回新增访问字段
2. `inline` 图片访问返回正确 `Content-Type`
3. `attachment` 下载返回 `Content-Disposition`
4. 视频 `inline` 可访问
5. 已过期素材访问失败
6. 非 owner 访问失败

### 前端测试

至少覆盖：

1. 卡片出现 `查看 / 下载`
2. 点击图片卡片打开预览弹层
3. 点击视频卡片打开预览弹层
4. 预览弹层中下载按钮使用 `downloadUrl`

### 人工验收

1. 图片完整预览，不裁切、不变形
2. 视频能播放
3. 下载文件名正确
4. 删除后列表刷新
5. TTL 到期素材不会继续正常预览或下载

## 风险与控制

### 风险 1：继续在 `server.ts` 里堆逻辑

控制：

- 新增 `material-access-service.ts`
- 让 `server.ts` 只保留路由组装

### 风险 2：前端仍然偷偷直接消费 `fileUrl`

控制：

- 预览和下载统一只用 `previewUrl` / `downloadUrl`
- `fileUrl` 保留兼容，不再作为新功能主依赖

### 风险 3：后面资源库复用时又重新发明一套

控制：

- 这次的类型命名和 service 输入输出不要写死成只适配生成库内部字段
- `MaterialSource` 从一开始就设计成可扩展枚举

## 分阶段落地建议

### 本轮

1. 抽素材访问能力层
2. 增强生成库列表接口
3. 增加统一内容路由
4. 前端生成库补 `查看 / 下载`
5. 加抽屉内图片/视频预览弹层

### 下一轮

1. 资源库复用同一素材访问能力
2. 输出素材相关面板统一改走访问描述
3. 评估是否逐步淡化对裸 `fileUrl` 的依赖

## 完成标准

本轮完成的判断标准：

1. 生成库图片可大图查看并下载
2. 生成库视频可预览并下载
3. 前端不再直接依赖裸 `fileUrl` 来完成新增能力
4. 后端已形成可复用的素材访问能力边界
5. 文档明确本轮只先接生成库，后续资源库复用同一设计
