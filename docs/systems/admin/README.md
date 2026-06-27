# Admin 后台系统

## 这个系统负责什么

Admin 是无限画布 2.0 的独立后台，负责用户、Provider、模型、系统设置、RunningHub 条目、环境同步、任务与观测等运营与治理能力。

## 建议阅读顺序

1. `architecture.md`
2. `protocol-and-capabilities.md`
3. `ui-and-information-architecture.md`
4. `frontend-design/README.md`

## 关键代码入口

- 后台 API 客户端：`apps/admin/src/admin-api-client.ts`
- RunningHub 工作台：`apps/admin/src/admin-runninghub-workspace.tsx`
- RunningHub 编辑器：`apps/admin/src/admin-runninghub-item-editor.tsx`
- API 设置面板：`apps/admin/src/admin-api-settings-panel.tsx`
- API 设置 helper：`apps/admin/src/admin-api-settings-panel-helpers.ts`
- 只读系统面板：`apps/admin/src/admin-readonly-panels.tsx`
- 服务端后台接口：`apps/api/src/server.ts`

## 当前重点

- 后台不是画布附属抽屉，而是独立 Web 能力
- RunningHub 工作台已成为 RH 条目录入和分析的主入口
- 系统页需要同时展示“配置值”和“实际生效值”
- API 设置面板已开始按 `helper / form sections / save actions` 分层，避免继续堆成单个超大后台文件
- 后台前端设计长期资料已进入 `frontend-design/`，后续在统一 `stitch` 风格基础上增减后台功能时优先维护该目录
