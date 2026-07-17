# Admin 十域版本口径修正 Production v0.7.3 发布

## 发布信息

- release：`20260717-admin-ten-domain-version-correction-prod-r1-v073`
- 来源 Gray：`20260717-admin-ten-domain-version-correction-gray-r1-v073`
- source commit：`b6a8c273c04fd55885a7023b6448e8d009f5700d`
- 与 Gray 共用中性发布包，SHA-256：`40a55669c5fafc4927026fbd5978fd569384f74531c7a076399f7fff0ec25242`
- 回滚：`20260717-audit-rankings-prod-r1-v072`

## 数据保护

- 发布前数据库确认为 `xinghuan_canvas_next`。
- custom dump：`/opt/apps/xinghuan-canvas/shared/backups/20260717-admin-ten-domain-version-correction-prod-pre-v073.dump`。
- 备份大小 `20,192,207` bytes，SHA-256 `7bb1baad56e25befe834552e1c73a147ca579137439bd40c2f50c250cf8c6afd`，`pg_restore --list` 通过。
- 无新增数据库迁移，`db:migrate` 为 `applied: [] / skipped: 23`。

## 结果

- API 与 Worker active；内外网状态均为 `v0.7.3 / production / enforced`。
- readiness：134 Subjects、120 published、10 restricted、4 retired、466 rules、11 principals、0 failures。
- Production 精确保留最近三个 Release，当前与回滚目录均存在。
