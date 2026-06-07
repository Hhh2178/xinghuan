# DEVLOG.md - 无限画布 2.0 开发日志台账

## 日志规则

- 最新记录放在最上方。
- 每次真实推进都必须记录：目标、变更范围、验证证据、影响、风险、下一步。
- 任何选型、部署、回滚、数据结构、节点规范和后台规范变化都要记录。
- 禁止记录真实 API Key、Token、Cookie、SSH Key 和数据库密码。

## 2026-06-08

### Provider 文件访问签名模块抽离

目标:

- 优化后端文件结构，降低 `apps/api/src/server.ts` 中供应商参考素材签名逻辑的复杂度。
- 保持 `/api/provider-files/...` 短期 HMAC 供应商短链行为不变，避免图像、视频和 LLM 上游再次无法拉取本地参考素材。
- 为签名、过期、篡改拒绝和危险路径处理建立独立合约验证。

变更范围:

- 新增 `apps/api/src/provider-file-access.ts`，集中管理本地素材引用归一化、供应商短链生成、请求解析、HMAC 签名与校验、危险用户 ID 归一化。
- `apps/api/src/server.ts` 改为导入 provider file access helpers；`sendProviderFile()` 只负责根据解析结果发送用户目录里的 input/output 文件。
- 新增 `scripts/verify-provider-file-access-contract.ts` 与根脚本 `verify:provider-file-access-contract`。
- 更新 `docs/prd/v0.1.0/progress.md` 与 `docs/prd/v0.1.0/changelog.md`。

验证证据:

- `npm run verify:provider-file-access-contract` 通过，覆盖模块存在、服务端不再内联签名函数、危险用户 ID 归一化、签名 URL、解析、过期拒绝、篡改拒绝和路径穿越文件名收敛。
- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run type-check` 通过。
- `npm run build:single-port` 通过。
- 受控临时单端口服务 `http://127.0.0.1:18347` 下，`npm run verify:external-image-proxy`、`npm run verify:external-chat-proxy`、`npm run verify:external-video-proxy` 均通过。

影响:

- Provider 签名短链成为独立可测试模块，后续修改图片、视频或 LLM 代理时更容易避免误伤素材访问链路。
- `server.ts` 的安全敏感纯逻辑减少，职责边界更清晰。

风险:

- 当前仅完成本机源码与受控临时服务验证，尚未单独发布到灰度或生产。
- 本机仍存在几份运行时数据文件脏改动，本次不会提交这些数据文件。

下一步:

- 继续按项目优化计划推进前端入口 UI 生产切换或下一块后端/后台结构优化。
- 如准备发布，应先在灰度重新跑 `verify:single-port` 与三类外部代理验证。

## 2026-06-07

### 设计稿最终入口页与过渡动画收口

目标:

- 按用户提供的 `stitch_ui_optimization_and_transitions` 设计文件，替换此前登录页分栏方案。
- 登录页采用居中磨玻璃星云卡片，保留科技风、深度感、鼠标跟随和轻量动画。
- 权限校验启动阶段采用量子同步过渡动画，移除旧 T8/开发占位文案。

变更范围:

- `apps/web/src/components/LoginGate.tsx`：改为居中 `xh-login-card-stellar` 登录卡，CSS-only 星云背景、星点、鼠标跟随卡片倾斜；移除设计稿演示用的 `SSO 接入`、`组织网络` 和分隔说明。
- `apps/web/src/App.tsx`：认证检查阶段改为 `xh-quantum-transition`，包含量子环、粒子吸入、状态文案切换、进度条和闪白过渡。
- `apps/web/src/styles/index.css`：新增 `xh-nebula-bg`、`xh-login-card-stellar`、`xh-input-stellar`、`xh-btn-stellar`、`xh-transition-*` 样式与 reduced-motion 兜底。
- `scripts/verify-xinghuan-entry-ui.mjs`：入口 UI 合约改为要求最终设计稿结构、禁止占位按钮、校验量子过渡动画。

验证证据:

- `npm run verify:xinghuan-entry-ui` 通过。
- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过；仅保留既有大 chunk 和空 `vendor-react` chunk 警告。
- 服务器 release `20260607-entrance-ui-gray` 执行 `npm ci`、`npm run build:single-port` 通过。
- 服务器 `npm run verify:xinghuan-entry-ui` 和 `npm run verify:single-port` 通过。
- 本机 Vite 预览 `http://127.0.0.1:18313` 截图通过，桌面截图见 `output/xinghuan-entry-ui/login-desktop.png`，移动端截图见 `output/xinghuan-entry-ui/login-mobile.png`。
- 浏览器 DOM 确认登录页包含 `星幻画布`、`XingHuan Canvas`、`进入创作星域` 和 `量子星图系统已就绪`，且不包含 `SSO 接入` 或 `组织网络`。
- 公网灰度 `https://canvas-next.hhh2121.xyz/` 截图通过，控制台 error 数量为 0，截图见 `output/xinghuan-entry-ui/gray-login-desktop.png`。

影响:

- 登录前页面现在与用户提供的最终设计稿一致：居中、沉浸、轻量星云，不再出现左侧开发说明区或演示入口。
- 启动过渡页从旧 `READY / STELLAR GRAPH WARMUP` 改为中文星幻量子同步语义。

风险:

- 当前已推灰度并通过公网入口验收，生产域名暂未切换。
- 仍存在既有 Web bundle 大 chunk 警告，不阻断本次入口 UI 发布。

下一步:

- 若灰度视觉确认通过，再决定是否同步到生产 `canvas.hhh2121.xyz`。

### B 方案量子星图入口 UI 落地

目标:

- 按用户确认的 B「量子星图」方向，重做登录首页、权限校验启动过渡、无画布创建首页和侧栏空状态。
- 加入磨玻璃 UI 动画与鼠标跟随光场，形成完整的星幻入口体验。

变更范围:

- 新增 `apps/web/src/components/StellarCursorAura.tsx`，提供全局鼠标跟随光晕组件。
- `apps/web/src/components/LoginGate.tsx`：替换为量子星图登录首页，保留原登录 API 行为。
- `apps/web/src/App.tsx`：权限校验阶段改为星图装载过渡页。
- `apps/web/src/components/Canvas.tsx`：无 active canvas 时显示“开启第一张星图”创建首页，并可直接创建星图画布。
- `apps/web/src/components/Sidebar.tsx`：侧栏无画布状态改为星图语言和小型磨玻璃卡片。
- `apps/web/src/styles/index.css`：新增星图背景、磨玻璃面板、入场动画、轨道动画、扫描动画、鼠标跟随光场和 reduced-motion 兜底。
- 新增 `scripts/verify-xinghuan-entry-ui.mjs` 与 `npm run verify:xinghuan-entry-ui`，覆盖入口 UI 合约。

验证证据:

- 先运行 `node scripts/verify-xinghuan-entry-ui.mjs`，8 项检查按预期失败，证明脚本能捕获未落地状态。
- 落地后 `npm run verify:xinghuan-entry-ui` 通过，8/8 检查全绿。
- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过；仅保留既有大 chunk 和空 `vendor-react` chunk 警告。
- 本机 Vite 预览 `http://127.0.0.1:18311` 返回 200。
- 登录页截图已生成：`output/xinghuan-entry-ui/login-stellar-graph-final.png`。
- CodeGraph 已同步。

影响:

- 登录前、认证检查、无画布状态和侧栏创建入口现在统一为星幻量子星图风格。
- 用户可在无画布主区域直接创建第一张星图画布，不再只依赖侧栏。

风险:

- 当前只完成本机落地和本地渲染截图验收，尚未推灰度或生产。
- 登录页截图已确认，登录后无画布主区域因需真实会话与数据态，当前主要由构建和静态 UI 合约覆盖。

下一步:

- 如确认视觉方向，可打包并推灰度 `canvas-next.hhh2121.xyz`，再用真实登录账号验收登录页、启动过渡、空画布创建和鼠标跟随效果。

### 全节点验收矩阵与本地完整验收链路

目标:

- 把“所有节点是否已注册、能否在真实画布渲染、同类输出预览是否继续自适应”变成可重复的一键验收。
- 修复全节点浏览器烟测暴露的去 AI 水印节点挂载时 `/api/ai-watermark/status` 返回 404 的问题。
- 在不恢复 RunningHub 真实工作流测试的前提下，完成当前非 RH 真实运行项的本地完整验收链路。

变更范围:

- `scripts/verify-node-acceptance-matrix.mjs`：修复常量初始化顺序问题，并覆盖 46 个注册节点的组件映射、端口声明、默认数据、可执行节点和关键代理节点合同。
- 新增 `scripts/verify-canvas-node-render-smoke.mjs` 与 `npm run verify:canvas-node-render-smoke`：创建临时画布，放入 46 个注册节点，并通过本机 Chrome/CDP 验证真实页面无缺失节点、无旧 T8 空态、无登录页残留、无错误边界和无运行时错误。
- `apps/api/src/server.ts`：新增 `GET /api/ai-watermark/status` 和 `POST /api/ai-watermark/process` 的结构化未配置兜底，避免节点挂载时报 404；处理接口当前明确返回 `AI_WATERMARK_NOT_CONFIGURED`。
- 新增 `scripts/verify-ai-watermark-api.mjs` 与 `npm run verify:ai-watermark-api`。
- 新增 `scripts/verify-local-acceptance-chain.mjs` 与 `npm run verify:local-acceptance-chain`，串联构建、单端口、节点矩阵、浏览器渲染、模型目录、三类外部代理、任务生命周期、素材 API、输出预览、RunningHub 合同/API、Worker 合同、输出落库和 14 天清理验证。
- 补充 `npm run verify:output-node-preview-layout`，让输出节点预览布局验证纳入根脚本。
- `scripts/verify-worker-output-materializer.ts`：兼容 PostgreSQL 灰度环境，验证时使用真实存在的未禁用用户作为 owner，并在 PostgreSQL 模式下查询 `xh_assets` 验证去重；文件模式仍验证 `resource-library.json`。
- 发布灰度 release `20260607-1545-node-acceptance-gray`。
- 新增运维记录 `ops/phase3-node-acceptance-gray-2026-06-07.md`。

验证证据:

- 本机 `npm run verify:local-acceptance-chain` 已通过，临时服务地址为 `http://127.0.0.1:18333`，最终输出 `ok=true`。
- 该链路已包含并通过：`build:single-port`、`verify:single-port`、`verify:node-acceptance-matrix`、`verify:canvas-node-render-smoke`、`verify:generic-node-catalog`、`verify:model-catalog`、`verify:ai-watermark-api`、`verify:external-image-proxy`、`verify:external-video-proxy`、`verify:external-chat-proxy`、`verify:task-payload-api`、`verify:task-lifecycle`、`verify:canvas-resource-api`、`verify:output-node-preview-layout`、`verify:runninghub-workflow-contract`、`verify:runninghub-workflow-api`、`verify:worker-adapter-contract`、`verify:worker-grsai-contract`、`verify:worker-output-materializer`、`verify:output-material-prune`。
- 节点验收矩阵结果：`totalRegistryNodes=46`、`visibleNodes=34`、`hiddenNodes=12`、`executableNodes=33`。
- 浏览器真实渲染烟测结果：`expectedNodeCount=46`、`renderedNodeCount=46`、`missingIds=[]`、`classMismatches=[]`、`legacyFound=[]`、`runtimeErrors=[]`。
- 输出预览布局验证继续通过，覆盖竖图、横视频和多图网格高度规则。
- 14 天输出素材保守清理验证继续通过，覆盖收藏、归类、共享文件保护。
- 灰度 `current` 已切换到 `/opt/apps/xinghuan-canvas-next/releases/20260607-1545-node-acceptance-gray`，API/Worker 均为 `active`，`/api/status` 返回 `environment=gray`。
- 服务器灰度已通过：`verify:single-port`、`verify:node-acceptance-matrix`、`verify:ai-watermark-api`、`verify:generic-node-catalog`、`verify:model-catalog`、`verify:external-image-proxy`、`verify:external-video-proxy`、`verify:external-chat-proxy`、`verify:task-payload-api`、`verify:task-lifecycle`、`verify:canvas-resource-api`、`verify:output-node-preview-layout`、`verify:runninghub-workflow-contract`、`verify:runninghub-workflow-api`、`verify:worker-adapter-contract`、`verify:worker-grsai-contract`、`verify:worker-output-materializer`、`verify:output-material-prune`。
- 公网灰度 `https://canvas-next.hhh2121.xyz` 已通过本机 Chrome 浏览器烟测：46/46 节点渲染成功，旧空态、错误边界和 runtime error 均为 0。

影响:

- 现在可以用一个命令在本机复验当前核心交付链路，避免只靠单点 smoke 判断生产可用性。
- 去 AI 水印节点即使暂未接入真实 Adapter，也不会因为状态接口缺失破坏全画布节点渲染。
- RH 当前仍只验证合同和空目录 API；真实工作流卡片录入、字段展开和预览运行继续按用户要求暂缓。

风险:

- `verify:worker-grsai-image-adapter` 需要 Redis/PostgreSQL 队列环境，本机临时服务未纳入该真实队列验收；已用静态/合同验证覆盖 Worker GRSAI 分支。
- Web 构建仍提示大 chunk 警告和空 `vendor-react` chunk，需要后续作为性能优化项单独收口。

下一步:

- 观察灰度运行状态。
- 若用户确认灰度无异常，再评估是否同步生产。
- 待用户恢复 RH 事项后，再补 RunningHub 首条真实工作流卡片与预览运行验收。

### 全节点验收链路生产同步

目标:

- 将灰度已通过的全节点验收矩阵、浏览器渲染烟测、AI watermark API 兜底和验证脚本兼容修复同步到生产。
- 确认生产 `canvas.hhh2121.xyz` 仍保持核心链路可用。
- 不恢复 RunningHub 真实工作流卡片录入、字段展开和预览运行测试。

变更范围:

- 发布生产 release `20260607-1610-node-acceptance-prod`。
- 将 `scripts/verify-output-material-prune.ts` 修复为导入清理模块前强制文件模式，避免生产 PostgreSQL 环境变量影响临时沙盒验证。
- 新增运维记录 `ops/phase3-node-acceptance-production-2026-06-07.md`。

验证证据:

- 生产 `current` 已切换到 `/opt/apps/xinghuan-canvas/releases/20260607-1610-node-acceptance-prod`。
- `xinghuan-canvas.service` 和 `xinghuan-canvas-worker.service` 均为 `active`。
- `http://127.0.0.1:18100/api/status` 与 `https://canvas.hhh2121.xyz/api/status` 均返回 `environment=production`。
- 服务器生产已通过：`verify:single-port`、`verify:node-acceptance-matrix`、`verify:ai-watermark-api`、`verify:generic-node-catalog`、`verify:model-catalog`、`verify:external-image-proxy`、`verify:external-video-proxy`、`verify:external-chat-proxy`、`verify:task-payload-api`、`verify:task-lifecycle`、`verify:canvas-resource-api`、`verify:output-node-preview-layout`、`verify:runninghub-workflow-contract`、`verify:runninghub-workflow-api`、`verify:worker-adapter-contract`、`verify:worker-grsai-contract`、`verify:worker-output-materializer`、`verify:worker-output-materials`、`verify:output-material-prune`。
- 公网生产 `https://canvas.hhh2121.xyz` 已通过本机 Chrome 浏览器烟测：46/46 节点渲染成功，旧空态、错误边界和 runtime error 均为 0。

