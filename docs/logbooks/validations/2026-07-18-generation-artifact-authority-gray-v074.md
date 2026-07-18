# Generation Artifact Authority Gray v0.7.4 验证

## 结论

- 状态：`PASS_WITH_OBSERVATION`。Gray 无运行态阻断项；按用户要求，Production 继续暂停且未执行任何切换。
- 严格 runtime gate 返回 `0.7.4 / gray / enforced / readiness=true`，API 与 Worker 均 active。
- 匿名首页返回 200，匿名生成库返回 401，缺 Origin 登录返回 403，外部 Artifact URL 返回 400。

## 功能与并发

- 真实 Worker 任务成功生成 Artifact 并关联 Task、Node、Canvas；Promotion 重复调用返回同一 Asset，删除 Artifact 后 Asset 与文件继续可读。
- Canvas/Resource API 返回 5 个画布、首画布 35 个节点和 22 条边、10 个图片资源。
- image/video/audio 登记与筛选通过；内容流读取通过。
- 25 路并发 Promotion 全部 200 且只产生 1 个 Asset；10 Promotion + 10 Delete 竞态只返回预期的 200/404。
- missing 内容返回 404；隔离临时过期记录返回 410，读取前后 `status/updated_at` 不变。

## Reconciliation 与数据

- 初次验收数据库 57 条 Artifact；全表 dry-run 前后指纹均为 `e04ed80b09301a47691e6ca416e49f3c`。
- reconciliation：0 candidates、2 protected files、0 updates、0 deleted files、0 deletion failures。
- null owner、重复 dedupe、Task owner mismatch、Asset owner mismatch、Verifier 非终态任务、Verifier Provider 残留、Worker/Artifact cardinality error 均为 0。
- Artifact 表约 196608 bytes，列表查询执行时间 0.08ms；数据库连接 2，active 1，无长查询；Redis chat/image/video/audio 队列均为 0。

## 性能与稳定性

- 浏览器独立冷启动 5 次，Gray 全部 200、控制台零错误；p50/p95：TTFB 586/1402ms、FCP 3072/3692ms、LCP 4088/5052ms、load 3842/5022ms。
- Production 只读基线 p50/p95：TTFB 586/1146ms、FCP 3000/3788ms、LCP 4100/4824ms、load 3767/4549ms。Gray p95 TTFB 为 warning 级单点差异，但 80 样本 status 与持续 canary 未复现，未判定为回退。
- 公网 Gray 与 Production 各 560 请求均零错误。Gray status 顺序 p50/p95 403/420ms，25 并发 p95 1403ms；首页顺序 p50/p95 408/678ms，25 并发 p95 1380ms。
- Gray 内网认证生成库 500 请求零错误：顺序 p50/p95 1.90/3.23ms；40 并发 728 req/s，p95 63.66ms。
- 9.5 分钟 canary 每 30 秒检查 status、首页、主 JS、主 CSS 与匿名鉴权，共 100 项周期检查，零错误。
- API 当前/峰值内存约 115/138 MiB，Worker 约 75/119 MiB；两服务 `NRestarts=0`，journal warning 为 0。磁盘使用率 75%。

## 验证说明

- 浏览器采样截图：`output/playwright/gray-r4-home.png`。
- Gray retention dry-run 准备保留 r4/r3/r2 并删除 canonical rollback v0.7.3，因此未执行 apply。Production 放行前需先修复保留脚本，使 current 与 rollback 同时受保护。
- 临时过期验证最初命中已有 dedupe 测试记录；已从仍存在的 Promotion Asset metadata 恢复原 Artifact ID 和 `deleted` 终态，最终行数、一致性审计及 reconciliation 指纹均重新通过。
- Nginx 两条 Gray error 均早于本轮 canary：一条外部访问规则拦截，一条部署切换瞬间 upstream refused；本轮持续检查未复现。

## Retention Follow-up

- 新增 rollback safety contract：脚本从 canonical state 读取 `rollbackReleaseId`，回滚目录缺失时拒绝继续，并禁止删除 current 或 rollback。
- 修复后的 dry-run 将 r4、r3 和 canonical v0.7.3 标记为 KEEP，只将 r2、r1、旧 v0.8.0 与 v0.7.2 标记为 PRUNE。
- apply 通过受 Harness 保护的入口完成，删除 4 个明确 Release；复核剩余数量为 3，current 与 rollback 均存在。
- 清理后 Gray runtime gate、API/Worker active、permission readiness 与公网 status 全部通过；Production status 仍为 v0.7.3。

## 扩展多场景验证

- 公网混合流量新增 6250 请求：顺序、10、50、100 并发场景中出现 1 次 15 秒超时，其余 6249 次均为 200；随后将 API/首页与静态资源拆分复测，API/首页 5000 请求和主 JS 资源 800 请求均零错误，未复现该超时，判定为公网链路瞬时抖动并保留 observation。
- 内网认证生成库新增 4750 请求，覆盖无筛选、image/video/audio 与无命中搜索：100 并发达到 1071.18 req/s，p50/p95/p99 为 87.76/134.88/143.17ms，全部返回 200。
- 5 路真实 Worker 验证并行执行，5 个任务全部 succeeded；Artifact 登记、Promotion 幂等、删除与 promoted binary 保护全部通过，临时 Provider 残留为 0。
- 同一 Artifact 的 100 Promotion + 100 Delete 高争用在 505.93ms 内完成：1 次 Promotion 200、99 次 Promotion 404、100 次 Delete 200，只生成 1 个 Asset；最终 Artifact content 为 404，被 Asset 引用时文件仍为 200。
- CSRF 边界返回预期的 403 `CSRF_ORIGIN_MISMATCH`；管理员/成员画布与资源隔离、跨用户读写拒绝、成员后台拒绝及临时数据清理全部通过。
- 15 分 3 秒持续探针每 15 秒检查 status、首页、主 JS、图标 JS 与匿名生成库，共 260 项检查；200/401 状态完全符合预期，零错误、零重启、journal warning 为 0。
- 压力期间 API 峰值内存约 219 MiB，结束后稳定在约 135 MiB；Worker 当前/峰值约 80/119 MiB。服务均保持 active，`NRestarts=0`，Redis Gray 队列为空，数据库无等待锁。
- 扩展验证产生的 6 个临时 Asset 已逐项删除，用户可见资源库无测试 Asset 残留；对应文件通过逐项 Artifact 删除清理。数据库保留 6 条终态审计行，最终 63 条 Artifact 全部为终态，dry-run 前后指纹均为 `3b09704c4684722179f1feba045d092b`。
- 最终 reconciliation 为 0 candidates、0 writes、0 deleted files、0 deletion failures、2 protected files、0 corrupt files；Production current 复核仍为 `20260717-admin-ten-domain-version-correction-prod-r1-v073` / `v0.7.3`。
