# Canvas Compatibility And Persistence Gray Release - 2026-06-26

## 状态

- 环境：`gray`
- 版本：`v0.5.1`
- release：`20260626-canvas-compatibility-persistence-gray-r1-v051`
- 当前状态：`已完成 deploy + runtime verify`

## 发布目标

- 修复旧工作流导入后 LLM 节点兼容性问题。
- 降低画布刷新后回退风险。
- 让工作流资源保存后在资源库中稳定可见。

## 变更范围

- `apps/web/src/utils/nodeMigration.ts`
  - 新增旧节点轻迁移层。
- `apps/web/src/components/Canvas.tsx`
  - 手动导入时对旧节点做迁移后再归一化。
- `apps/web/src/components/canvas/useCanvasPersistence.ts`
  - 画布加载时对旧快照做同样的迁移清洗。
- `apps/api/src/server.ts`
  - workflow 资源项补齐 `workflowNodeCount / workflowEdgeCount / workflowNodeTypes / workflowPreview`。

## Agent 已验证

- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/web`
- `codegraph sync`
- `npm run build:single-port`
- `npm run package:release -- 20260626-canvas-compatibility-persistence-gray-r1-v051`
- `node scripts/release/deploy-gray-release.mjs --release=20260626-canvas-compatibility-persistence-gray-r1-v051 --archive=dist-release/20260626-canvas-compatibility-persistence-gray-r1-v051.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
- `node scripts/release/verify-gray-runtime.mjs --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.1 --expected-environment=gray`
- `ssh -i D:/codex/服务器/Tencent_Cloud_Server.pem -p 728 ubuntu@101.33.75.38 \"readlink -f /opt/apps/xinghuan-canvas-next/current && systemctl is-active xinghuan-canvas-next.service && systemctl is-active xinghuan-canvas-next-worker.service && curl -fsS http://127.0.0.1:18200/api/status && echo && curl -fsS https://canvas-next.hhh2121.xyz/api/status\"`

## 本次部署执行

- 发布包：
  - `dist-release/20260626-canvas-compatibility-persistence-gray-r1-v051.tar.gz`
- 服务器解包目录：
  - `/opt/apps/xinghuan-canvas-next/releases/20260626-canvas-compatibility-persistence-gray-r1-v051`
- release 内执行：
  - `npm ci`
  - `npm run db:migrate`
- 本次迁移结果：
  - `applied = []`
  - `skipped = 18`

## 运行态复核

- current 指针：
  - `/opt/apps/xinghuan-canvas-next/releases/20260626-canvas-compatibility-persistence-gray-r1-v051`
- `/api/status`：
  - `version = 0.5.1`
  - `environment = gray`
- 关键服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- `docs/logbooks/releases/current-release-index.md`：
  - 已同步到本次 gray release
- `ops/README.md`：
  - 已同步到本次 gray release
- `ops/current/gray.md`：
  - 已同步到本次 gray release

## 待用户验收

- 旧工作流导入后是否仍需要删除重建 LLM 节点。
- 刷新画布后是否还会随机回退。
- 保存工作流后资源库是否能稳定看到对应条目与摘要。
