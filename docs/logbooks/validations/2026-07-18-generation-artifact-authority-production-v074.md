# Generation Artifact Authority Production v0.7.4 验证

## 结论

- 状态：`FAILED_ROLLED_BACK`。同一制品曾晋级 Production，但公网压力测试触发 API 退出，已回滚到旧 `v0.7.3`。
- 严格 runtime gate 通过：内外网均为 `0.7.4 / production / enforced / readiness=true`，API、Worker、output prune timer active，Nginx 配置正常。
- Production 数据库、data dir、Redis queue 与 Gray 隔离；发布前 custom dump 已通过大小、SHA-256 与 `pg_restore --list` 校验。

## 功能与数据

- 真实 Worker 任务成功登记 Artifact；Promotion 幂等、删除 Artifact 后 Asset 与文件保护通过。测试 Asset 已清理，临时 Provider 残留为 0。
- Canvas/Resource API 返回 5 个画布，首画布 35 节点、22 边；请求链与系统可观测性 verifier 通过，requestId 样本覆盖率 100%。
- 迁移导入 698 条有效 legacy Artifact；3 个已不存在 owner 和 2 个损坏 legacy JSON 被安全跳过，没有写入无效记录。
- 最终 698 条 Artifact：304 active、394 terminal；null owner、重复 dedupe、Task owner mismatch、Asset owner mismatch 和等待锁均为 0。
- reconciliation dry-run 前后指纹均为 `f813ba8390615aa13d554e7d0ab4f08e`，零写入；发现 25 条 missing、1 条 expire、1 条 expired binary cleanup 候选，均为既有 legacy 状态偏差，无 Asset 引用保护冲突，本次未主动批量清理。

## 性能与稳定性

- 内网认证生成库 3000 请求、50 并发全部 200：825.26 req/s，p50/p95/p99 为 54.96/90.04/130.55ms。
- 首轮公网混合压测出现 1 次 502 与 3 次超时；拆分复测的顺序阶段短暂出现 7 次 502，但其后 25/75 并发共 3000 请求全部 200，Nginx 无对应新增 upstream error。
- 后续本机 500 请求与服务器外网回环 1000 请求全部 200；10 分 8 秒 canary 对 status、首页、主 JS、图标 JS 与匿名生成库执行 165 项检查，全部符合 200/401 预期，未复现 502。
- API/Worker 无重启；压力后 API 当前/峰值约 170/260 MiB，Worker 当前约 87 MiB，服务持续 active。

## 观察项

- 2 个损坏 legacy JSON 保留原文件等待专门数据修复，不影响 PostgreSQL authority 中的 698 条有效记录。
- 公网 502 未形成连续模式且在 4500 次后续请求与 canary 中未复现，保留为链路 observation。
- 系统面板的任务失败率与 revision conflict critical 状态来自部署前累计历史数据，发布后 verifier 未发现新运行态故障。
- `12:39:44 +08:00` API 因流式响应断开后的二次 headers 写入退出；systemd 自动恢复后仍按发布门禁主动回滚，不以自动恢复替代稳定性验收。
