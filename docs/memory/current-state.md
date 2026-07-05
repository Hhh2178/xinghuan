# 当前状态

## 当前版本与阶段

- 当前活跃版本：`v0.5.25`
- 当前灰度 release：`20260704-comfyui-machine-first-gray-r1-v0525` (已部署)
- 当前生产 release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 当前工作分支：`xinghuan-integration-clean`
- 最新完成：clean worktree 结构治理批次已开始收口，工具链安全网、图标瘦身、API/Worker provider 去重、auth current-user 精准查询已在 `xinghuan-integration-clean` 提交。
- 当前冻结项：ComfyUI 功能开发暂停并封存；只允许 crash/security/rollback/docs 级别止血，不继续节点 UI、工作流治理、Tailscale/隧道、多机器调度等扩展。
- 当前产品路线口径：
  - 早期 `Phase 3` 任务与素材闭环已完成；当前不再用 Phase 3 作为主状态描述
  - ComfyUI 后台实例池管理界面重构已完成并部署到灰度，但后续功能开发已冻结
  - 当前重点是 clean worktree 迁移完整性、未完成结构批次 B2/B3/E1/F1 的完成或明确延期、发布链路一致性和主入口状态收口
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
  - gray 当前运行在 `v0.5.25`，production 当前运行在 `v0.5.22`
  - gray 当前 release 为 `20260704-comfyui-machine-first-gray-r1-v0525` (已部署)
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
- 仍需推进或明确延期：
  - B1 login email lookup extraction。
  - B2 任务列表分页与 `payload/result/logs` 去大字段。
  - B3 Postgres pool 调参。
  - E1 剩余 repository boundary。
  - F1 任务实时机制 decision/deferral。
- 灰度前必须执行：
  - 迁移完整性校验，确认成果不只停留在 `xinghuan-milestone-b`。
  - `npm run ci`、`npm run verify:file-hotspot-budgets`、`npm run codegraph:sync`。

## 相关入口

- 总索引：`../INDEX.md`
- 系统知识：`../systems/README.md`
- 运行态材料：`../../ops/README.md`
