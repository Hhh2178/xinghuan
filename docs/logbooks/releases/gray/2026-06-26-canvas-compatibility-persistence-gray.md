# Canvas Compatibility And Persistence Gray Release - 2026-06-26

## 状态

- 环境：`gray`
- 版本：`v0.5.1`
- release：`20260626-canvas-compatibility-persistence-gray-r1-v051`
- 当前状态：`待 deploy + runtime verify`

## 发布目标

- 修复旧工作流导入后 LLM 节点兼容性问题。
- 降低画布刷新后回退风险。
- 让工作流资源保存后在资源库中稳定可见。

## 变更范围

- `apps/web/src/utils/nodeMigration.ts`
  - 新增旧节点轻迁移层。
- `apps/web/src/components/Canvas.tsx`
  - 手动导入时对旧节点做迁移后再归一化。
- `apps/web/src/components/canvas/useCanvasPersistence.ts`
  - 画布加载时对旧快照做同样的迁移清洗。
- `apps/api/src/server.ts`
  - workflow 资源项补齐 `workflowNodeCount / workflowEdgeCount / workflowNodeTypes / workflowPreview`。

## Agent 已验证

- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/web`
- `codegraph sync`
- `npm run build:single-port`
- `npm run package:release -- 20260626-canvas-compatibility-persistence-gray-r1-v051`

## 本次部署执行

- 发布包：
  - `dist-release/20260626-canvas-compatibility-persistence-gray-r1-v051.tar.gz`

## 待用户验收

- 旧工作流导入后是否仍需要删除重建 LLM 节点。
- 刷新画布后是否还会随机回退。
- 保存工作流后资源库是否能稳定看到对应条目与摘要。
