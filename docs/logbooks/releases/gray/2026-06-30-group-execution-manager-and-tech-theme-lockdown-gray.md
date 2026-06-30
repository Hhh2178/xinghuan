# AICopy Video Task And Duration Range Gray Release - 2026-06-30

## 状态

- 环境：`gray`
- 版本：`v0.5.18`
- release：`20260630-aicopy-video-task-and-duration-range-gray-r1-v0518`
- 当前状态：`2026-06-30 本地收口完成，待 gray 重新部署与在线烟测`
- 上一灰度 release：`20260629-group-default-permission-refresh-gray-r1-v0516`

## 发布目标

- 组内执行改为按画布连线自动推导的拓扑顺序串行执行。
- 新增全局组管理节点，只负责组级执行顺序和跳过控制。
- 前台主题锁定为科技风，保留 dark / light 切换，移除多风格入口。
- 旧视觉预设移出前台运行入口，统一归档。

## 变更范围

- `apps/web/src/components/canvas/groupExecutionManager.ts`
  - 新增组级执行计划解析与全局组顺序管理。
- `apps/web/src/components/canvas/useCanvasRuntime.ts`
  - 画布运行路径改为按组计划和拓扑顺序执行。
- `apps/web/src/components/nodes/GroupExecutionManagerNode.tsx`
  - 新增组管理节点面板。
- `apps/web/src/stores/theme.ts`
  - 锁定科技风运行面，保留 dark / light。
- `apps/web/src/theme/defaultTemplates.ts`
  - 前台模板收口为科技风。
- `apps/web/src/theme/applyTheme.ts`
  - 统一科技风变量映射。
- `apps/web/src/styles/index.css`
  - 移除旧多风格入口。
- `docs/archive/canvas-theme-presets/`
  - 旧主题预设归档。
- `apps/web/src/components/nodes/VideoNode.tsx`
  - AICopy 视频节点改为走后台任务提交 + 轮询，不再卡在同步视频生成路径。
- `apps/web/src/types/canvas.ts`
  - 前端高级 Provider 协议补齐 `aicopy`。
- `apps/web/src/components/apiSettingsHelpers.ts`
  - AICopy 作为独立高级 Provider 协议在设置页可见。
- `apps/admin/src/admin-model-editor.tsx`
  - 视频模型时长配置支持档位 / 范围双模式，并在保存时回写 `parameterSchema`。
- `apps/admin/src/admin-api-settings-panel-helpers.ts`
  - AI 草案同步对对象形态的 `parameterSchema` 也能正确保真。

## Agent 已验证

- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/admin`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/worker`
- `npm run type-check -w @xinghuan/model-core`
- `npm run build -w @xinghuan/web`
- `npm run build -w @xinghuan/api`
- `npm run build -w @xinghuan/model-core`
- `npm run verify:provider-model-catalog-contract`

## 本轮补修状态

- `2026-06-30` 本地代码已补修 `aicopy / grok-imagine-video-1.5-preview` 协议与视频时长范围配置链路。
- 当前补修尚未重新推送到 gray；现阶段灰度在线烟测仍待重新部署后执行。
- 本机执行 `node scripts/verify-external-video-proxy.mjs` 时，直连 `http://127.0.0.1:18200` 返回 `ECONNREFUSED`，因此这轮只能先完成静态契约与类型校验，不能把它表述为“已完成新的 gray runtime verify”。

## 风险

- 组内拓扑执行依赖连线正确性，旧画布若存在断链或环，需要用户后续人工复核。
- 主题已锁到科技风，但仍保留少量兼容字段，后续若继续瘦身可再拆兼容层。
- `aicopy` preview 模型的最终在线可用性，还需要在 gray 可达后跑一次真实任务提交与轮询。
