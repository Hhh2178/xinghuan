# Revision 与 Ownership 保护

## 当前稳定规则

- 画布、资源库、后台关键设置都已纳入 revision 冲突保护
- 跨用户访问与写入必须返回 ownership mismatch，而不是静默覆盖
- 统一权限 Subject 和 Rule 的 PostgreSQL 更新必须在单条 SQL 内校验前一 revision，不能只依赖路由先读后写
- 权限 Rule 删除必须携带当前 revision；更新或删除竞态统一返回 `409`

## 覆盖范围

- 画布
- 资源库
- AI 助手配置
- 任务并发与系统设置
- 统一权限 Subject 发布状态、组规则、账号覆盖规则及规则删除

## PostgreSQL 写入约束

- Subject UPSERT 仅在 `current.revision = excluded.revision - 1` 时允许冲突更新。
- 首次 Subject 注册允许“revision 相同且全部受管字段完全一致”的幂等并发重放；同 revision 但字段不同仍返回冲突。
- Rule UPSERT 使用相同条件，并通过 `RETURNING` 区分成功与并发冲突。
- Rule DELETE 使用 `id + revision` 条件和 `RETURNING`，避免旧页面删除已被其他管理员修改的新版本。
- 路由层的 revision 预检只用于快速反馈，数据库条件写入才是最终并发边界。