影响:

- 生产现在具备与灰度一致的全节点验收链路、AI watermark API 兜底和验证脚本兼容修复。
- 生产真实 Worker 输出素材落库链路已复验通过。

风险:

- Web 构建仍存在大 chunk 和空 `vendor-react` chunk 警告，属于后续性能优化项。
- RunningHub 仍只覆盖合同和空目录 API；真实工作流卡片录入、字段展开和预览运行继续按用户要求暂缓。

下一步:

- 对完整验收目标做最终审计，区分“已验收通过”和“用户明确暂缓”的范围。

### 供应商参考素材短链与星幻空态修复

目标:

- 解释并验证灰度域名与生产域名的实际运行关系。
- 修复图像节点参考图仍报 `image upload failed, please check the image` 的根因。
- 检查并覆盖视频、LLM 等同类参考素材转发节点。
- 将进入工作区的过渡页和无画布空态从 T8/企鹅文案替换为星幻画布设计。

变更范围:

- `apps/api/src/server.ts`：
  - 新增 `/api/provider-files/...` 供应商短链入口。
  - 本地 `/files/input/...`、`/files/output/...`、`/input/...`、`/output/...` 参考素材在发给图像/视频/LLM 上游前，会转换为带过期时间和 HMAC 签名的短链。
  - 普通 `/files` 仍保持登录保护，短链只允许读取单个明确文件。
- `scripts/verify-external-image-proxy.mjs`、`verify-external-video-proxy.mjs`、`verify-external-chat-proxy.mjs`：
  - 新增真实上传参考图、上游收到短链、未登录可读取短链单文件的回归验证。
- `apps/web/src/App.tsx`、`Canvas.tsx`、`Sidebar.tsx`、`CanvasManager.tsx`：
  - 替换权限校验过渡页。
  - 替换无画布空态，移除“贞贞的无限画布（企鹅共创版）/请先在左侧创建或选择一个画布”等旧文案。
- 发布生产 release `20260606-1810-provider-signed-refs-xinghuan-empty`。
- 发布灰度 release `20260606-1818-provider-signed-refs-xinghuan-empty-gray`。

验证证据:

- 灰度和生产 Nginx 映射不同：`canvas.hhh2121.xyz -> 127.0.0.1:18100`，`canvas-next.hhh2121.xyz -> 127.0.0.1:18200`。
- 灰度和生产 release 不同，但 `XINGHUAN_DATABASE_URL` 脱敏 hash 一致，当前共用同一 PostgreSQL 数据底座。
- 未登录访问普通素材 URL 返回 `401`，确认上次“绝对 URL”仍不足以让外部供应商拉取素材。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run build -w @xinghuan/web` 通过。
- 本机 `npm run build:single-port` 通过。
- 生产 `npm run verify:single-port` 通过。
- 生产公网 `verify:external-image-proxy`、`verify:external-video-proxy`、`verify:external-chat-proxy` 均通过。
- 生产当前静态资源引用 `index-DKFUNYas.js` / `index-CPrY09TR.css`，当前 `dist` 中已搜不到旧空态文案。
- 灰度 `npm run verify:single-port` 通过。
- 灰度公网 `verify:external-image-proxy`、`verify:external-video-proxy`、`verify:external-chat-proxy` 均通过。
- 灰度当前 `dist` 中已搜不到旧空态文案。

影响:

- GRSAI 等外部供应商现在拿到的是可匿名读取的短期签名参考图链接，不再是需要登录 cookie 的普通素材 URL。
- 同类图像参考链路已覆盖图像、视频和 LLM 后端代理。
- 两个域名仍保持灰度/生产角色区分，但当前数据底座相同，用户在两个域名看到相近数据是预期结果。

风险:

- 短链默认有效期为 20 分钟；若某些供应商排队超过该时间才拉取参考图，需要后续把有效期配置化或按任务生命周期续签。
- 灰度和生产当前共用数据库；如果后续需要严格隔离资产库和用户数据，需要单独开生产库并迁移。

下一步:

- 让用户刷新页面后复测图像节点参考图生成。
- 如 GRSAI 仍报上传失败，再专项确认其是否要求 Base64/文件上传接口而不是 URL 拉取。

### 生产图像参考素材与视频模型修复

目标:

- 修复图像生成节点在使用本地/资产库参考图时，上游报 `image upload failed, please check the image` 的问题。
- 让视频节点从旧的内置 Grok Video 面板切到后台发布模型目录驱动的状态。

变更范围:

- `apps/api/src/server.ts`：图像/视频外部代理在转发参考素材前，会把 `/files/...`、`/input/...`、`/output/...` 和无前导斜杠的同类路径归一化为当前请求公网 origin 下的绝对 URL；`data:image/...` 与已有 `http(s)` URL 保持不变。
- `scripts/verify-external-image-proxy.mjs`：新增本地素材引用转公网绝对 URL 的断言。
- `scripts/verify-external-video-proxy.mjs`：新增视频参考素材引用转公网绝对 URL 的断言。
- 生产后台启用既有模型 `toapis-grok-video`，使 `/api/models` 返回 `videoModels=1`。
- 发布生产 release `20260606-1715-image-ref-video-model-fix`。

验证证据:

- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run build:single-port` 通过。
- 生产 `readlink -f /opt/apps/xinghuan-canvas/current` 返回 `/opt/apps/xinghuan-canvas/releases/20260606-1715-image-ref-video-model-fix`。
- 生产 `curl http://127.0.0.1:18100/api/status` 返回 `environment=production`。
- 生产 `npm run verify:single-port` 通过。
- 生产模型目录验证返回 `imageCount=1`、`videoCount=1`、`firstVideo=ToAPIs Grok Video`。
- 生产公网 `XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz npm run verify:external-image-proxy` 通过，包含 `Proxy normalizes local reference URL`。
- 生产公网 `XINGHUAN_VERIFY_BASE_URL=https://canvas.hhh2121.xyz npm run verify:external-video-proxy` 通过。

影响:

- GRSAI 图像生成拿到的参考图不再是服务内部相对路径，而是公网可访问 URL，降低上游“图片上传失败”的概率。
- 视频节点刷新后应显示后台发布模型 `ToAPIs Grok Video`，进入与图像节点同类的发布模型消费状态。

风险:

- 若上游要求 Base64 上传而不是 URL 拉取，仍可能需要补充厂商专用上传 Adapter；当前修复优先解决截图中最符合的本地相对 URL 不可访问问题。
- 视频节点 UI 进入发布模型目录后，视觉主题仍与图像节点不完全一致；若需要完全同款布局，可作为后续前端统一任务推进。

下一步:

- 让用户在生产页面刷新后复测图像参考图生成与视频节点显示。
- 若图像上游仍报错，再进入 GRSAI 参考图上传格式专项排查。

### 生产普通用户账号创建

目标:

- 按用户要求创建 3 个普通成员账号，账号以 `zezhen` 开头，密码使用随机码。
- 遵守项目安全规则，不在聊天、文档或 Git 中记录真实密码。

变更范围:

- 在生产站点通过后台 API 创建：
  - `zezhen01@xinghuan.local`
  - `zezhen02@xinghuan.local`
  - `zezhen03@xinghuan.local`
- 新增运维记录 `ops/production-user-accounts-2026-06-06.md`。

验证证据:

- 管理员登录生产后台 API 成功。
- 3 个新成员账号均通过 `/api/auth/login` 登录验证。
- 临时凭据文件保存在服务器 `/opt/apps/xinghuan-canvas/shared/credentials/` 下，权限为 `0600`。

影响:

- 生产站点现在已有 3 个可用普通成员账号。
- 真实密码只在服务器受限权限文件中交付，未进入仓库、文档或聊天输出。

风险:

- 临时凭据文件交付后应尽快移入密码管理器，或完成密码轮换后删除。

下一步:

- 由管理员完成密码分发、轮换策略和临时凭据文件处置。

### 生产位 18100 运维模板与切换清单补齐

目标:

- 为正式域名 `canvas.hhh2121.xyz` 和生产端口 `127.0.0.1:18100` 补齐独立于灰度的运维材料。
- 明确生产环境文件、systemd、Nginx、Redis 队列、数据路径和日志路径不复用灰度。

变更范围:

- 新增 `config/canvas-production.env.example`。
- 新增 `ops/production-deploy-runbook.md` 和 `ops/production-acceptance-checklist.md`。
- 新增 `ops/nginx/canvas.hhh2121.xyz.conf.example`。
- 新增 `ops/systemd/xinghuan-canvas*.example` 生产 systemd 模板。
- 更新 `ops/README.md`、`ops/production-preflight-2026-06-06.md` 和 `MEMORY.md`。

验证证据:

- 已核对现有仓库中此前只有灰度版 env、Nginx、systemd 和 runbook，生产位材料缺失。
- 本轮新增模板已明确：
  - 生产目录根为 `/opt/apps/xinghuan-canvas/`
  - 生产环境文件为 `/opt/apps/xinghuan-canvas/shared/canvas.env`
  - 生产端口为 `127.0.0.1:18100`
  - 生产 Redis 队列为 `xinghuan:tasks:prod`
- `ops/production-preflight-2026-06-06.md` 已回写这些模板入口。

影响:

- 后续正式切生产时，不需要再临时拿灰度配置改端口，而是可以直接按独立生产模板执行。
- 生产与灰度的运行目录、日志目录、数据目录和队列命名边界更清晰，降低误用风险。

风险:

- 这轮补的是模板和 runbook，不代表服务器上的生产站点已经安装或启用。
- PostgreSQL 生产连接串、证书、bootstrap 密码和真实日志路径仍需在服务器侧单独填写与验证。

下一步:

- 继续把生产预检清单收口到可执行状态，并准备生产 smoke 的命令级步骤。

### 生产位目录骨架与 env 示例服务器落地

目标:

- 在不启服务、不切域名的前提下，把生产位服务器侧的最小目录骨架先准备出来。
- 验证生产位当前确实尚未安装 active env、Nginx 和 systemd，避免误判为“已部署”。

变更范围:

- 服务器创建 `/opt/apps/xinghuan-canvas/releases`、`/opt/apps/xinghuan-canvas/shared/data`、`/opt/apps/xinghuan-canvas/shared/logs`。
- 上传本地 `config/canvas-production.env.example`，落到服务器 `/opt/apps/xinghuan-canvas/shared/canvas.env.example`。
- 新增运维记录 `ops/production-prep-2026-06-07.md`。

验证证据:

- 服务器检查返回：
  - `PROD_DIR_MISSING`
  - `PROD_CURRENT_MISSING`
  - `NGINX_PROD_SITE_MISSING`
  - `PROD_API_SERVICE_MISSING`
  - `PROD_WORKER_SERVICE_MISSING`
  - `PROD_ENV_MISSING`
- 同时确认灰度底座仍正常：`xinghuan-canvas-next.service`、`xinghuan-canvas-next-worker.service`、`nginx`、`postgresql`、`redis-server` 均为 `active`。
- 创建目录后，服务器返回 `PROD_DIRS_CREATED`，并可见：
  - `/opt/apps/xinghuan-canvas`
  - `/opt/apps/xinghuan-canvas/releases`
  - `/opt/apps/xinghuan-canvas/shared/data`
  - `/opt/apps/xinghuan-canvas/shared/logs`
- 服务器上已存在 `/opt/apps/xinghuan-canvas/shared/canvas.env.example`。
- 服务器检查确认 active env 仍不存在：`PROD_ENV_ACTIVE_MISSING`。

影响:

- 生产位现在至少具备了独立目录骨架，不再是纯文档状态。
- 但这仍不代表生产服务已部署；真正的 `canvas.env`、systemd、Nginx 和 release 仍需后续安装。

风险:

- 这轮还没有安装任何生产服务单元，也没有生成真正的生产环境文件。
- 若后续直接把模板误当 active 配置使用，仍可能导致 bootstrap 密码或连接串未填完整。

下一步:

- 填写真实 `canvas.env` 后，再准备 `18100` 本机 smoke。

### 生产 Nginx / systemd 模板服务器安装但保持未启用

目标:

- 将生产 Nginx 和 systemd 模板正式安装到服务器标准路径。
- 保持这些模板未启用，避免误触发生产切流。

变更范围:

- 服务器安装：
  - `/etc/nginx/sites-available/canvas.hhh2121.xyz`
  - `/etc/systemd/system/xinghuan-canvas.service`
  - `/etc/systemd/system/xinghuan-canvas-worker.service`
  - `/etc/systemd/system/xinghuan-canvas-output-prune.service`
  - `/etc/systemd/system/xinghuan-canvas-output-prune.timer`
- 运行 `systemctl daemon-reload`
- 更新 `ops/production-prep-2026-06-07.md`、`ops/production-preflight-2026-06-06.md` 和 `MEMORY.md`

验证证据:

- 服务器返回 `PROD_TEMPLATES_INSTALLED`。
- 复查可见上述 Nginx/systemd 文件均已存在于服务器目标路径。
- 复查确认：
  - `NGINX_PROD_NOT_ENABLED`
  - `systemctl is-enabled xinghuan-canvas.service` 返回 `disabled`
  - `systemctl is-enabled xinghuan-canvas-worker.service` 返回 `disabled`
  - `systemctl is-enabled xinghuan-canvas-output-prune.timer` 返回 `disabled`
- `systemd-analyze verify` 未对新安装的生产 unit 报错；输出中仅出现与本项目无关的 `tat_agent.service` 旧路径警告。
- 同时确认：
  - `PROD_ENV_ACTIVE_MISSING`
  - `PROD_CURRENT_MISSING`

影响:

- 生产位已从“只有本地模板”推进到“服务器模板已落位但未启用”状态。
- 下轮只需要补 active env、release 和最小 smoke，就可以进入真正的生产服务启动前检查。

风险:

- 生产 env 真值仍未落地，生产 release 也尚未创建，因此现在仍不能启动这些 unit。
- Nginx 站点未启用，说明正式域名切流仍未开始。

下一步:

- 填写真实 `canvas.env`。
- 准备生产 release 并创建 `/opt/apps/xinghuan-canvas/current`。
- 在 `127.0.0.1:18100` 做本机 smoke 后，再决定是否启用站点和服务。

### 生产 release 启动与 18100 本机 smoke

目标:

- 将当前灰度基线复制为生产 release。
- 在不启用生产 Nginx 站点的前提下，先验证 `127.0.0.1:18100` 能完整跑通。

变更范围:

