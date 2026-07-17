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

## 用户目录写入约束

- PostgreSQL 运行态禁止 Auth、Admin、Provider 和 Settings 全量删除后重建；批量导入只能存在于显式离线脚本。
- 创建用户组与默认策略必须在同一事务中定点插入；更新分组策略必须按 `group_id` upsert。
- 用户换组只允许更新 `xh_users.group_id`，不得删除重建用户记录。
- 用户目录配置写入不得触碰画布、项目、素材、任务 owner 或会话之外的业务归属关系。
- 用户删除是独立高风险命令；必须依赖明确的删除语义，不能被“更新用户/用户组/策略”间接触发。

## 任务身份不变量

- 用户发起的任务必须写入 `owner_id`，并在 payload/result 保留 `userId` 诊断快照。
- Worker 和后台任务状态更新不得把既有 `owner_id` 写为 null。
- 历史 `owner_id` 为空时，后台只读查询可按 `payload.userId -> result.userId` 回退显示；诊断快照不能替代新任务的主外键。
- 账号已真实删除时显示“已删除账号”，不能与缺失 owner 的“未知账号”混为一类。
