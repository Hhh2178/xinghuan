# v0.6.2 系统发布任务监控灰度记录

- 日期：2026-07-14
- 版本：`v0.6.2`
- 环境：gray，`canvas-next.hhh2121.xyz`
- 范围：任务监控仅展示最近活动的 2,000 条记录；终态任务记录最终状态时间；任务表格改为紧凑单行展示。
- 数据库变更：`022_ops_task_finalized_at.sql` 新增 `xh_tasks.finalized_at` 和任务活动排序索引。
- 保护：任务历史不删除；生产 `canvas.hhh2121.xyz` 不在本次操作范围内。

## 本地验证

- `npx vitest run apps/api/src/task-lifecycle.test.ts apps/api/src/task-repository.test.ts apps/api/src/admin-task-list-routes.test.ts`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/worker`
- `npm run type-check -w @xinghuan/admin`
- `npm run build -w @xinghuan/admin`
- `node scripts/verify-admin-task-panel-contract.mjs`

## 灰度部署

- release：`20260714-ops-task-window-gray-v062`
- 部署目录：`/opt/apps/xinghuan-canvas-next/releases/20260714-ops-task-window-gray-v062`
- 迁移：`021_unified_permission_platform.sql`、`022_ops_task_finalized_at.sql` 已由灰度迁移程序执行；其余 20 个历史迁移跳过。
- 运行态：`xinghuan-canvas-next.service` 与 `xinghuan-canvas-next-worker.service` 均为 `active`。
- 状态接口：内网 `http://127.0.0.1:18200/api/status` 与公网 `https://canvas-next.hhh2121.xyz/api/status` 均返回 `version=0.6.2`、`environment=gray`。
- 数据库：`xh_tasks.finalized_at` 已存在。部署时存量 390 条任务未回填该字段，符合历史终态回退 `updatedAt` 的设计。

## 自动化验收

- 任务生命周期、仓储与后台列表路由测试共 11 项通过。
- API、Worker、Admin 类型检查与 Admin 构建通过。
- `verify-admin-task-panel-contract.mjs`、版本一致性、发布包契约、热点预算、发布索引一致性均通过。
- 灰度后台入口 `/admin/` 返回 `200`；未认证的 `/api/admin/tasks` 返回 `401`。

## 待人工验收

- 使用灰度管理员会话确认“仅显示最近 2,000 条任务记录”提示、终态时间列、运行中 `--`、长文本单行省略与悬停全文。
- 确认 Provider/能力/状态筛选、分页、取消及重试交互正常。
