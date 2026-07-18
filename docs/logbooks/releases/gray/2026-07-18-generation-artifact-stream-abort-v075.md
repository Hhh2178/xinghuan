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

- 本地 RED 已稳定复现 Production 栈，GREEN 后 API 持续存活。
- 46 个测试文件、168 项测试和关键治理门禁通过；Gray runtime 验收将在部署后补齐。
- r1 真实 Gray 已通过 500 次认证内容流中断；r2 修正 release verifier 直接使用已打包 dist，CI 仍在回归前显式构建 API。
