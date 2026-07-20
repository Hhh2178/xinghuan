# AICOPY Video Contract Scope Gray v0.7.8 发布

- release：`20260720-aicopy-video-contract-scope-gray-r1-v078`
- source commit：`e08c290bd7625de88037e1da646a46d17172b488`
- 制品：`dist-release/20260720-aicopy-video-contract-scope-gray-r1-v078.tar.gz`
- 大小：`1,851,446` bytes
- SHA-256：`309362abb563bedfba5d62debbeed2c472355385f90b67dcb01132b914d8e4f6`
- 回滚：`20260720-model-publication-sd-scope-gray-r1-v077`

## 结果

- Admin 移除旧 SD 模型 ID 白名单；所有 `protocol=aicopy + capability=video` 模型均显示 SD 补充请求契约入口。
- 开关与契约只写入当前模型；未开启的 Grok 等模型不会被自动注入 SD 字段。
- 本次无数据变更，24 个迁移全部 skipped；Gray 内外网为 `0.7.8 / gray / enforced`，API/Worker active。
- Retention 保留 v0.7.8 current、v0.7.7 rollback 与 v0.7.6，删除旧 v0.7.5 r2 Release 并释放 `316,456,960` bytes；shared/备份/用户素材未触碰。
