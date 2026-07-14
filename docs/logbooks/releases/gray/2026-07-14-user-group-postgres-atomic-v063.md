# v0.6.3 用户组 PostgreSQL 原子创建灰度记录

- 日期：2026-07-14
- 版本：`v0.6.3`
- 环境：gray，`canvas-next.hhh2121.xyz`
- 范围：修复后台创建用户组时 `xh_group_permission_policies_updated_by_fkey` 外键失败，以及成功响应后分组被旧快照覆盖的问题。
- 保护：生产 `canvas.hhh2121.xyz` 不在本次操作范围内。

## 根因

- PostgreSQL 全量认证数据写入先删除用户、再恢复带 `updated_by` 的权限策略，策略引用的管理员尚未恢复，触发外键失败。
- 创建路径先单独插入用户组、再使用创建前读取的认证快照做全量替换，旧快照会覆盖新组，造成组与默认策略不一致。

## 修复

- 全量恢复顺序调整为：用户组、用户、分组权限策略、会话、登录尝试。
- 新组与默认关闭策略写入同一份 `nextAuthDb` 快照，并在一个 PostgreSQL 事务内提交。
- 读取 PostgreSQL 策略时忽略没有真实用户组且非 `ungrouped` 的历史孤立策略，避免继续传播异常记录。

## 本地验证

- `auth-postgres-write-order.test.ts` 先以外键恢复顺序和原子快照契约失败，再随修复通过。
- 任务生命周期、任务仓储、后台任务列表路由与用户组回归测试共 13 项通过。
- `@xinghuan/api` 类型检查通过。

## 灰度部署与验收

- release：`20260714-user-group-postgres-atomic-v063`
- 部署目录：`/opt/apps/xinghuan-canvas-next/releases/20260714-user-group-postgres-atomic-v063`
- 迁移：本批次没有新增数据库迁移；既有 22 个迁移均已存在并跳过。
- 运行态：灰度 API 与 Worker 均为 `active`；内网和公网状态接口均为 `version=0.6.3`、`environment=gray`。
- 真实验收：使用灰度管理员会话完成“创建临时用户组 -> 列表读取 -> 默认关闭策略读取 -> 数据库确认组与策略各一条 -> 精确清理 -> 登出”。全部通过。
- 数据完整性：验收后临时分组为 0，非 `ungrouped` 的孤立权限策略为 0。
- 保护：生产环境未修改，仍运行 `v0.5.22`。
