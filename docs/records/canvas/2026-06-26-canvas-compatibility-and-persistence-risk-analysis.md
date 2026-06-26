# 画布兼容性与持久化风险分析 - 2026-06-26

## 范围

- 旧工作流导入
- 画布刷新后的状态回退
- 工作流保存到资源库后不可见
- 相关的 LLM 节点兼容性
- 资源库索引与刷新链路

## 结论

这三类问题不是孤立 bug，更像是同一条链路上的三个断点：

1. 导入链路只做了节点序列号归一化，没有做旧节点 schema 迁移。
2. 画布持久化存在“加载快照、pending save、revision”三套状态并行，刷新时可能把旧快照重新写回。
3. 工作流资源确实进入了资源系统，但展示侧依赖的摘要字段和刷新条件不够稳，容易形成“已保存但看不见”的错觉。

## 已确认的系统证据

- `apps/web/src/components/Canvas.tsx` 的导入流程只调用 `normalizeCanvasNodeSerials(...)`。
- `apps/web/src/components/canvas/useCanvasPersistence.ts` 同时维护 `pendingSaveByCanvasRef`、`lastSavedByCanvasRef`、`revisionByCanvasRef`。
- `apps/web/src/components/nodes/LLMNode.tsx` 兼容字段很多，说明旧画布里 `llm` 节点存在历史状态残留风险。
- `apps/web/src/components/canvas/useCanvasSendFlow.ts` 已调用 `api.addResourceWorkflow(...)`，保存动作本身不是空的。
- `apps/api/src/server.ts` 的资源写入会保存 `workflowFragment`，但资源列表展示依赖 `workflowNodeCount`、`workflowEdgeCount`、`workflowPreview` 等字段和前端过滤条件。

## 根因分析

### 1. 旧工作流导入兼容不足

导入目前只处理 node serial，没做更深层的节点数据迁移。
对 `llm` 节点来说，历史数据可能同时包含：

- `prompt` / `reply` / `userPrompt`
- `history`
- `generatedImages`
- `backendModelId` / `providerSource`
- 旧版输出字段残留

这会让“能导入”与“能正确运行”之间出现断层。

### 2. 画布刷新回退更像快照竞态

`useCanvasPersistence.ts` 里，加载时会优先取 `pendingSave`，保存时会延迟写入，刷新时又会读取 server 数据和本地 pending 状态。
这意味着：

- 新版本刷新后，旧 pending snapshot 可能覆盖新状态
- 自动保存和手动保存都可能和版本切换发生竞态
- revision 冲突会触发保护，但不是所有回退都表现为冲突

### 3. 工作流保存“不可见”更像索引/展示不稳

保存动作会把 `workflowFragment` 写入资源项，但资源列表卡片展示依赖：

- kind 是否正确是 `workflow`
- 查询是否被 `kind/category/favorite/q` 过滤
- `workflowPreview` 是否存在
- `workflowNodeCount / workflowEdgeCount` 是否可用

如果这些摘要字段不完整，用户会感觉像“保存失败”。

## 对其他功能的影响

### 1. LLM 节点

- 旧画布里的 LLM 节点更容易出现导入后失配。
- 节点内部依赖 `history`、`reply`、`generatedImages` 等状态，兼容字段一多，旧数据越容易表现异常。
- 如果后续直接收紧 schema，不做迁移，会影响历史画布可用性。

### 2. 画布自动保存 / 手动保存

- 任何涉及版本切换、重新打开、切换画布的操作，都可能放大快照竞态。
- 如果修复时把 pending save 逻辑删太猛，可能导致“已编辑但没落盘”。
- 因此必须保留 revision 保护，只收紧快照的覆盖条件。

### 3. 资源库

- 工作流资源如果补齐摘要字段，资源库会更稳定。
- 但如果只修前端展示而不修保存结构，后续仍会有“条目存在但内容不全”的问题。
- 资源库刷新事件需要和后端返回字段一起验证，不能只看 UI 刷新。

### 4. 发送到画布 / 工作流插入

- `workflowFragment` 结构一旦迁移，插入画布时的节点 ID / 连线 ID 也要继续保持去重。
- 需要确保 `instantiateSendNodeFragment(...)` 这类逻辑不被新字段影响。

### 5. 后台管理与统计

- 这次分析只触及 Canvas / Resource / LLM 节点链路。
- 不直接影响公告、Key 池、RunningHub 调度，但如果后续要做统一 schema 迁移，后台字段展示也要跟着复核。

## 风险评估

- 低风险：补充资源摘要字段、刷新事件、导入时清理明显旧字段。
- 中风险：调整画布加载/保存快照的优先级。
- 高风险：直接重写 LLM 节点数据结构或移除历史兼容字段。

## 建议的后续顺序

1. 先补导入迁移层，只做旧工作流清理，不碰运行逻辑。
2. 再收紧画布持久化，优先解决刷新回退。
3. 最后补工作流资源摘要与列表展示一致性。
4. 每一步都单独验证，不要把三条一起改。

## 验证建议

- 导入一份旧工作流，检查 LLM 节点是否可直接运行。
- 刷新画布后对比节点数量、连线数、节点位置是否回退。
- 保存工作流后立刻在资源库中搜索 `workflow`，确认条目出现且卡片摘要完整。
- 切换 kind/category/favorite 过滤，确认不是筛选条件把结果隐藏了。
