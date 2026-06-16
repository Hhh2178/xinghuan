# 生产切换记录 - 2026-06-06

## 目标

- 将 `canvas.hhh2121.xyz` 正式切到星幻无限画布 2.0 生产服务。
- 生产服务监听 `127.0.0.1:18100`。
- 保持灰度 `canvas-next.hhh2121.xyz` / `127.0.0.1:18200` 继续运行。

## 基线

- 灰度 release：`20260607-0218-phase3-runninghub-workflow-gray`
- 生产 release：`20260606-1810-provider-signed-refs-xinghuan-empty`
- 生产 current：

```text
/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260606-1810-provider-signed-refs-xinghuan-empty
```

## 已执行

- 创建生产 active env：

```text
/opt/apps/xinghuan-canvas/shared/canvas.env
```

- 启动并启用生产服务：

```text
xinghuan-canvas.service
xinghuan-canvas-worker.service
xinghuan-canvas-output-prune.timer
```

- 启用生产 Nginx 站点：

```text
/etc/nginx/sites-enabled/canvas.hhh2121.xyz
```

- 使用 certbot 为 `canvas.hhh2121.xyz` 签发并部署 HTTPS 证书。
- 生产维护发布 `20260606-1715-image-ref-video-model-fix`：
  - 图像/视频代理会把本地素材引用归一化为公网绝对 URL 后再提交给上游。
  - 生产后台启用既有 `toapis-grok-video` 视频模型。
- 生产维护发布 `20260606-1810-provider-signed-refs-xinghuan-empty`：
  - 图像/视频/LLM 代理会把本地素材引用转换为短期 HMAC 签名的 `/api/provider-files/...` 供应商短链。
  - 普通 `/files` 仍保持登录保护，供应商短链只读单个明确文件。
  - 工作区权限校验页与无画布空态已替换为星幻画布设计。

## 证书

- 证书名称：`canvas.hhh2121.xyz`
- 证书路径：`/etc/letsencrypt/live/canvas.hhh2121.xyz/fullchain.pem`
- 私钥路径：`/etc/letsencrypt/live/canvas.hhh2121.xyz/privkey.pem`
- 到期时间：`2026-09-04 07:19:20+00:00`
- certbot 已配置自动续期任务。

## 验收

生产本机端口：

- `curl http://127.0.0.1:18100/api/status` 返回 `environment=production`。
- `npm run verify:single-port` 通过。
- `npm run verify:canvas-resource-api` 通过。
- `npm run verify:task-lifecycle` 通过。
- `npm run verify:worker-output-materials` 通过。
- `npm run cleanup:output-materials:dry-run` 通过，并读取 `/opt/apps/xinghuan-canvas/shared/data`。
- `npm run verify:external-image-proxy` 通过，包含本地素材引用转公网 URL 回归断言。
- `npm run verify:external-video-proxy` 通过，包含视频参考素材引用转公网 URL 回归断言。
- `npm run verify:external-chat-proxy` 通过，包含 LLM 图片输入短链回归断言。
- 当前生产 `dist` 已确认不包含旧空态文案 `贞贞的无限画布` / `企鹅共创版` / `请先在左侧创建或选择`。
- `/api/models` 登录态目录返回 `imageCount=1`、`videoCount=1`。

生产公网 HTTPS：

- `curl https://canvas.hhh2121.xyz/api/status` 返回 `environment=production`。
- `npm run verify:single-port` 通过。
- `npm run verify:canvas-resource-api` 通过。
- `npm run verify:task-lifecycle` 通过。
- `npm run verify:worker-output-materials` 通过。
- `npm run cleanup:output-materials:dry-run` 通过。

服务状态：

- `xinghuan-canvas.service` 为 `active` / `enabled`。
- `xinghuan-canvas-worker.service` 为 `active` / `enabled`。
- `xinghuan-canvas-output-prune.timer` 为 `active` / `enabled`。
- `nginx -t` 通过。

## 注意

- RunningHub 真实工作流卡片、字段展开和预览运行测试仍按用户要求暂缓。
- 生产 env 当前沿用灰度数据库连接作为同一数据底座切换；若后续要求生产独立数据库，需要单独开库、迁移和复验。
- `canvas-next.hhh2121.xyz` 灰度服务仍保持运行，可继续作为后续灰度入口。
