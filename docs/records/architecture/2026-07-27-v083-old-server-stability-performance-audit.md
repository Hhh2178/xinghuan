# v0.8.3 旧服务器稳定性、结构与渲染性能审计

日期：2026-07-27

状态：Analysis complete, design pending user approval

活动工作树：`feature/canvas-agent-runtime`
发布范围：仅旧服务器 `101.33.75.38:728`

## 1. 审计目标与硬边界

本次审计为后续 `0.8.3` 系列子构建提供事实基线，覆盖：

- 生成任务从创建、Provider、轮询、下载、物料化到前端接收的稳定性；
- Agent Runtime bootstrap、发布、路由与运行控制门禁；
- API、Worker、Web、Admin 与 shared package 的结构边界；
- 页面崩溃、错误回退页、动态加载和热更新；
- React Flow 画布与节点的加载、测量、状态更新和渲染成本；
- 旧项目 `T8-penguin-canvas` / `penguin:*` 遗留内容；
- 旧服务器 Gray、Production 发布与回退安全。

硬边界：

1. 产品版本只使用 `0.8.3`；允许 `r1/r2/r3...` 子构建。
2. 所有部署只允许目标 `ubuntu@101.33.75.38:728`。
3. Gray 根目录为 `/opt/apps/xinghuan-canvas-next`；Production 根目录为 `/opt/apps/xinghuan-canvas`。
4. 不触碰 `43.131.246.222` 新服务器及 `zezhen.online` 环境。
5. 不执行 retention apply，不删除任何历史 release。
6. 每个可发布批次先 Gray，验证通过后以相同 archive 与 SHA-256 晋级 Production。
7. 分析和计划完成并通过用户审查前，不继续代码实现或发布。

## 2. 权威证据

### 2.1 仓库与索引

- CodeGraph：1,104 个文件、14,210 个符号、38,935 条依赖边。
- 当前工作树已有 4 个修改文件和 2 个新增文件，均来自暂停中的 output recovery RED/GREEN 批次；本审计不覆盖或改写它们。
- 根版本仍为 `0.8.2`；`0.8.3` 尚未构建或部署。

### 2.2 源码规模

| 子系统 | 文件数 | 行数 | 测试文件数 |
|---|---:|---:|---:|
| Web | 313 | 88,917 | 34 |
| Admin | 97 | 32,086 | 15 |
| API | 203 | 42,207 | 83 |
| Worker | 67 | 13,642 | 24 |
| Shared | 41 | 4,841 | 14 |

当前最大热点：

| 文件 | 行数 | 主要风险 |
|---|---:|---|
| `apps/api/src/server.ts` | 11,458 | HTTP 分发、兼容逻辑、Provider/RunningHub、存储与运行态胶水仍集中 |
| `apps/admin/src/styles.css` | 10,565 | 全局样式覆盖、选择器冲突、HMR 失效范围大 |
| `apps/web/src/styles/index.css` | 5,387 | 画布、节点、弹层与主题样式集中，改动影响面大 |
| `apps/web/src/components/Canvas.tsx` | 4,234 | 节点/连线状态、拖拽、复制粘贴、分组、持久化投影和视图壳耦合 |
| `PoseMasterNode.tsx` | 3,894 | 配置、预览、运行态与表单混合 |
| `ToolboxParamNode.tsx` | 2,845 | 参数 schema、素材绑定、预览与 React Flow 写入混合 |
| `ImageEditModal.tsx` | 2,683 | 工具状态、编辑动作与 UI 混合 |
| `ImageNode.tsx` | 2,456 | 输入、提交轮询、恢复、预览与节点更新混合 |
| `DrawingBoardNode.tsx` | 2,380 | 画板交互、工具栏、持久化和节点生命周期混合 |
| `apps/worker/src/worker.ts` | 1,765 | 调度入口、Provider 执行与恢复分支仍存在关键耦合 |

### 2.3 旧服务器只读运行态

2026-07-27 使用显式旧服务器参数执行 runtime verifier：

| 环境 | 版本 | 当前 release | API | Worker | 权限 readiness |
|---|---|---|---|---|---|
| Gray | `0.8.2` | `20260727-provider-output-recovery-v082-r1` | active | active | ready / 0 failures |
| Production | `0.8.2` | `20260727-provider-output-recovery-v082-r1` | active | active | ready / 0 failures |