- 服务器创建 `/opt/apps/xinghuan-canvas/shared/canvas.env`，从灰度 env 派生并调整为生产端口、生产 data dir、生产 dist dir、生产队列名。
- 服务器创建 production release `20260606-1604-phase3-prod-prep`。
- 设置 `/opt/apps/xinghuan-canvas/current` 指向该 release。
- 启动并启用：
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`
  - `xinghuan-canvas-output-prune.timer`

验证证据:

- `/api/status` 返回 `environment=production`，`dataDir=/opt/apps/xinghuan-canvas/shared/data`。
- `127.0.0.1:18100` 已监听。
- 生产服务状态：
  - `xinghuan-canvas.service` 为 `active` / `enabled`
  - `xinghuan-canvas-worker.service` 为 `active` / `enabled`
  - `xinghuan-canvas-output-prune.timer` 为 `active` / `enabled`
- `npm run verify:single-port` 在 `http://127.0.0.1:18100` 全部通过。
- `npm run verify:canvas-resource-api` 在 `http://127.0.0.1:18100` 通过，当前生产位 `canvasCount=0`、`imageResourceCount=0`。
- `npm run verify:task-lifecycle` 在 `http://127.0.0.1:18100` 通过，重试任务进入 `running`。
- `npm run verify:worker-output-materials` 在 `http://127.0.0.1:18100` 通过，输出素材已写入 `/files/output/task_output_task-1780733666575-mj87s4_1.png`。
- `npm run cleanup:output-materials:dry-run` 使用 export 后通过，确认读取生产 shared data：`/opt/apps/xinghuan-canvas/shared/data`。
- `sudo nginx -t` 通过。
- `/etc/nginx/sites-enabled/canvas.hhh2121.xyz` 仍不存在，返回 `NGINX_PROD_NOT_ENABLED`。

影响:

- 生产服务已经在服务器本机端口 `18100` 跑通，具备正式切域名前的核心运行条件。
- 公网域名仍未切换，灰度与生产可以并行运行。

风险:

- 生产 env 目前沿用灰度数据库连接作为同一数据底座切换预演；若后续要求生产独立数据库，需要另行开库、迁移和复验。
- 生产 Nginx 站点尚未启用，因此公网生产域名还未完成最终验收。

下一步:

- 启用 production Nginx site 并 reload。
- 验证 `https://canvas.hhh2121.xyz/api/status`、登录、后台、画布和素材 smoke。

### 生产域名切换与 HTTPS smoke

目标:

- 将 `canvas.hhh2121.xyz` 正式接入 production `127.0.0.1:18100`。
- 为生产域名签发 HTTPS 证书，并完成公网 smoke。

变更范围:

- 启用 `/etc/nginx/sites-enabled/canvas.hhh2121.xyz`。
- 使用 certbot 签发并部署 `canvas.hhh2121.xyz` 证书。
- 新增 `ops/production-cutover-2026-06-06.md`。
- 更新 `ops/README.md`、`ops/production-preflight-2026-06-06.md` 和 `MEMORY.md`。

验证证据:

- certbot 成功签发证书：
  - `Certificate Name: canvas.hhh2121.xyz`
  - 到期时间：`2026-09-04 07:19:20+00:00`
  - 证书路径：`/etc/letsencrypt/live/canvas.hhh2121.xyz/fullchain.pem`
- `sudo nginx -t` 通过。
- `https://canvas.hhh2121.xyz/api/status` 返回 `environment=production`。
- 公网 `npm run verify:single-port` 全部通过。
- 公网 `npm run verify:canvas-resource-api` 通过。
- 公网 `npm run verify:task-lifecycle` 通过。
- 公网 `npm run verify:worker-output-materials` 通过。
- `npm run cleanup:output-materials:dry-run` 通过，读取生产 shared data。
- 服务状态：
  - `xinghuan-canvas.service` 为 `active` / `enabled`
  - `xinghuan-canvas-worker.service` 为 `active` / `enabled`
  - `xinghuan-canvas-output-prune.timer` 为 `active` / `enabled`

影响:

- `canvas.hhh2121.xyz` 现在已是星幻无限画布 2.0 的生产入口。
- 灰度 `canvas-next.hhh2121.xyz` 仍保留运行，用于后续灰度。

风险:

- RunningHub 真实工作流验收仍按用户要求暂缓。
- 生产 env 当前沿用灰度数据库连接作为同一数据底座切换；如需生产独立数据库，后续必须单独迁移。

下一步:

- 发布后观察生产服务、Nginx 和 certbot 自动续期状态。
- 准备 bootstrap 密码轮换与独立数据库策略评估。

### RunningHub 真实测试暂缓记录与生产预检基线更新

目标:

- 按用户要求暂停 RunningHub 真实工作流卡片录入、字段展开和预览运行类测试。
- 把最新灰度状态、`verify:single-port` 复验结果和生产预检基线写回文档，转入下一步生产切换准备。

变更范围:

- 更新 `MEMORY.md`、`docs/prd/v0.1.0/progress.md`、`changelog.md`、`release.md`、`decisions.md` 和 `ops/production-preflight-2026-06-06.md`。
- 明确记录“当前只保留 RunningHub 目录/字段映射第一版进入灰度，真实工作流测试暂缓”的决策。
- 将生产预检基线切换到当前灰度 release `20260607-0218-phase3-runninghub-workflow-gray`。

验证证据:

- 本机 `npm run verify:single-port` 已重新通过。
- 灰度 `npm run verify:single-port` 已重新通过。
- 历史 `POST /api/admin/providers` `401` 在本机和灰度复验中均未再复现。
- 灰度 `npm run verify:runninghub-workflow-api` 仍通过，当前返回 `workflowCount=0`、`appCount=0`、`firstWorkflow=null`。

影响:

- RunningHub 第一版链路继续保留在灰度，但当前推进重心不再是补真实工作流卡片，而是先推进生产切换准备中的非 RH 项。
- 旧的 `verify:single-port` `401` 不再作为当前阻塞项，也不为这个已消失的问题做猜测性修复。

风险:

- RunningHub 真实工作流卡片和预览运行验收仍未完成，后续恢复时仍需补真实数据。
- 生产切换仍需继续完成独立 `18100` 运行位、生产环境文件和运维轮换项确认。

下一步:

- 继续推进生产切换准备，并优先收口不依赖 RunningHub 真实卡片的预检项。

### Phase 3 RunningHub 工作流字段映射与画布消费灰度发布

目标:

- 完成 Phase 3 计划表中的 RunningHub 工作流字段映射第一版闭环。
- 让后台不只是保存 RunningHub 工作流卡片标题，而是能持久化工作流 JSON 和字段映射，并让画布 `RunningHubNode` 直接消费这些后台配置。

变更范围:

- `apps/api/src/server.ts`：
  - 扩展 `RunningHubEntry`，新增 `runTargetId`、`workflowJson`、结构化 `fields`。
  - 新增 `normalizeRunningHubFieldDefinitions`、`normalizeOptionalJsonText` 等归一化逻辑。
  - 新增公开接口 `GET /api/runninghub/catalog`，向登录用户返回已启用 RunningHub Provider 下的应用/工作流目录。
- `apps/admin/src/main.tsx`：
  - RunningHub 工作流卡片新增高级编辑器，可编辑 `runTargetId`、工作流 JSON 和字段映射 JSON。
  - 工作流编辑本地带 JSON 合法性校验，避免把非法配置直接保存进后台。
- `apps/web/src/services/runninghubCatalog.ts`：
  - 新增前端 RunningHub 目录服务和 `buildRunningHubAppInfoFromCatalog`，把后台字段映射转成节点可直接使用的 `appInfo.nodeInfoList`。
- `apps/web/src/components/nodes/RunningHubNode.tsx`：
  - 新增“工作流预设”下拉，自动读取后台工作流目录。
  - 选中预设后自动注入 `webappId`、`appInfo`、字段映射和工作流 JSON，不再只能手填再现拉上游。
- `scripts/verify-runninghub-workflow-contract.mjs`：
  - 新增结构级 contract 验证。
- `scripts/verify-runninghub-workflow-api.mjs`：
  - 新增真实接口验收脚本，登录后验证 `/api/runninghub/catalog` 返回形态。
- 灰度发布：
  - 发布 release `20260607-0218-phase3-runninghub-workflow-gray` 到 `/opt/apps/xinghuan-canvas-next/releases/20260607-0218-phase3-runninghub-workflow-gray`。

验证证据:

- 本机：
  - `npm run verify:runninghub-workflow-contract` 通过。
  - `npm run type-check -w @xinghuan/api`、`@xinghuan/admin`、`@xinghuan/web` 全部通过。
  - `npm run build:single-port` 通过。
- 灰度：
  - `readlink /opt/apps/xinghuan-canvas-next/current` 返回 `/opt/apps/xinghuan-canvas-next/releases/20260607-0218-phase3-runninghub-workflow-gray`。
  - `systemctl is-active xinghuan-canvas-next.service`、`xinghuan-canvas-next-worker.service` 均返回 `active`。
  - 灰度 `npm run verify:runninghub-workflow-contract` 通过。
  - 灰度 `npm run verify:runninghub-workflow-api` 通过，当前返回 `workflowCount=0`、`appCount=0`、`firstWorkflow=null`。

影响:

- RunningHub 工作流现在首次具备“后台配置一次，画布节点直接消费”的基础能力。
- 后续再配置真实工作流时，节点侧不需要重新硬编码字段表，只需要消费后台目录即可。

风险:

- 灰度当前没有已启用的 RunningHub 工作流卡片，因此真实“选择预设后自动展开字段”的视觉验收还缺一条真实配置数据。
- 这轮只完成了“字段映射持久化 + 目录消费”；真实预览运行和上游工作流 JSON 拉取仍是下一步。

下一步:

- 在后台录入第一条真实 RunningHub 工作流卡片，补一轮真实节点选择与字段展开验收。
- 继续推进 RunningHub 预览运行与更完整的上游同步。

### Phase 3 画布 / 素材 PostgreSQL repository 灰度热修复

目标:

- 收口 Phase 3 画布 / 素材 PostgreSQL repository 的灰度异常，确认运行态真正使用 PostgreSQL 持久化，而不是只在后台状态页里显示 `storageDriver=postgres`。
- 修复 `/api/canvas` 在灰度首次读取时触发的 PostgreSQL 列名错误，并把这类 schema/query 漏洞纳入自动验收。

变更范围:

- `apps/api/src/server.ts`：修正画布 PostgreSQL repository 对 `xh_canvases` 的列名引用，全部从错误的 `title` 改为现网 schema 实际存在的 `name`，覆盖 `readCanvasList`、`writeCanvasList`、`writeCanvasData` 和 `toCanvasListItem`。
- `scripts/verify-postgres-canvas-resource-contract.mjs`：补强 contract，显式校验 `001_admin_core.sql` 中 `xh_canvases.name` 的定义，并要求 API 侧画布 SQL 读取/写入同样使用 `name`。
- `scripts/verify-canvas-resource-api.mjs`：新增轻量灰度 API 验证脚本，覆盖登录后读取 `/api/canvas`、首个画布详情和 `/api/resources/items?kind=image`。
- `package.json`：新增 `npm run verify:canvas-resource-api`。
- 灰度发布：打包并上传 release `20260607-0115-phase3-canvas-pg-hotfix-gray`，部署到 `/opt/apps/xinghuan-canvas-next/releases/20260607-0115-phase3-canvas-pg-hotfix-gray`，切换 `current` 并重启单端口 API/Worker 服务。

验证证据:

- 根因复现：
  - 灰度登录后请求 `GET /api/canvas` 返回 `500`，错误为 `column "title" does not exist`。
  - 服务器 `information_schema.columns` 确认 `xh_canvases` 列为 `id/owner_id/project_id/name/node_count/data/created_at/updated_at`，不存在 `title`。
  - 同一灰度环境下 `/api/resources/items?kind=image` 可返回 `2` 条资源，说明素材 repository 已在 PostgreSQL 生效，而画布链路被列名错误单独阻断。
- 本机验证：
  - `npm run verify:postgres-canvas-resource-contract` 通过。
  - `npm run type-check -w @xinghuan/api` 通过。
  - `npm run build:single-port` 通过。
  - `node --check scripts/verify-canvas-resource-api.mjs` 通过。
- 灰度验证：
  - `readlink /opt/apps/xinghuan-canvas-next/current` 返回 `/opt/apps/xinghuan-canvas-next/releases/20260607-0115-phase3-canvas-pg-hotfix-gray`。
  - `systemctl is-active xinghuan-canvas-next.service`、`xinghuan-canvas-next-worker.service` 均返回 `active`。
  - 灰度 `npm run verify:canvas-resource-api` 通过，返回 `canvasCount=13`、首个画布 `nodeCount=4`、`edgeCount=2`、`imageResourceCount=2`。
  - 灰度 PostgreSQL 计数变为：`xh_canvases=13`、`xh_assets=2`、`xh_resource_categories=0`。

影响:

- Phase 3 的“画布 / 素材 PostgreSQL repository”现在已在灰度运行态真正打通，不再只是素材能落库、画布却因为列名不一致无法导入。
- 以后若再出现 migration/schema 与 API 查询不一致，contract 和灰度 API 验证都会更早暴露问题，而不是等到后台或真实用户读画布时才发现。

风险:

- 当前灰度资源分类表 `xh_resource_categories` 仍为 `0`，这符合现状，因为还没有真实分类数据；后续若启用分类操作，仍需补一轮分类 CRUD 灰度验收。
- `verify:single-port` 之前在灰度出现的 `POST /api/admin/providers 401` 这轮没有顺带处理，它与本次画布 repository 列名问题是独立问题，需要后续单独收口。

下一步:

- 继续推进 RunningHub 工作流字段映射与预览运行。
- 评估是否把 `verify:canvas-resource-api` 纳入固定灰度验收清单和生产切换前检查。

## 2026-06-06

### Phase 3 素材空间读取闭环与任务生命周期灰度发布

目标:

- 完成素材空间读取闭环，让资源库抽屉打开后能自动看到新生成素材，而不是必须手动重开。
- 把后台任务从“直接翻状态”收口为真实的取消 / 重试语义，并保护 Worker 不覆盖运行中被取消的任务。
- 将这两项一起推上灰度，并用真实队列重新验收。

变更范围:

- `packages/shared/src/index.ts`：新增任务状态共享类型，以及 `canCancelTask` / `canRetryTask` helper。
- `apps/api/src/server.ts`：新增语义化取消接口、`/api/admin/tasks/:id/retry`、任务级定向读写 helper，避免灰度 PostgreSQL 环境继续依赖整库回写。
- `apps/worker/src/worker.ts`：任务领取、成功、失败写回均增加取消态保护；若任务执行过程中被取消，Worker 记录日志并保留 `cancelled` 状态，不再覆写为 `succeeded/failed`。
- `apps/admin/src/main.tsx`：任务页操作按钮改为按状态显示“取消”或“重试”，不再做 `cancelled <-> queued` 状态翻转。
- `apps/web/src/components/ResourceLibraryDrawer.tsx`：资源库抽屉在打开状态下增加静默轮询，配合现有 `penguin:resources-changed` 事件形成素材空间读取闭环。
- 灰度发布：打包当前 worktree，上传并发布 release `20260606-2358-phase3-lifecycle-gray` 到 `/opt/apps/xinghuan-canvas-next/releases/20260606-2358-phase3-lifecycle-gray`。

验证证据:

