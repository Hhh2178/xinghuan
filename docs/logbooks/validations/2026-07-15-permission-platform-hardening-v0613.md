# v0.6.13 统一权限平台灰度验收

## 本地证据

- 权限专项：10 个测试文件、44 项测试通过。
- 全仓：27 个测试文件、103 项测试通过。
- 根构建、全 workspace 类型检查、Lint、project harness 和权限发布契约通过。
- 审查修复：Subject/Rule UPSERT 竞态、Rule DELETE 竞态、并发首次注册、节点新增绕过、权限目录 N+1。

## 灰度数据验收要求

- reconciliation dry-run 显式报告全部组和 `ungrouped`。
- apply 在事务内完成，第二次计划为零变更。
- readiness 必须为 `ready=true`，无 orphan rule/principal、无 retired subject rule、无缺失 action coverage。
- 真实未分组成员、命名组成员的模型、图片、视频、RH 和公共资源目录非空。
- 账号 deny 覆盖组 allow、账号 allow 覆盖组 deny 均通过，探针规则与组基线恢复成功。
- 不调用任何付费生成模型。

## 灰度运行态

- 待部署后补充服务、版本、模式、备份、迁移、真实账号与浏览器证据。
