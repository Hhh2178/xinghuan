# Generation Artifact Stream Abort Gray v0.7.5 发布

## 发布信息

- release：`20260718-generation-artifact-stream-abort-gray-r2-v075`
- source branch：`xinghuan-integration-clean`
- 版本：`0.7.5`
- 回滚：`20260718-generation-artifact-authority-gray-r4-v074`

## 变更

- 修复客户端中断 Generation Artifact 内容流后顶层 catch 二次写 headers 导致 API 退出的问题。
- 新增 100 次认证 Artifact 内容流中断回归，并纳入 `verify:quick` 与 release package。
- 保持 `v0.7.4` 的 Generation Artifact authority、迁移、Promotion 与 reconciliation 行为不变。

## 状态

- 制品：`dist-release/20260718-generation-artifact-stream-abort-v075-r2.tar.gz`，SHA-256：`261fd44b75a2662b9510697207f743f81ebd893917b7d0413f2dce69688e35d8`。
- 本地 RED 已稳定复现 Production 栈，GREEN 后 API 持续存活；46 个测试文件、168 项测试和关键治理门禁通过。
- r2 release 目录内 `npm run verify:api-aborted-response` 直接使用已打包 dist 并通过 100 次中断回归，CI 仍在回归前显式构建 API。
- Gray 严格 runtime/readiness、真实 Worker/Canvas/Resource、500 次真实认证内容流中断、5900 请求混合负载和 9 分 49 秒持续探针全部通过；API 与 Worker `NRestarts=0`，journal warning 为 0。
