# AI Governance Runtime Current Production v0.7.44

- release: `20260725-ai-governance-runtime-current-production-r1-v0744`
- source artifact: Gray `20260725-ai-governance-runtime-current-gray-r1-v0744`
- source commit: `6a154df`
- rollback: `20260722-canvas-revision-observability-prod-r1-v0718`
- Gray: `20260725-ai-governance-runtime-current-gray-r1-v0744`

## Scope

- 将已通过 Gray 验收的前后台 AI 助手、AI 托管运行时、候选选择器 provenance 修复、批量媒体执行和治理面板晋级到 Production。
- Production 使用独立目录 `/opt/apps/xinghuan-canvas/`、环境文件、数据库 `xinghuan_canvas_next` 和队列 `xinghuan:tasks:prod`。

## Deployment

- Production `current` 已切换至 `/opt/apps/xinghuan-canvas/releases/20260725-ai-governance-runtime-current-production-r1-v0744`。
- 数据库迁移应用 `026_canvas_agent_runtime.sql` 至 `044_canvas_run_execution_layers.sql`，既有 `001-025` 跳过。
- 仅重启 Production API/Worker；Gray 运行目录未覆盖。

## Evidence

- 内部与公网 `/api/status` 均返回 `0.7.44 / production / enforced`。
- API、Worker、output-prune timer 均 `active`；Nginx 配置测试通过。
- 数据库目标校验：current=`xinghuan_canvas_next`，expected=`xinghuan_canvas_next`。
- Permission readiness 通过，无 failures。
- Admin task pagination、environment sync、request-chain observability、system observability、Provider task service/worker smoke 全部通过。
- System observability 当前报告既有业务数据告警：24h 失败率 `25.45%`、revision conflict `8` 次；接口、审计 requestId 覆盖率和趋势数据正常，此项不阻断本次发布。

## Visual Scope

- 复用 Gray 已验收的 PC 端视觉；未新增其他窗口尺寸矩阵。
