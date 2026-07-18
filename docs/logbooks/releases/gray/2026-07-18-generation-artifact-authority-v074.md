# Generation Artifact Authority Gray v0.7.4 发布

## 发布信息

- Release：`20260718-generation-artifact-authority-gray-r4-v074`
- Source commit：`e11c86a13a0a5bcfd14b08dcca963d8857be97c3`
- 制品：`dist-release/20260718-generation-artifact-authority-v074-r4.tar.gz`
- SHA-256：`491bd968db695c0ded2f8db35308db6740cdc73ae073e1e32f0e65afe750d41e`
- 回滚：`20260717-admin-ten-domain-version-correction-gray-r1-v073`
- Production：保持 `v0.7.3`，本批次未推送

## 发布内容

- Generation Artifact 成为生成库权威数据源，Worker 输出完成 Task、Node、Canvas 和文件物料化关联。
- Promotion 使用稳定 Asset ID，重复与并发调用保持幂等；删除 Artifact 不删除已晋级 Asset 仍引用的文件。
- PostgreSQL reconciliation 在 claim 前识别 Asset 引用并跳过候选写入，同时保留 claim 后二次引用检查。
- 匿名请求不再在非 Artifact 路由上求值空用户 ID；live verifier 已补齐同源请求、分页响应、任务 capability 与 release 打包。
- 数据库迁移结果：24 项 skipped，legacy migration 42/42 valid and applied。

## 结果

- API、Worker、内外网 status、enforced permission readiness 全部通过。
- Gray 功能、并发、性能、资源、稳定性与数据一致性验收通过，详见对应 validation logbook。
- Production 未备份、未部署、未切换，继续等待用户明确放行。
