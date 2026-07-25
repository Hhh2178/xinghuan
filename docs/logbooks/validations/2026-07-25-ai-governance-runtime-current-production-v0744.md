# AI Governance Runtime Current Production v0.7.44 Validation

- release: `20260725-ai-governance-runtime-current-production-r1-v0744`
- environment: `production`
- database: `xinghuan_canvas_next`
- rollback: `20260722-canvas-revision-observability-prod-r1-v0718`

## Pre-deploy

- Gray `v0.7.44` runtime、Provider/Agent/Canvas Run 真实验收已通过。
- Production deploy 前版本 `v0.7.18`、API/Worker active、权限 readiness 通过。

## Post-deploy

- `release:gray:verify --env=production`：版本、环境、权限模式、服务状态、数据库和 readiness 全部匹配。
- 服务层：API、Worker、output-prune timer active；生产根路径和 `/api/status` 可访问。
- Nginx：`nginx -t` 通过，公网域名返回 `0.7.44 / production / enforced`。
- Admin task pagination、environment sync no-op apply、request-chain observability、system observability、Provider task service/worker 均通过。
- `system-observability` 返回既有业务告警（24h 失败率 25.45%、revision conflict 8），无新增发布阻断错误。

## Boundary

- Gray 与 Production 目录、环境文件、数据库和队列保持隔离。
- 未执行 GitHub 推送；未触碰其他项目。
