# v0.6.13 统一权限平台生产发布

## 发布信息

- 版本：`v0.6.13`
- 环境：`production`
- release：`20260716-permission-platform-hardening-prod-r1-v0613`
- 来源 gray：`20260715-permission-platform-hardening-v0613`
- 发布包：`dist-release/20260715-permission-platform-hardening-v0613.tar.gz`
- 发布包 SHA-256：`8e22472e60aac49fcefceab8edb13e1c0344e79b01264787ac82b9409266001e`
- 上一 production release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 代码提交：`df3970bd51d2198dc1fb9eb1af1af5a7556f13b6`

## 发布结论

- `v0.6.13` 已按 `shadow -> migration/reconciliation -> readiness -> enforced` 顺序进入 production。
- API、Worker、output prune timer 均为 `active`；内网与公网状态均为 `0.6.13 / production / enforced`。
- Production readiness：127 Subjects、120 published、7 restricted、478 rules、2 principals、0 failures。
- 真实未分组成员目录：42 models、11 image、9 video、10 RH、3 shared resources、0 denied nodes。
- 账号 deny 覆盖 ungrouped allow 的可逆探针通过，恢复后规则数保持 478。
- 未调用任何付费生成模型。

## 生产数据迁移

- 发布前核对发现 production 与 gray 实际使用不同数据库：
  - production：`xinghuan_canvas_next`
  - gray：`xinghuan_canvas_gray`
- Production 在发布前只有旧 `xh_group_permission_policies`，统一 Subject/Rule 表由本次 `db:migrate` 创建。
- 本次 migration 应用：`020_ungrouped_permission_policy.sql`、`021_unified_permission_platform.sql`、`022_ops_task_finalized_at.sql`。
- Subject 注册后 reconciliation dry-run：120 Subject updates、478 rule upserts、0 unresolved。
- Apply 后二次 dry-run：0 Subject updates、0 rule upserts、0 unresolved，幂等通过。
- 生产 env 与权限数据备份均保留在 `/opt/apps/xinghuan-canvas/shared/backups/`，未输出或提交任何密钥。

## 验证

- 本地：`build:single-port`、release harness、permission hardening contract 通过，工作树干净。
- `verify:single-port` 本地入口因未运行 `127.0.0.1:18200` 而无法连接；真实环境验证改在 production `18100` 完成。
- 公网 canary：首页 200（824ms）、`/admin` 200（5050ms）、`/api/status` 200（433ms），首屏 JS/CSS 全部 200。
- request-chain observability 与 system observability 验证通过；数据库目标匹配，请求 ID 覆盖率为 100%。
- 部署后 API/Worker 日志无 fatal、uncaught 或 readiness 启动错误。
- 浏览器自动化后端仍无法初始化，因此未宣称完成截图或人工视觉验收。

## 运行观察

- 系统观测仍报告历史任务失败趋势与 revision conflict 为 `critical`；这是累计窗口指标，不是本次发布新增错误。
- 发布后观察到一条真实视频任务以 `upstream_business_failed` 结束，未命中本地 `PERMISSION_DENIED`，未作为发布回滚信号。

## 回滚

- 代码回滚目标：`/opt/apps/xinghuan-canvas/releases/20260702-envsync-admin-sections-prod-r1-v0522`
- 权限模式可先恢复为 `shadow`，再重启 API/Worker。
- 发布前 env 与权限数据备份均保留在 production shared backups 目录。
- 回滚后必须复核 `18100`、公网 `/api/status`、API/Worker 状态和权限目录。