- Gray 当前有 8 个 release 目录。
- Production 当前有 7 个 release 目录。
- 本目标要求全部保留。

## 3. 已经完成、不得重复规划的工作

已有结构路线和提交证据证明以下项目已完成或已有可用边界：

- ESLint、Vitest、CI/Harness 和 CodeGraph 基础设施；
- lucide namespace import 清理，`vendor-icons` 已从历史约 575 kB 降至当前约 54 kB；
- 当前用户 session/login 精准查询；
- Admin task 列表分页和大字段移除；
- API/Worker provider 公共 helper 下沉；
- provider/settings/admin/task/admin usage repository 边界；
- Admin 十域动态加载、路由错误边界和懒加载单次刷新恢复；
- RunningHubNode、RHToolsNode、ApiSettings 等热点的首轮拆分；
- Canvas persistence、interaction、overlay、send-flow 等若干 seam 已从 `Canvas.tsx` 提取；
- Worker task store、生命周期、取消同步、失败胶水、延迟重排、媒体轮询已有结构契约。

因此本轮必须建立在这些边界上增量推进，不能重新引入第二套状态容器、第二套路由框架或大爆炸式重写。

## 4. 已确认问题

### 4.1 P0：产物恢复契约仍未完成发布

既有审计已确认 Admin 将恢复命令写入 `result.outputRecoveryMode`，而 Worker 原来只读取 `payload.outputRecoveryMode`。当前工作树已进入最小修复的 GREEN 阶段，但仍缺：

- 跨层契约 verifier 的 package/release/Harness 接线；
- Agent environment readiness verifier；
- 完整测试、构建、release archive；
- 旧服务器 Gray 真实“零 Provider submit / 零新增计费 / 同 task ID”验收；
- Production 同制品晋级。

该项直接涉及重复生成与重复计费，必须是第一个实现批次。

### 4.2 P0：发布配置与用户指定目标冲突

`config/environments.json` 和 `scripts/release/_shared.mjs` 当前默认指向 `43.131.246.222:22`，但本目标明确只允许旧服务器 `101.33.75.38:728`。

当前脚本允许通过 CLI 覆盖 host、port、remote root、service、status URL 和 env file，但仅靠操作人员每次手写完整参数不足以防误部署。计划必须增加：

- `old-server` 显式 target profile；
- archive deploy 前的目标指纹检查；
- 目标不是 `101.33.75.38:728` 时 fail closed；
- 日志只输出非敏目标与 release 信息，不输出 key 或环境变量；
- Gray/Production 各自独立根目录、服务、数据库和状态 URL 校验。

### 4.3 P0：错误回退页存在真实乱码与旧企鹅内容

`apps/web/src/components/ErrorBoundary.tsx` 当前包含：

- 多段已经固化进源码的乱码中文；
- 企鹅 emoji；
- 原始 component stack 直接展示给用户；
- 内联样式，与现有设计 token 和组件体系脱节；
- 只有整页刷新或简单 reset，没有按画布、节点或异步 chunk 分层恢复；
- 没有 request/correlation ID，也没有可安全复制的诊断摘要。

`App.tsx` 只在 Canvas 外包一层 ErrorBoundary。单个节点渲染错误仍可能让整个 Canvas 子树退出，用户失去当前画布操作面。Admin 有独立 route error boundary，但 Web 与 Admin 的错误模型、文案和诊断信息不统一。

### 4.4 P1：React Flow 状态更新仍以全数组写入为主

`Canvas.tsx` 使用本地 `useState<Node[]>` / `useState<Edge[]>`，并在大量交互中调用 `setNodes(prev => prev.map(...))`、`setEdges(...)`。节点组件中也存在多处 `useReactFlow().setNodes(...)`。

风险：

- 拖拽、选择、尺寸同步、运行态更新可能复制完整 node 数组；
- 节点内部写全局图状态，职责和渲染影响范围难以约束；
- `memo(Node)` 只能在 props 引用稳定时减少重渲染，不能抵消频繁的新 `data` 对象和全数组 map；
- React Flow 订阅边界缺少统一选择器，部分节点通过 `getNodes/getEdges` 临时扫描全图；
- 多个节点自行执行轮询、恢复和 `setNodes`，运行任务数量增加时更新频率线性放大。

### 4.5 P1：Canvas 首屏懒加载被立即预加载部分抵消

