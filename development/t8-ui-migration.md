# T8 成熟画板 UI 迁移记录

日期：2026-06-04

## 需求纠偏

用户明确要求暂时不要从头重做画板 UI，而是直接使用 T8 已经成熟的界面、前端页面、节点系统和无限画板体验。

因此当前 worktree 中的 `apps/web` 占位画板只作为工程骨架验证，不作为正式产品 UI。

## 新方向

`apps/web` 应迁移 T8 前端：

- 采用 T8 `src/App.tsx` 的成熟页面结构。
- 采用 T8 `src/components/Canvas.tsx` 的 ReactFlow 画布主体。
- 采用 T8 节点面板、节点组件、素材面板、工具栏和主题系统。
- 清理 T8、企鹅、贞贞、RunningHub、RH 默认品牌和外部推广入口。
- 默认主题切换为星幻科技风。
- API 调用从 T8 本地后端逐步适配到星幻 `apps/api`。

## 迁移顺序

1. 将 T8 `src/` 迁入 `apps/web/src/`。
2. 补齐 T8 前端依赖。
3. 修改 `apps/web/vite.config.ts`：
   - alias `@ -> ./src`
   - `/api` 代理到星幻 API 或兼容 API
   - 注入 `__APP_VERSION__` 和 `__APP_NAME__`
4. 修改 `apps/web/index.html` 标题为星幻。
5. 清理用户可见旧品牌入口。
6. 保持 T8 画板可运行后，再做 API 和后台接入。

## 当前注意

- 不删除 T8 研究仓库。
- 不批量删除文件或目录。
- 不把当前占位画板继续当作正式 UI。
- 后续验收必须看到 T8 成熟画板结构，而不是占位画板。

## 2026-06-04 迁移进展

已完成：

- 已将 T8 `src/` 迁入 `apps/web/src/`。
- 已补齐 `@xyflow/react`、`zustand`、`@mediapipe/tasks-vision` 等前端依赖。
- 已为 `apps/web` 增加 `@ -> ./src` alias。
- 已为 `apps/web` 增加 T8 兼容代理：
  - `/api -> http://127.0.0.1:18766`
  - `/files -> http://127.0.0.1:18766`
  - `/output -> http://127.0.0.1:18766`
  - `/input -> http://127.0.0.1:18766`
- 已注入星幻编译期常量：`__APP_NAME__ = xinghuan-canvas`、`__APP_VERSION__ = 0.1.0`。

验证：

- `npm install` 成功，审计结果 0 vulnerabilities。
- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过。
- T8 兼容后端监听 `127.0.0.1:18766`。
- 星幻 Web 监听 `127.0.0.1:18310`。
- 浏览器 DOM 验证 `apps/web` 已显示 T8 成熟画板 UI，并可读取已有 `画布 1`。

已知问题：

- 用户可见旧品牌词仍存在，包括 T8、企鹅、贞贞、RunningHub、RH 等。
- 当前仍依赖 T8 兼容后端，不是星幻 API。
- 构建包体较大，主要来自 T8 自带主题图片和音乐资源。
- 浏览器截图接口在 T8 大画布页面上超时，需后续补稳定截图方式。

## 2026-06-04 样式回退修复

问题：

- 迁移 T8 `src/` 后漏迁 `tailwind.config.js` 和 `postcss.config.js`。
- `apps/web` 未声明 Tailwind/PostCSS 依赖。
- 页面表现为散乱的裸 HTML/像素主题状态。

修复：

- 新增 `apps/web/tailwind.config.js`。
- 新增 `apps/web/postcss.config.js`。
- 为 `apps/web` 补充 `tailwindcss`、`postcss`、`autoprefixer`。
- 将默认主题从 `pixel-candy` 改为 `tech-default`。
- 将星幻迁移版主题持久化 key 改为 `xinghuan-canvas-theme-tech-v1`。
- `loadCustomTemplates()` 强制采用科技风默认模板，避免 T8 后端/旧缓存把页面拉回像素风。

验证：

- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过。
- 浏览器确认：
  - `--t8-bg-app = #09090b`
  - `--t8-bg-canvas = #0a0a0b`
  - `--t8-accent = #38bdf8`
  - 页面已恢复科技风，不再是散乱裸样式。

## 2026-06-04 顶部品牌清理

范围：

- 顶部品牌统一为 `星幻无限画布`。
- 像素主题分支中的 `企鹅共创版` 改为 `企业共创版`。
- 侧栏底部版本标识改为 `星幻无限画布 · v0.1.0`。
- 顶部外部推广入口不再渲染：
  - 最新应用
  - AIX产品
  - 贞贞工坊
  - 视频教程
  - 在线画布

验证：

- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过。
- 浏览器 DOM 验证：
  - 包含 `星幻无限画布`。
  - 不包含顶部旧品牌 `贞贞的无限画布`、`企鹅共创版`、`T8 ·`、`T8-penguin-canvas`。
  - 不渲染顶部推广入口。
  - 科技风 token 仍为 `--t8-bg-app = #09090b`。

未完成：

- 侧栏中 `RH`、`RunningHub` 仍作为节点分组/节点名称出现，下一步单独处理为默认隐藏或星幻服务商节点分组。

## 2026-06-04 星幻 API 兼容层

目标：

- 保留 T8 成熟画板前端。
- 将画布列表、创建、读取、保存从 T8 后端切换到星幻 `apps/api`。
- 使用相对数据目录，避免继续依赖 T8 研究仓库的数据文件。

变更：

