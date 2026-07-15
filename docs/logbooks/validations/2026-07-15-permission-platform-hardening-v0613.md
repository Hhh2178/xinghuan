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

- release 指针：`/opt/apps/xinghuan-canvas-next/releases/20260715-permission-platform-hardening-v0613`。
- API/Worker：`active / active`；内网与公网状态均为 `0.6.13 / gray / enforced`。
- 迁移前：124 restricted、0 published、0 rules；readiness 按预期失败。
- 迁移后：117 published、7 restricted、932 rules、4 principals；readiness `true` 且无 failures。
- reconciliation 第二次 dry-run：`subjectUpdates=0 / ruleUpserts=0 / unresolved=0`。
- shadow 与 enforced 的未分组、命名组目录计数一致：模型 54、图像 11、视频 16、RH 7、资源 1、拒绝节点 0。
- 双向账号覆盖和 revision 回滚全部通过，回滚后规则总数仍为 932。
- 首次 enforced 启动发现 single-flight 变量 TDZ，自动回滚 shadow；修复并重新部署后 enforced 启动和 release verify 通过。
- 本机浏览器自动化后端未能启动；本批次不记录虚假的截图或控制台证据。

## 结论

- 统一权限已在 gray 成为权威来源，真实普通成员目录非空，账号覆盖优先级与回滚正确。
- Production 保持 `v0.5.22`，未修改生产服务、数据库或路由。
