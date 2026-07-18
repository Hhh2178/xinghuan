# Generation Artifact Authority Production v0.7.4 发布与回滚

## 发布信息

- release：`20260718-generation-artifact-authority-prod-r1-v074`
- 来源 Gray：`20260718-generation-artifact-authority-gray-r4-v074`
- source commit：`e11c86a13a0a5bcfd14b08dcca963d8857be97c3`
- 与 Gray 共用制品：`20260718-generation-artifact-authority-v074-r4.tar.gz`
- SHA-256：`491bd968db695c0ded2f8db35308db6740cdc73ae073e1e32f0e65afe750d41e`
- 回滚：`20260717-admin-ten-domain-version-correction-prod-r1-v073`

## 数据保护与迁移

- 发布前数据库、期望数据库均为 `xinghuan_canvas_next`；数据目录与队列分别为 Production 专用的 `/opt/apps/xinghuan-canvas/shared/data`、`xinghuan:tasks:prod`。
- custom dump：`/opt/apps/xinghuan-canvas/shared/backups/20260718-pre-v074-generation-artifact-authority.dump`。
- 备份大小 `30,566,755` bytes，SHA-256 `de4a05f819e8a207ed170a3e128eb52f7a6d7a989e1168fe804bbc3b804725a6`，`pg_restore --list` 通过。
- `db:migrate` 应用 `024_generation_artifacts.sql`，跳过 23 个已有迁移。
- legacy migration 扫描 29 个用户、22 个文件、698 条有效记录并写入 698 条；3 个已不存在 owner 被跳过，2 个既有 JSON 尾部损坏文件被安全跳过。

## 结果

- API、Worker、output prune timer active；内外网状态均为 `v0.7.4 / production / enforced`。
- readiness：134 Subjects、120 published、10 restricted、4 retired、466 rules、11 principals、0 failures。
- 真实 Worker Artifact、Promotion 幂等、Asset 文件保护、Canvas/Resource、请求链与系统可观测性验收通过。
- Production 数据库最终 698 条 Artifact；所有权、dedupe、Task/Asset owner mismatch、Verifier Provider 残留和等待锁均为 0。
- 公网压力测试触发一次 `ERR_HTTP_HEADERS_SENT` API 退出；本批次判定失败并回滚到 `v0.7.3`，不得作为当前 Production release。
