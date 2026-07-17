# 用户目录全量替换导致业务归属数据丢失

Date: 2026-07-17

## 状态

- 根因已确认，本地修复与专项测试已完成。
- Production 尚未部署本轮修复，也未执行历史数据写回或恢复。
- 在修复部署前，不得在 Production 创建用户组或保存旧分组权限策略。

## 现象

- 后台任务列表大量显示“未知账号”。
- 账号换组或创建用户组后，用户画布和侧边栏个人资源消失。
- 权限 Subject 从“受限”切换为“已发布”偶发无可见反馈。

## 根因

1. 用户组创建和旧分组权限策略保存调用运行时 `writeAuthDbPostgres`。
2. 该函数先删除 `xh_users`，再用相同 ID 重建用户。
3. `xh_canvases / xh_projects / xh_assets` 对用户外键使用 `ON DELETE CASCADE`，因此业务数据被级联删除。
4. `xh_tasks.owner_id` 使用 `ON DELETE SET NULL`，因此历史任务保留但显示“未知账号”。
5. 权限 Subject metadata 使用 `JSON.stringify` 比较；PostgreSQL JSONB 返回键顺序变化会误增 revision，导致管理员提交命中 `409`。

## Production 只读证据

- 最近 24 小时抽样时，255 条任务中 242 条 `owner_id` 为空，悬空 owner 外键为 0。
- 当前 6,833 条任务中 6,797 条 owner 为空；其中 6,709 条可从 `payload/result.userId` 恢复身份显示。
- 当前数据库有 20 个画布；用户数据目录存在 58 个画布 JSON，可作为孤儿快照恢复候选。
- 当前素材表有 19 条记录。被级联删除的素材不能仅凭任务记录自动重建，需对照文件、备份和 ownership 后单独恢复。
- 审计记录显示用户组创建发生后，旧任务 owner 立即为空；后续新任务 owner 正常，且 API/Worker 未在分界点重启。

## 修复

- 新增用户目录定点写入 repository：用户组和默认策略在一个事务中插入，策略更新按 `group_id` upsert。
- 移除 API 运行时 Auth、Admin、Provider、Settings 的 PostgreSQL 全量替换能力；离线迁移继续由显式脚本承担。
- 权限 metadata 改为键顺序无关的语义深比较。
- 权限 revision 冲突时刷新最新 Subject，并在目标状态未达成时安全重试一次；结果显示在当前行。
- 任务 owner 查询统一回退到 `owner_id -> payload.userId -> result.userId`；任务写回不得把已有 owner 清空。

## 恢复边界

- 历史任务：本轮通过只读查询回退恢复后台显示，不修改 Production 数据。
- 画布：使用现有孤儿快照发现与 ownership 冲突检查，先生成候选清单，再由用户确认后恢复。
- 素材与项目：先做备份/文件清单差异分析；没有稳定 ownership 证据时禁止自动写回。
- 任何恢复前必须先完成 Production 数据库备份并验证 `pg_restore --list`。
