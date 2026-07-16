# v0.6.13 统一权限平台生产验证

## 结论

- 结果：通过。
- 运行态：`20260716-permission-platform-hardening-prod-r1-v0613`，`0.6.13 / production / enforced`。
- 服务：API、Worker、output prune timer active；Nginx 配置检查通过。
- 回滚锚点：`20260702-envsync-admin-sections-prod-r1-v0522`。

## 权限数据

- 数据库：`xinghuan_canvas_next`，与 production expected database 一致。
- reconciliation apply：120 Subject updates、478 rule upserts、0 unresolved。
- 二次 reconciliation plan：0 updates、0 upserts、0 unresolved。
- readiness：127 Subjects、120 published、7 restricted、478 rules、2 principals、0 failures。

## 真实成员验收

- Shadow：未分组成员目录可用。
- Enforced：42 models、11 image、9 video、10 RH、3 shared resources、0 denied nodes。
- 账号 deny 覆盖 ungrouped allow：通过。
- 探针规则删除后目录恢复，规则数由 478 回到 478。
- Production 没有命名组成员，因此未在生产临时改组用户；命名组和双向账号覆盖已在 gray 使用真实成员完成验证。

## Runtime Canary

- 内网、公网 `/api/status`：200，版本、环境、权限模式一致。
- 首页、`/admin` 和全部首屏 JS/CSS：200；最慢页面响应为 `/admin` 5050ms，低于 10 秒门槛。
- request-chain observability：通过。
- system observability：通过，数据库匹配、request ID 覆盖率 100%。
- 部署后服务日志：0 fatal/uncaught/readiness 错误。
- 自动浏览器连接两次初始化失败，未取得 screenshot 或 console 级浏览器证据；该限制不影响 HTTP、API、权限和服务验收结论。

## 残留观察

- 历史任务失败趋势与 revision conflict 指标仍为 `critical`，需继续按现有运维事项跟踪。
- 发布后真实视频任务的失败分类为 upstream business failure，不是本地权限拒绝；本次验收未调用生成模型。
