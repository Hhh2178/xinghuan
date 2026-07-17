# v0.7.0 组重试与目录排序 Production 发布

## 发布信息

- release：`20260717-group-retry-catalog-order-prod-r1-v070`
- 来源 Gray：`20260717-group-retry-catalog-order-gray-r1-v070`
- source commit：`90450cb78907c299ec9e5f36aa49feece52165f9`
- 发布包与 Gray 相同，SHA-256：`954146bc352483f343a12d2b365e88e2042c5593c6b7eb27f5f421d4a7fecb23`
- 回滚：`20260716-permission-platform-hardening-prod-r1-v0613`

## 数据保护

- 发布前对 `xinghuan_canvas_next` 做全库 custom dump，并通过 `pg_restore --list`。
- 保存用户、画布/owner、项目、素材/owner、任务/owner、权限、分组、Provider 和模型有序清单。
- 4 个 retired Subject 的 16 条旧规则先单独备份，再以精确事务清理；未运行批量 reconcile。
- 发布前旧记录差集：用户、56 画布、191 素材、6763 任务及全部关键关系均 `missing=0`。
- 发布期间正常新增 1 画布、4 素材和 9 任务，未覆盖或删除旧记录。

## 部署与验收

- 仅应用 `023_provider_model_display_order.sql`，Provider 12、模型 56 均完成非空排序回填。
- API/Worker/output prune timer active；内外网为 `0.7.0 / production / enforced`。
- readiness：134 Subjects、116 published、14 restricted、4 retired、462 rules、2 principals、0 failures。
- 管理员排序换序和恢复、公共模型目录顺序、成员管理接口 `403` 均通过。
- request-chain/system observability、数据库目标、Nginx 配置均通过；发布后 error 级服务日志无条目。
- Playwright 发布前后页面结构一致，控制台 0 error / 0 warning，加载约从 1.64s 降至 1.20s。

## 已知观察

- 任务失败和 revision conflict 仍为历史窗口告警，不是本次发布新增错误。
- npm audit 仍有 1 个 low severity dependency issue；Vite 主 chunk 仍有既有体积 warning。