- 本机 `npm run type-check -w @xinghuan/shared`、`@xinghuan/api`、`@xinghuan/worker`、`@xinghuan/admin`、`@xinghuan/web` 全部通过。
- 本机隔离 API `http://127.0.0.1:18300` 上 `npm run verify:task-lifecycle` 通过，返回 `ok=true`。
- 本机隔离后台 `/admin` 浏览器抽查通过：任务页对排队任务显示“取消”，对已取消任务显示“重试”，并能看到“管理员取消任务”“管理员发起重试”日志。
- 本机 `npm run build:single-port` 通过。
- 灰度 `readlink /opt/apps/xinghuan-canvas-next/current` 返回 `/opt/apps/xinghuan-canvas-next/releases/20260606-2358-phase3-lifecycle-gray`。
- 灰度 `systemctl is-active xinghuan-canvas-next.service` 和 `xinghuan-canvas-next-worker.service` 均返回 `active`。
- 灰度 `npm run verify:task-lifecycle` 通过，返回 `ok=true`；原任务保持 `cancelled`，重试任务已被 Worker 消费进入 `running`。
- 灰度 `npm run verify:worker-output-materials` 通过，返回 `ok=true`、`resourceItemId=res-1780727541745-9nva3d`、`fileUrl=/files/output/task_output_task-1780727541467-w0fpn7_1.png`。
- 灰度 `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment=gray`。

影响:

- Phase 3 的“任务输出进入素材空间”和“素材空间能及时读到新增输出”现在已经闭环，不再需要手动重开抽屉才能看到新素材。
- 灰度后台任务系统现在具备更真实的生命周期语义：取消不会再把运行中任务误改回成功，重试会生成新任务并保留原任务审计线索。

风险:

- 资源库抽屉当前使用 4 秒静默轮询作为第一版闭环，功能已可用，但后续仍可以继续收口为更细粒度的事件推送。
- `verify:task-lifecycle` 在灰度队列可用时，重试任务可能很快从 `queued` 进入 `running`；这符合当前异步系统行为，但后续如果需要固定断言排队态，需要在脚本里额外锁住队列消费窗口。

下一步:

- 继续推进画布 / 素材 PostgreSQL repository。
- 继续推进 RunningHub 工作流字段映射和生产切换准备。

### Phase 3 输出素材落库与自动清理灰度发布

目标:

- 把本地已经完成的“Worker 输出素材落库”和“14 天保守自动清理”一起推到灰度。
- 让项目 CodeGraph 保持已建立且同步到最新状态。
- 用真实灰度环境补做队列联调与清理 dry-run 验收，而不是停留在本机验证。

变更范围:

- CodeGraph：执行 `codegraph status`、`codegraph sync`，确认项目索引可用且已更新。
- 灰度发布：打包当前 worktree，上传并发布 release `20260606-1515-phase3-output-prune-gray` 到 `/opt/apps/xinghuan-canvas-next/releases/20260606-1515-phase3-output-prune-gray`。
- 服务器环境：为 `canvas-next.env` 补入 `XINGHUAN_OUTPUT_MATERIAL_RETENTION_DAYS=14`。
- systemd：安装并启用 `xinghuan-canvas-next-output-prune.service` 与 `xinghuan-canvas-next-output-prune.timer`。
- 验收：执行灰度 `verify:worker-output-materials` 与 `cleanup:output-materials:dry-run`。

验证证据:

- 本机 `codegraph status` 返回 `Index is up to date`。
- 灰度 `readlink /opt/apps/xinghuan-canvas-next/current` 返回 `/opt/apps/xinghuan-canvas-next/releases/20260606-1515-phase3-output-prune-gray`。
- 灰度 `systemctl is-active xinghuan-canvas-next`、`xinghuan-canvas-next-worker`、`xinghuan-canvas-next-output-prune.timer` 均返回 `active`。
- 灰度 `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment=gray`。
- 灰度 `npm run verify:worker-output-materials` 通过，返回 `ok=true`、`taskId=task-1780725769684-pvlouq`、`resourceItemId=res-1780725770036-i16lge`。
- 灰度 `npm run cleanup:output-materials:dry-run` 通过，返回 `ok=true`、`apply=false`、`retentionDays=14`、`deletedItemIds=[]`。
- 灰度 timer 状态显示下一次计划触发时间为 `2026-06-07 04:16 CST`。

影响:

- Phase 3 的两条新能力现在已经不只是本地代码，而是正式进入灰度运行态。
- 灰度环境从今天起具备每日自动回收旧任务输出素材的能力，同时保持保守保护规则。

风险:

- `xinghuan-canvas-next-output-prune.timer` 虽然已经启用，但首轮真实自动执行要等到 `2026-06-07 04:16 CST` 之后才能看到完整运行记录。
- `verify:worker-output-materials` 会在灰度留下 1 条测试任务和 1 条资源记录，用于证明链路真实打通。

下一步:

- 在 `2026-06-07` 首轮自动清理执行后，补一条灰度审计记录。
- 继续推进素材空间读取闭环与取消/重试。

### 输出素材 14 天自动清理脚本与定时器模板

目标:

- 为 Phase 3 新增的输出素材库补一个保守型生命周期清理能力。
- 默认只清理超过 14 天、明确属于任务输出的旧素材，避免误伤收藏、已整理或仍在使用的资产。
- 提前准备好灰度/生产接入 systemd timer 的部署材料。

变更范围:

- `scripts/prune-old-output-materials.mjs`：新增输出素材清理脚本，支持 `dry-run` 和 `--apply`，按用户目录扫描 `resource-library.json`，逐条判断后再逐个文件删除。
- `package.json`：新增 `cleanup:output-materials` 与 `cleanup:output-materials:dry-run`。
- `scripts/verify-output-material-prune.ts`：新增回归验证，覆盖“删除过期任务输出、保留收藏、保留分类、保留最近使用、保留非任务输出、共享文件不误删”。
- `config/canvas-next.env.example`：新增 `XINGHUAN_OUTPUT_MATERIAL_RETENTION_DAYS=14`。
- `ops/systemd/xinghuan-canvas-next-output-prune.service.example`、`ops/systemd/xinghuan-canvas-next-output-prune.timer.example`：新增每日定时清理模板。
- `ops/README.md`：补充新的 systemd 模板索引。

验证证据:

- 红测：`npm run verify:output-material-prune` 首次执行失败，报 `ERR_MODULE_NOT_FOUND`，证明清理脚本尚未实现。
- 绿测：`npm run verify:output-material-prune` 通过，确认过期任务输出会删，收藏/分类/非任务输出会保留，共享文件不会被误删。
- CLI：`npm run cleanup:output-materials:dry-run` 通过，证明命令入口可直接挂到定时器环境。
- 本机 `npm run build:single-port` 通过。

影响:

- 用户目录式资产库现在不仅能积累素材，也具备了可控的自动回收机制。
- 默认策略偏保守，更适合先在灰度和生产跑起来，不会因为定时任务把用户手工保留的素材误删。

风险:

- 当前自动清理只覆盖“任务输出旧素材”，没有触碰手工收藏和其他资源类型；如果后续想扩大范围，需要先再定规则。
- 这轮只交付了脚本和 timer 模板，还没有真正接到灰度服务器的 systemd 定时任务里。

下一步:

- 在灰度服务器接入 `xinghuan-canvas-next-output-prune.timer`，先跑一次 dry-run，再做一次真实 apply 验收。
- 继续推进素材空间读取闭环和取消/重试。

### Phase 3 第一刀: Worker 输出素材落库本地实现

目标:

- 把 Phase 3 从“任务成功只回写 `result`”推进到“任务成功会沉淀出可管理素材”。
- 先完成图像任务的最小纵切：输出转存到用户输出目录、资源库索引可追踪、同任务重复回写不脏重复。
- 在本机缺少 Redis/worker 联调条件时，先补齐可以离线运行的定向验证脚本。

变更范围:

- `apps/worker/src/output-materials.ts`：新增 Worker 输出素材 helper，负责把 data URL/远程图像 materialize 到用户 `/files/output/...`，并把资源项写入 `resource-library.json`。
- `apps/worker/src/worker.ts`：任务成功后新增输出素材落库步骤，回写 `resourceItemIds`、`resourceCount`、`materializedImageUrls` 到任务 `result`，并在日志中记录已写入素材数量。
- `apps/api/src/server.ts`、`apps/web/src/services/api.ts`：扩展资源项结构，补齐 `sourceUrl`、`originalName`、`sourceNodeId`、`sourceCanvasId`、`taskId`、`providerId`、`modelId`。
- `scripts/verify-worker-output-materializer.ts`：新增本地定向验证，覆盖输出文件落地、资源库写入和同任务去重。
- `scripts/verify-worker-output-materials.mjs`：新增联调验证脚本，留给 Redis/worker 可用环境做“任务成功后资源库可见”的真实链路验收。
- `package.json`：新增 `verify:worker-output-materializer`、`verify:worker-output-materials`。

验证证据:

- 红测 1：`npm run verify:worker-output-materializer` 初次执行失败，报 `ERR_MODULE_NOT_FOUND`，证明落库 helper 尚未实现。
- 红测 2：`npm run verify:worker-output-materials` 在本机 `18200` 上失败，任务长期停留 `queued`；随后确认本机 `verify:worker` 同样因为 `redis is not connected` 不能作为联调环境。
- 绿测：`npm run verify:worker-output-materializer` 通过，确认 data URL 输出已落到用户输出目录、资源库生成 1 条记录，且同任务重复写入仍保持 1 条。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/worker` 通过。
- 本机 `npm run build -w @xinghuan/worker` 通过。
- 本机 `npm run build:single-port` 通过。

影响:

- Phase 3 已经不再停留在“讨论方案”，而是落下了第一段真正可运行的输出素材闭环。
- 后续素材空间/API 只要读取现有资源库，就能看到这批由 Worker 成功任务沉淀出的图像素材。
- 同一任务重复回写会按 `taskId` 去重，避免后续补偿写入把资源库刷脏。

风险:

- 当前只完成了图像任务这条最小纵切，视频/音频结果 materialize 还没接上。
- 本机 `18200` 没有 Redis/worker 联调条件，所以这轮不能把“队列消费 + 资源库可见”作为本地端到端凭据。
- 资源库和素材索引仍是 file-based；真正的 PostgreSQL repository 推进还在后面。

下一步:

- 把这批改动推到灰度，运行 `verify-worker-output-materials.mjs` 做真实队列联调。
- 补素材空间读取联动，确认资源抽屉能稳定展示这批新输出。
- 继续推进取消/重试和素材索引 PostgreSQL repository。

### Phase 2 收口补充、灰度凭据对齐与 Phase 3 计划重排

目标:

- 把 Phase 2 最后几项“看起来已完成但文档和环境还没完全收口”的事项补平。
- 修复输出素材节点单图/单视频预览高度不收口的问题。
- 将灰度管理员密码重新对齐到服务器 bootstrap 环境，避免灰度凭据继续漂移。
- 按实际状态重写 Phase 3 计划，明确后续先做任务输出素材闭环，再谈生产切换。

变更范围:

- `apps/admin/src/main.tsx`、`apps/admin/src/styles.css`：后台模型高级设置新增说明卡片和 schema 示例，明确 Provider 协议、参数 schema 与 `inputProfile` 的职责边界。
- `apps/web/src/components/nodes/OutputNode.tsx`：输出素材节点单图/单视频根据真实媒体宽高比重新计算预览框和节点高度，不再继承历史固定高。
- `apps/web/src/components/nodes/outputPreviewLayout.ts`：抽出输出预览高度计算逻辑，供脚本回归验证。
- `scripts/verify-output-node-preview-layout.mjs`：新增输出节点预览布局回归，覆盖单张竖图、单条横视频和多图网格。
- `scripts/align-gray-admin-password.py`：新增灰度管理员密码对齐脚本，通过服务器环境中的 bootstrap 管理员密码重写 PostgreSQL 中的管理员密码哈希。
- `docs/prd/README.md`、`docs/prd/v0.1.0/plan.md`、`progress.md`、`release.md`、`changelog.md`、`decisions.md`、`ops/production-preflight-2026-06-06.md`：按实际状态收口并把计划切换到 Phase 3。

验证证据:

- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build -w @xinghuan/admin` 通过。
- 本机 `npm run type-check -w @xinghuan/web` 通过。
- 本机 `npm run build -w @xinghuan/web` 通过。
- 本机 `npx tsx scripts/verify-output-node-preview-layout.mjs` 通过。
- 本机 `npm run build:single-port` 通过。
- 灰度 release `20260606-1150-admin-schema-gray` 已部署。
- 灰度 release `20260606-1217-output-preview-layout-gray` 已部署。
- `readlink /opt/apps/xinghuan-canvas-next/current` 返回 `20260606-1217-output-preview-layout-gray`。
- `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment=gray`。
- 通过 `scripts/align-gray-admin-password.py` 将灰度管理员密码重新对齐到服务器 `canvas-next.env` 中的 bootstrap 管理员密码。
- 服务器本地使用 bootstrap 管理员邮箱/密码登录 `/api/auth/login` 成功。

影响:

- Phase 2 现在不仅“功能上可用”，而且灰度说明、输出节点 UI、运维基线和计划文档都重新对齐到了同一状态。
- 输出素材节点在单张长图/横视频场景下，不再出现两侧黑边正常但下方整块空面板被撑开的体验问题。
- 后续 Phase 3 的优先级被明确为“任务结果沉淀为素材资产”，而不是继续提前讨论生产切换。

风险:

- 灰度管理员密码虽然已经与环境对齐，但生产前仍需要独立的正式密码轮换策略，不能长期停留在 bootstrap 口令模式。
- 输出素材节点预览问题已修复，但更大的 Phase 3 风险仍在于结果落库、素材空间联动、取消/重试和 repository 切换尚未完成。

下一步:

- 按修订后的 Phase 3 计划，优先实现 Worker 输出写入输出素材与资源库。
- 再补任务取消/重试和素材空间读取闭环。

### GRSAI Worker 异步链路补齐、灰度双链路验收与测试清理

目标:

- 将 `grsai_draw` 从同步图像代理继续下沉到 Worker 图像 Adapter。
- 把 GRSAI 的同步/异步灰度验收固化成可复用脚本，不再依赖人工点页面。
- 清理灰度环境里残留的 `verify-*` 和 `phase2-*` 测试 Provider、任务记录。

变更范围:

- `apps/worker/src/worker.ts`：新增 `grsai_draw` 协议识别、GRSAI Draw 提交与轮询逻辑，Worker 结果新增 `adapter: "grsai-image"`、`taskId`、`remoteImageUrls`。
- `scripts/verify-worker-grsai-contract.mjs`：新增 Worker `grsai_draw` 合约回归，覆盖协议识别、分支路由和上下游接口常量。
- `scripts/verify-worker-grsai-image-adapter.mjs`：新增 Worker + mock GRSAI 上游端到端验收，覆盖任务入队、提交 draw、轮询结果和 result 回写。
- `scripts/verify-grsai-draw-gray.mjs`：新增灰度真实双链路验收，自动登录后台、定位已启用 GRSAI Provider/模型，分别验证同步代理和异步 Worker。
- `package.json`：新增 `verify:grsai-draw`、`verify:grsai-draw-gray`、`verify:worker-grsai-contract`、`verify:worker-grsai-image-adapter`。

验证证据:

