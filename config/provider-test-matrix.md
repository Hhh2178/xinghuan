# Provider Test Matrix - 无限画布 2.0

## 记录规则

- 本文件记录测试服务商、文档地址、模型名称、接入优先级和密钥存放方式。
- 真实 API Key 不写入本文件。
- 真实 Key 只能进入 `.env.local`、服务器环境变量、后台加密字段或密钥管理系统。
- `.env.local` 必须保持未提交状态。

## P0 图像服务商：GRSAI

用途：

- 作为 2.0 首个图像生成真实验收服务商。
- 用于验证通用图像生成节点、模型目录、参数 schema、动态参考图端口、任务队列和输出素材落库。

用户已提供：

- Provider：GRSAI
- 测试模型：`gpt-image-2`
- 模型类型：文生图，后续可扩展图生图和多参考图。
- 文档地址 1：`https://qmy27nhsd9.apifox.cn/452392911e0`
- 文档地址 2：`https://nkxx.grsai.com/zh/dashboard/documents/gpt-image`
- Key 状态：用户已在历史对话中提供，未写入本项目文档。

建议环境变量：

- `GRSAI_API_KEY`
- `GRSAI_BASE_URL`
- `GRSAI_TEST_MODEL=gpt-image-2`

2.0 验收重点：

- 后台可创建 GRSAI Provider。
- 后台可手动录入或自动发现 `gpt-image-2`。
- 后台可配置尺寸、比例、质量、seed、参考图数量等参数 schema。
- 通用图像生成节点可选择 GRSAI 和 `gpt-image-2`。
- 任务成功后输出图片进入当前用户当前项目素材空间。

## P1 视频服务商：ToAPIs Grok Video

用途：

- 作为 2.0 首个视频生成真实验收服务商。
- 视频调用成本和耗时较高，应低频测试，优先使用短视频和低成本参数。

用户已提供：

- Provider：ToAPIs
- 测试模型方向：Grok Video
- 推荐测试模型：`grok-video-3`
- 文档地址：`https://docs.toapis.com/docs/cn/api-reference/videos/grok-video/generation`
- Key 状态：用户已在历史对话中提供，未写入本项目文档。

建议环境变量：

- `TOAPIS_API_KEY`
- `TOAPIS_BASE_URL`
- `TOAPIS_TEST_MODEL=grok-video-3`

2.0 验收重点：

- 后台可创建 ToAPIs Provider。
- 后台可配置视频模型 input profile，包括首帧、尾帧、多参考图、比例、时长和质量。
- 通用视频生成节点能根据模型 profile 自动显示首帧/尾帧/参考图端口。
- 任务异步执行，日志可查，失败原因可追踪。
- 成功视频进入项目素材空间。

## 密钥落地策略

开发期：

- 本机使用 `config/.env.local.example` 复制为 `.env.local` 后手动填写真实 Key。
- `.env.local` 不提交。

服务器灰度：

- 推荐写入 systemd EnvironmentFile 或后台加密 Provider 字段。
- 禁止写进 release 目录下的 Markdown 文档。
- 禁止写进 Nginx 配置、Git 仓库和日志文件。

后台正式方案：

- Provider Key 加密保存。
- 前端只显示脱敏值。
- 任务日志只记录 Provider ID、模型 ID、请求 ID 和脱敏错误，不记录 Key。
