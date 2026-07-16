# Harness 系统

## 这个系统负责什么

Harness 系统负责把当前仓库已有的规则、文档、验证脚本、发布脚本和子系统接入约定组织成一张可执行地图。它不替代 `AGENTS.md`、`docs/`、`ops/` 或 `package.json`，只说明这些入口在执行时如何组合。

## 关键入口

- 规则入口：`AGENTS.md`
- 文档入口：`docs/INDEX.md`
- 系统入口：`docs/systems/README.md`
- 运维入口：`ops/README.md`
- 执行入口：`package.json`
- 脚本目录：`scripts/`
- 状态权威源：`config/environments.json`、`ops/current/release-state.json`
- 候选产品版本权威源：根 `package.json`；shared runtime 和 web build 只读取该文件，不维护第二个手写版本常量
- 已部署环境版本权威源：`ops/current/release-state.json`；gray / production 可以在分阶段发布时暂时落后于候选版本，但不得超前

## 建议阅读顺序

1. `workspace-verify-release-map.md`
2. `subharness-convention.md`

## 执行分层

- Workspace harness：负责仓库导航、CodeGraph 同步、workspace type-check 和 package export 检查。
- Verification harness：负责 `verify:*` 契约、热点预算、source size、release 文档一致性和快速验收。
- Release harness：负责 gray / production 的 prepare、package、deploy、runtime verify 与 logbook 同步。
- Integration harness：负责 RunningHub、ComfyUI、Provider 等外部接入的子工程模板、env 模板和独立 contract。
- Documentation harness：负责 `docs/governance/`、`docs/systems/`、`docs/logbooks/` 与主入口同步。
- Authority harness：负责产品版本、环境拓扑、当前 release state 和证据链接的一致性。

## 当前根级聚合命令

- `npm run harness:verify:project`
- `npm run harness:verify:quick`
- `npm run harness:verify:workspace`
- `npm run harness:verify:release`
- `npm run harness:verify:comfyui`
- `npm run verify:authority-state`
- `npm run harness:run -- --profile=quick`
- `npm run harness:run -- --profile=project`

## Documentation Contract Commands

- `npm run verify:documentation-entry-contract`
- `npm run verify:visual-design-docs-contract`
- `npm run verify:design-token-docs-contract`
- `npm run verify:component-registry-docs-contract`
- `npm run verify:system-doc-template-contract`
- `npm run verify:harness-doc-sync-contract`

## 更新规则

- 新增项目级 harness 入口时，优先更新本目录和 `package.json` 根脚本。
- Harness runner 将每次 profile 运行写入 ignored `.harness/runs/*.json`；release/validation logbook 仍是正式审计证据。
- 新增子 harness 时，必须有 README、环境模板或配置说明、根级 verify 入口，以及对应 contract。
- 本目录只记录执行地图和接入约定，不复制系统设计正文、发布记录或长期状态。
