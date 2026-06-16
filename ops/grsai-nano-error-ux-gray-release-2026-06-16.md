# GRSAI nano 路由与图像节点错误透传灰度发布记录 - 2026-06-16

## 目标

- 将 `GRSAI` `nano-banana` 专用提交路由修复推到灰度。
- 将图像节点错误透传修复推到灰度，避免前端继续把真实失败覆盖成占位提示。
- 顺带发布输出文本流相关修复，并做最小灰度验收。

## Release 信息

- gray release：`20260616-grsai-nano-error-ux-gray-r1-ee04792`
- 上一灰度 release：`20260615-phase-e-observability-governance-batch3-gray-r2`
- gray current：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260616-grsai-nano-error-ux-gray-r1-ee04792`
- 服务：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`

## 涉及改动

- `apps/api/src/grsai-image-adapter.ts`
- `apps/api/src/external-proxy.ts`
- `apps/worker/src/worker.ts`
- `apps/web/src/components/nodes/ImageNode.tsx`
- `scripts/verify-grsai-image-adapter.ts`
- `scripts/verify-image-node-error-reporting.mjs`
- `scripts/verify-output-text-flow-contract.mjs`

## 本地发布前验证

- `npm run verify:grsai-draw`
- `node scripts/verify-image-node-error-reporting.mjs`
- `node scripts/verify-output-text-flow-contract.mjs`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/worker`
- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/admin`
- `npm run build:single-port`
- `npm run verify:release-package-contract`

## 发布步骤

1. 本地生成 release 包：
   - `dist-release/20260616-grsai-nano-error-ux-gray-r1-ee04792.tar.gz`
2. 上传到服务器：
   - `/tmp/20260616-grsai-nano-error-ux-gray-r1-ee04792.tar.gz`
3. 解包到新 release：
   - `/opt/apps/xinghuan-canvas-next/releases/20260616-grsai-nano-error-ux-gray-r1-ee04792`
4. 在 release 目录执行：
   - `npm ci`
   - `npm run db:migrate`
5. 切换 `current` 到新 release。
6. 重启灰度 API / Worker。

### 本次实际执行补记

- 本地已重新执行：
  - `npm run build:single-port`
  - `npm run verify:release-package-contract`
  - `npm run package:release -- 20260616-grsai-nano-error-ux-gray-r1-ee04792`
- 实际上传：
  - `scp ... dist-release/20260616-grsai-nano-error-ux-gray-r1-ee04792.tar.gz -> /tmp/20260616-grsai-nano-error-ux-gray-r1-ee04792.tar.gz`
- 服务器实际执行：
  - 解包到 `/opt/apps/xinghuan-canvas-next/releases/20260616-grsai-nano-error-ux-gray-r1-ee04792`
  - `npm ci`
  - 加载 `shared/canvas-next.env` 后执行 `npm run db:migrate`
  - 切换 `current`
  - 重启：
    - `xinghuan-canvas-next.service`
    - `xinghuan-canvas-next-worker.service`

### 本次发布过程中的实际注意点

- 首次在 release 目录直接运行 `npm run db:migrate` 时出现：
  - `DATABASE_NOT_CONFIGURED`
- 根因不是 release 包缺文件，而是没有先加载：
  - `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
- 补上：
  - `set -a`
  - `. /opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
  - `set +a`
  之后 `db:migrate` 正常返回：
  - `applied = []`
  - `skipped = 14`

## 灰度验收

- 运行态：
  - `npm run verify:release-preflight`
  - `npm run verify:request-chain-observability`
  - `npm run verify:system-observability`
- 结果：
  - `environment = gray`
  - `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260616-grsai-nano-error-ux-gray-r1-ee04792`
  - `services.api = active`
  - `services.worker = active`
  - `database.current = xinghuan_canvas_gray`
  - `database.targetMatched = true`
  - `database.counts`：
    - `users = 7`
    - `canvases = 14`
    - `assets = 3`
    - `tasks = 130`
    - `sessions = 146`
- `verify:request-chain-observability` 实际结果：
  - `ok = true`
  - 读链路动作包含：
    - `auth.admin_me`
    - `summary.read`
    - `users.read`
    - `sessions.read`
    - `providers.read`
    - `models.read`
    - `tasks.read`
    - `system.read`
- `verify:system-observability` 实际结果：
  - `ok = true`
  - `database.current = xinghuan_canvas_gray`
  - `database.expected = xinghuan_canvas_gray`
  - `targetMatched = true`
  - `audits.requestIdCoverageLast24hPercent = 100`
- `GRSAI gpt-image-2` 同步图像链路：
  - `/api/proxy/external/image` 返回本地文件 URL 成功
- `GRSAI gpt-image-2` 异步图像链路：
  - `/api/proxy/external/image/task` 真实实测成功
  - 任务状态返回 `adapter = grsai-image`
  - 输出素材已落到 `/files/output/task_output_...png`

## 当前限制

- 当前灰度后台仅启用了 `GRSAI gpt-image-2`。
- `nano-banana-fast` / `nano-banana-2` 尚未在当前灰度数据中启用，因此这次灰度没有做 nano 模型真实上游验收。
- 异步图像链路首轮复验曾遇到一次上游返回：
  - `status = failed`
  - `error = generate image failed`
  - 随后同链路复跑通过
- 现阶段更像 GRSAI 上游波动，不是灰度发布导致的固定回归。

## 结论

- 本次灰度发布已完成。
- 当前灰度环境已切到 `20260616-grsai-nano-error-ux-gray-r1-ee04792`。
- 与本次发布直接相关的同步图像链路、异步图像链路、错误透传修复已在灰度完成最小实测。
