# ComfyUI Connector Harness

`@xinghuan/comfyui-connector` 是机器侧的轻量 connector workspace。

它的职责不是治理工作流，而是把本机 ComfyUI 实例以稳定、可验证、可运维的方式接入到星幻后台实例池：

- 注册实例
- 周期性心跳
- 自动探测能力标签
- 将 `baseUrl / tailscaleAddress / connectorVersion / health` 回写后台

## 目录

```text
apps/comfyui-connector/
  .env.example
  README.md
  package.json
  tsconfig.json
  tsconfig.build.json
  src/
    config.ts
    comfyui-client.ts
    heartbeat.ts
    connector.ts
```

## 环境变量

可复制 `.env.example` 作为机器侧 env 文件。

- `XINGHUAN_COMFYUI_CONNECTOR_API_BASE_URL`
  - 星幻后台 API 根地址，例如 `https://canvas-next.hhh2121.xyz`
- `XINGHUAN_COMFYUI_CONNECTOR_TOKEN`
  - 后台 `XINGHUAN_COMFYUI_CONNECTOR_TOKEN`，机器侧与服务端必须一致
- `XINGHUAN_COMFYUI_INSTANCE_ID`
  - 机器实例的稳定唯一 ID
- `XINGHUAN_COMFYUI_INSTANCE_NAME`
  - 管理后台展示名；为空时回退到 `INSTANCE_ID`
- `XINGHUAN_COMFYUI_TAILSCALE_ADDRESS`
  - 机器的 Tailscale 地址或 MagicDNS 名称
- `XINGHUAN_COMFYUI_BASE_URL`
  - 本机 ComfyUI 地址，默认 `http://127.0.0.1:8188`
- `XINGHUAN_COMFYUI_CONCURRENCY`
  - 当前机器允许的并发数
- `XINGHUAN_COMFYUI_CONNECTOR_VERSION`
  - connector 版本；默认回退到 monorepo `appVersion`
- `XINGHUAN_COMFYUI_NOTE`
  - 后台备注
- `XINGHUAN_COMFYUI_HEARTBEAT_MS`
  - 心跳周期，默认 `15000`

## 命令

```bash
npm run dev -w @xinghuan/comfyui-connector
npm run type-check -w @xinghuan/comfyui-connector
npm run build -w @xinghuan/comfyui-connector
npm run verify:comfyui-connector-harness
```

## systemd

推荐使用仓库中的 `systemd` 模板：

- `ops/systemd/xinghuan-comfyui-connector.service.example`

建议在机器上准备单独 env 文件，例如：

- `/opt/apps/xinghuan-comfyui-connector/shared/comfyui-connector.env`

systemd 只负责常驻进程拉起；真正的实例治理仍以后台 `/api/internal/comfyui/connectors/register` 和 `/api/internal/comfyui/connectors/heartbeat` 为准。

## 验证清单

1. 先确认本机 ComfyUI 可访问：
   - `curl http://127.0.0.1:8188/system_stats`
2. 再启动 connector：
   - `npm run dev -w @xinghuan/comfyui-connector`
3. 后台确认实例出现：
   - `GET /api/admin/comfyui/instances`
4. 最后跑仓库契约：
   - `npm run verify:comfyui-connector-harness`
