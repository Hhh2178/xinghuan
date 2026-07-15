# 当前状态

## 当前版本与阶段

- 当前灰度版本：`v0.6.11`（已部署）
- 当前生产版本：`v0.5.22`（production 已于 2026-07-14 15:44 从 v0.5.27 回退）
- 当前灰度 release：`20260715-aifork-grok-fast-contract-v0611` (已部署)
- 当前生产 release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 当前工作分支：`xinghuan-integration-clean`
- 最新完成：AIFork Grok FAST 已启用独立通用请求契约，使用 `duration/video_length/aspect_ratio/video_config/reference_images`；SD 补充契约和其他 Provider/模型链路保持隔离。
- 当前冻结项：ComfyUI 功能开发暂停并封存；只允许 crash/security/rollback/docs 级别止血，不继续节点 UI、工作流治理、Tailscale/隧道、多机器调度等扩展。
- 当前产品路线口径：
  - 早期 `Phase 3` 任务与素材闭环已完成；当前不再用 Phase 3 作为主状态描述
  - ComfyUI 后台实例池管理界面重构已完成并部署到灰度，但后续功能开发已冻结
  - 当前重点是 clean worktree 迁移完整性、未完成结构批次 E1/F1 的完成或明确延期、发布链路一致性和主入口状态收口
- 当前多用户正式化治理口径：
  - `Phase A-E` 已完成 gray / production 收口

## 当前环境入口

- 当前 worktree：`D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`
- 灰度：`canvas-next.hhh2121.xyz` / `127.0.0.1:18200`
- 生产：`canvas.hhh2121.xyz` / `127.0.0.1:18100`
- 当前 production 数据库目标：`xinghuan_canvas_next`

## 当前高频系统关注点

- RunningHub：条目建模、Workflow/App 区分、无入参 workflow、AI App v2、空白草稿创建、输出重置
- Admin：系统并发治理、RH 工作台、环境同步
- API：任务接口、系统只读聚合、RunningHub 分析
- Worker：普通任务并发与 RH 平台窗口治理
- Worker 下一步：`worker.ts` 第二阶段收口继续推进
  - 已抽出 RunningHub client 与 poll 解析护栏
  - 下一步继续拆分 dispatch、统一取消同步与更多共享运行态 helper
- 当前工程治理重点：
  - 避免继续制造 `server.ts / worker.ts / RunningHubNode.tsx` 这类超级文件
  - 发布前必须收紧工作树，只保留本轮预期改动
- 当前画布执行链路重点：
  - 组执行管理器已支持持续开关、执行次数和面板内直接开始执行
  - 组内执行按当前连线拓扑串行
  - 多轮执行时每轮都会重新读取当前画布拓扑
- 当前已完成的最新运行态治理：
  - gray 当前运行 `v0.6.11`，production 当前运行在 `v0.5.22`
  - gray 当前 release 为 `20260715-aifork-grok-fast-contract-v0611` (已部署)
  - production 当前 release 为 `20260702-envsync-admin-sections-prod-r1-v0522`
  - ComfyUI connector harness、共享工作流专用执行入口和项目级 harness 入口层已在本地整合分支完成
  - ComfyUI 后台实例池管理界面重构已完成并部署到灰度（2026-07-03）：
    - 新增 admin-comfyui-overview.tsx 仪表盘概览页
    - 新增 admin-comfyui-detail.tsx 实例详情页（基本配置/工作流管理/执行日志三个标签页）
    - 新增 POST /api/admin/comfyui/instances/:id/test-connection 连接测试 API
    - 新增完整 CSS 样式（metric-card、instance-grid、detail-header、tabs 等）
    - 新增 XINGHUAN_COMFYUI_CONNECTOR_TOKEN 环境变量配置
  - 灰度部署验证通过：
    - 服务状态：xinghuan-canvas-next 和 xinghuan-canvas-next-worker 均为 active
    - API 状态：内网和公网 HTTPS 均返回 version=0.5.24, environment=gray
  - ComfyUI 图标一致性修复与 connector harness 灰度激活已完成（2026-07-03 12:26）：
    - 修复 `.error-banner` 全站选择器冲突，统一按钮圆角/图标尺寸到全站规范
    - 发现并修复灰度早期增量部署遗漏重新构建 `apps/api/dist` 的问题：connector 注册/心跳路由此前在灰度实际不可用
    - 已补齐灰度 `apps/api/dist`、`apps/admin/dist`，并在服务器 `canvas-next.env` 新增 `XINGHUAN_COMFYUI_CONNECTOR_TOKEN`
    - 验证：`POST /api/internal/comfyui/connectors/register` 带正确 token 返回 200，测试数据已清理
    - 本机真实机器接入已完成；当前待用户浏览器验收工作流治理页与共享工作流真实执行链路

