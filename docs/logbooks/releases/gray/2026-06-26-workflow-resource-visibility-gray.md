# Workflow Resource Visibility Gray Release - 2026-06-26

## 状态

- 环境：`gray`
- 版本：`v0.5.1`
- release：`20260626-workflow-resource-visibility-gray-r1-v051`
- 当前状态：`待 deploy + runtime verify`

## 发布目标

- 修复框选节点后“保存工作流到资源库”成功但在工作流资源库中不可见的问题。
- 修复 workflow 资源插入画布时对 `fileUrl` 的错误强依赖。

## 变更范围

- `apps/web/src/services/api.ts`
  - `getResourceItems` 不再把默认分类态 `all` 透传为真实 `categoryId`。
- `apps/web/src/utils/workflowResource.ts`
  - 新增 `resolveWorkflowResourceFragment`，优先使用内嵌 `workflowFragment` 恢复工作流。
- `apps/web/src/App.tsx`
  - workflow 资源插入改为走统一解析逻辑。
- `scripts/verify-resource-items-query-contract.ts`
  - 回归保护 `all` 分类不应过滤空资源库。
- `scripts/verify-workflow-resource-resolver-contract.ts`
  - 回归保护 workflow 资源优先从内嵌 fragment 恢复。

## Agent 已验证

- `npx tsx scripts/verify-resource-items-query-contract.ts`
- `npx tsx scripts/verify-workflow-resource-resolver-contract.ts`
- `npm run type-check -w @xinghuan/web`

## 待用户验收

- 框选节点后选择“保存工作流到资源库”，在资源库的“工作流”页签中可立即看到条目。
- 点击该 workflow 资源后，可正常插入当前画布。
