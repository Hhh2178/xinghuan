# 后台 AI 助手结构化卡片与协议文档灰度发布记录 - 2026-06-17

## 目标

- 将右侧后台 AI 助手真实结构化卡片渲染、剪贴板图片粘贴上传和协议设计 atlas 文档一起推入 gray。
- 确认 gray current 已承接这轮后台助手与文档收束改动，而不是继续停在柏拉图批次。

## Release 信息

- gray release：`20260617-admin-assistant-structure-gray-r3-f881c28`
- 上一灰度 release：`20260617-plato-multipart-gray-r2-427237e-dirty`
- 发布当时 gray current：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260617-admin-assistant-structure-gray-r3-f881c28`
- 打包基线：
  - `HEAD = f881c28`
  - 当前 worktree 还包含未提交改动，因此本次仍属于 dirty worktree 打包发布

## 说明

- 本记录对应 2026-06-17 当时的 gray 发布状态，后续 current 已升级到更新的 release。
- 这里保留的是历史发布证据，不是当前运行态入口。

## 本次带入 gray 的范围

- 共享助手结构：
  - `packages/shared/src/assistant-message-blocks.ts`
  - `packages/shared/src/assistant-chat.ts`
- 后台 AI 助手：
  - `apps/admin/src/admin-assistant-panel.tsx`
  - `apps/admin/src/admin-assistant-message-blocks.ts`
  - `apps/admin/src/admin-types.ts`
  - `apps/admin/src/styles.css`
- API 助手结果契约与提示词：
  - `apps/api/src/server.ts`
- 协议设计文档与路由：
  - `docs/project-atlas/provider-protocol-and-request-body-design.md`
  - `docs/project-atlas/README.md`
  - `docs/project-atlas/interfaces-and-dataflow.md`
  - `docs/documentation-governance.md`
- 验证脚本：
  - `scripts/verify-admin-assistant-ui-contract.mjs`
  - `scripts/verify-admin-assistant-chat.mjs`

## 发布前验证

- `npm run build:single-port`
- `node scripts/verify-admin-assistant-ui-contract.mjs`
- `node scripts/verify-admin-assistant-chat.mjs`
- `npm run verify:release-package-contract`
- `node scripts/package-release.mjs 20260617-admin-assistant-structure-gray-r3-f881c28`

结果：

- 构建通过。
- 后台助手 UI 契约通过。
- 后台助手聊天契约通过。
- release package contract 通过。
- release 包生成成功：
  - `dist-release/20260617-admin-assistant-structure-gray-r3-f881c28.tar.gz`
  - `sizeMB = 5.38`

## 实际发布步骤

1. 生成 release 包并复制到根工作目录：
   - `D:/codex/服务器/20260617-admin-assistant-structure-gray-r3-f881c28.tar.gz`
2. 上传到服务器：
   - `/tmp/20260617-admin-assistant-structure-gray-r3-f881c28.tar.gz`
3. 解包到：
   - `/opt/apps/xinghuan-canvas-next/releases/20260617-admin-assistant-structure-gray-r3-f881c28`
4. 在新 release 目录执行：
   - `npm ci`
   - 加载 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
   - `npm run db:migrate`
5. 切换 `current` 到新 release。
6. 重启：
   - `xinghuan-canvas-next.service`
   - `xinghuan-canvas-next-worker.service`

## 发布过程中的实际问题

- 第一次远端切换失败并不是解包脚本问题，而是并行执行时远端脚本先于 `scp` 读到了 `/tmp`，导致 tar 提示包不存在。
- 第二次部署改成串行后恢复正常。
- 第一次批量重启后，输出里曾出现带回车符的 `Invalid unit name ... \\x0d`，导致对 Worker 状态的判断不可靠；随后单独重启 `xinghuan-canvas-next-worker.service`，服务恢复 `active`。

## 灰度验收

### 运行态

- `readlink -f /opt/apps/xinghuan-canvas-next/current`
  - `/opt/apps/xinghuan-canvas-next/releases/20260617-admin-assistant-structure-gray-r3-f881c28`
- `systemctl is-active xinghuan-canvas-next.service`
  - `active`
- `systemctl is-active xinghuan-canvas-next-worker.service`
  - `active`
- `curl http://127.0.0.1:18200/api/status`
  - `environment = gray`
- `curl https://canvas-next.hhh2121.xyz/api/status`
  - `environment = gray`

### gate

- `npm run verify:release-preflight`
  - `ok = true`
  - `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260617-admin-assistant-structure-gray-r3-f881c28`
  - `database.name = xinghuan_canvas_gray`
  - `services.api = active`
  - `services.worker = active`
- `npm run verify:request-chain-observability`
  - `ok = true`
- `npm run verify:system-observability`
  - `ok = true`
  - `database.current = xinghuan_canvas_gray`
  - `database.expected = xinghuan_canvas_gray`
  - `targetMatched = true`

## 结论

- 本次 gray 发布已完成。
- 当前 gray current 已切到 `20260617-admin-assistant-structure-gray-r3-f881c28`。
- 后台 AI 助手结构化卡片渲染、剪贴板图片粘贴上传和 Provider 协议设计 atlas 文档已经进入 gray current。
- 当前 `verify:system-observability` 里仍存在历史任务失败和 revision conflict 的告警，这属于运行态观测结论，不是本次发布失败。