## 当前结构治理状态（2026-07-05）

- 已完成并提交：
  - `53f8ee8` 工具链安全网：lint/test/ci 可执行。
  - `619fcdd` 图标瘦身：移除 lucide namespace import，`vendor-icons` 显著下降。
  - `7966bd1` API/Worker provider 去重：共享 helper 下沉到 `packages/shared` 的受控 Node 子路径。
  - `9e27bc7` auth current-user 精准查询：当前用户 session lookup 不再走全量 auth-db 读取。
  - `2b0b062` auth login 精准查询：Postgres 登录用户 email lookup 已走 `authCurrentUserRepository.findEnabledUserByEmail`，避免普通登录路径读取完整 auth DB。
  - `6b8d966` release 包补齐 auth verifier，避免 gray 远端 `npm run verify:auth-*` 因脚本缺失失败。
  - `28e2c02` environment sync smoke 改为 no-op `skip` apply，链路测试可重复运行且不写入配置。
  - `f9d7fff` / gray `c549e71` B2 任务列表分页与去大字段：`GET /api/admin/tasks` 列表不再返回 `payload/result/logs`，并已在灰度 `20260705-postgres-pool-tuning-gray-r1-v0525` live verify 通过。
  - `2127368` / gray `20260705-postgres-pool-tuning-gray-r1-v0525` B3 Postgres pool 调参已完成：API/Worker 默认值不变，并新增 shared/service env 覆盖入口，已完成 gray runtime verify。
  - `20260705-auth-login-repository-gray-r3-v0525` 已完成 gray runtime verify、auth verifier、admin task pagination、environment sync no-op smoke。
  - `20260706-task-list-lightweight-gray-r1-v0527` 已完成 gray runtime verify、远端 admin task pagination、environment sync smoke、auth repository verifier。
- 本轮已灰度发布：
  - `c5af7bd` provider repository core boundary。
  - `fb529c9` admin provider route repository wiring。
  - `eeb0a36` provider persistence helper extraction。
  - `55ad04b` settings repository boundary。
  - `c0b8b70` admin repository boundary。
  - `41fb8a3` task repository boundary。
  - `340257f` admin usage summary repository/service boundary。
  - `66f9a99` task repository list summary heavy-field repair。
- 当前 repository wave 状态：
  - provider/settings/admin/task/admin usage summary boundary 已随 `20260706-task-list-lightweight-gray-r1-v0527` 推送灰度。
  - 远端 `verify-admin-task-pagination` 与 `verify-environment-sync-smoke` 已在服务器 release 目录加载 gray env 后通过。
- 仍需推进或明确延期：
  - E1 environment-sync-local 抽取延期到专门批次，不在本次 repository wave 强行迁移。
  - F1 任务实时机制已决策延期实现；后续优先 shared frontend polling，再评估 SSE。
- 后续新灰度前必须执行：
  - 迁移完整性校验，确认成果不只停留在 `xinghuan-milestone-b`。
  - `npm run ci`、`npm run verify:file-hotspot-budgets`、`npm run codegraph:sync`。

## 相关入口

- 总索引：`../INDEX.md`
- 系统知识：`../systems/README.md`
- 运行态材料：`../../ops/README.md`
