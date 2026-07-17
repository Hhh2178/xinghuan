# v0.7.2 审计账号与分组排行榜 Production 验证

## 发布前

- 当前 release、API、Worker、生产数据库目标与 canonical state 一致。
- Production 全库备份成功并通过恢复目录检查。
- 部署 dry-run 确认仅触碰 `/opt/apps/xinghuan-canvas/`、生产 `canvas.env`、18100 端口和生产服务；Gray 未触碰。
- 使用与 Gray 完全相同的归档和 SHA-256。

## 运行态

- current：`/opt/apps/xinghuan-canvas/releases/20260717-audit-rankings-prod-r1-v072`。
- API / Worker / output prune timer：均为 `active`。
- 内网与公网状态：`0.7.2 / production / enforced`。
- 数据库：`current=expected=xinghuan_canvas_next`。
- readiness：134 Subjects、466 Rules、11 principals、0 failures。
- Nginx 配置通过；发布后 API/Worker error 级日志为 0。

## 观测与页面

- request-chain verifier 通过；最近 24 小时 request-id 覆盖率 100%。
- system observability verifier 通过；既有任务失败与 revision conflict 告警无发布后突增证据。
- 正式审计页成功加载 27 个账号和 10 个分组，均按成功次数降序。
- 账号与分组首行贴顶，`align-content: start`、`grid-auto-rows: minmax(32px, auto)`、`overflow-y: auto` 均生效。
- 模型与 RH 全局统计正常，Chrome 控制台 0 errors。
