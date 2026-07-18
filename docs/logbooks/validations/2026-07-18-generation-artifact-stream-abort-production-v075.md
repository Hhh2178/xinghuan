# Generation Artifact Stream Abort Production v0.7.5 验证

## 结论

- 状态：`PASS`。
- Production 已复用 Gray r2 的同一不可变制品，远端 SHA-256 与发布记录一致。
- 严格 runtime gate 返回 `0.7.5 / production / enforced / readiness=true`；最终为 134 Subjects、116 published、10 restricted、8 retired、452 rules、11 principals、0 failures。
- API、Worker、output prune timer active，Nginx 配置通过，数据库目标为 `xinghuan_canvas_next`。

## 故障路径与功能验证

- release 目录内 `verify:api-aborted-response` 在 clean env 下通过 100 次隔离回归。
- 真实 Production 服务通过 500 次认证 Artifact 内容流中断，API/Worker 重启计数前后均为 0，未出现 `ERR_HTTP_HEADERS_SENT`。
- Worker 产物登记、Promotion 幂等、Asset 文件保护、Canvas/Resource、requestId 链路和系统可观测性验证通过；测试 Artifact、文件、Provider 和 Asset 已清理。
- 系统面板的任务失败率和 revision conflict 继续作为既有累计 observation，不作为本次发布新增故障。

## 性能与持续观察

- 公网混合 3000 请求、75 并发：零错误，约 923.65 req/s，p95 130ms。
- 内网认证生成库 2000 请求、75 并发：零错误，约 902.53 req/s，p95 118ms。
- 9 分 45 秒 canary：40 轮、200 项检查零错误，p95 61ms，最大 181ms。
- canary 结束时 API/Worker `NRestarts=0`；API 当前/峰值内存约 326/756 MiB，Worker 当前/峰值约 225/242 MiB。
- `2026-07-18 14:20 +08:00` 后 API/Worker journal warning 为 0，Production Nginx 新错误为 0。

## 数据与观察项

- 发布前备份已通过大小、SHA-256 和 `pg_restore --list` 校验。
- reconciliation dry-run 扫描 23 个用户、713 条 Artifact，发现 33 个既有 legacy 候选；`apply=false`、`updatedIds=0`，本次未主动批量清理。
- `v0.7.4` 发布时跳过的 2 个损坏 legacy JSON 继续保留为专门数据修复观察项，不影响 PostgreSQL authority 中的有效记录。
- catalog reconciliation 在验收窗口将 4 个已删除共享资源 subjects 标为 retired；14 条旧规则经管理员 API revision guard 精确删除后，readiness 恢复为 ready。未执行会新增 2166 条规则的全量 reconciliation apply。
- Retention apply 仅删除旧 `v0.7.2` Release；复核 current、rollback、3 个保留目录和严格 runtime 全部通过。
