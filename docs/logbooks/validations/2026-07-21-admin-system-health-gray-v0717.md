# 后台系统健康可视化 Gray v0.7.17 验证

## 自动化与构建

- 全量测试：`67 files / 230 tests` 通过。
- `verify:quick`、Admin/API build、全 workspace type-check、设计文档契约、readonly panel 契约与 system health visualization contract 通过。
- staged source size guard 捕获并阻止 `main.tsx` 跨过 1000 行；抽取 `use-admin-system-health.ts` 后主文件为 989 行，所有治理门禁通过。
- `npm audit --omit=dev`：0 high / 0 critical，仅 1 个 transitive esbuild low；prepare/远端 `npm ci` 报告的 high 位于开发依赖口径，不属于生产依赖审计结果。

## Gray 运行态

- current：`/opt/apps/xinghuan-canvas-next/releases/20260721-admin-system-health-gray-r1-v0717`
- App / Worker：`active / active`
- 内网与公网状态：`0.7.17 / gray / enforced`
- 数据库：`xinghuan_canvas_gray`，25 项 migration 已存在，本次无新增 migration。
- 权限 readiness：128 subjects、122 published、3 restricted、3 retired、932 rules、5 principals、0 failures。
- 发布后 App/Worker error 级 journal：无记录。

## 真实页面验收

- `/admin/system/health` 正确显示 Gray / 0.7.17、PostgreSQL、Redis、Worker、Storage 五域与真实告警。
- 当前健康页正确暴露 13 条 DB queued / Redis empty 差异，不隐式修改任务。
- 1h/24h/7d/30d 范围可切换；7d 聚合桶生效；手动刷新成功。
- PostgreSQL Inspector 正确显示当前库 `xinghuan_canvas_gray` 和 25 项 migration。
- 1366×768、1440×900、1920×1080 均无页面横向溢出，健康页与右侧助手无覆盖。
- 页面交互期间浏览器控制台无 error/warn。

## Retention 与 Production 边界

- Gray retention dry-run 后受控删除旧 `20260721-admin-cost-accounting-gray-r1-v0715`（308,264,960 bytes），最终保留 3 个 release。
- Production 公网状态仍为 `0.7.13 / production / enforced`。
- Production current 仍为 `20260720-media-node-runtime-resume-prod-r1-v0713`，App 启动时间仍为 `2026-07-20 22:59:22 CST`；未部署、未重启、未修改。
