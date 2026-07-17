# v0.7.0 组重试与目录排序 Gray 发布

## 发布信息

- release：`20260717-group-retry-catalog-order-gray-r1-v070`
- source commit：`90450cb78907c299ec9e5f36aa49feece52165f9`
- 发布包：`dist-release/20260717-group-retry-catalog-order-v070.tar.gz`
- SHA-256：`954146bc352483f343a12d2b365e88e2042c5593c6b7eb27f5f421d4a7fecb23`
- 回滚：`20260716-default-open-canvas-recovery-gray-r2-v070`

## 发布内容

- 组执行管理器支持每个节点失败后重试 `0-10` 次，旧画布默认保持 3 次。
- 管理员可调整 Provider 和同 Provider/capability 模型在前台画布的展示顺序。
- PostgreSQL 增量迁移 `023_provider_model_display_order.sql` 新增并回填 `sort_order`。
- 普通成员不能调用排序管理接口，公共资源管理员边界保持不变。

## 数据保护与部署

- 发布前全库 dump、`pg_restore --list` 和 12 组关键关系清单均通过。
- 迁移仅应用 `023`，未运行导入脚本或全表替换。
- 启动门禁发现 2 个 retired Subject 残留 16 条规则；规则先单独备份，再以精确事务清理。
- 用户、画布、素材、任务、权限 Subject、分组、Provider 和模型旧关系均 `missing=0`。

## 结果

- API/Worker、内外网状态和 enforced readiness 通过。
- readiness：127 Subjects、121 published、3 restricted、3 retired、926 rules、5 principals、0 failures。
- 排序 API 换序、`/api/models` 顺序、成员 `403` 和恢复原顺序均通过。

