# 文档治理收束与发布闭环灰度发布记录 - 2026-06-17

## 目标

- 将当前 worktree 已完成但尚未进入 gray 的收束改动发布到灰度。
- 把文档治理、CodeGraph hook、发布闭环脚本与生成库素材访问链路一起带入当前 gray release。
- 在不触碰生产的前提下，确认 gray current、服务状态和观测 gate 都恢复到可追溯状态。

## Release 信息

- gray release：`20260617-doc-archive-governance-gray-r1-2737811`
- 上一灰度 release：`20260616-grsai-nano-error-ux-gray-r1-ee04792`
- gray current：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260617-doc-archive-governance-gray-r1-2737811`
- 对应提交：
  - `2737811 chore: close docs and verification loop`

## 本次带入 gray 的范围

- 文档治理与归档路由收束：
  - `AGENTS.md`
  - `MEMORY.md`
  - `DEVLOG.md`
  - `docs/documentation-governance.md`
- CodeGraph 工作流与 hook 安装：
  - `.githooks/*`
  - `scripts/codegraph-hook.mjs`
  - `scripts/setup-codegraph-hooks.mjs`
- 生成库素材访问与预览/下载链路：
  - `apps/api/src/material-access-service.ts`
  - `apps/api/src/material-access-types.ts`
  - `apps/web/src/components/GenerationLibraryDrawer.tsx`
  - `apps/web/src/components/GenerationLibraryPreviewOverlay.tsx`
- Phase D / Phase E 收尾验证脚本闭环：
  - `scripts/verify-task-cancellation-phase-d.mjs`
  - `scripts/verify-admin-task-pagination.mjs`
  - `scripts/verify-request-chain-observability.mjs`
  - `scripts/verify-system-observability.mjs`
  - `scripts/verify-release-preflight-contract.mjs`
  - `scripts/verify-observability-script-cleanup-contract.mjs`

## 本地发布前验证

- `npm run build:single-port`
- `npm run verify:release-package-contract`
- `npm run package:release -- 20260617-doc-archive-governance-gray-r1-2737811`

结果：

- 构建通过。
- release package contract 通过。
- release 包生成成功：
  - `dist-release/20260617-doc-archive-governance-gray-r1-2737811.tar.gz`
  - `sizeMB = 5.36`

## 实际发布步骤

1. 上传 release 包：
   - `/tmp/20260617-doc-archive-governance-gray-r1-2737811.tar.gz`
2. 解包到新目录：
   - `/opt/apps/xinghuan-canvas-next/releases/20260617-doc-archive-governance-gray-r1-2737811`
3. 在新 release 目录执行：
   - `npm ci`
   - 加载 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
   - `npm run db:migrate`
4. 切换 `current` 到新 release。
5. 重启：
   - `xinghuan-canvas-next.service`
   - `xinghuan-canvas-next-worker.service`

## 发布过程中的实际问题

- 首次远端执行时，命令链里嵌套的变量转义被 PowerShell/SSH 吃掉，导致远端 `mkdir` 参数异常。
- 修复方式不是重改 release，而是改为把整段 shell 脚本直接通过 stdin 送进远端 `bash -s`。
- 后续再次复核时，`verify:system-observability` 第一次报的是脚本名末尾混入 Windows 换行符，不是服务异常；单独重跑后通过。

## 灰度验收

### 运行态

- `readlink -f /opt/apps/xinghuan-canvas-next/current`
  - `/opt/apps/xinghuan-canvas-next/releases/20260617-doc-archive-governance-gray-r1-2737811`
- `xinghuan-canvas-next.service = active`
- `xinghuan-canvas-next-worker.service = active`
- `curl http://127.0.0.1:18200/api/status`
  - `environment = gray`

### gate

- `npm run verify:release-preflight`
  - `ok = true`
  - `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260617-doc-archive-governance-gray-r1-2737811`
  - `database.name = xinghuan_canvas_gray`
  - `services.api = active`
  - `services.worker = active`
- `npm run verify:request-chain-observability`
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
- `npm run verify:system-observability`
  - `ok = true`
  - `database.current = xinghuan_canvas_gray`
  - `database.expected = xinghuan_canvas_gray`
  - `targetMatched = true`
  - `audits.requestIdCoverageLast24hPercent = 100`

### 域名入口

- `https://canvas-next.hhh2121.xyz/api/status`
  - 返回 `200`

## 结论

- 本次 gray 发布已完成。
- 当前 gray current 已从 `20260616-grsai-nano-error-ux-gray-r1-ee04792` 切到 `20260617-doc-archive-governance-gray-r1-2737811`。
- 当前 gray release 已把文档治理收束、CodeGraph hook、生成库素材访问链路和 release gate 脚本闭环一并带上。
