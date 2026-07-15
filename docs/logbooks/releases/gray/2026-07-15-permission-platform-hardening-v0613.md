# v0.6.13 统一权限平台防回归灰度发布

## 发布信息

- 版本：`v0.6.13`
- 环境：仅 gray
- release：`20260715-permission-platform-hardening-v0613`
- 发布包：`dist-release/20260715-permission-platform-hardening-v0613.tar.gz`
- 回滚：`20260715-aifork-grok-fast-preprocess-v0612`
- Production 保持：`v0.5.22`

## 根因

- 统一 Subject 已注册并限制普通成员，但规则、旧策略迁移、统一后台和发布门禁没有同时落地。
- 管理员绕过权限，因此后台看似正常；普通成员的模型、RH、资源和节点目录可能整体为空。
- 路由 revision 预检没有下沉到 PostgreSQL，两个管理员仍可能在检查后互相覆盖。

## 变更

- 增加 `legacy / shadow / enforced` 三态权限运行时；gray 先以 `shadow` 保持旧权限权威。
- 增加幂等 reconciliation、readiness CLI、强制模式启动门禁和灰度 release 检查。
- 模型、RH、公共资源、节点目录与直接执行统一走 Subject/Action 判定。
- 后台用户治理切换到统一权限工作区，支持组、未分组、账号覆盖、发布状态、审计原因和服务端批量 explain。
- Subject/Rule 更新与 Rule 删除使用 PostgreSQL 原子 revision 条件，竞态稳定返回 `409`。
- 节点侧栏、资源插入、生成库插入和工作流导入共享同一新增权限边界；已有画布节点仍可加载。

## 发布顺序

1. 备份 `xh_permission_subjects`、`xh_permission_rules` 与 `xh_group_permission_policies`。
2. 部署 `shadow` 并验证旧权限继续权威。
3. reconciliation dry-run；对缺失旧策略显式选择 `allow`，保持当前 legacy 的空 deny 行为。
4. 事务 apply，第二次 dry-run 必须为零变更。
5. readiness 与未分组/命名组成员目录验收通过后切换 `enforced`。
6. 验证账号 deny 覆盖组 allow、账号 allow 覆盖组 deny，并按 revision 回滚探针规则。

## 本地验证

- 构建通过；27 个测试文件、103 项测试通过。
- Lint 0 error；project harness、权限 hardening contract、热点与暂存文件护栏通过。
- Production 本轮禁止修改。
