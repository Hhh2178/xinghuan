# Workspace / Verify / Release Map

## 目标

这份地图用于回答“当前应该跑哪条链路”。它把仓库已有脚本按执行意图分组，避免每次从大量 `verify:*` 命令里重新寻找入口。

## Workspace harness

用于本地开发批次收口，重点确认仓库索引、类型和 package 边界。

常用命令：

- `npm run codegraph:sync`
- `npm run type-check`
- `npm run verify:package-exports`
- `npm run harness:verify:workspace`

适用场景：

- 修改跨 workspace 类型或导出关系
- 新增 workspace
- 修改 `packages/*` 或多个 `apps/*` 之间的共享类型
- 完成一轮较大的本地实现后准备进入提交前验证

## Verification harness

用于快速判断当前代码是否仍满足工程护栏。

常用命令：

- `npm run verify:critical`
- `npm run verify:important`
- `npm run verify:quick`
- `npm run harness:verify:quick`
- `npm run verify:project-harness-contract`
- `npm run verify:canvas-workflow-capabilities-contract`
- `npm run verify:runninghub-group-permission-contract`
- `npm test` (Vitest excludes generated `.tmp/**` runtime verification artifacts)

适用场景：

- 提交前快速检查
- 修改脚本、文档入口或治理规则后确认入口未漂移
- 触碰热点文件后确认预算、watchlist 和文档同步要求仍成立
- 修改代码/标签节点、组运行、模板弹层、文本分割或组锁定路径后确认 Canvas 工作流能力未漂移
- 修改 RunningHub Provider 目录、分组权限或画布条目选择器后确认分组模型、双门禁和前后台接线未漂移

## Documentation harness

用于确认入口文件、视觉规范、系统模板和 harness 接线没有漂移。

常用命令：

- `npm run verify:documentation-entry-contract`
- `npm run verify:domain-context-and-adr-contract`
- `npm run verify:generation-artifact-framework-contract`
- `npm run verify:generation-artifact-operations`
- `npm run verify:visual-design-docs-contract`
- `npm run verify:design-token-docs-contract`
- `npm run verify:component-registry-docs-contract`
- `npm run verify:system-doc-template-contract`
- `npm run verify:harness-doc-sync-contract`

适用场景：

- 修改 `AGENTS.md`、`README.md`、`MEMORY.md`、`DEVLOG.md` 或 `ops/README.md`
- 修改 `CONTEXT.md`、`docs/adr/` 或领域/架构治理规则
- 修改 canvas/admin 视觉规范
- 修改 canvas/admin token 或组件注册表
- 新增或调整系统接口文档模板
- 修改 `package.json` 中的 harness 聚合命令

## Release harness

用于 gray / production 发布准备和发布记录一致性检查。

常用命令：

- `npm run release:gray:prepare`
- `npm run release:gray:deploy`
- `npm run release:gray:verify`
- `npm run verify:release-preflight-contract`
- `npm run verify:sealed-production-artifact-harness`
- `npm run verify:release-gate-docs-contract`
- `npm run verify:release-package-contract`
- `npm run verify:current-release-entry-consistency`
- `npm run verify:release-governance-contract`
- `npm run release:retention:prune -- --env=<gray|production> --ssh-key=<path>`
- `npm run harness:verify:release`

适用场景：

- 推送 gray 前的本地准备
- gray 运行态验证后同步 release 记录
- production 晋级前确认版本、包、文档和运行入口一致
- gray / production 验证通过后先 dry-run，再将服务器 Release 恢复为最近五个

### Sealed production artifact staged releases

The release harness blocks drift from this order: `0.8.16` sealed production artifact, `0.8.17` admin tiers, then `0.8.18` RunningHub groups. For every stage, Gray verifies one archive and Production promotes the same Gray archive without rebuilding it. Before the stage is complete, append actual verification evidence for the contracts, archive identity, and runtime result to the release and validation logbooks.

Current local proof (2026-08-03): candidate `0.8.16`, archive `20260803-sealed-production-artifact-v0816-r1.tar.gz`, sidecar SHA-256 `9916bb3e74c04f092469e5019d3a1e6ea38d3376cedc23a5c2d784160d3dc9a0`; 185 content-manifest files, 211 tar entries excluding the root entry, 0 forbidden entries. Workspace type-check, production/static/runtime builds, package/archive/version contracts, and deploy/runtime dry-runs passed. This is executable local proof, not Gray/Production live-runtime evidence; Production must promote this exact archive after Gray approval.

Local continuation proof (2026-08-04): the Vitest matrix is `243 passed / 1 skipped` test files and `929 passed / 4 skipped` tests after excluding generated `.tmp/**` runtime artifacts. RunningHub focused contracts and authenticated local catalog verification passed; the local catalog had no entries, so execution was intentionally not attempted.

Archive runtime smoke also passed in an isolated extraction: `npm ci --omit=dev --ignore-scripts` succeeded and `apps/api/dist/cli/permission-readiness.js` returned the expected `DATABASE_NOT_CONFIGURED` failure without a database URL, proving the sealed entrypoint is executable without source tooling.

### Encrypted server release envelope (2026-08-04)

- Server-only packaging now has an explicit `package:server-release` path. It wraps the existing source-free, minified runtime archive with an AES-256-GCM envelope and writes a separate outer SHA-256 sidecar.
- The development worktree remains source-based: `package:release`, `build`, `dev`, type-check and tests are unchanged. No encrypted artifact is staged or imported by development commands.
- `verify:encrypted-release-contract` protects both the envelope header/authentication tag and the inner `verify:release-package-contract` inventory. Deployment supports `target-profile=old-server` and `target-profile=new-server` and decrypts only with the target environment's `XINGHUAN_RELEASE_ENCRYPTION_KEY`.
- Harness evidence must record the inner plaintext manifest identity and outer encrypted archive SHA-256 without recording the key or any secret-derived value.

## Integration harness

用于外部系统或机器侧子工程接入。

当前已登记：

- ComfyUI connector：`apps/comfyui-connector/`
- ComfyUI instance pool：`scripts/verify-comfyui-instance-pool-contract.mjs`

常用命令：

- `npm run verify:comfyui-connector-harness`
- `npm run verify:comfyui-execution-helpers`
- `npm run harness:verify:comfyui`

适用场景：

- 新增 ComfyUI 机器侧连接器配置
- 修改共享 ComfyUI 工作流执行链路
- 后续扩展多机器实例池、共享工作流或其他机器侧 connector
