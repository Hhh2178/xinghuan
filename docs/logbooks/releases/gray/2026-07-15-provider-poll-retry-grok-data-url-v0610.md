# v0.6.10 Provider 轮询重试与 Grok FAST Data URL 灰度发布

## 发布信息

- 版本：`v0.6.10`
- 环境：仅 gray
- release：`20260715-provider-poll-retry-grok-data-url-v0610`
- 发布包：`dist-release/20260715-provider-poll-retry-grok-data-url-v0610.tar.gz`
- Gray current：`/opt/apps/xinghuan-canvas-next/releases/20260715-provider-poll-retry-grok-data-url-v0610`
- Production 保持：`v0.5.22` / `20260702-envsync-admin-sections-prod-r1-v0522`

## 变更

- 为 Provider 幂等 GET 轮询增加统一的瞬时错误重试，覆盖 APIMart 视频轮询、APIMart 最终结果查询、AICopy 视频轮询、APIMart 图像轮询和 ModelScope 图像轮询。
- 仅重试网络异常、`408`、`425`、`429` 和 `5xx`；初次请求后最多重试 4 次，并遵守受上限约束的 `Retry-After` 和任务截止时间。
- 生成 POST 不进入重试，避免上游任务重复提交和重复计费。
- 在视频模型“输入能力 -> 参考图模式”内增加模型级参考图传输方式：默认 `公网 URL`，显式配置时使用 `Data URL`。
- FAST 模型继续支持最多 6 张参考图，只对 `AICopy` 协议、`api.aicopy.top` 和 `grok-imagine-video-1.5-fast` 的目标记录启用 `Data URL`。
- API/Worker 仅在提交前于内存中读取当前账号的本地素材并转换；Base64 不进入任务 payload、数据库和日志。
- 增加单图 20 MB、总原始大小 64 MB、受支持图片类型、账号所有权和首尾帧成员关系校验。

## 验证

- `npm run build:single-port`：通过。
- `npm test`：22 个测试文件、70 项测试通过。
- `npm run lint`：0 error；保留 200 个既有 warning。
- 全工作区类型检查、project harness、workspace harness、版本对齐和 release package contract：通过。
- 免费轮询 Mock：生成 POST 仅 1 次；首次 GET 返回 502，第二次 GET 成功，任务最终 `succeeded`，并记录 `pollRetryCount=1`。
- 免费三图 Mock：3 张参考图均以 `Data URL` 提交，`seconds=6`、`size=720x1280`；任务数据库 payload 仍只保存 3 条签名 URL，不含 `data:image`。
- 灰度后台真实页面确认 FAST 的最大参考图数量为 6、传输方式为 `Data URL`。
- `1920x1080` 下开启和关闭 AI 助手均无页面横向溢出；参考图卡片无文字溢出，浏览器控制台 0 error。
- Gray API、Worker 均为 active；内网和公网状态均为 `0.6.10 / gray`。
- Production 公网状态为 `0.5.22 / production`，生产 release 未变。

## 边界

> 后续纠正：真实三图复测证明 403 的直接根因是 FAST 仍沿用 Preview 的 `seconds/size/images` 请求契约，而不是单纯的参考图传输方式。修复见 `2026-07-15-aifork-grok-fast-contract-v0611.md`。

- 本批次没有再次提交昂贵的真实模型生成请求。
- 原始 FAST 多图失败已证明发生在 AIFork 向 Grok 内部素材接口上传第 3 张参考图的阶段；我方签名 URL、图片格式、尺寸、TTL 和三张素材的上游下载均正常。
- `Data URL` 是模型级显式能力，不会改变其他 Provider、其他模型或默认 URL 链路。