`App.tsx` 声明了 lazy Sidebar、Canvas 和 RHToolsProvider，但模块初始化时立即创建 `preloadWorkspaceShell = Promise.all(...)`。这保留了 chunk 分割，却在应用入口加载时立即请求完整工作区资源。

当前生产构建基线：

| 产物 | 原始大小 | gzip |
|---|---:|---:|
| Web 主入口 | 358.83 kB | 114.86 kB |
| Canvas chunk | 442.51 kB | 127.63 kB |
| React Flow vendor | 188.51 kB | 60.95 kB |
| ToolboxParamNode | 148.82 kB | 44.46 kB |
| MediaPipe vendor | 135.68 kB | 40.42 kB |
| Web CSS | 216.06 kB | 39.62 kB |
| Admin 主入口 | 453.91 kB | 135.22 kB |
| Admin CSS | 207.31 kB | 31.40 kB |

需要通过登录态、空画布和大型画布三个场景的网络瀑布与 React profiler 证明应采用“认证完成后空闲预取”“进入工作区才加载”还是“按节点类型加载”，不能仅按 chunk 大小决定。

### 4.6 P1：现有“性能优化”开关只降低视觉效果

`visualPerformanceMode.ts` 只在根元素上设置 `data-performance-mode='reduced'`；CSS 关闭光标光效并缩短/移除部分动画。它没有改变：

- node/edge 更新频率；
- React Flow 订阅范围；
- 媒体预览解码；
- 节点轮询；
- 大画布可见性裁剪；
- ResizeObserver / updateNodeInternals 调度；
- 大型节点的渲染内容。

因此该按钮当前更准确的含义是“降低动效”，不能作为实际画布性能优化完成的证据。

### 4.7 P1：错误边界粒度不足

建议的隔离层级应至少包含：

1. App shell：认证、导航和全局资源；
2. Canvas workspace：加载或持久化失败；
3. 单节点 renderer：一个节点异常不得使整个画布退出；
4. 懒加载 chunk：自动刷新最多一次，第二次失败进入稳定回退界面；
5. 媒体预览：图片/视频解码失败仅影响该预览；
6. Admin route：保留当前 resetKey 模式并统一诊断协议。

每层必须定义 reset key、是否保留未保存画布、是否允许刷新、用户可见文案、诊断 ID 和日志上报边界。

### 4.8 P1：旧项目命名混合了内部兼容契约和用户可见内容

当前至少 29 个 Web 源文件包含 `T8-penguin`、`penguin:*` 或企鹅文本。它们不能一次性全改：

- 用户可见模板、错误页、占位文案和旧路径提示应清理；
- Canvas schema、导出格式、localStorage key、CustomEvent 名称可能是持久化兼容协议；
- 隐藏 node type `penguin-portrait` 可能仍存在历史画布引用；
- 直接改事件名会破坏跨组件通信，必须先增加新旧事件桥和迁移测试。

应先建立 inventory，将项目遗留分为 `visible-copy`、`compatibility-contract`、`dead-code` 三类，再分别处理。

### 4.9 P1：超大 CSS 使页面局部变更扩大到全局

Web `index.css` 5,387 行，Admin `styles.css` 10,565 行。风险包括：

- 通用 class 名冲突；
- HMR 时重新计算大范围样式；
- 难以判断某页面或节点依赖哪些样式；
- 已发生过 `.error-banner` 全局选择器冲突的历史事故。

本轮不应引入一次性 CSS Modules 全迁移。应按实际触碰批次拆出错误回退、Canvas shell、node shared chrome、Admin route shell 四个稳定边界，并设置 CSS 入口体积预算。

### 4.10 P2：API 和 Worker 仍有剩余编排热点

`server.ts` 已抽取大量 route handler/repository，但文件仍包含：

- 主 HTTP 分发；
- environment sync；
- provider/model normalization 与测试；
- RunningHub catalog 分析和兼容逻辑；
- Assistant prompt、解析和 fallback；
- auth/session 与资源 helper。

`worker.ts` 已拆出 task store/lifecycle/polling 等模块，但本次 output recovery 缺陷证明 dispatch operation 仍缺统一、可测试的入口契约。

后续结构拆分必须服务稳定性或可测性；只为减少行数搬文件不能作为验收结果。

## 5. 推荐分批与依赖顺序（待设计审批）

