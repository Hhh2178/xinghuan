# 画布工作流能力增强执行计划

## 执行原则

按契约优先、共享 runner 优先、独立模块优先执行；每阶段完成后运行针对性测试，再进入下一阶段。

## Phase 1：现状与契约

- CodeGraph 定位注册、运行、模板、资源和锁定链路。
- 完成设计文档与本执行计划。
- 验证：文档包含安全、兼容、失败语义和 UI 归属。

## Phase 2：共享模型与服务端

- 新建 `apps/api/src/code-node-runtime.ts` 与测试。
- 新建 `apps/api/src/code-node-routes.ts` 并接入 `server.ts`。
- 在 web API service 增加 execute client。
- 更新节点 registry、默认尺寸、迁移和 runtime cleanup。
- 验证：沙箱成功、语法错误、危险代码、超时、输出上限测试。

## Phase 3：代码与标签节点

- 新建 `CodeNode.tsx`、`LabelNode.tsx`。
- 在 Canvas nodeTypes/default data/serial wrapper 中注册。
- 代码节点接 upstream materials 和 `useRunTrigger`。
- 标签节点接固定状态和样式控件。
- 验证：预设 reducer、默认数据、序列化契约、组件 contract。

## Phase 4：组运行与工具节点

- 为 GroupBox 增加 `executionCount` 控件和请求字段。
- 扩展 execution plan，按组展开执行次数。
- `runNodesByOrder` 读取 `ok/error` 并重试最多 3 次。
- 抽出文本打散自动创建 runner，按钮与运行总线复用。
- 验证：执行顺序、循环展开、成功后继续、失败重试、最终失败测试。

## Phase 5：模板弹层

- 新建 `WorkflowTemplateModal.tsx`。
- `CanvasToolbar` 移除静态 dropdown 和数量 badge，改为 modal。
- 通过 App/Canvas 现有工作流插入 ref 接入。
- 验证：API 参数、筛选、缩略图优先级、插入回调和空态测试。

## Phase 6：锁定修复

- 在 `onNodesChange` 过滤锁定节点 position changes。
- `onNodeDragStop` 恢复 drag start 快照后再清 ref。
- 标签自身 locked 使用同一 guard 语义。
- 验证：locked group、locked member、unlocked group 三组回归。

## Phase 7：收口

- 更新 `docs/systems/canvas/`、节点注册表、daily log。
- 运行 focused tests、全量 tests、type-check、project Harness、CodeGraph sync。
- 启动本地服务，用浏览器验证模板页、两种节点、组循环和锁定交互。
- 提交推送；先灰度后生产。

## 回滚

- 新节点通过 registry 独立注册，可单独隐藏而不破坏旧画布。
- 模板入口可临时恢复静态下拉。
- 组字段均有默认值，回滚 UI 不影响旧 JSON。
- Python route 可通过服务端 feature flag 关闭。
