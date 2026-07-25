# Media Retention v0.8.1 Gray

- release: `20260725-media-retention-v081-r2`
- version: `0.8.1`
- source commit: `85b1993`
- archive SHA-256: `AE5D388A6D8894610C2FE3FDDFBA8229E1D3AA099F193BA7E6F32D35CD186453`
- rollback: `20260725-ai-governance-runtime-current-gray-r1-v0744`

## Scope

- 修正 Canvas Run 引用保护查询：通过 `xh_canvas_runs` 解析 `owner_id`。
- 启用临时上传 24 小时 TTL、生成制品 72 小时保留、资源库/运行中任务保护和删除重试摘要。
- 同一制品部署到旧服务器 Gray 与新服务器 Gray。

## Deployment

- 旧 Gray：`canvas-next.hhh2121.xyz`，release current 已切换。
- 新 Gray：`canvas-next.zezhen.online`，release current 已切换。
- 两端均应用 `045_ephemeral_upload_retention.sql`，此前 44 条迁移保持不变。
- 未执行 release retention prune，未删除正式构建包或用户媒体迁移源。

## Result

- 两端 API/Worker active，内部与公网 `/api/status` 返回 `0.8.1 / gray / enforced`。
- 两端 `xh_ephemeral_uploads` 表存在。
- 清理 dry-run：新 Gray 无候选；旧 Gray 无制品候选，仅报告历史孤儿文件，未盲删。
