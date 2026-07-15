# v0.6.11 AIFork Grok FAST 请求契约灰度发布

## 发布信息

- 版本：`v0.6.11`
- 环境：仅 gray
- release：`20260715-aifork-grok-fast-contract-v0611`
- 发布包：`dist-release/20260715-aifork-grok-fast-contract-v0611.tar.gz`
- Production 保持：`v0.5.22` / `20260702-envsync-admin-sections-prod-r1-v0522`

## 根因

- `v0.6.10` 只把 FAST 参考图从公网 URL 改成 Data URL，仍沿用 Preview 的 `seconds/size/images` 字段。
- 真实插件的 FAST 分支要求 `duration`、`video_length`、`aspect_ratio`、`resolution`、`video_config` 和 `reference_images`。
- 因字段契约错误，公网 URL 与 Data URL 三图任务均在上游内部第 3 张素材处理阶段返回 403。

## 变更

- 增加通用 `requestContractEnabled`，兼容但不等同于 SD 专用 `aicopyRequestContractEnabled`。
- 目标 FAST 模型独立写入插件一致的请求 bindings，并继续仅在内存中转换 Data URL。
- 后台保存 FAST 配置时不再把通用契约误判成 SD 补充契约。
- Worker 请求摘要兼容 `reference_images`、`aspect_ratio` 和嵌套 `video_config`。

## 验证

- FAST 三图精确请求体回归通过，断言不存在 `seconds`、`size`、`images`。
- 全工作区类型检查、单端口构建和 22 个测试文件共 70 项测试通过。
- 灰度真实任务、上游任务和输出物料证据记录在对应 validation 文件中。

## 边界

- 只修改 `api.aicopy.top` 下目标 `grok-imagine-video-1.5-fast` 的模型配置。
- 不改变其他 AIFork 模型、其他 Provider、SD 请求契约和生产环境。
