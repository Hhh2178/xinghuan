# v0.7.2 审计账号与分组排行榜 Gray 发布

## 发布信息

- release：`20260717-audit-rankings-gray-r2-v072`
- source commit：`ec47e189af9c93a345d458f652af4182b9537cd9`
- 发布包：`dist-release/20260717-audit-rankings-gray-r2-v072.tar.gz`
- SHA-256：`8418c98d9e48abc8fedbf4bae5ce1775bb9134576c7332c715663a87ceb9a986`
- 回滚：`20260717-audit-account-ranking-gray-r1-v072`
- Production：保持 `v0.7.0`，本批次未触碰。

## 发布内容

- 账号排行榜从 Top 5 摘要改为完整账号目录，并保留有历史成功任务的未知或已删除归属行。
- 分组能量条改为完整分组目录，同时保留未分组历史统计；零用量账号和分组显示为 0。
- 两个排行榜均按成功调用次数降序，从容器顶部紧凑排列；外层面板尺寸不变，内容超出时在面板内部纵向滚动。
- 账号下钻、模型总使用次数、RH 条目总使用次数和现有筛选口径保持不变。

## 数据保护

- 本批次仅修改 Admin 前端展示与纯函数排序，无数据库 schema 或数据写入变更。
- `db:migrate` 执行结果为 `applied: [] / skipped: 23`。

## 结果

- API 与 Worker active；内外网 `/api/status` 均为 `v0.7.2 / gray / enforced`。
- readiness：127 Subjects、121 published、3 restricted、3 retired、926 rules、5 principals、0 failures。
- 真实后台审计页显示 29 个账号行和 5 个分组行；账号含 28 个当前账号与 1 个历史未知账号，分组含 4 个当前组与未分组行。
- 页面布局计算确认首行贴顶、`align-content: start`、`overflow-y: auto`；浏览器控制台 0 errors。
