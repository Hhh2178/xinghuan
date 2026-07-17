# Admin 十域版本口径修正 Gray v0.7.3 发布

## 发布信息

- release：`20260717-admin-ten-domain-version-correction-gray-r1-v073`
- source commit：`b6a8c273c04fd55885a7023b6448e8d009f5700d`
- 中性发布包：`dist-release/20260717-admin-ten-domain-version-correction-v073.tar.gz`
- SHA-256：`40a55669c5fafc4927026fbd5978fd569384f74531c7a076399f7fff0ec25242`
- 回滚：`20260717-admin-ten-domain-gray-r1-v080`

## 发布内容

- 按用户明确授权将当前版本口径从 `v0.8.0` 修正为 `v0.7.3`；Admin 十域功能与交互能力保持不变。
- 新增版本与 Release 保留治理：后续 Gray 默认只递增 PATCH，Gray 与 Production 各保留最近三个 Release。
- 本批次无新增数据库迁移，`db:migrate` 为 `applied: [] / skipped: 23`。

## 结果

- API 与 Worker active；内外网状态均为 `v0.7.3 / gray / enforced`。
- readiness：127 Subjects、121 published、3 restricted、3 retired、926 rules、5 principals、0 failures。
- 清理后 Gray 精确保留三个 Release，当前指针与回滚锚点均存在。