### Batch r1：计费与发布安全

- output recovery operation contract；
- Agent environment readiness gate；
- old-server target profile 和 fail-closed target verifier；
- 完整测试、archive、Gray 真实恢复、Production 同制品晋级。

### Batch r2：崩溃隔离与旧 UI 清理

- 统一 Web/Admin diagnostic envelope；
- 替换乱码和企鹅错误页；
- Canvas workspace 与 node renderer 两级错误边界；
- chunk 二次失败稳定回退；
- visible-copy 清理，兼容协议保持不变。

### Batch r3：加载与可观测基线

- 登录、空画布、50/100/200 节点加载基线；
- React commit、long task、node render count、updateNodeInternals、网络瀑布采集；
- preloadWorkspaceShell 改为认证后 idle/intent 预取；
- Admin 主入口按稳定业务域继续拆分；
- chunk/CSS 预算进入 Harness。

### Batch r4：Canvas 更新模型收口

- 统一 node data mutation service；
- 节点组件禁止散落的全图 `setNodes(map)`；
- 用窄选择器订阅节点自身及显式上游投影；
- 高频 drag/resize/runtime projection 合并到 animation-frame batch；
- 以 50/100/200 节点矩阵验证行为与帧稳定性。

### Batch r5：热点节点与 CSS 拆分

- 优先 PoseMaster、ToolboxParam、Image、DrawingBoard；
- 按 schema、runtime actions、preview、view section 拆分；
- 每次只拆一个职责，保留原 public props；
- 同步 node behavior test、render smoke 与 hotspot budget；
- 拆分 error、Canvas shell、node chrome、Admin route CSS。

### Batch r6：API/Worker 编排边界

- Worker operation dispatch 和 provider capability entry seam；
- API provider key-pool/import-models residue；
- 只抽取有行为测试保护的纯逻辑或 handler；
- 不改变存储权威、任务状态机或 Provider 协议。

## 6. 每个批次的验证矩阵

每个子构建至少需要：

1. 相关行为测试 RED → GREEN；
2. workspace type-check；
3. Web/Admin/API/Worker 对应 build；
4. 相关契约 verifier；
5. `verify:file-hotspot-budgets`、watchlist 和 staged governance；
6. project/workspace/release Harness；
7. `git diff --check` 和 CodeGraph sync；
8. Gray 内外状态、API/Worker、权限 readiness；
9. 1920×1080 PC 行为与控制台验收；
10. 该批次专属稳定性/性能指标；
11. Production 使用同一 archive 与 SHA-256；
12. 发布后再次核对旧服务器 current link，记录未运行 retention apply。

性能批次还必须记录：

- 首屏可交互时间和关键 chunk 请求时序；
- 50/100/200 节点首次稳定渲染时间；
- 单节点文本修改触发的 node render 数；
- 拖拽 5 秒期间 React commits、long tasks 与平均/最低帧率；
- ResizeObserver 与 `updateNodeInternals` 调用数；
- 运行中任务轮询请求数；
- JS heap 增量和媒体卸载后的回收趋势。

## 7. 回退模型

- 本地：每批独立 commit；验证失败只回退当前批，不叠加下一批。
- Gray：记录发布前 current；失败时只恢复 Gray symlink 并重启 Gray API/Worker。
- Production：记录发布前 current 和数据库备份；失败时只恢复 Production symlink 并重启 Production API/Worker。
- 数据库：本轮结构/性能批次默认不做不可逆 schema 变更；若后续确需迁移，必须单列 expand/contract 计划。
- 前端：新错误边界、预加载策略、渲染 batch 应具备独立 kill switch 或可回退 commit。
- 历史 release：失败构建也保留用于审计；不使用通用删除或 retention apply。

## 8. 审计结论

推荐采用渐进式分层稳定化，而不是前端先行或一次性重写：

- r1 先消除重复 Provider 提交和误发布风险；
- r2 让单节点/单 chunk 崩溃不再拖垮整个画布，并移除用户可见旧企鹅内容；
- r3 建立可重复性能基线后再改变加载策略；
- r4 用窄订阅和批处理降低画布更新放大；
- r5/r6 沿既有 seam 拆热点，不用行数下降冒充稳定性提升。

该顺序每一步都能独立验收、独立回退，并保持 `0.8.3` 单一产品版本约束。
