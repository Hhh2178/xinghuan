# 权限默认值与管理员边界

## 普通成员默认权限

- 已发布的前台 Subject 在没有匹配规则时默认允许。
- 用户规则优先于用户组规则；显式 deny 用于关闭能力。
- 未发布或已退役 Subject 不因默认允许而开放。
- 新建组和缺失旧组策略均使用空 deny-list。

默认允许覆盖画布节点、已发布模型、已发布公共资源的查看与使用、已发布 RunningHub 应用与工作流等前台创作和消费能力。

## 管理员专属能力

以下能力不进入用户组或单账号可授权 Action：

- 上传、新增公共资源；
- 创建、调整公共资源分类；
- 编辑、删除、发布公共资源；
- 后台、密钥、运维和其他公共资源治理操作。

前端隐藏只用于体验，后端 `requireAdmin` 和成员 HTTP `403` 是最终安全边界。

## 兼容投影

- 统一权限 Subject/Rule 是最终决策来源。
- `/api/me/permissions` 将统一节点决策投影为前端兼容 deny-list。
- 旧 deny-list 中目录未知的历史 ID继续保留，防止迁移期间静默放权。
- 资源与 RunningHub 目录、使用和执行入口都必须调用同一统一决策。

## 后台授权交互边界

- `exposureState` 是全局目录状态，不属于当前选中的用户组或账号；全局受限时，任何组规则或账号规则都不能重新开放该 Subject。
- 权限矩阵中间的快捷按钮和右侧动作下拉框只写入当前选中主体的规则，不得修改 `exposureState`。
- “少数账号可用”的标准配置顺序是：Subject 保持全局发布，先对目标用户组写入 `deny`，再对例外账号写入 `allow`；账号规则优先于用户组规则，组内其他账号继续保持禁止。

## 模型全局发布权威

- Provider 模型的启用状态是模型全局发布的唯一权威：启用模型对应 Subject 必须为 `published`，停用模型对应 Subject 为 `restricted`，删除模型由目录 reconciliation 标记为 `retired`。
- 模型权限矩阵只写组或账号的 `view / execute` scoped rules；不得通过权限 Subject API 手工改写模型的全局曝光状态。
- 新启用模型和历史上误留为 `restricted` 的启用模型，会在目录 reconciliation 时自动修复为 `published`。
- “普通成员屏蔽、管理员可见”必须通过全部目标组（含 `ungrouped`）的 `deny` 表达；如需少数成员例外，再写账号 `allow`。

## 默认关闭存量迁移

- `permissions:migrate-default-open` 默认只 dry-run。
- apply 必须显式指定期望数据库名。
- 自动候选必须同时满足：五类 deny 恰好为 `['*']`、策略时间与组创建时间相差不超过 1 秒、没有非 `legacy-reconciliation` 来源 deny。
- apply 只清空候选组旧 deny-list，并只删除自动 reconciliation deny；人工 deny 不删除。
- Gray apply 前必须备份权限相关表，并限制到已确认 principal。

## Ownership

账号换组只改变权限主体，不改变画布、个人资源或任务的 `owner_id`。换组验收必须比较前后画布 ID 集合，而不只比较数量。

## 账号删除与 Agent 知识快照

- 删除用户会级联删除其 Agent Runs 与专属 Knowledge Snapshots；快照直接更新/删除仍由数据库触发器禁止。
- Knowledge Snapshot 到 Agent Run 的外键在事务提交时检查，保证级联顺序不影响删除；若另一个仍存续的 Run 引用该快照，事务失败并整体回滚。
- 数据库迁移：`apps/api/db/050_snapshot_account_deletion.sql`。