- 红绿测试：本机 `npm run verify:worker-grsai-contract` 先 FAIL 后 PASS。
- 本机 `npm run verify:grsai-draw` 通过。
- 本机 `npm run type-check -w @xinghuan/worker` 通过。
- 本机 `npm run build -w @xinghuan/worker` 通过。
- 本机 `npm run build:single-port` 通过。
- 新灰度 release：`20260606-2335-grsai-worker-gray`。
- 服务器 `npm ci`、`npm run build:single-port` 通过。
- `readlink /opt/apps/xinghuan-canvas-next/current` 指向 `20260606-2335-grsai-worker-gray`。
- `systemctl is-active xinghuan-canvas-next.service` 和 `xinghuan-canvas-next-worker.service` 均为 `active`。
- 服务器 `npm run verify:grsai-draw-gray` 通过：同步 `/api/proxy/external/image` 和异步 `/api/admin/tasks` + Worker 均成功。
- 服务器 `npm run verify:worker-grsai-image-adapter` 通过：mock 上游任务最终 `succeeded`，结果适配器为 `grsai-image`。
- `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment=gray`。
- 灰度清理后 PostgreSQL 中 `verify-*`、`phase2-*` 测试 Provider 为 0 条，新增两条 GRSAI 验收任务也已删除。

影响:

- GRSAI 现在同时具备同步代理链路和 Worker 异步任务链路，后台任务中心可以统一承载这类图像任务。
- 灰度环境现在有“本机无依赖回归 + 服务器真实双链路验收”两层脚本，后续发版前可直接复跑。
- 测试 Provider 与临时验收任务已清理，后台配置更干净。

风险:

- `verify:grsai-draw-gray` 依赖灰度环境中已有已启用的 GRSAI Provider/模型；如果后台配置被改名或禁用，脚本会失败。
- Worker 目前已补齐 GRSAI 图像任务，但输出素材落库、资源库联动、取消/重试策略仍属于 Phase 3。

下一步:

- 准备生产域名切换前的预检清单，但不在未确认前直接切生产。
- 继续推进任务输出素材落库和资源库联动。

### GRSAI Draw 协议补齐与灰度真实生图复验

目标:

- 让当前 2.0 灰度环境重新具备 GRSAI `gpt-image-2` 真实文生图能力。
- 补齐当前 API 缺失的 `grsai_draw` 协议支持，避免把 GRSAI 误当 OpenAI 兼容接口调用。
- 在灰度服务器上完成一次新的真实图像生成与本地落盘验收。

变更范围:

- `apps/api/src/grsai-image-adapter.ts`：新增 GRSAI Draw 图像客户端，支持 `/v1/draw/completions` 提交、`/v1/draw/result` 轮询和成功结果解析。
- `apps/api/src/server.ts`：`/api/proxy/external/image` 新增 `grsai_draw` 协议分支；Provider probe/fetch-models 增加 GRSAI Draw 手动模型目录逻辑；Provider 协议枚举补齐。
- `packages/model-core/src/index.ts`：Provider 协议枚举新增 `grsai_draw`。
- `apps/admin/src/main.tsx`：后台 Provider 协议下拉和模型协议覆盖下拉新增 `GRSAI Draw`。
- `scripts/verify-grsai-image-adapter.ts`：新增 GRSAI Draw 协议红绿测试，覆盖“提交后轮询”和“上游立即成功”两种响应形态。

验证证据:

- 本机 `npx tsx scripts/verify-grsai-image-adapter.ts` 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机真实 GRSAI smoke 通过：`createGrsaiImageClient` 调 `https://grsai.dakka.com.cn` 成功返回 1 张图像 URL。
- 新灰度 release：`20260606-2140-grsai-draw-gray`。
- 服务器 `npm ci`、`npm run build:single-port` 通过。
- `systemctl is-active xinghuan-canvas-next.service` 和 `xinghuan-canvas-next-worker.service` 均为 `active`。
- 灰度公网真实图像代理复验通过：`/api/proxy/external/image` 使用 `grsai_draw` + `gpt-image-2` 成功生成本地文件 `/files/output/external_image_1780715075124_joztk5.png`，`GET` 返回 `200 image/png`，文件大小 `2254013` bytes。

影响:

- 当前 2.0 灰度环境已重新具备 GRSAI `gpt-image-2` 真实图像生成能力。
- GRSAI 不再被错误地走 OpenAI 兼容图像接口，后续后台和画布都可直接复用统一协议。
- 灰度后台当前已将 `grsai` Provider 调整为 `https://grsai.dakka.com.cn` + `grsai_draw`，模型 `grsai-gpt-image-2` 已启用并覆盖同协议。

风险:

- GRSAI 上游模型集合仍采用手动目录方式；当前 `probe/fetch-models` 不做自动发现，只固定提供 `gpt-image-2` 入口。

下一步:

- 若继续做用户侧可视验收，可在公网后台确认 Provider 协议显示为 `GRSAI Draw`，再从画布图像节点手点一次真实生成。
- 将本次灰度复验结论同步到进度与变更记录。

### Phase 2 通用节点与服务器灰度验收收口

目标:

- 完成 Phase 2 节点与模型治理闭环。
- 确认图像、视频、LLM 三类通用节点都从后台 Provider/Model 目录读取模型。
- 确认后台模型 schema 变化会驱动画布节点参数和参考图上限动态变化。
- 在灰度服务器和公网画布上完成真实连通、视觉和操控验收。

变更范围:

- `apps/api/src/server.ts`：补齐 `/api/proxy/external/llm`、`/api/proxy/external/video`，并修复任务入队后全库写回覆盖 Worker 状态的竞态。
- `apps/worker/src/worker.ts`：补充任务领取和执行日志，便于定位队列问题。
- `apps/web/src/components/nodes/ImageNode.tsx`、`VideoNode.tsx`、`LLMNode.tsx`：三类通用节点接入后台模型目录；图像/视频节点根据模型 schema 渲染比例、尺寸、时长、分辨率和参考图上限；schema 更新后自动归一化旧参数。
- `apps/admin/src/main.tsx`、`apps/admin/src/styles.css`：后台模型行增加高级设置，可编辑显示名、模型 ID、能力分类、协议覆盖、输入 Profile 和参数 Schema JSON。
- 新增/升级 `verify:external-chat-proxy`、`verify:external-video-proxy`、`verify:generic-node-catalog`、`verify:model-catalog` 等自动验收脚本。

验证证据:

- 本机 `npm run type-check -w @xinghuan/web`、`npm run type-check -w @xinghuan/admin`、`npm run build:single-port` 通过。
- 本机 `verify:model-catalog` 通过，覆盖模型 `inputProfile` 和 `parameterSchema` 编辑后 `/api/models` 动态 UI 元数据同步。
- 灰度 release：`20260606-0945-phase2-complete-gray`。
- 灰度服务器完整自动验收通过：`verify:single-port`、`verify:model-catalog`、`verify:external-image-proxy`、`verify:external-chat-proxy`、`verify:external-video-proxy`、`verify:generic-node-catalog`、`verify:task-payload-api`、`verify:worker-adapter-contract`、`verify:worker-image-adapter`、`verify:worker`。
- 公网 `https://canvas-next.hhh2121.xyz/` 真实画布验收通过：文本节点连接图像、视频、LLM；图像输出 `/files/output/external_image_...png`，视频输出 `/files/output/external_video_...mp4`，LLM 返回 `Phase 2 LLM 节点连通成功`。
- 公网后台模型高级设置验收通过：保存新图像 schema 后，画布图像节点显示 `3:4`、`800x1200`、`prompt,image_reference,multi_image`、`图像 (0/5)`，再次点击生成成功且控制台 0 error。
- 视觉截图：`output/playwright/phase2-gray-model-advanced-editor.png`、`output/playwright/phase2-gray-dynamic-schema-after-admin-edit.png`、`output/playwright/phase2-gray-public-after.png`、`output/playwright/phase2-gray-admin-api-narrow.png`。

影响:

- Phase 2 的后台 Provider/模型、选择导入、三类模型目录、通用节点消费、真实代理调用、Worker 图像 Adapter 和服务器灰度验收已经形成闭环。
- 画布前端不再暴露服务商设置入口，模型治理集中在统一后台。
- 真实 Key 仍只在服务器环境文件或后台加密字段中保存，前端和文档不记录明文。

风险:

- 当前真实同步代理覆盖 OpenAI 兼容、APIMart、自定义协议路径；RunningHub 工作流字段映射、预览运行和更多厂商专用 Adapter 后续继续补。
- 输出文件已经生成到 `/files/output` 并能在输出素材节点下载，但画布内容和素材资源库的完整 PostgreSQL repository 迁移仍属于后续阶段。
- Web 包仍有大 chunk 警告，需后续继续分包优化。

下一步:

- 进入 Phase 3：任务取消/重试、输出素材资源库联动、画布/素材 PostgreSQL repository、生产域名切换准备。

### Phase 2 通用图像节点接入后台模型目录

目标:

- 让画布通用图像节点不再只依赖本地/T8 内置模型，而是读取后台已启用 Provider/Model。
- 图像节点的模型、比例、尺寸和参考图上限根据后台模型 schema 动态变化。
- 补齐 `/api/proxy/external/image`，让后台模型可通过后端代理生成并转存输出文件。

变更范围:

- `packages/model-core/src/index.ts`：统一模型能力为 `chat/image/video`，新增 Provider 协议和图像/视频参数 schema 默认合并逻辑。
- `apps/api/src/server.ts`：新增登录保护的 `/api/models` 成员可见模型目录；新增 `/api/proxy/external/image`，从后台 Provider 取 Key、调用 OpenAI 兼容图像接口、解析 URL/base64 返回并转存到 `/files/output/`。
- `apps/web/src/services/api.ts`、`apps/web/src/stores/modelCatalog.ts`、`apps/web/src/App.tsx`：新增模型目录客户端和登录后预加载。
- `apps/web/src/components/nodes/ImageNode.tsx`：新增“后台模型”选择区；后台模型选中时展示动态比例/尺寸，并隐藏本地模型/MJ 专属参数面板。
- `scripts/verify-model-catalog.mjs`：升级为临时创建 Provider/Model 后验证模型目录，确保至少存在图像模型、动态 UI 元数据和无 Key 泄漏。
- `scripts/verify-external-image-proxy.mjs`：新增 mock OpenAI 兼容上游，验证后端图像代理会转发模型、prompt 和授权头，并保存本地输出图像。

验证证据:

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过。
- `npm run verify:model-catalog` 通过，覆盖临时 Provider/Model、图像模型目录、动态参数和无密钥泄漏。
- `npm run verify:external-image-proxy` 通过，mock 上游返回 base64 图片后成功转存为 `/files/output/...`。
- Chrome headless 动态 UI smoke 通过：截图 `output/playwright/phase2-canvas-ui-dynamic-model-clean.png`；确认图像节点显示“后台模型”、服务商名、比例、尺寸，且后台模型模式下不再显示 Midjourney 专属面板；控制台无 error。
- 本机 `npm run verify:worker` 当前未通过，原因是本地 Redis 未连接；worker 真实 Provider Adapter 仍未完成。

影响:

- 后台模型目录已经成为画布通用图像节点的可消费来源。
- 前端不再接触 Provider API Key，图像生成走后端代理。
- 后台模型模式的参数展示开始由模型 schema 驱动，为后续语言/视频通用节点复用同一目录奠定基础。

风险:

- 当前图像代理第一版支持 `openai/apimart/custom` 兼容协议；RunningHub、Gemini、ModelScope 专用生成 Adapter 仍需继续补。
- 参考图在部分 OpenAI 兼容服务商中可能需要 `/images/edits` 或厂商专用字段，当前第一版优先保证文生图和兼容 JSON 路径。
- Worker 仍是 mock 执行，任务 payload/result 和真实 Provider Adapter 需要进入下一段实现与灰度 Redis/PostgreSQL 验收。

下一步:

- 扩展 Worker 读取 `payload/result`，并接入 Provider Adapter。
- 在灰度服务器执行模型目录、外部图像代理、动态 UI 和 worker 队列 smoke。
- 更新 release/验收清单后再切灰度 release。

### Phase 2 Worker 图像 Adapter 接入

目标:

- 让后台任务不再只有 mock 执行路径。
- 让任务表的 `payload/result` 被 API 和 Worker 真实读写。
- Worker 可以读取 Provider/Model/Key，按图像任务调用 OpenAI 兼容图像接口并回写结果。

变更范围:

- `apps/api/src/server.ts`：`AdminTaskRecord` 新增 `payload` 和 `result`；后台创建/更新任务支持写入 payload/result；PostgreSQL repository 读写 `xh_tasks.payload` 和 `xh_tasks.result`。
- `apps/worker/src/worker.ts`：移除 `executeMockTask` 调用；读取任务、Provider、Model、payload 和加密 Key；新增图像 Adapter，支持 `openai/apimart/custom` 协议的 `/images/generations`；结果回写 `imageUrls`、`remoteImageUrls`、`imageCount` 和完成时间。
- `scripts/verify-worker-adapter-contract.mjs`：新增 Worker Adapter 合约验证，防止回退到 mock。
- `scripts/verify-task-payload-api.mjs`：新增不依赖 Redis 的任务 payload/result API 验证。

验证证据:

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/worker` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/worker` 通过。
- `npm run verify:worker-adapter-contract` 通过。
- `npm run verify:task-payload-api` 通过，创建带 payload/result 的 cancelled 任务后可读回完整字段，测试数据已恢复。
- `npm run verify:external-image-proxy` 顺序复跑通过。
- `npm run verify:worker` 本机仍未通过，原因是本地 Redis 未连接；需要灰度服务器端到端复验。

影响:

- 后台任务已经具备承载真实节点执行参数的结构。
- Worker 第一版真实图像 Adapter 已落地，后续可以把画布异步生成任务接入同一队列。
- 无 Provider/Model 的旧后台健康检查任务仍可 no-op 成功，避免破坏现有 worker 队列验收语义。

风险:

- 本机没有 Redis/PostgreSQL 队列环境，尚未完成 worker 端到端运行验收。
- Worker 图像 Adapter 当前只回写任务 result，尚未把输出自动写入素材资源库。
- 专用协议 Provider 仍需后续接入独立 adapter。

下一步:

- 灰度部署后执行 `npm run verify:worker` 和一条带真实/Mock Provider 的图像任务端到端验收。
- 将 Worker 输出写入资源库和画布可消费素材。

## 2026-06-05

### 后台 API 设置按 Infinite-Canvas 重做

目标:

- 将当前粗表格式 Provider/模型后台重做为参考 `D:\AI canvas\Infinite-Canvas` 的 API 设置体验。
- 合并 Provider 和模型两个后台 Tab，形成统一 `API 设置` 模块。
- 实现服务商验证、模型拉取、选择性导入和语言/图像/视频三类模型管理闭环。

变更范围:

- `apps/admin/src/main.tsx`：新增参考式 API 设置页面，包含左侧平台列表、右侧 Provider 编辑器、拉取模型、选择模型弹窗和三类模型列表。
- `apps/admin/src/styles.css`：新增科技风后台 API 设置样式，贴近参考项目的信息结构和交互层级，同时保持与其他后台区域一致的深色视觉语言。
- `apps/api/src/server.ts`：Provider 增加 `protocol`、探测状态、最近拉取时间；模型能力统一为 `chat/image/video`；新增 Provider probe、fetch-models、import-models、delete Provider、delete Model 接口。
- `apps/api/db/002_provider_model_framework.sql`：新增 Provider/模型框架迁移，补齐 `protocol`、探测字段、`protocol_override` 和三类模型约束。
- 修正模型拉取交互：拉取时携带当前表单内尚未保存的 Base URL、API Key 和协议；选择模型弹窗只展示本次真实拉取结果，不再把已有预设模型混入拉取结果。

