# atlas 项目总纲批次正式发布记录 - 2026-06-17

## 目标

- 在确认 gray 已承接最新 HEAD 后，将同一批 atlas 总纲、文档收束、CodeGraph hook 与 release gate 闭环推进到 production。
- 让 production current 与主入口文档重新对齐，避免线上已切换但当前状态仍停留在旧 release。

## Release 信息

- production release：`20260617-atlas-prod-r1-2f0a88f`
- 上一生产 release：`20260615-phase-e-observability-governance-batch3-prod-r2`
- production current：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260617-atlas-prod-r1-2f0a88f`
- 对应提交：
  - `2f0a88f docs: add data model and worker atlas`

## 本地发布前验证

- `codegraph status`
- `npm run build:single-port`
- `npm run verify:release-package-contract`
- `npm run package:release -- 20260617-atlas-prod-r1-2f0a88f`

结果：

- CodeGraph 索引状态正常：
  - `Index is up to date`
- 构建通过。
- release package contract 通过。
- release 包生成成功：
  - `dist-release/20260617-atlas-prod-r1-2f0a88f.tar.gz`
  - `sizeMB = 5.36`

## 实际发布步骤

1. 上传 release 包到：
   - `/tmp/20260617-atlas-prod-r1-2f0a88f.tar.gz`
2. 解包到：
   - `/opt/apps/xinghuan-canvas/releases/20260617-atlas-prod-r1-2f0a88f`
3. 在新 release 目录执行：
   - `npm ci`
   - 加载 `/opt/apps/xinghuan-canvas/shared/canvas.env`
   - `npm run db:migrate`
4. 切换 `current` 到新 release。
5. 重启：
   - `xinghuan-canvas.service`
   - `xinghuan-canvas-worker.service`
   - `xinghuan-canvas-output-prune.timer`

## 正式验收

### 服务与本机入口

- `systemctl is-active xinghuan-canvas`
  - `active`
- `systemctl is-active xinghuan-canvas-worker`
  - `active`
- `systemctl is-active xinghuan-canvas-output-prune.timer`
  - `active`
- `readlink -f /opt/apps/xinghuan-canvas/current`
  - `/opt/apps/xinghuan-canvas/releases/20260617-atlas-prod-r1-2f0a88f`
- `curl http://127.0.0.1:18100/api/status`
  - `environment = production`

### production gate

在当前 release 目录先加载：

- `/opt/apps/xinghuan-canvas/shared/canvas.env`

随后执行：

- `npm run verify:release-preflight`
  - `ok = true`
  - `environment = production`
  - `currentReleaseTarget = /opt/apps/xinghuan-canvas/releases/20260617-atlas-prod-r1-2f0a88f`
  - `database.name = xinghuan_canvas_next`
- `npm run verify:request-chain-observability`
  - `ok = true`
- `npm run verify:system-observability`
  - `ok = true`
  - `database.current = xinghuan_canvas_next`
  - `database.expected = xinghuan_canvas_next`
  - `targetMatched = true`

### header smoke

- `curl -i -H "x-request-id: prod-gate-check" http://127.0.0.1:18100/api/status`
  - 响应头保留：
    - `x-request-id: prod-gate-check`

### 公网入口

- `https://canvas.hhh2121.xyz/api/status`
  - `200`
- `https://canvas.hhh2121.xyz/`
  - `200`

## 本次发布过程中的实际注意点

- 生产位 gate 脚本如果不先加载：
  - `/opt/apps/xinghuan-canvas/shared/canvas.env`
  会默认回落到 `18200`，从而误打 gray。
- 因此 production 验收不能只 `cd current && npm run verify:*`，必须先 source 生产 env。
- `verify:system-observability` 当前会报告：
  - `tasks.health.status = warning`
  - `audits.conflicts.health.status = critical`
  这反映的是生产运行态观测，不是本次发布失败。

## 结论

- 本次 production 发布已完成。
- 当前 production current 已从 `20260615-phase-e-observability-governance-batch3-prod-r2` 切到 `20260617-atlas-prod-r1-2f0a88f`。
- atlas 总纲、文档治理收束、CodeGraph hook、生成库素材访问链路和 release gate 闭环已进入 production current。
