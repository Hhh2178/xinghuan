# 2026-07-05 Auth Login Repository Gray Release

## 发布目标

- 将 auth login enabled-user email lookup 收口到 auth repository 边界。
- 避免 Postgres 登录路径为了查用户而读取完整 auth DB。
- 修复 gray release 包遗漏 auth verifier 脚本的问题，让远端 release 包可执行对应自检。
- 将 environment sync smoke 改为幂等 no-op apply，避免重复灰度验证时误写配置或因缺少 identical provider 误失败。
- 继续保持 ComfyUI 功能冻结；本 release 不新增 ComfyUI 能力。

## 发布信息

- 环境：`gray`
- 版本：`v0.5.25`
- 最终 release：`20260705-auth-login-repository-gray-r3-v0525`
- 上一稳定灰度 release：`20260705-postgres-pool-tuning-gray-r1-v0525`
- 发布分支：`xinghuan-integration-clean`
- 关键代码 commits：
  - `2b0b062` - auth login lookup 走 repository
  - `6b8d966` - release 包补齐 auth verifier
  - `28e2c02` - environment sync smoke 幂等化

## Agent 已验证

### 本地代码与产物

- 已通过：
  - `npx vitest run apps/api/src/auth-repository.test.ts`
  - `npm run type-check -w @xinghuan/api`
  - `npm run verify:auth-current-user-repository-contract`
  - `npm run verify:auth-login-precision-query-contract`
  - `npm run verify:file-hotspot-budgets`
  - `npm run ci`
  - `npm run codegraph:sync`
  - `npm run release:gray:prepare -- --release=20260705-auth-login-repository-gray-r3-v0525 --verify="npx vitest run apps/api/src/auth-repository.test.ts" --verify="npm run verify:auth-current-user-repository-contract" --verify="npm run verify:auth-login-precision-query-contract" --verify="npm run verify:environment-sync-smoke" --verify="npm run type-check -w @xinghuan/api"`
- gray 发布包：
  - `dist-release/20260705-auth-login-repository-gray-r3-v0525.tar.gz`
  - size：约 `1.56 MB`
- r3 包 included 清单已包含：
  - `scripts/verify-auth-current-user-repository-contract.mjs`
  - `scripts/verify-auth-login-precision-query-contract.mjs`
  - `scripts/verify-environment-sync-smoke.mjs`

### 远端部署与运行态

- 已执行：
  - `npm run release:gray:deploy -- --release=20260705-auth-login-repository-gray-r3-v0525 --archive=dist-release/20260705-auth-login-repository-gray-r3-v0525.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem`
  - `npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --expected-version=0.5.25 --expected-environment=gray`
- 远端 current 指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260705-auth-login-repository-gray-r3-v0525`
- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 运行态验证：
  - `https://canvas-next.hhh2121.xyz/api/status => version 0.5.25, environment gray`
  - `http://127.0.0.1:18200/api/status => version 0.5.25, environment gray`
- 链路验证：
  - `npm run verify:auth-login-precision-query-contract`
  - `npm run verify:auth-current-user-repository-contract`
  - `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200 node scripts/verify-admin-task-pagination.mjs`
  - `XINGHUAN_VERIFY_BASE_URL=http://127.0.0.1:18200 node scripts/verify-environment-sync-smoke.mjs`
  - `journalctl` 复查 API / Worker 重启后均通过 database target check。

## 中间修复记录

- r1：部署后运行态正常，但远端 `npm run verify:auth-*` 暴露 release 包未包含 auth verifier 脚本。
- r2：补齐 auth verifier 后运行态与 auth verifier 正常，但 environment sync smoke 暴露脚本依赖 identical provider，不具备重复执行幂等性。
- r3：补齐 no-op apply smoke 后，运行态、auth verifier、任务分页和环境同步 smoke 全部通过。

## 风险与残留问题

- 本轮只发布 auth login repository slice 与 release/verify 链路修复，不推进 ComfyUI 功能。
- `apps/api/src/server.ts` 热点预算剩余很少：当前 `11908 / 11910`。
- E1 剩余 repository boundary 仍需分批推进：
  - auth admin writes
  - provider
  - settings
  - admin
  - task
  - usage summary
  - environment-sync-local
- Web/Admin build 仍有既有 chunk size warning；本轮未触碰前端 bundle 结构。

## 回滚信息

- 回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260705-postgres-pool-tuning-gray-r1-v0525`
- 需要重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后复查：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - `http://127.0.0.1:18200/api/status`
