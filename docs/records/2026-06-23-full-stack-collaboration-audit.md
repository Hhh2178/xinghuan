# 全栈协作审查记录 - 2026-06-23

## 范围

- 前端画布
- 后台 Admin
- API
- Worker
- RunningHub 协议与任务链路
- 发布与环境边界

## 已确认问题

### 1. 核心入口文件过大，协作边界已变薄

- `apps/api/src/server.ts`：`11910` 行
- `apps/web/src/components/Canvas.tsx`：`5439` 行
- `apps/worker/src/worker.ts`：`2044` 行
- `apps/web/src/components/nodes/RunningHubNode.tsx`：`1490` 行
- `apps/web/src/components/nodes/RHToolsNode.tsx`：`1505` 行
- `apps/web/src/components/ApiSettings.tsx`：`2435` 行
- `apps/admin/src/admin-api-settings-panel.tsx`：`1289` 行
- `apps/admin/src/admin-runninghub-workspace.tsx`：`870` 行

影响：

- 读一个功能要拖进太多上下文。
- 小改动更容易牵连提交、轮询、状态、保存、展示多个层。
- Bug 修复成本持续上升。

### 2. 前端停止语义仍然不统一

- 多个节点的 `handleStop` 主要只是停轮询。
- RH / RH Tools 这类任务，前端“停止”与后端真实取消还没完全同义。
- `apps/web/src/services/generation.ts` 已经存在统一取消接口，但 RH 两个节点都还没有真正接上它。

影响：

- 画布和后台状态可能不一致。
- 用户会看到“停了”，但上游仍继续跑。

### 3. RunningHub 协作链仍有漂移

- 后台分析面板已支持 `requestExample` / `responseExample`。
- 但分析结果、真实运行、画布展示之间仍会出现字段漂移。
- Key 池、运行目标类型、输出映射仍有重复归一化逻辑。
- 前台 catalog 会拿到 `outputSchema`，但 `execution` 没有完整进入节点运行时。
- `RunningHubNode` 和 `RHToolsNode` 实际上已经分裂成两套 RH 语义，前者偏统一目标，后者仍偏 `webappId` / app-only。

影响：

- 看起来“分析完成”，实际运行仍可能不一致。
- App / Workflow / 运行目标 的语义容易混在一起。
- 同属 RH 的两个节点会表现得不像同一个系统。

### 4. 环境边界仍未完全收口

- production 仍指向 `xinghuan_canvas_next`。
- gray / production 的数据库与队列边界仍需要继续收紧。

影响：

- 数据、任务、素材、画布状态可能互相污染。

### 5. Admin 分析与目录维护还偏一体化

- RunningHub 工作台同时承载目录、分析、Key 池、测试。
- 目前还缺少更明确的“草案 / 生效 / 漂移”状态视图。
- 后台已能生成草案卡片，但草案、已保存字段、真实 fetchInfo 之间还没有显式 drift 提示。
- 前台 `queryRh()` 返回的任务诊断字段比后台和服务层更薄，协作时常常要切后台才能解释失败原因。

影响：

- 后台越加越满，容易把配置、分析、验证混在一起。
- 前后台对同一任务的解释能力不一致。

## 优先级

1. 统一停止 / 取消语义。
2. 收口 RunningHub 协作链。
3. 拆薄 API / Worker / Canvas / Admin 热点文件。
4. 完成 production / gray 环境隔离。

## 结论

这不是“某一个点坏了”，而是协作边界已经开始失真。最优先不是继续加功能，而是先把运行态、取消态、分析态、目录态、环境态重新分层。
