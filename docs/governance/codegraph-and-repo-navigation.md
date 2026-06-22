# CodeGraph 与仓库导航

## 默认规则

- 进入代码理解前先执行 `codegraph status`
- 若当前仓库没有索引，先执行 `codegraph init -i`
- 找系统边界、调用链、影响面时优先用 CodeGraph
- 精确文本定位时再回退到 `rg`
- 改动完成后执行 `codegraph sync`

## 适合优先用 CodeGraph 的场景

- 找 RunningHub、Admin、API、Worker 的真实入口文件
- 判断某个字段会影响哪些模块
- 恢复较大代码库的上下文
- 确认改动边界是否跨系统

## 常用配合方式

### 先看结构

- `codegraph status`
- `codegraph files --filter apps/admin/src --pattern "*runninghub*" --format flat --no-metadata`
- `codegraph files --filter apps/api/src --pattern "*runninghub*" --format flat --no-metadata`

### 再做精确检索

- `rg "runTargetId" apps packages scripts`
- `rg "effectiveConcurrency" apps`

## 当前高频入口

- RunningHub 后台：`apps/admin/src/admin-runninghub-workspace.tsx`
- RunningHub 编辑器：`apps/admin/src/admin-runninghub-item-editor.tsx`
- RunningHub catalog：`apps/api/src/runninghub-catalog.ts`
- RunningHub 执行描述：`apps/api/src/runninghub-execution-descriptor.ts`
- Worker 主循环：`apps/worker/src/worker.ts`
- 画布 RH 节点：`apps/web/src/components/nodes/RunningHubNode.tsx`