- `apps/api/src/server.ts` 新增 T8 前端兼容接口：
  - `GET /api/status`
  - `GET/POST /api/settings`
  - `GET /api/settings/raw`
  - `GET /api/settings/rh-tool-categories`
  - `GET /api/settings/rh-tool-apps`
  - `GET /api/themes/templates`
  - `GET/POST /api/canvas`
  - `GET/PUT/DELETE /api/canvas/:id`
  - `POST /api/canvas/:id/auto-save`
  - `PATCH /api/canvas/:id/name`
  - 资源库和云上传状态的空数据兼容接口。
- `apps/web/vite.config.ts` 将 `/api` 代理切换到 `http://127.0.0.1:18300`。
- `/files`、`/output`、`/input` 暂时仍代理到 T8 兼容后端，用于静态资源过渡。

验证：

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过。
- `GET http://127.0.0.1:18300/api/status` 返回 `xinghuan-api`。
- `POST /api/canvas` 创建 `星幻测试画布`。
- `PUT /api/canvas/:id` 保存 1 个测试节点。
- 浏览器确认 `apps/web` 显示 `星幻测试画布` 和 `1 个节点`。

剩余：

- 真实素材上传、输出文件、资源库持久化仍未迁入星幻 API。
- 真实模型执行仍未迁入星幻任务队列。
- T8 兼容后端暂时仍用于 `/files`、`/output`、`/input`。

## 2026-06-04 服务器部署演进记录

当前不直接部署服务器，先继续本机循序推进。

当前本机迁移期服务：

- Web：`127.0.0.1:18310`
- 星幻 API：`127.0.0.1:18300`
- T8 兼容后端：`127.0.0.1:18766`

目标服务器形态：

- 单端口生产服务。
- `apps/api` 同时服务：
  - `apps/web/dist`
  - `/api/*`
  - `/files/*`
  - `/output/*`
  - `/input/*`
- 灰度使用 `canvas-next.hhh2121.xyz` 和 `127.0.0.1:18200`。
- 生产使用 `canvas.hhh2121.xyz` 和 `127.0.0.1:18100`。

实施顺序：

1. 继续迁移文件、输出、输入和资源库接口。
2. 实现本机单端口生产服务。
3. 本机验收通过后部署灰度。
4. 灰度验收通过后再考虑生产切换。

## 2026-06-04 文件与资源接口迁移

目标：

- 将 `/files`、`/input`、`/output` 和资源库最小能力迁入星幻 API。
- 继续保留 T8 成熟画板前端，不动 RH 节点分组。

变更：

- `apps/api` 新增 `busboy` 依赖处理 multipart 上传。
- `apps/api/src/server.ts` 新增：
  - `POST /api/files/upload`
  - `POST /api/files/upload-base64`
  - `GET /api/files/list`
  - `POST /api/files/save-to-disk`
  - `POST /api/files/duck-decode` 空解码兼容
  - `GET /files/input/*`
  - `GET /files/output/*`
  - `GET /input/*`
  - `GET /output/*`
  - `GET/POST /api/resources/categories`
  - `PUT/DELETE /api/resources/categories/:id`
  - `GET /api/resources/items`
  - `POST /api/resources/items/add`
  - `POST /api/resources/sets/add`
  - `POST /api/resources/poses/add`
  - `POST /api/resources/workflows/add`
  - `PUT/DELETE /api/resources/items/:id`
- `apps/web/vite.config.ts` 将 `/files`、`/input`、`/output` 代理切换到 `127.0.0.1:18300`。

数据目录：

- `apps/api/data/input`
- `apps/api/data/output`
- `apps/api/data/resources`

验证：

- `npm install` 成功，0 vulnerabilities。
- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过。
- 命令行上传测试文件成功，返回 `/files/input/up_*.txt`。
- `GET /files/input/up_*.txt` 返回 200。
- `POST /api/resources/items/add` 写入 `星幻上传测试资源`。
- `GET /api/resources/items?kind=image` 返回该资源。
- 浏览器 DOM 确认 Web 仍显示 `星幻测试画布`、`后端已连接`、`星幻无限画布`。

剩余：

- 资源库 UI 点击在浏览器工具中偶发 CDP 超时，命令接口验证已通过。
- 真实输出文件、缩略图、资源分类默认初始化仍需增强。
- 模型生成产物落库仍未接入任务队列。

## 2026-06-05 本机单端口生产服务

目标：

- 将 T8 成熟画板前端的本机运行方式从 Vite dev + API + T8 兼容后端收敛为星幻 API 单端口生产服务。

变更：

- `apps/api/src/server.ts` 托管 `apps/web/dist`。
- 非 API/文件路径的 GET 请求使用 SPA fallback 回退到 `index.html`。
- 静态文件 MIME 扩展到 HTML、JS、CSS、SVG、JSON、字体和 MIDI。
- `/api/*`、`/files/*`、`/input/*`、`/output/*` 继续由星幻 API 优先处理。

验证：

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/web` 通过。
- `127.0.0.1:18200` 单端口启动成功。
- 关闭 `18300`、`18310`、`18766` 后，仅 `18200` 监听。
- 同端口验证 `/`、静态 JS、`/api/status`、画布创建/保存/读取、文件上传/访问和 SPA fallback。
- Chrome headless 截图：`output/playwright/single-port-18200-chrome.png`。
- DOM dump 确认 `星幻无限画布`、`后端已连接`、`react-flow` 存在，并且不包含旧开发端口。

剩余：

- 真实模型执行、登录隔离、数据库和任务队列仍待后续阶段。
- Web 生产包存在大 chunk 警告，后续需要分包优化。
- RH 节点分组按用户要求暂不处理。
