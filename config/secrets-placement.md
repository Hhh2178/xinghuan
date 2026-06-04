# Secrets Placement - 无限画布 2.0

## 原则

真实 API Key 不写入 Markdown 文档，不提交到 Git，不进入截图、日志或聊天输出。

本项目只在文档中记录：

- 服务商名称。
- 文档地址。
- 模型名称。
- 环境变量名。
- 密钥应该放在哪里。

## 当前测试密钥对应关系

### GRSAI

- 用途：P0 图像生成验收。
- 测试模型：`gpt-image-2`
- 文档：
  - `https://qmy27nhsd9.apifox.cn/452392911e0`
  - `https://nkxx.grsai.com/zh/dashboard/documents/gpt-image`
- 本机环境变量：
  - `GRSAI_API_KEY`
  - `GRSAI_BASE_URL`
  - `GRSAI_TEST_MODEL`

### ToAPIs Grok Video

- 用途：P1 视频生成低频验收。
- 测试模型：`grok-video-3`
- 文档：`https://docs.toapis.com/docs/cn/api-reference/videos/grok-video/generation`
- 本机环境变量：
  - `TOAPIS_API_KEY`
  - `TOAPIS_BASE_URL`
  - `TOAPIS_TEST_MODEL`

## 本机放置方式

复制模板：

```powershell
Copy-Item "config\.env.local.example" ".env.local"
```

然后在 `.env.local` 中填写真实值。

`.env.local` 已被 `.gitignore` 忽略，不会进入 Git 提交。

## 服务器放置方式

优先级：

1. 后台 Provider 加密字段。
2. systemd `EnvironmentFile`。
3. 服务器安全目录下的未提交 `.env` 文件。

禁止：

- 写入 PRD、SPEC、README、DEVLOG、MEMORY。
- 写入 Nginx 配置。
- 写入 Git 仓库。
- 写入任务日志。
- 在前端页面完整展示。
