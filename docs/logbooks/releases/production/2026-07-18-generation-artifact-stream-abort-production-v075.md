# Generation Artifact Stream Abort Production v0.7.5 发布

## 发布信息

- release：`20260718-generation-artifact-stream-abort-prod-r1-v075`
- 来源 Gray：`20260718-generation-artifact-stream-abort-gray-r2-v075`
- source commit：`567bd27215a5ba0da875ed239fdc0d952340348a`
- 与 Gray 共用制品：`20260718-generation-artifact-stream-abort-v075-r2.tar.gz`
- SHA-256：`261fd44b75a2662b9510697207f743f81ebd893917b7d0413f2dce69688e35d8`
- 回滚：`20260717-admin-ten-domain-version-correction-prod-r1-v073`

## 数据保护与切换

- Production 数据库、数据目录和队列分别为 `xinghuan_canvas_next`、`/opt/apps/xinghuan-canvas/shared/data`、`xinghuan:tasks:prod`，均未复用 Gray。
- 切换前 custom dump：`/opt/apps/xinghuan-canvas/shared/backups/20260718-before-generation-artifact-stream-abort-v075-r1.dump`。
- 备份大小 `30,727,532` bytes，SHA-256 `761428619002f19e64f59bbfec9d1b3f0651d86c99e4e0a18a4c74732b3c229f`，`pg_restore --list` 返回 126 条有效条目。
- `db:migrate` 跳过 24 个已应用迁移，没有重复执行 Generation Artifact legacy 导入。

## 结果

- API、Worker、output prune timer active；内外网状态均为 `v0.7.5 / production / enforced`，权限 readiness 为 ready。
- release 内隔离回归、真实 Production 500 次认证 Artifact 内容流中断、Worker/Promotion、Canvas/Resource、请求链与系统可观测性全部通过。
- 75 并发公网 3000 请求和认证生成库 2000 请求均零错误，p95 分别为 130ms 和 118ms。
- 9 分 45 秒 canary 完成 40 轮、200 项 status/home/JS/CSS/匿名鉴权检查，零错误，p95 61ms，最大 181ms。
- API/Worker `NRestarts=0`；切换稳定后 journal warning 和 Production Nginx 新错误均为 0。
- Generation Artifact reconciliation 仅 dry-run；713 条记录中有 33 个既有 legacy 候选，`updatedIds=0`，未执行批量治理。
- catalog reconciliation 将 1 个已删除共享资源分类和 3 个已删除资源条目标记为 retired 后，14 条旧规则短暂触发 readiness gate；已通过管理员 API revision guard 逐条删除并复验 ready。
- Production retention 通过受保护脚本保留当前 `v0.7.5`、事故证据 `v0.7.4` 和回滚 `v0.7.3`，移除旧 `v0.7.2` Release，释放 `307,757,056` bytes；`shared/`、备份和用户数据未触碰。
