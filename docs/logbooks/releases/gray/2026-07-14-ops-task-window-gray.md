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

灰度部署后补充 API、迁移和页面验收证据。
