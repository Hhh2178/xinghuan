# Gray 默认开放权限与画布恢复执行计划

## 目标

在不触碰 Production 的前提下，恢复测试账号孤立画布；将普通成员前台创作和消费能力统一为“已发布对象默认允许、后台显式关闭”；永久隔离公共资源管理员治理能力；完成节点摘要和服务商列表 UI 修复并发布 Gray。

## 安全边界

- 画布、个人资源和任务只绑定稳定 user id，不绑定 group id。
- 管理员公共资源上传、分类、编辑、删除、发布不进入可授权目录，成员 API 始终返回 `403`。
- 数据操作先备份、dry-run，再事务 apply；原始画布 JSON 不删除。
- 只部署 Gray，Production release、服务和数据库均不修改。

## 执行阶段

1. 固化 Gray 数据库、孤立快照、旧组策略和统一权限规则来源证据。
2. 用事务恢复 DB 中缺失的画布快照；跨 owner ID 冲突整体回滚；重复执行无新增。
3. 修改默认值：新组、缺失组策略为空 deny；已发布 Subject 无匹配规则默认允许。
4. 用路由契约和真实 HTTP 测试锁定公共资源管理员边界。
5. 将统一节点决策投影到 `/api/me/permissions`，保留未知旧 deny 兼容项。
6. 对 Gray 系统默认全禁策略执行受控迁移；人工 deny 保留。
7. 移除图像/视频节点无用途参数摘要；服务商侧栏桌面 sticky、窄屏静态。
8. 执行全量测试、build、三层 Harness、CodeGraph、文档和 release gate。
9. 提交并推送分支，备份 Gray 数据，发布新 release，执行真实账号验收。

## Gray 验收

- 换组前后画布 ID 集合、个人资源和任务 owner 不变。
- 测试账号恢复 4 个画布且重复读取不重复导入。
- 节点默认可见，已发布公共工作流可查看和使用。
- 后台显式 deny 后对应前台能力隐藏且直接调用被拒绝。
- 普通成员看不到公共资源管理控件，所有管理 API 返回 `403`。
- API/Worker active，status 为 Gray 目标 release，permission readiness 通过。
- Production 保持原 release 与运行态。
