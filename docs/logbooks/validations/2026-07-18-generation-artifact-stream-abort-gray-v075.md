# Generation Artifact Stream Abort Gray v0.7.5 验证

## 当前结论

- 状态：`PASS`。
- 回归测试在修复前稳定触发 `ERR_HTTP_HEADERS_SENT` 与 API 退出；修复后 100 次认证内容流中断全部完成且 API 保持健康。
- `verify:quick`、release package contract、46 个测试文件与 168 项测试通过。
- Gray r2 严格 gate 返回 `0.7.5 / gray / enforced / readiness=true`，readiness 为 127 Subjects、121 published、926 rules、5 principals、0 failures。
- r2 release 目录内打包验证通过；真实服务 500 次认证内容流中断后 API 健康，`NRestarts` 保持 0，近 20 分钟 journal warning 为 0。
- 真实 Worker 产物登记、Promotion 幂等、删除后 Asset 文件保护通过；Canvas/Resource 返回 5 个画布、首画布 35 个节点和 22 条边、13 个图片资源。
- 5900 请求混合负载零错误：公网 100 并发 986.11 req/s、p95 169.78ms；内网认证列表 100 并发 1104.34 req/s、p95 105.62ms。
- 9 分 49 秒持续探针完成 40 轮，对 status、首页、主 JS、主 CSS 与匿名鉴权执行 200 项检查，状态码全部符合预期。
- 结束时 API 当前/峰值内存约 121/141 MiB，Worker 当前/峰值约 69/118 MiB；两服务 active，`NRestarts=0`。
