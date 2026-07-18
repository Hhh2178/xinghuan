# Release 版本与服务器保留政策

## 目的与权威边界

本文件是 Gray / Production 版本递增和服务器 Release 目录保留的长期治理规范。所有发版 Agent 在修改版本、准备发布包或清理服务器 Release 前必须读取本文件。

- 候选产品版本仍以根 `package.json` 为权威源。
- 已部署版本与 Release 仍以 `ops/current/release-state.json` 为权威源。
- 本文件只拥有版本递增规则和服务器保留规则，不复制当前版本或历史发布清单。
- 规则发生变化时，必须同步 `AGENTS.md`、Gray / Production Runbook、Harness 合同和当日日志。

## Gray 版本递增宪法

1. 每次达到 Gray 推送级别的代码或配置变更，默认只在当前 Gray 版本上增加一个 PATCH，即 `0.0.1`。
2. 示例：当前 Gray 为 `0.7.3` 时，下一次默认 Gray 版本为 `0.7.4`。
3. Agent 不得仅因功能较大、信息架构变化或内部重构自行递增 MINOR 或 MAJOR。
4. 只有用户明确要求具体版本、MINOR 递增或 MAJOR 递增时，才允许越过默认 PATCH 规则；用户给出的精确版本优先。
5. Production 从 Gray 晋级时复用已经验收的相同版本和产物，不额外递增版本。
6. 版本修正或降号只能由用户明确授权，并在发布记录中说明原因；`0.8.0 -> 0.7.3` 是 2026-07-17 用户明确授权的一次版本口径修正。

## 服务器 Release 保留宪法

1. Gray 与 Production 各自最多保留最近三个已经落盘的 Release 目录。
2. 保留集合必须包含当前 `current` 指向的 Release，以及 `ops/current/release-state.json` 对应环境声明的 `rollbackReleaseId`；剩余名额再按服务器 Release 目录修改时间降序补足。
3. 清理只能在新 Release 完成运行态验证后执行。执行顺序固定为：dry-run、核对 current 与候选、apply、复核数量和服务状态。
4. 标准入口：
   - `npm run release:retention:prune -- --env=gray --ssh-key=<path>`
   - `npm run release:retention:prune -- --env=gray --ssh-key=<path> --apply=true --confirm-retention=3`
   - Production 将 `--env` 改为 `production`。
5. 脚本必须拒绝删除 `current` 或 `rollbackReleaseId`、在回滚目录缺失时拒绝继续、拒绝越出 `<remoteRoot>/releases/`、拒绝非3的确认值，并逐个处理明确候选。
6. 该保留规则只适用于服务器 `<remoteRoot>/releases/`。以下路径永久排除：`shared/`、`shared/data/`、`shared/backups/`、环境文件、数据库目录、日志和用户素材。
7. 失败 Release 在事故调查期间可以临时保留，但调查结束后必须恢复到三个；不能为了满足数量限制而先删除故障证据。
8. 禁止用通用 `rm -rf`、通配符或未验证变量执行清理；只有项目内受 Harness 保护的保留脚本属于授权入口。

## 验证与审计

- 合同：`npm run verify:release-governance-contract`
- Release Harness：`npm run harness:verify:release`
- 每次真实清理必须在当日日志或对应发布记录中写明环境、保留项、删除数量、释放空间和复核结果。
- Production 清理前必须再次确认当前 Release、回滚能力和数据库备份不在目标范围。
