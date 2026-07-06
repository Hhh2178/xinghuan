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

适用场景：

- 提交前快速检查
- 修改脚本、文档入口或治理规则后确认入口未漂移
- 触碰热点文件后确认预算、watchlist 和文档同步要求仍成立

## Documentation harness

用于确认入口文件、视觉规范、系统模板和 harness 接线没有漂移。

常用命令：

- `npm run verify:documentation-entry-contract`
- `npm run verify:visual-design-docs-contract`
- `npm run verify:design-token-docs-contract`
- `npm run verify:component-registry-docs-contract`
- `npm run verify:system-doc-template-contract`
- `npm run verify:harness-doc-sync-contract`

适用场景：

- 修改 `AGENTS.md`、`README.md`、`MEMORY.md`、`DEVLOG.md` 或 `ops/README.md`
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
- `npm run verify:release-gate-docs-contract`
- `npm run verify:release-package-contract`
- `npm run verify:current-release-entry-consistency`
- `npm run harness:verify:release`

适用场景：

- 推送 gray 前的本地准备
- gray 运行态验证后同步 release 记录
- production 晋级前确认版本、包、文档和运行入口一致

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
