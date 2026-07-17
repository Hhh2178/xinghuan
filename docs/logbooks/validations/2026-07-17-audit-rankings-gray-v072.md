# v0.7.2 审计账号与分组排行榜 Gray 验证

## 本地门禁

- `npm run ci`：45 个测试文件、163 项测试通过；所有 workspace type-check 与构建通过。
- 排行榜专项测试：账号和分组共 5 项通过，覆盖完整目录、零用量、历史行、未分组、降序与选中分组。
- Admin 用量驾驶舱契约检查通过，确认账号和分组均使用完整目录构建器与内部滚动容器。
- CodeGraph sync、发布包契约与工作树清洁检查通过。

## 运行时

- release symlink：`/opt/apps/xinghuan-canvas-next/releases/20260717-audit-rankings-gray-r2-v072`。
- API / Worker：均为 `active`。
- 内网与公网状态：`0.7.2 / gray / enforced`。
- 权限 readiness：`ready=true`，127 Subjects、926 Rules、0 failures。
- 数据库目标：`xinghuan_canvas_gray`；无新增迁移。

## 真实数据与页面验收

- 近 30 天成功总数为 199；全局模型、RH 条目与账号下钻统计正常加载。
- 分组排行榜显示 `AI组 141`、`未分组 40`、`杨旭组 15`、`测试组 3`、`景哥组 0`，共 5 行并按成功次数降序。
- 账号排行榜显示 29 行：28 个当前账号加 1 个历史未知账号，零用量账号均显示 0。
- 两个排行榜的首行与列表顶部坐标一致，`align-content` 为 `start`，自动行高为 `minmax(32px, auto)`，纵向溢出策略为 `auto`。
- Chrome 真实登录会话加载审计页成功，控制台 0 errors。
