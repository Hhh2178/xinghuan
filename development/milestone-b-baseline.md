# Milestone B 工程基线记录

日期：2026-06-04

## 目标

建立星幻正式工程骨架，验证不依赖 T8 研究仓库也能形成 Web、Admin、API、Worker 和共享包边界。

## 变更范围

新增 monorepo：

- `apps/web`：星幻无限画布工作台占位页。
- `apps/admin`：星幻统一后台占位页。
- `apps/api`：Node HTTP health/version 服务。
- `apps/worker`：worker 占位启动服务。
- `packages/shared`：产品名、版本和 health payload。
- `packages/ui`：星幻 shell 和科技风 tokens。
- `packages/canvas-core`：节点定义和端口类型。
- `packages/model-core`：Provider/model 草案类型和初始模型。

新增配置：

- 根 `package.json`。
- 根 `tsconfig.base.json`。
- `config/.env.example`。

## 验证证据

- `npm install` 成功。
- 依赖审计结果：0 vulnerabilities。
- `npm run type-check` 通过。
- `npm run build` 通过。
- `npm run start -w @xinghuan/worker` 通过，输出 `xinghuan-worker ready: queue adapter pending`。
- API 监听：`http://127.0.0.1:18300`。
- `GET /health` 返回 `ok: true`、`service: xinghuan-api`、`version: 0.1.0`。
- `GET /api/version` 返回 `ok: true`、`service: xinghuan-api-version`、`version: 0.1.0`。
- Web 监听：`http://127.0.0.1:18310`。
- Admin 监听：`http://127.0.0.1:18320`。

## 浏览器验收

浏览器 DOM 验收：

- Web 页面包含 `星幻` 和 `无限画布`。
- Web 页面不包含 `T8`、`企鹅`、`贞贞`、`RunningHub`、`RH风格`。
- Admin 页面包含 `星幻` 和 `模型目录`。
- Admin 页面不包含 `T8`、`企鹅`、`贞贞`、`RunningHub`、`RH风格`。

视觉验收：

- Web 默认首屏为深色科技风画布、青绿色强调色、左侧节点栏、中间画布、右侧属性面板。
- Admin 默认首屏为深色科技风后台、指标卡片、模型目录表格。
- 浏览器截图已在本轮工具输出中返回；写入本地截图文件时出现一次 `Page.captureScreenshot` 超时，后续应补充稳定截图脚本。

## 已知限制

- 当前是工程基线，占位页不含真实 ReactFlow 交互。
- 当前不接真实 Provider API。
- 当前没有登录、数据库、Redis、对象存储和任务队列。
- Admin 只是信息架构占位，尚未实现 CRUD。
- 截图文件落盘未完成，需要后续补测。

## 下一步

- 引入真实画布组件边界。
- 增加 Playwright 或稳定浏览器验收脚本。
- 增加 API 路由结构、认证中间件和数据模型迁移计划。
- 建立 `apps/web` 与 `apps/api` 的配置连接。
