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

## 建议阅读顺序

1. `workspace-verify-release-map.md`
2. `subharness-convention.md`

## 执行分层

- Workspace harness：负责仓库导航、CodeGraph 同步、workspace type-check 和 package export 检查。
- Verification harness：负责 `verify:*` 契约、热点预算、source size、release 文档一致性和快速验收。
- Release harness：负责 gray / production 的 prepare、package、deploy、runtime verify 与 logbook 同步。
- Integration harness：负责 RunningHub、ComfyUI、Provider 等外部接入的子工程模板、env 模板和独立 contract。
- Documentation harness：负责 `docs/governance/`、`docs/systems/`、`docs/logbooks/` 与主入口同步。

## 当前根级聚合命令

- `npm run harness:verify:project`
- `npm run harness:verify:quick`
- `npm run harness:verify:workspace`
- `npm run harness:verify:release`
- `npm run harness:verify:comfyui`

## 更新规则

- 新增项目级 harness 入口时，优先更新本目录和 `package.json` 根脚本。
- 新增子 harness 时，必须有 README、环境模板或配置说明、根级 verify 入口，以及对应 contract。
- 本目录只记录执行地图和接入约定，不复制系统设计正文、发布记录或长期状态。