验证证据:

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run build:single-port` 通过。
- 临时 `127.0.0.1:18221` 执行 `npm run verify:single-port` 全部 PASS。
- 新 Provider 接口烟测通过：`/api/admin/providers` 返回 `protocol`；草稿 `/probe` 和 `/fetch-models` 返回稳定结构。
- 空 Key/拉取失败烟测通过：`/api/admin/providers/grsai/fetch-models` 返回 `ok=false`、`modelCount=0` 和空模型列表，不会打开包含预设模型的选择器。
- 修复“拉取模型点击后无响应”的可感知反馈问题：模型列表卡片内新增拉取状态/失败原因提示，拉取中按钮显示 spinner 并禁用，选择模型按钮在拉取中或无结果时禁用。
- 已启动新版本机单端口服务 `127.0.0.1:18200`，供当前浏览器刷新检查。

影响:

- 后台不再把 Provider 和模型割裂为两个粗表格。
- 拉取模型不会自动导入，必须经过选择器勾选。
- 拉取失败或没有上游模型时不会伪装成已有模型列表，管理员能明确区分“已配置模型”和“本次上游拉取结果”。
- 管理员在当前模型列表卡片视口内即可看到“正在拉取 / 缺 Key / 无模型 / 已拉取数量”等反馈。
- 模型目录按照 `chat`、`image`、`video` 维护，为后续通用节点和 Worker Adapter 打基础。

风险:

- RunningHub 和 ModelScope LoRA 的高级配置已进入第一版；火山方舟高级配置按用户要求暂不加入。
- PostgreSQL 环境部署前需要执行 `npm run db:migrate` 应用 `002_provider_model_framework.sql`。

下一步:

- 做浏览器视觉验收和小屏检查。
- 继续补 RunningHub/火山/ModelScope 高级配置细节。
- 将画布通用节点的模型下拉切到后台发布模型。

### RunningHub 和 ModelScope 高级配置加入后台

目标:

- 按用户要求跳过火山方舟高级配置。
- 将 `D:\AI canvas\Infinite-Canvas` 中的 RunningHub 应用/工作流与 ModelScope LoRA 管理能力加入统一后台。

变更范围:

- `apps/api/src/server.ts`：Provider 增加 `rhApps`、`rhWorkflows`、`msLoras` 字段，读写时统一规范化。
- `apps/api/db/002_provider_model_framework.sql`：新增 `rh_apps`、`rh_workflows`、`ms_loras` JSONB 字段。
- `apps/admin/src/main.tsx`：RunningHub Provider 显示应用/工作流配置面板，支持粘贴 `/run/ai-app/...` 或 `/run/workflow/...` 创建卡片、编辑标题/备注、启停和删除；ModelScope Provider 显示 LoRA 面板，支持新增、目标模型、强度、启停和删除。
- `apps/admin/src/styles.css`：补充 RunningHub 和 LoRA 面板样式。

验证证据:

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/admin` 通过。
- `npm run build:single-port` 通过。
- 本机 `127.0.0.1:18200` 已重启到最新构建。
- RH/LoRA 字段保存烟测通过，创建临时 Provider 后已删除，并恢复测试数据文件。

影响:

- 后台 API 设置开始覆盖参考项目中除火山外的高级服务商配置。
- RunningHub 和 ModelScope LoRA 目前完成的是配置管理层，后续还需接入真实节点消费和 RunningHub 工作流参数图形编辑。

风险:

- RunningHub 工作流字段映射、工作流 JSON 拉取和预览运行尚未迁入。
- LoRA 配置已可保存，但画布图像节点仍需后续切到后台发布模型和 LoRA 目录。

下一步:

- 将画布通用节点模型/LoRA 来源切到后台目录。
- 继续迁入 RunningHub 工作流字段映射和应用参数编辑。

### 后台 Provider/模型框架重设与画布入口收口

目标:

- 根据新的后台模型服务商需求，校正当前文档和执行计划。
- 移除画布前端的 API/服务商设置入口，服务商配置后续只保留在统一后台。
- 参考 `D:\AI canvas\Infinite-Canvas` 的 Provider 和模型拉取实现，重设星幻后台模型框架。

变更范围:

- 更新 `apps/web/src/App.tsx`，移除画布顶部 `API 设置` 齿轮按钮和 `ApiSettingsModal` 挂载。
- 新增 `docs/prd/v0.1.0/provider-model-framework.md`。
- 更新 `docs/prd/v0.1.0/plan.md`，将 Phase 2 拆为后台 Provider/模型治理任务级计划。
- 更新 `docs/prd/v0.1.0/progress.md`，校正 Phase 1 完成状态，并移除 Redis/worker 仍待办的矛盾记录。
- 更新 `docs/prd/v0.1.0/release.md` 和 `docs/prd/README.md`，同步当前灰度验收状态。

验证证据:

- 静态检索确认画布 API 设置入口集中在 `apps/web/src/App.tsx`，本次已移除。
- 参考项目确认可复用的核心模式：Provider CRUD、Key/Base URL 验证、上游模型拉取、语言/图像/视频三类分类、拉取后选择导入、模型手工维护。
- 本轮代码和文档不记录真实 API Key、Token、Cookie 或数据库密码。

影响:

- 画布前端不再承担服务商配置职责。
- 后台 Provider/模型框架从简单表格升级为可执行的服务商管理、模型拉取、选择导入和三类模型目录方案。

风险:

- 当前后台代码仍未完整实现新的 Provider 拉取模型和选择导入交互，需要作为 Phase 2 的下一组开发任务推进。
- 迁移期仍保留旧 T8 API settings store 加载，避免现有节点兼容逻辑突然失效；后续画布模型消费接口完成后再彻底清理。

下一步:

- 扩展 Provider schema 和 API。
- 实现后台 Provider 验证地址、拉取模型和模型选择器。
- 将通用节点模型来源切换到后台已启用模型目录。

### 代码同步到灰度服务器完成

目标:

- 将本地代码通过 SSH 同步到灰度服务器。
- 验证服务正常运行。

变更范围:

- 创建 release `20260605-1506-xinghuan-mimo-sync`。
- 同步代码到 `/opt/apps/xinghuan-canvas-next/releases/20260605-1506-xinghuan-mimo-sync/`。
- 执行 `npm ci`，0 vulnerabilities。
- 执行 `npm run build:single-port`，构建成功。
- 切换 `current` 符号链接到新 release。
- 重启 `xinghuan-canvas-next.service` 和 `xinghuan-canvas-next-worker.service`。

验证证据:

- `curl -s https://canvas-next.hhh2121.xyz/` 返回 HTTP 200。
- `curl -s https://canvas-next.hhh2121.xyz/api/status` 返回 `service=xinghuan-api`、`environment=gray`。
- 管理员登录成功，`/api/admin/system` 返回 `storageDriver=postgres`、`databaseStatus=connected`、`redisStatus=connected`。
- `xinghuan-canvas-next.service` 和 `xinghuan-canvas-next-worker.service` 均为 `active`。

影响:

- 灰度服务器已更新到最新代码。
- 项目状态文档和服务器信息已同步。

风险:

- 验收脚本因环境变量传递问题未完全通过，但核心功能已验证。

下一步:

- 实现 Provider Adapter。

### 服务器信息同步到项目文件夹

目标:

- 将 `D:\codex\服务器` 中的服务器连接信息和基础设施状态同步到无限画布 2.0 项目。
- 确保项目文件夹包含完整的运维参考信息，便于后续部署和调试。

变更范围:

- 新增 `ops/server-connection.md`，包含：
  - SSH 连接方式和安全配置
  - 本地路由修复（代理绕过）
  - 域名与端口映射
  - 灰度基础设施服务清单
  - 部署目录结构
  - 数据库和 Redis 配置
  - 密钥管理策略
  - 常用运维命令
- 更新 `MEMORY.md` 服务器记忆：
  - 补充 SSH 密钥位置
  - 补充 DNS 和 HTTPS 证书信息
  - 补充内部代理服务说明
  - 补充部署目录结构
  - 补充密钥管理详情
  - 添加 `ops/server-connection.md` 引用

验证证据:

- `ops/server-connection.md` 已创建。
- `MEMORY.md` 服务器记忆已更新。
- 未包含真实密钥或密码。

影响:

- 项目文件夹现在包含完整的服务器运维参考。
- 后续部署和调试可以直接参考 `ops/server-connection.md`。

风险:

- 本机 `.env.local` 包含真实测试 Key，已确认被 `.gitignore` 忽略。

下一步:

- 推送代码到服务器进行同步和测试。
- 实现 Provider Adapter。

### Mimo 代码补全提交与 Web 分包优化

目标:

- 补全未入库的核心代码，消除代码丢失风险。
- 优化 Web 构建分包策略，解决大 chunk 警告。
- 分析项目风险并给出处理方案。

变更范围:

- 更新 `.gitignore`，新增 `output/` 和 `releases/` 排除规则。
- 分 9 个提交将 apps/、packages/、scripts/、ops/、config/、development/ 全部代码入库：
  - `56cb7bd` feat: add monorepo root config and shared packages
  - `4aa9c4a` feat: add web workspace with canvas UI
  - `5f9d6b7` feat: add api workspace with PostgreSQL and Redis
  - `af8e351` feat: add admin dashboard and worker consumer
  - `bc613b5` feat: add deployment scripts and config templates
  - `60505d3` docs: add ops deployment records and runbooks
  - `81efdfa` docs: add development baseline and migration notes
  - `df3388a` docs: update progress, changelog and release records
  - `882480b` perf(web): add manual chunks for vendor splitting
- `apps/web/vite.config.ts` 新增 `build.rollupOptions.output.manualChunks`：
  - vendor-react: React/ReactDOM
  - vendor-flow: @xyflow/react
  - vendor-mediapipe: @mediapipe/tasks-vision
  - vendor-icons: lucide-react
  - chunkSizeWarningLimit: 600KB
- 更新 `AGENTS.md` 当前状态为 Phase 1 完成。
- 更新 `MEMORY.md` 当前阶段、已完成能力和服务器基础设施状态。
- 更新 `DEVLOG.md` 补充本条记录。

验证证据:

- `git status` 显示 clean，所有代码已入库。
- `git log --oneline -9` 显示 9 个新提交，均包含 `[mimo-init]` 或 `[mimo-perf]` 标记。
- `npm run type-check -w @xinghuan/web` 通过。
- `.gitignore` 已排除 `output/` 和 `releases/`。

影响:

- 项目代码安全性大幅提升，不再依赖单机本地存储。
- Web 首屏加载性能将改善，vendor 分包可独立缓存。
- 项目状态文档已同步到最新进展。

风险:

- Provider Adapter 尚未实现，worker 仍为 mock 执行器。
- 画布/素材元数据尚未切 PostgreSQL repository。

下一步:

- 实现 GRSAI Provider Adapter（P0 图像验收）。
- Worker 接入真实 Provider 调用。
- 任务输出素材落库。

### PostgreSQL readiness 灰度部署完成

目标:

- 为统一后台补齐 PostgreSQL 表结构和迁移入口。
- 在后台系统页展示数据库配置、连接和迁移状态。
- 将数据库 readiness 部署到灰度环境，但不在 PostgreSQL 尚未启用时强制切换数据源。

变更范围:

- 新增 `apps/api/db/001_admin_core.sql`，覆盖用户、会话、项目、画布、素材、Provider、模型、任务、审计和迁移表。
- 新增 `scripts/db-migrate.mjs` 和根脚本 `npm run db:migrate`。
- `apps/api` 新增数据库状态探测，`/api/admin/system` 返回 `database` 状态对象。
- `apps/admin` 系统页新增数据库状态、迁移状态和错误展示。
- `scripts/verify-single-port.mjs` 覆盖后台系统数据库状态字段。
- `config` 模板预留 `XINGHUAN_DATABASE_URL`。
- 新增运维记录 `ops/gray-db-readiness-2026-06-05.md`。

验证证据:

- 本机 `node --check scripts\db-migrate.mjs` 通过。
- 本机 `node --check scripts\verify-single-port.mjs` 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机未配置数据库时 `npm run db:migrate` 返回 `DATABASE_NOT_CONFIGURED`，退出码 2，符合预期。
- 本机 `npm run verify:single-port` 通过。
- 本机后台系统页可见 `数据库状态 not_configured`。
- 服务器 release `20260605-1315-xinghuan-db-ready-gray` 已部署。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- 服务器 `npm run verify:single-port` 通过。
- 服务器未配置数据库时 `npm run db:migrate` 返回 `DATABASE_NOT_CONFIGURED`，退出码 2，符合预期。
- 公网 `/api/status` 返回 `service=xinghuan-api`、`environment=gray`。
- 公网 `/api/admin/system` 未登录返回 401。
- 管理员登录后 `/api/admin/system` 返回 `databaseStatus=not_configured`、`databaseConfigured=false`、`migrations=0`。

影响:

- 后台已经具备数据库接入前的可观测状态。
- 迁移脚本已经可以作为 PostgreSQL 启用后的标准入口。
- 当前仍保持文件型运行数据，不影响灰度服务连续性。

风险:

- 灰度服务器 PostgreSQL 当前尚未配置连接，因此还没有真实落库。
- 后续切库需要数据迁移策略，不能直接丢弃现有文件型 auth/admin/canvas 数据。
- 数据库连接串属于密钥，不能写入文档、Git 或聊天。

下一步:

- 启用 PostgreSQL 服务、创建灰度数据库和最小权限账号。
- 写入服务器环境变量后执行 `npm run db:migrate`。
- 实现 repository 层和文件数据迁移/切换策略。
- 接入 Redis/worker 任务队列。

### PostgreSQL 灰度启用和首轮迁移完成

目标:

- 在灰度服务器启用 PostgreSQL。
- 创建灰度数据库和专用应用账号。
- 将数据库连接串写入服务器环境文件。
- 执行首轮 schema migration。

变更范围:

- 服务器安装 PostgreSQL 16.14。
- PostgreSQL 仅监听 `127.0.0.1:5432`。
- 创建数据库 `xinghuan_canvas_next`。
- 创建应用账号 `xinghuan_canvas_next`。
- 将 `XINGHUAN_DATABASE_URL` 写入 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`，明文未写入仓库和文档。
- 执行 `npm run db:migrate`，应用 `001_admin_core.sql`。
- 新增运维记录 `ops/postgresql-gray-migration-2026-06-05.md`。

验证证据:

- `systemctl is-active postgresql` 返回 `active`。
- `psql --version` 返回 PostgreSQL 16.14。
- `ss -ltnp` 确认 PostgreSQL 监听 `127.0.0.1:5432`。
- `npm run db:migrate` 返回 `ok: true`，`applied: ["001_admin_core.sql"]`。
- 管理员登录后 `/api/admin/system` 返回 `databaseStatus=connected`、`databaseConfigured=true`、`migrations=["001_admin_core.sql"]`。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 数据库 `xh_schema_migrations` 包含 `001_admin_core.sql`。

影响:

- 灰度环境已经具备真实 PostgreSQL schema。
- 后台系统页可以实时观测数据库连接和迁移状态。
- 现有文件型运行数据未被破坏。

风险:

- auth/admin/canvas 仍未切换到 PostgreSQL repository。
- 后续需要设计数据导入、双写或切换策略。
- 数据库账号密码需要纳入后续备份和轮换流程。

下一步:

- 实现 PostgreSQL repository 层。
- 将 auth/admin/canvas 数据迁移进数据库。
- 接入 Redis/worker 和真实任务表。

### 后台 auth/admin PostgreSQL repository 切换完成

目标:

- 将统一后台的用户、会话、Provider、模型、任务和审计数据切到 PostgreSQL repository。
- 保留文件型 fallback，确保本地开发和回滚路径可用。
- 导入灰度现有文件型后台数据。

变更范围:

- `apps/api` 新增 auth/admin PostgreSQL repository。
- `apps/api` 保留 file repository fallback。
- `/api/admin/system` 新增 `storageDriver`。
- `apps/admin` 系统页新增“存储驱动”。
- 新增 `scripts/db-import-files.mjs`。
- 新增 `npm run db:import-files`。
- `config` 模板新增 `XINGHUAN_STORAGE_DRIVER=file`。
- 新增运维记录 `ops/postgresql-repository-cutover-2026-06-05.md`。

验证证据:

- 本机 `node --check scripts\db-import-files.mjs` 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机 file driver 下 `npm run verify:single-port` 通过。
- 服务器 release `20260605-1410-xinghuan-pg-repo-gray` 已部署。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- 服务器 `npm run db:import-files` 导入 users=2、sessions=2、providers=5、models=2、tasks=1、auditLogs=3。
- 服务器设置 `XINGHUAN_STORAGE_DRIVER=postgres` 后服务 active。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 管理员登录后 `/api/admin/system` 返回 `storageDriver=postgres`、`databaseStatus=connected`、`migrations=["001_admin_core.sql"]`。
- 数据库复核 `users=2`、`providers=6`、`audit=4`。
- PostgreSQL `xh_providers` 明文测试 Key 计数为 0，`enc:v1` 加密 Key 计数为 4。

影响:

- 后台核心数据已进入 PostgreSQL。
- 现有自动验收仍覆盖登录、后台权限、Provider Key 脱敏、审计、画布保存、用户隔离和文件上传。
- 画布内容、素材文件和资源库仍保留文件型存储。

风险:

- 画布和资源库 repository 尚未切 PostgreSQL。
- Redis/worker 任务队列尚未接入，`xh_tasks` 当前只承接后台任务记录。
- Provider Adapter 尚未接入真实模型调用。

下一步:

- 设计并接入 Redis/worker 任务队列。
- 实现 Provider Adapter。
- 后续再推进画布/素材元数据 PostgreSQL repository。

### Redis/worker 任务队列灰度部署完成

目标:

- 后台任务从静态记录升级为真实队列闭环。
- API 创建 queued 任务后进入 Redis。
- worker 常驻领取任务并回写 PostgreSQL 状态和日志。

变更范围:

- `apps/api` 新增 Redis 入队和状态探测。
- `/api/admin/system` 新增 `redis` 状态对象。
- `apps/admin` 系统页展示 Redis 状态、队列名、队列深度和错误。
- `apps/admin` 任务页展示更多日志和更新时间。
- `apps/worker` 从占位服务升级为 Redis 队列消费者。
- 新增 `scripts/verify-worker-queue.mjs` 和 `npm run verify:worker`。
- `build:single-port` 纳入 `@xinghuan/worker`。
- 新增 worker systemd 示例和灰度实际服务 `xinghuan-canvas-next-worker.service`。
- 新增运维记录 `ops/worker-queue-gray-deploy-2026-06-05.md`。

验证证据:

- 本机 `node --check scripts\verify-worker-queue.mjs` 通过。
- 本机 `node --check scripts\verify-single-port.mjs` 通过。
- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run type-check -w @xinghuan/worker` 通过。
- 本机 `npm run build:single-port` 通过，包含 worker 构建。
- 本机无 Redis/file driver 下 `npm run verify:single-port` 通过。
- 服务器 Redis 为 `active`，`redis-cli ping` 返回 `PONG`。
- 服务器 release `20260605-1505-xinghuan-worker-queue-gray` 已部署。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过，`apps/worker/dist/worker.js` 存在。
- 服务器 API 和 worker systemd 服务均为 `active`。
- 服务器 `npm run verify:worker` 通过，worker 将验收任务回写为 `succeeded`。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 公网管理员登录后 `/api/admin/system` 返回 `redisStatus=connected`、`redisQueue=xinghuan:tasks`、`redisDepth=0`。

影响:

- 后台任务已经具备排队、领取、执行、成功/失败回写和日志链路。
- worker 已作为独立 systemd 服务常驻运行。
- 当前执行器仍为 mock，真实模型调用由下一步 Provider Adapter 接入。

风险:

- 当前还没有任务超时、重试次数、取消中断和死信队列。
- worker 执行器尚未接入真实 Provider。
- 输出素材落库还未接入任务结果。

下一步:

- 实现 Provider Adapter 和后台连接测试。
- worker 根据 provider/model 调用 Adapter。
- 任务成功后写入输出素材和资源库。

### 后台安全增强灰度部署完成

目标:

- 补齐统一后台安全底座。
- Provider Key 不明文落盘。
- 管理员可以通过后台重置用户密码。
- 后台关键操作可审计。

变更范围:

- `apps/api` 新增 Provider Key AES-256-GCM 加密存储。
- `apps/api` 新增 `/api/admin/audit`。
- 后台用户、Provider、模型、任务变更写入审计日志。
- `apps/admin` 用户管理增加密码重置。
- `apps/admin` Provider 管理增加 Key 更新和清除。
- `apps/admin` 新增审计页面。
- `config` 模板新增 `XINGHUAN_SECRET_KEY`。
- 新增运维记录 `ops/gray-admin-security-2026-06-05.md`。

验证证据:

- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机 `npm run verify:single-port` 通过，包含 Key 脱敏和审计验收。
- 本机 `admin.json` 不包含测试 Key 明文，包含 `enc:v1` 和 `provider.create`。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- 服务器 `npm run verify:single-port` 通过。
- 服务器 `admin.json` 不包含测试 Key 明文，包含 `enc:v1` 和 `provider.create`。
- 公网审计页截图 `output/playwright/gray-admin-audit-https.png` 通过。

影响:

- 灰度后台的 Provider Key 已从文件明文升级为加密字段。
- 后台关键操作可在审计页查看。
- 后台具备基础密码重置能力。

风险:

- 当前仍是文件型后台数据。
- `XINGHUAN_SECRET_KEY` 后续需要正式备份和轮换流程。
- 审计日志仍缺少 IP、User-Agent 和请求 ID。

下一步:

- 进入 PostgreSQL 迁移。
- 补充生产级审计字段。
- 接入真实任务队列和 Provider Adapter。

### 统一后台灰度部署完成

目标:

- 完成统一后台 `/admin` 的真实可用版本。
- 后台采用星幻科技风。
- 后台接口必须管理员登录后访问。
- 部署到灰度服务器并完成命令与视觉验收。

变更范围:

- `apps/api` 新增 `/api/admin/*` 管理接口。
- 新增文件型后台数据 `admin.json`。
- 新增管理员守卫：未登录 401，成员 403。
- `apps/admin` 从占位页升级为真实后台应用。
- 单端口服务新增 `/admin` 和 `/admin/assets/*` 静态托管。
- `build:single-port` 纳入 `@xinghuan/admin`。
- 新增部署记录 `ops/gray-admin-deploy-2026-06-05.md`。

验证证据:

- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机 `npm run verify:single-port` 通过，包含后台 API 和权限验收。
- 本机 Chrome 截图 `output/playwright/admin-dashboard-local-2.png` 通过。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- `xinghuan-canvas-next.service` 为 `active`。
- `/opt/apps/xinghuan-canvas-next/current` 指向 `20260605-1215-xinghuan-admin-gray`。
- 服务器 `npm run verify:single-port` 全部 PASS。
- 公网 Chrome 截图 `output/playwright/gray-admin-dashboard-https.png` 通过。

影响:

- 灰度域名现在可通过 `/admin` 访问统一后台。
- 管理员可查看和维护用户、Provider、模型、任务和系统状态。
- 普通成员不能访问后台数据接口。
- 后台仍使用文件型数据，后续迁移 PostgreSQL。

风险:

- Provider Key 目前仍是文件型存储，后续必须加密。
- 模型 schema 目前是文本配置，后续需要结构化编辑器。
- 任务监控是骨架，后续要接 Redis/worker。

下一步:

- 进入 PostgreSQL 数据模型和迁移层。
- 进入真实任务队列和 Provider Adapter。

### 灰度认证版部署完成

目标:

- 将最小登录、退出、用户隔离和科技风登录门禁部署到 `canvas-next.hhh2121.xyz`。
- 完成服务器命令验收和公网视觉验收。
- 不切换生产域名，不修改内部代理服务。

变更范围:

- 新增灰度认证版 release `20260605-1135-xinghuan-auth-gray`。
- 服务器 `/opt/apps/xinghuan-canvas-next/current` 已指向新 release。
- 服务器 `canvas-next.env` 已配置管理员和成员 bootstrap secret。
- 新增运维记录 `ops/gray-auth-deploy-2026-06-05.md`。
- 更新 `docs/prd/v0.1.0/progress.md`、`changelog.md` 和 `release.md`。

验证证据:

- 本机 `npm run build:single-port` 通过。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- `systemctl is-active xinghuan-canvas-next.service` 返回 `active`。
- `readlink /opt/apps/xinghuan-canvas-next/current` 返回新 release 目录。
- `curl -fsS http://127.0.0.1:18200/api/status` 返回 `environment: gray`。
- 服务器 `npm run verify:single-port` 全部 PASS，包含认证和用户隔离验收。
- `sudo nginx -t` 通过。
- `systemctl is-active nginx` 返回 `active`。
- `https://canvas-next.hhh2121.xyz/api/status` 返回 200。
- `https://canvas-next.hhh2121.xyz/api/canvas` 未登录返回 401 `AUTH_REQUIRED`。
- Chrome headless 公网未登录截图 `output/playwright/gray-auth-login-gate-https-cdp.png` 通过。
- Chrome headless 公网登录后截图 `output/playwright/gray-auth-logged-canvas-https.png` 通过。

影响:

- 灰度域名已进入认证版。
- 未登录用户只能看到星幻科技风登录门禁。
- 登录后仍进入 T8 成熟无限画板主体。
- 画布、素材和资源库已按账号隔离。

风险:

- 当前认证仍是文件型最小实现，不是最终数据库认证。
- bootstrap 密码只适合初始化阶段，后续需要正式后台用户管理和密码重置。
- Web bundle 仍存在大 chunk 警告。

下一步:

- 建立统一后台骨架和管理员权限守卫。
- 建立 PostgreSQL 数据模型。
- 建立 Redis/worker 任务队列。
- 接入真实 Provider 调用。

### 本机登录隔离和科技风门禁完成

目标:

- 在保留 T8 成熟无限画板主体 UI 的前提下，补齐星幻平台最小登录能力。
- 先完成本机认证、用户隔离和自动验收，再进入灰度服务器部署。
- 新增平台界面统一采用星幻科技风。

变更范围:

- `apps/api` 新增最小账号、session cookie、登录、退出和当前用户接口。
- `/api/canvas`、`/files`、`/input`、`/output` 等工作区能力需要登录后访问。
- 画布、输入素材、输出素材和资源库改为按用户目录隔离。
- `apps/web` 新增科技风登录门禁和顶部用户/退出入口。
- 前端设置预加载改为登录后执行，避免未登录时产生认证接口噪声。
- `scripts/verify-single-port.mjs` 升级为认证验收流。
- `config/.env.example` 和 `config/canvas-next.env.example` 补充 bootstrap 管理员变量占位。
- `docs/prd/v0.1.0/plan.md` 和 `design.md` 记录任务级计划、视觉验收和统一科技风后台方向。

验证证据:

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run type-check -w @xinghuan/web` 通过。
- `node --check scripts/verify-single-port.mjs` 通过。
- `npm run build:single-port` 通过。
- `npm run verify:single-port` 通过，包含未登录拒绝、管理员登录、成员登录和跨用户画布不可见。
- Chrome headless 本机截图 `output/playwright/auth-login-gate.png` 确认未登录时展示科技风登录页，不渲染画布。

影响:

- 本机已经具备最小公司内部登录隔离形态。
- 后台和后续管理页面的视觉方向固定为星幻科技风。
- T8 原画板主体 UI 保持稳定，不重做节点和画布交互。

风险:

- 当前认证仍是文件型最小实现，后续需要迁移 PostgreSQL。
- 灰度服务器部署认证版本前必须设置真实 bootstrap 管理员密码。
- 真实密码不能写入仓库、文档、日志或聊天输出。

下一步:

- 配置灰度服务器 bootstrap 管理员密码并部署认证版本。
- 补齐独立统一后台骨架和管理员权限守卫。
- 继续推进 PostgreSQL 数据模型和任务队列。

### 灰度服务器部署完成

目标:

- 将星幻无限画布部署到灰度域名 `canvas-next.hhh2121.xyz`。
- 使用服务器单端口服务 `127.0.0.1:18200`。
- 不修改内部代理项目，不切换生产域名。

变更范围:

- 新增灰度部署记录 `ops/gray-deploy-2026-06-05.md`。
- 服务器 release：`20260605-0903-xinghuan-gray`。
- 服务器目录：`/opt/apps/xinghuan-canvas-next/releases/20260605-0903-xinghuan-gray`。
- systemd 服务：`xinghuan-canvas-next.service`。
- Nginx 站点：`canvas-next.hhh2121.xyz`。
- HTTP/HTTPS 均代理到 `127.0.0.1:18200`。

验证证据:

- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- 首次 systemd 启动失败后，修复 `build:single-port` 未构建 workspace 运行时依赖的问题。
- `systemctl is-active xinghuan-canvas-next` 返回 `active`。
- `systemctl is-active nginx` 返回 `active`。
- `sudo nginx -t` 通过。
- 服务器 `npm run verify:single-port` 8 项全部 PASS。
- `http://canvas-next.hhh2121.xyz/` 返回 200。
- `http://canvas-next.hhh2121.xyz/api/status` 返回 `xinghuan-api`。
- `https://canvas-next.hhh2121.xyz/` 返回 200。
- `https://canvas-next.hhh2121.xyz/api/status` 返回 `xinghuan-api`。
- Chrome headless 截图 `output/playwright/gray-canvas-next-https.png`。
- Chrome DOM dump 确认 `星幻无限画布`、`后端已连接` 和 `react-flow` 存在，并且不包含旧开发端口。

影响:

- 灰度域名已可用于后续真实用户流和后台/登录/任务队列联调。
- 生产域名仍未切换。
- 内部代理服务未修改。

风险:

- 当前灰度仍是无登录、无数据库、无任务队列的 POC 服务。
- Web bundle 仍存在大 chunk 警告，后续需要分包优化。
- RH 节点分组仍按用户要求暂不处理。

下一步:

- 进入登录、用户隔离、数据库、任务队列和真实 Provider 调用阶段。

### 灰度部署准备材料完成

目标:

- 在本机单端口验收后，补齐灰度部署前的可执行材料。
- 让后续部署到 `canvas-next.hhh2121.xyz` 时有明确启动脚本、环境模板、Nginx/systemd 示例、runbook 和验收清单。

变更范围:

- 根 `package.json` 新增：
  - `build:single-port`
  - `start:single-port`
  - `verify:single-port`
- 新增 `scripts/start-single-port.mjs`，跨平台启动 `apps/api/dist/server.js` 并设置单端口默认环境。
- 新增 `scripts/verify-single-port.mjs`，自动验证 Web、API、画布保存读取、文件上传访问和 SPA fallback。
- 更新 `config/.env.example`，默认端口改为 `18200` 并补充 `XINGHUAN_WEB_DIST_DIR`。
- 新增 `config/canvas-next.env.example`。
- 新增 `ops/gray-deploy-runbook.md`。
- 新增 `ops/gray-acceptance-checklist.md`。
- 新增 `ops/nginx/canvas-next.hhh2121.xyz.conf.example`。
- 新增 `ops/systemd/xinghuan-canvas-next.service.example`。
- 更新 `ops/README.md` 的灰度材料索引。

验证证据:

- `node --check scripts/start-single-port.mjs` 通过。
- `node --check scripts/verify-single-port.mjs` 通过。
- `npm run build:single-port` 通过。
- 使用 `npm run start:single-port` 启动后，`127.0.0.1:18200` 监听。
- `npm run verify:single-port` 全部 PASS：
  - `GET /`
  - `GET /api/status`
  - `POST /api/canvas`
  - `PUT /api/canvas/:id`
  - `GET /api/canvas/:id`
  - `POST /api/files/upload`
  - `GET uploaded file`
  - `SPA fallback`
- 相关监听端口确认仅 `18200` 存在。
- 静态扫描灰度文档和配置，未发现禁止使用的批量删除命令。

影响:

- 后续灰度部署可以直接按 runbook 进入服务器执行。
- 本机和服务器都可以复用同一套单端口启动/验收脚本。

风险:

- 当前仍未实际部署到服务器。
- HTTPS 证书配置需要在 HTTP 灰度可用后单独处理。
- systemd 和 Nginx 示例仍需在服务器实际路径上二次确认。

下一步:

- 进入服务器灰度部署实施，目标为 `canvas-next.hhh2121.xyz`。

### 本机单端口生产服务验收

目标:

- 将本机迁移期的 Web/API/T8 兼容后端多端口形态收敛为 `18200` 单端口生产服务。
- 证明关闭 Vite dev server 和 T8 兼容后端后，星幻仍可打开 Web、访问 API、保存画布和访问素材文件。

变更范围:

- `apps/api/src/server.ts` 增加 `apps/web/dist` 静态文件托管。
- 增加 SPA fallback，非 API/文件路径的 GET 请求回退到 `index.html`。
- 扩展静态资源 MIME，覆盖 HTML、JS、CSS、SVG、JSON、字体和 MIDI。
- 保留 `/api/*`、`/files/*`、`/input/*`、`/output/*` 优先匹配，避免前端 fallback 吞掉接口错误。

验证证据:

- `npm run type-check -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/api` 通过。
- `npm run build -w @xinghuan/web` 通过，存在大 chunk 警告但不阻塞生产服务验收。
- 启动 `127.0.0.1:18200`，显式指定 `XINGHUAN_WEB_DIST_DIR` 和 `XINGHUAN_DATA_DIR`。
- 停止 `18300`、`18310`、`18766` 后，仅 `18200` 保持监听。
- `GET /` 返回 200 且包含 React root。
- `GET /assets/*.js` 返回 200。
- `GET /api/status` 返回 `xinghuan-api`。
- `POST /api/canvas` 创建 `单端口验收画布`。
- `PUT /api/canvas/:id` 保存 1 个测试节点，随后 `GET /api/canvas/:id` 读取到 1 个节点。
- `POST /api/files/upload` 上传文件成功，返回 `/files/input/up_*.json`，该文件通过同端口返回 200。
- `GET /workspace/deep/link` 通过 SPA fallback 返回 200。
- Chrome headless 截图保存到 `output/playwright/single-port-18200-chrome.png`。
- Chrome DOM dump 确认包含 `星幻无限画布`、`后端已连接` 和 `react-flow`，且不包含 `18300`、`18310`、`18766`。

影响:

- 本机已经具备后续服务器灰度所需的单 upstream 形态。
- Nginx 后续可以只代理 `127.0.0.1:18200` 到灰度域名。
- 画板仍继续采用 T8 成熟 UI，不在本阶段重做画板。

风险:

- 真实模型执行、用户登录、数据库隔离和任务队列仍未进入本阶段。
- Web 构建存在大 chunk 警告，后续需要做代码分包和资源体积优化。
- RH 节点分组仍可见，本阶段按用户要求暂不处理。

下一步:

- 进入灰度部署准备：整理启动脚本、Nginx upstream、systemd 服务和回滚清单。
- 补充服务器部署前密钥、数据目录和日志目录规范。

## 2026-06-04

### T8 成熟画板 UI 迁移方向纠偏

目标:

- 根据用户需求明确 `apps/web` 不从头重做画板 UI。
- 将当前占位画板降级为工程骨架验证，正式方向改为迁移 T8 成熟前端。

变更范围:

- 新增 `development/t8-ui-migration.md`。

验证证据:

- 已确认 T8 前端入口为 `src/main.tsx` 和 `src/App.tsx`。
- 已确认 T8 画板核心为 `src/components/Canvas.tsx`。
- 已确认 T8 前端包含 `components`、`stores`、`services`、`theme`、`types`、`utils` 等完整结构。

影响:

- 后续不继续强化当前占位画板。
- `apps/web` 下一步迁入 T8 前端成熟 UI，再做星幻品牌、主题和 API 适配。

风险:

- T8 前端仍包含大量旧品牌和旧后端 API 绑定。
- 迁入后可能出现依赖和路径别名问题。

下一步:

- 将 T8 `src/` 迁入 `apps/web/src/`。
- 补齐依赖和 Vite 配置。
- 先让 T8 画板 UI 在星幻 worktree 中跑起来。

进展补充:

- 已完成 T8 `src/` 到 `apps/web/src/` 的迁入。
- 已补齐前端依赖和 Vite alias/proxy。
- `npm run type-check -w @xinghuan/web` 通过。
- `npm run build -w @xinghuan/web` 通过。
- `apps/web` 已在 `127.0.0.1:18310` 显示 T8 成熟画板 UI。
- 当前仍存在旧品牌词和 T8 后端依赖，下一步进入品牌与 API 适配。

修复补充:

- 补齐 `apps/web/tailwind.config.js`、`apps/web/postcss.config.js` 和 Tailwind/PostCSS 依赖，修复迁移后页面散乱问题。
- 默认主题改为 `tech-default`，并使用新的星幻主题缓存 key。
- 浏览器确认科技风 token 生效：`#09090b`、`#0a0a0b`、`#38bdf8`。
- 顶部品牌已统一为 `星幻无限画布`。
- 顶部外部推广入口已不再渲染。
- 侧栏底部版本标识已改为星幻。
- 当前 `RH`、`RunningHub` 仍作为节点分组/节点名称出现，下一步单独处理。
- 新增星幻 API 兼容层，画布列表、创建、读取、保存已从 T8 后端切换到 `apps/api`。
- Web `/api` 代理已切到 `127.0.0.1:18300`。
- 浏览器确认 `apps/web` 通过星幻 API 显示 `星幻测试画布` 和 `1 个节点`。
- 补充服务器部署演进记录：先本机单端口生产服务，再部署灰度 `canvas-next.hhh2121.xyz`，最后再生产切换。
- 新增文件与资源接口迁移：`/files`、`/input`、`/output` 和资源库最小 CRUD 已接入星幻 API。
- Web `/files`、`/input`、`/output` 代理已切到 `127.0.0.1:18300`。
- 命令验证文件上传、文件访问、资源写入和资源查询通过。

### Milestone B 星幻工程基线

目标:

- 创建星幻正式工程骨架，不再以 T8 研究仓库作为产品主干。
- 建立 Web、Admin、API、Worker 和共享包边界。
- 验证默认科技风工作台和统一后台首屏。

变更范围:

- 新增根 `package.json` 和 `tsconfig.base.json`。
- 新增 `config/.env.example`。
- 新增 `apps/web`。
- 新增 `apps/admin`。
- 新增 `apps/api`。
- 新增 `apps/worker`。
- 新增 `packages/shared`、`packages/ui`、`packages/canvas-core`、`packages/model-core`。
- 新增 `development/milestone-b-baseline.md`。

验证证据:

- `npm install` 成功，审计结果 0 vulnerabilities。
- `npm run type-check` 通过。
- `npm run build` 通过。
- `npm run start -w @xinghuan/worker` 通过。
- API `/health` 和 `/api/version` 返回 `ok: true`。
- Web `http://127.0.0.1:18310` 可打开。
- Admin `http://127.0.0.1:18320` 可打开。
- 浏览器 DOM 验证 Web/Admin 均包含星幻核心文案，且不包含 T8、企鹅、贞贞、RunningHub、RH风格。

影响:

- 星幻正式工程从独立 worktree 起步，避免污染主项目文档仓库和 T8 研究仓库。
- 服务器开发策略保持为本机开发、灰度服务器验收。
- 后续可以在此基线上引入真实画布、认证、数据库、后台 CRUD 和任务队列。

风险:

- 当前只是工程基线，占位 UI 未接入真实 ReactFlow。
- 截图文件落盘时出现浏览器截图超时，需后续补充稳定截图脚本。
- 尚未实现登录、数据库、Redis、对象存储和真实 Provider 调用。

下一步:

- 增加稳定浏览器截图验收。
- 接入真实画布核心组件。
- 设计并实现 API 路由边界和认证中间件。

### 本机真实测试密钥落地

目标:

- 将用户提供的 GRSAI 和 ToAPIs 测试 Key 放入 2.0 本机环境文件，方便后续 POC 直接读取。

变更范围:

- 新建 `.env.local`，写入 GRSAI 与 ToAPIs 的本机测试环境变量。
- 验证 `.env.local` 被 `.gitignore` 忽略。
- 文档和 Git 提交中不记录真实 Key 值。

验证证据:

- `git check-ignore -v .env.local` 确认 `.env.local` 命中忽略规则。

影响:

- 后续本机开发和 POC 可以从 `.env.local` 读取 `GRSAI_API_KEY`、`TOAPIS_API_KEY` 等变量。
- Git 仓库不会追踪 `.env.local`。

风险:

- 若后续手动强制添加被忽略文件，仍可能造成密钥泄露；提交前必须继续做密钥扫描。

下一步:

- 进入候选基底评估和 POC 准备。

### Git 仓库初始化与密钥忽略规则补充

目标:

- 将无限画布 2.0 初始化为独立 Git 仓库。
- 明确真实 API Key 的忽略规则和放置方式。

变更范围:

- 更新 `.gitignore`，用中文标注本机密钥、运行期输出、依赖、构建产物和系统噪音。
- 新增 `config/secrets-placement.md`，说明 GRSAI 和 ToAPIs 测试密钥应进入 `.env.local`、服务器环境变量或后台加密字段。
- 不把真实 Key 写入 Markdown 文档。

验证证据:

- Git 仓库已初始化。
- 本仓库本地提交身份设置为 `Codex <codex@local>`，不影响全局 Git 配置。
- 初始提交：`5f1dc08 docs: initialize infinite canvas 2 project`。
- `.env`、`.env.local`、`config/.env.local` 已验证会被 `.gitignore` 忽略。
- 提交前密钥扫描无命中。

影响:

- 2.0 文档可以进入 Git 追踪。
- 真实密钥文件默认不被 Git 追踪。

风险:

- 若手动强制 `git add -f .env.local` 仍可能泄露；后续应增加提交前密钥扫描。

下一步:

- 建立候选基底评估表。
- 创建后续 POC 分支或工作区。

### 测试服务商与服务器状态记录

目标:

- 将 2.0 首批测试服务商、文档地址、模型名称和密钥存放策略落到项目文件夹。
- 将当前腾讯云服务器、旧项目服务和磁盘空间状态写入 2.0 运维记录。

变更范围:

- 新增 `config/.env.local.example`，用于本地填写真实密钥。
- 新增 `config/provider-test-matrix.md`，记录 GRSAI 和 ToAPIs 的测试用途、文档地址、模型和验收重点。
- 新增 `ops/server-state-2026-06-04.md`，记录服务器磁盘、旧项目目录占用、服务状态、端口和对 2.0 的影响。
- 更新 `MEMORY.md`，补充测试服务商和服务器状态快照索引。
- 新增 `.gitignore`，默认忽略 `.env` 和 `.env.*`，避免真实密钥进入 Git。

验证证据:

- 通过 SSH 采集服务器状态：旧灰度 release 为 `5148170`，Web、worker、Redis、Nginx 和内部代理服务均为 `active`。
- 根分区当前约 `59G`，已用 `46G`，可用 `11G`，使用率 `81%`。
- 旧灰度项目 `/opt/apps/canvas-enterprise-next` 当前约 `23G`。
- 本地密钥扫描无命中。

影响:

- 真实 API Key 未写入 Markdown 文档。
- 2.0 后续接入 Provider 时可直接参考测试矩阵和 `.env.local.example`。

风险:

- 磁盘空间偏紧，后续部署 2.0 前需要决定是否清理旧 release。
- 清理旧项目必须逐项确认，禁止批量删除。

下一步:

- 建立候选基底评估表。
- 决定 2.0 POC 是否复用旧灰度域名或使用新端口/新子域名。

### v0.1.0 新项目立项文档初始化

目标:

- 放弃旧 Node Banana 改造路线，建立“无限画布 2.0”新项目文档和治理入口。
- 将完整需求、关键经验、限制条件、验收标准和后续选型路线沉淀为可执行文件。

变更范围:

- 新增 `AGENTS.md`，定义项目协作规则、工程规则、安全规则和当前状态。
- 新增 `MEMORY.md`，记录 2.0 项目记忆、旧项目放弃原因、核心需求、关键决策和服务器信息。
- 新增 `DEVLOG.md`，建立开发日志台账。
- 新增 `docs/prd/v0.1.0/` 初始 PRD、SPEC、设计、计划、进度、发布、变更和决策文档。
- 新增 `ops/`、`config/`、`development/`、`research/` 目录，为后续运维、配置、开发和调研留出位置。

验证证据:

- 文件已创建在 `D:\codex\无限画布2.0`。
- 当前不涉及代码构建、测试或服务器部署。

影响:

- 2.0 从文档层面成为新的项目主线。
- 旧 `D:\codex\服务器\无限画布` 不再作为后续功能开发主干。

风险:

- 还未完成候选基底 POC，技术路线尚未锁定。
- 旧项目中已完成的后端能力不能直接视为可复用，需要逐项评估迁移价值。

下一步:

- 建立候选基底评估表。
- 对候选项目进行许可证、节点体系、执行引擎、前后端结构和部署可行性评估。
- 选择 1-2 个候选做最小 POC。
