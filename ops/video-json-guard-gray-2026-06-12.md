# 画布视频 JSON/HTML 误报修复灰度发布记录（2026-06-12）

## 目标

- 修复画布视频生成链路在收到 HTML 或其他非 JSON 响应时，前端直接报 `Unexpected token '<'` 的误导性错误。
- 将灰度前端错误提示改为明确指出“哪个接口返回了 HTML 页面”，便于继续追真实失败来源。

## 代码范围

- `apps/web/src/services/generation.ts`
  - 新增统一 `readJsonResponse(response, label)`。
  - 新增 `looksLikeHtmlResponse(text)`。
  - 覆盖视频、Seedance、音频、RunningHub、MJ、上传等生成相关接口，不再直接 `await r.json()`。
- `scripts/verify-generation-json-response-contract.mjs`
  - 新增前端响应解析契约验证，防止后续再回退为直接 JSON 解析。
- `package.json`
  - 新增 `verify:generation-json-response-contract`。

## 本机验收

- `npm run verify:generation-json-response-contract`
  - 结果：通过
- `npm run verify:external-video-proxy`
  - 结果：通过
- `npm run verify:single-port`
  - 结果：通过
- `npm run build:single-port`
  - 结果：通过

说明：

- 首次并行执行 `verify:external-video-proxy` 与 `verify:single-port` 时，本机 file-based admin 数据被两个脚本同时写入，出现过一次测试层面的 `Provider 不存在`。
- 改为串行重跑后，`verify:external-video-proxy` 已完整通过，确认该残差不是本次代码修复本身导致。

## 灰度发布

- release：`20260612-generation-json-guard-gray-r1`
- 路径：`/opt/apps/xinghuan-canvas-next/releases/20260612-generation-json-guard-gray-r1`
- 当前链接：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260612-generation-json-guard-gray-r1`

服务器动作：

- 上传发布包到 `/tmp/20260612-generation-json-guard-gray-r1.tar.gz`
- 解压到灰度 release 目录
- 在 release 目录执行 `npm ci`
- 加载 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
- 执行 `node scripts/db-migrate.mjs`
- 重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`

## 灰度验收

- `systemctl is-active xinghuan-canvas-next.service`
  - 结果：`active`
- `systemctl is-active xinghuan-canvas-next-worker.service`
  - 结果：`active`
- `readlink -f /opt/apps/xinghuan-canvas-next/current`
  - 结果：`/opt/apps/xinghuan-canvas-next/releases/20260612-generation-json-guard-gray-r1`
- `curl http://127.0.0.1:18200/api/status`
  - 结果：`environment=gray`
- `curl https://canvas-next.hhh2121.xyz/api/status`
  - 结果：`environment=gray`
- `POST https://canvas-next.hhh2121.xyz/api/proxy/external/video`（未登录空请求）
  - 结果：`401 AUTH_REQUIRED`
  - `Content-Type: application/json; charset=utf-8`
- 灰度前端资产检查
  - 当前包 `Canvas-hDGbekGz.js` 已包含文案：
    - `返回了 HTML 页面，请检查登录状态、网关代理或上游配置`

## 当前结论

- 这次修复已经灰度生效。
- 同类问题后续再出现时，前端不应再显示 `Unexpected token '<'`，而应提示具体接口返回了 HTML 页面。
- 下一步如果仍有视频失败，需要继续追真实失败来源：
  - 上游 Provider 返回 HTML
  - Cloudflare / 网关挑战页
  - 登录态失效或跳转
  - 后端特定视频分支返回的非 JSON 内容

## 追加根因与任务化修复

后续截图中出现的新提示为：

- `扩展视频生成接口返回了 HTML 页面，请检查登录状态、网关代理或上游配置`

进一步排查后确认：

- 该提示来自前端 `readJsonResponse()`，含义是浏览器请求 `/api/proxy/external/video` 本身拿到了 HTML，而不是 Agnes JSON 失败体。
- 服务器 Nginx 日志中对应请求出现：
  - `POST /api/proxy/external/video` `499`
- 这表示客户端或代理层在后端返回前断开连接。
- 用户已经把域名切到 Cloudflare 橙云，且节点约 2 分钟后失败；这与橙云代理对长 HTTP 请求的超时/断开行为吻合。
- 后台 API 供应商侧能生成成功，说明上游任务本身未必失败，失败点在“浏览器长请求等待异步视频完成”的链路设计。

修复已发布到灰度：

- release：`20260612-external-video-task-gray-r1`
- 路径：`/opt/apps/xinghuan-canvas-next/releases/20260612-external-video-task-gray-r1`
- 当前链接：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260612-external-video-task-gray-r1`

修复内容：

- 新增 `POST /api/proxy/external/video/task`
  - 校验登录态。
  - 找到后台发布的 Provider 视频模型。
  - 读取模型 `advancedConfig`。
  - 将本地参考素材转换为 Provider 文件签名 URL。
  - 写入 `xh_tasks` 并推入 Redis 队列。
  - 立即返回 `taskId`。
- 新增 `GET /api/proxy/external/video/task/:taskId`
  - 校验任务归属。
  - 返回 `queued/running/succeeded/failed/cancelled` 状态、素材化视频 URL、远端 URL、失败原因和最近日志。
- 画布 `VideoNode` 的后台发布模型分支改成短提交 + 轮询任务状态，不再让浏览器持有长请求等待上游视频完成。

灰度验收：

- `npm run build:single-port` 本机通过。
- `npm run verify:apimart-video-adapter-contract` 本机通过。
- `npm run verify:generation-json-response-contract` 本机通过。
- 灰度 `db:migrate` 返回 `{"ok":true,"applied":[],"skipped":7}`。
- `systemctl is-active xinghuan-canvas-next.service` => `active`。
- `systemctl is-active xinghuan-canvas-next-worker.service` => `active`。
- `https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`。
- 未登录 `POST https://canvas-next.hhh2121.xyz/api/proxy/external/video/task` => JSON `401 AUTH_REQUIRED`。
- 登录态本机空请求 `POST http://127.0.0.1:18200/api/proxy/external/video/task` => JSON `缺少 prompt`。
- 灰度 Redis => `PONG`，队列深度 `0`。
- 登录态 `/api/models` 确认 Agnes 视频模型 `advancedConfig.mode=async_video_task`。

验收限制：

- 本轮未自动发起真实 Agnes 视频任务，以避免消耗上游额度。
- 最终仍需要在灰度画布手动提交一次低成本 Agnes 视频生成，确认任务入队、节点轮询、视频素材回填和资源库写入完整闭环。
