# Admin 后台系统

## 这个系统负责什么

Admin 是无限画布 2.0 的独立后台，负责用户、Provider、模型、系统设置、RunningHub 条目、环境同步、任务与观测等运营与治理能力。

## 建议阅读顺序

1. 根级 `DESIGN.md`
2. `architecture.md`
3. `protocol-and-capabilities.md`
4. `ui-and-information-architecture.md`
5. `frontend-design/README.md`
6. `cost-accounting-and-module-recovery.md`

## 关键代码入口

- 后台 API 客户端：`apps/admin/src/admin-api-client.ts`
- 声明式页面与路径模型：`apps/admin/src/admin-view-model.ts`
- URL / History 状态：`apps/admin/src/use-admin-navigation.ts`
- 工作区二级导航：`apps/admin/src/admin-shell-workspace-band.tsx`
- 路由错误隔离：`apps/admin/src/admin-route-error-boundary.tsx`
- 动态模块加载恢复：`apps/admin/src/admin-lazy-import-recovery.ts`
- 费用分析：`apps/admin/src/admin-cost-dashboard.tsx`
- 渠道健康分析：`apps/admin/src/admin-channel-health-dashboard.tsx`
- 模型计费配置：`apps/admin/src/admin-model-pricing-section.tsx`
- RunningHub 工作台：`apps/admin/src/admin-runninghub-workspace.tsx`
- RunningHub 编辑器：`apps/admin/src/admin-runninghub-item-editor.tsx`
- API 设置面板：`apps/admin/src/admin-api-settings-panel.tsx`
- API 设置 helper：`apps/admin/src/admin-api-settings-panel-helpers.ts`
- 只读系统面板：`apps/admin/src/admin-readonly-panels.tsx`
- 服务端后台接口：`apps/api/src/server.ts`

## 当前重点

- 后台不是画布附属抽屉，而是独立 Web 能力
- Admin 已采用十个一级业务域：运营总览、账号与组织、权限与安全、Provider 与模型、RH 管理、ComfyUI 管理、内容与资源、任务与运行、数据分析与审计、系统与发布。
- 正式页面通过稳定 `/admin/...` URL 恢复；页面模块按路由懒加载，业务域数据按需读取，并由页面级错误边界隔离。
- 壳层、路由状态与工作区导航分别由 `main.tsx`、`use-admin-navigation.ts`、`admin-shell-workspace-band.tsx` 承担，业务面板不再负责一级导航。
- API 平台列表和各平台下的模型列表通过管理员专属上下移动操作维护前台展示顺序；权威字段为 `xh_providers.sort_order` 与 `xh_models.sort_order`。
- Provider 顺序全局生效；模型顺序限定在同一 Provider 和同一 capability 内，重排 API 要求提交完整作用域并以事务写入。
- RunningHub 工作台已成为 RH 条目录入和分析的主入口
- 系统页需要同时展示“配置值”和“实际生效值”
- API 设置面板已开始按 `helper / form sections / save actions` 分层，避免继续堆成单个超大后台文件
- 后台前端设计长期资料已进入 `frontend-design/`，后续在统一 `stitch` 风格基础上增减后台功能时优先维护该目录
- 数据分析与审计下的 `/admin/analytics/reliability` 只读展示 Provider / 模型渠道健康度；筛选、手动刷新和默认关闭的五分钟自动刷新均由该页面负责，不在 `main.tsx` 累积状态。
