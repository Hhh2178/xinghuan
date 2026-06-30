# Performance Toggle and Import Fixes Gray Release - 2026-06-30

## 状态

- 环境：`gray`
- 版本：`v0.5.20`
- release：`20260630-performance-toggle-and-import-fixes-gray-r1-v0520`
- 当前状态：`2026-06-30 已完成 gray deploy + runtime verify`
- 上一灰度 release：`20260630-group-execution-manager-runtime-rounds-gray-r2-v0519`

## 发布目标

- 顶栏新增“性能优化”开关，默认关闭，切换后强制刷新，并记住用户选择。
- 继续保留 reduced 渲染档位，用于轻量化视觉降级。
- 修复上传素材节点在全局 / 组内执行时错误自动生成输出素材节点的问题。
- 修复视频工作流导入后节点偶发不可用的问题。

## 变更范围

- `apps/web/src/stores/performanceMode.ts`
  - 新增持久化性能模式 store，默认 `normal`。
- `apps/web/src/App.tsx`
  - 顶栏右侧公告控件区新增“性能优化”胶囊开关。
  - 切换模式后立即 `window.location.reload()`。
  - 启动时按持久化模式写入 `data-performance-mode`。
- `apps/web/src/styles/index.css`
  - reduced mode 继续关闭鼠标光晕、星轨动画和磨玻璃。
  - 新开关保留统一科技风视觉。
- `apps/web/src/utils/nodeMigration.ts`
  - 视频节点导入轻迁移继续清理旧运行态。
- `apps/api/src/canvas-node-migration.ts`
  - 后端同步补齐视频节点导入清理。
- `apps/web/src/components/nodes/UploadNode.tsx`
  - 上传素材节点的执行输出策略继续走既有上游链路，不再额外落空输出节点。
- `scripts/verify-performance-mode-toggle-contract.ts`
  - 新增性能模式开关契约脚本。
- `scripts/verify-upload-node-batch-output-policy-contract.ts`
  - 新增上传节点批量执行输出策略契约脚本。
- `scripts/verify-video-import-migration-contract.ts`
  - 新增视频导入迁移契约脚本。

## Agent 已验证

- `npx tsx scripts/verify-performance-mode-toggle-contract.ts`
- `npx tsx scripts/verify-visual-performance-mode-contract.ts`
- `npx tsx scripts/verify-upload-node-batch-output-policy-contract.ts`
- `npx tsx scripts/verify-video-import-migration-contract.ts`
- `npm run type-check -w @xinghuan/web`
- `npm run build -w @xinghuan/web`

## 待用户验收

- 顶栏“性能优化”开关是否在刷新与重新登录后仍保持选择。
- 优化模式是否明显缓解节点多时的画布卡顿。
- 上传素材节点在全局执行 / 组内执行时是否不再自动产出错误的输出素材节点。
- 视频节点导入后是否恢复正常可执行状态。

## 风险

- 当前性能优化仍以关闭高开销视觉效果为主，真正的海量节点懒渲染还需要后续继续推进。
- 视频生成链路仍依赖灰度机器上的样例资源，服务器侧样例缺失会影响一部分 smoke 覆盖。
