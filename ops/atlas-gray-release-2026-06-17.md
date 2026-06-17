# atlas 项目总纲批次灰度发布记录 - 2026-06-17

## 目标

- 将当前 worktree 的 atlas 总纲、数据模型/Worker 导航、文档路由收束、CodeGraph hook 和 release gate 闭环推入 gray。
- 让 gray current 承接 `2f0a88f` 对应的总纲批次，而不是停留在更早的文档收束 release。

## Release 信息

- gray release：`20260617-atlas-gray-r2-2f0a88f`
- 上一灰度 release：`20260617-doc-archive-governance-gray-r1-2737811`
- gray current：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260617-atlas-gray-r2-2f0a88f`
- 对应提交：
  - `2f0a88f docs: add data model and worker atlas`

## 本次带入 gray 的范围

- `docs/project-atlas/`
  - `api-navigation.md`
  - `data-model-navigation.md`
  - `worker-execution-chain.md`
  - 以及总纲入口与相关路由更新
- 文档治理入口同步：
  - `README.md`
  - `AGENTS.md`
  - `MEMORY.md`
  - `docs/prd/README.md`
  - `docs/prd/v0.1.0/progress.md`
  - `ops/README.md`
- CodeGraph 工作流：
  - `.githooks/*`
  - `scripts/codegraph-hook.mjs`
  - `scripts/setup-codegraph-hooks.mjs`
- 生成库素材访问链路：
  - API 访问描述与内容路由
  - 前端预览 / 下载入口
- release gate / observability 脚本闭环

## 发布前验证

- `npm run build:single-port`
- `npm run verify:release-package-contract`
- `npm run package:release -- 20260617-atlas-gray-r2-2f0a88f`

结果：

- 构建通过。
- release package contract 通过。
- release 包生成成功：
  - `dist-release/20260617-atlas-gray-r2-2f0a88f.tar.gz`
  - `sizeMB = 5.36`

## 实际发布步骤

1. 上传 release 包到：
   - `/tmp/20260617-atlas-gray-r2-2f0a88f.tar.gz`
2. 解包到：
   - `/opt/apps/xinghuan-canvas-next/releases/20260617-atlas-gray-r2-2f0a88f`
3. 在新 release 目录执行：
   - `npm ci`
   - 加载 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
   - `npm run db:migrate`
4. 切换 `current` 到新 release。
5. 重启：
   - `xinghuan-canvas-next.service`
   - `xinghuan-canvas-next-worker.service`

## 灰度验收

- `readlink -f /opt/apps/xinghuan-canvas-next/current`
  - `/opt/apps/xinghuan-canvas-next/releases/20260617-atlas-gray-r2-2f0a88f`
- `xinghuan-canvas-next.service = active`
- `xinghuan-canvas-next-worker.service = active`
- `npm run verify:release-preflight`
  - `ok = true`
  - `environment = gray`
  - `currentReleaseTarget = /opt/apps/xinghuan-canvas-next/releases/20260617-atlas-gray-r2-2f0a88f`
- `npm run verify:request-chain-observability`
  - `ok = true`
- `npm run verify:system-observability`
  - `ok = true`
  - `database.current = xinghuan_canvas_gray`
  - `database.expected = xinghuan_canvas_gray`
  - `targetMatched = true`
- `https://canvas-next.hhh2121.xyz/api/status`
  - `200`

## 结论

- 本次 gray 发布已完成。
- 当前 gray current 已切到 `20260617-atlas-gray-r2-2f0a88f`。
- atlas 总纲、文档治理收束、CodeGraph hook、生成库素材访问链路与 release gate 闭环已进入 gray current。
