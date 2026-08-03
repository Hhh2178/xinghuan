# Harness 系统

## 这个系统负责什么

Harness 系统负责把当前仓库已有的规则、文档、验证脚本、发布脚本和子系统接入约定组织成一张可执行地图。它不替代 `AGENTS.md`、`docs/`、`ops/` 或 `package.json`，只说明这些入口在执行时如何组合。

## 关键入口

- 规则入口：`AGENTS.md`
- 文档入口：`docs/INDEX.md`
- 领域入口：`CONTEXT.md`
- 架构决策入口：`docs/adr/README.md`
- 系统入口：`docs/systems/README.md`
- 运维入口：`ops/README.md`
- 执行入口：`package.json`
- 脚本目录：`scripts/`
- 状态权威源：`config/environments.json`、`ops/current/release-state.json`
- 候选产品版本权威源：根 `package.json`；shared runtime 和 web build 只读取该文件，不维护第二个手写版本常量
- 已部署环境版本权威源：`ops/current/release-state.json`；gray / production 可以在分阶段发布时暂时落后于候选版本，但不得超前
- `verify:authority-state` 对低于候选版本的环境给出 warning，对高于候选版本的环境失败；不得用强制相等阻断 gray / production 分阶段发布

## 建议阅读顺序

1. `workspace-verify-release-map.md`
2. `subharness-convention.md`

## 执行分层

- Workspace harness：负责仓库导航、CodeGraph 同步、workspace type-check 和 package export 检查。
- Verification harness：负责 `verify:*` 契约、热点预算、source size、release 文档一致性和快速验收。
- Release harness：负责 gray / production 的 prepare、package、deploy、runtime verify 与 logbook 同步。
- Integration harness：负责 RunningHub、ComfyUI、Provider 等外部接入的子工程模板、env 模板和独立 contract。
- Documentation harness：负责 `docs/governance/`、`docs/systems/`、`docs/logbooks/` 与主入口同步。
- Domain/ADR harness：负责领域词汇、架构决策状态、索引登记和 Agent 阅读/更新职责同步。
- Authority harness：负责产品版本、环境拓扑、当前 release state 和证据链接的一致性。

## 当前根级聚合命令

- `npm run harness:verify:project`
- `npm run harness:verify:quick`
- `npm run harness:verify:workspace`
- `npm run harness:verify:release`
- `npm run harness:verify:comfyui`
- `npm run verify:authority-state`
- `npm run verify:sealed-production-artifact-harness`
- `npm run verify:release-governance-contract`
- `npm run release:retention:prune -- --env=<gray|production> --ssh-key=<path>`
- `npm run harness:run -- --profile=quick`
- `npm run harness:run -- --profile=project`

## Documentation Contract Commands

- `npm run verify:documentation-entry-contract`
- `npm run verify:domain-context-and-adr-contract`
- `npm run verify:agent-runtime-architecture-contract`（同时保护双入口身份、Assistant Content、Knowledge Snapshot、Admin 结构化配置与运行时边界）
- `npm run verify:assistant-content-contract`（保护 `markdown-v1`、跨 chunk reasoning 隔离、安全 GFM 渲染、双端接入与内容字号/溢出边界）
- `npm run verify:generation-artifact-framework-contract`
- `npm run verify:generation-artifact-operations`
- `npm run verify:visual-design-docs-contract`
- `npm run verify:design-token-docs-contract`
- `npm run verify:component-registry-docs-contract`
- `npm run verify:system-doc-template-contract`
- `npm run verify:harness-doc-sync-contract`

## Sealed production artifact release track

The release harness records the staged dual-artifact boundary before packaging: `0.8.16` delivers the sealed production artifact, `0.8.17` delivers admin tiers, and `0.8.18` delivers RunningHub groups. Production must promote the same Gray archive that passed runtime verification; it must not rebuild a second production archive.

Before any stage is called complete, append its actual verification evidence (focused contracts, build/archive identity, and Gray or Production runtime result) to the release and validation logbooks. This harness directory keeps the execution rule and links only; it does not duplicate the evidence itself.

### 2026-08-03 0.8.16 local implementation proof

- Implementation chain: `9b84f59` → `2b34418` → `43e2db3` → `00197d1` → `f01bd03` → `53ed914` → `cee7211`.
- Candidate archive: `20260803-sealed-production-artifact-v0816-r1.tar.gz`; adjacent sidecar SHA-256: `9916bb3e74c04f092469e5019d3a1e6ea38d3376cedc23a5c2d784160d3dc9a0`.
- Inventory: 185 content-manifest files, 211 tar entries excluding the archive root entry, and 0 forbidden entries; manifest and API markers report `0.8.16`.
- Verification: all workspace type-check, `build:single-port`, `build:production-runtime`, package/archive/version contracts, and deployment/runtime dry-runs passed.
- Scope: this is executable local proof for the `0.8.16` candidate. It is not Gray or Production live-runtime evidence; actual deployment remains gated by the release-clean check and must promote this exact archive/SHA.
- Admin tier implementation progress: shared tier contract and migration are committed in `b90b7da`; auth repository/server propagation is locally verified (7 focused auth tests, API type-check and auth query contracts). Administrator account visibility/mutation policy and UI remain pending before `0.8.17` release.
- Root visibility policy helper is now covered by 3 focused tests (operator non-disclosure, last-root protection and audit redaction); route wiring and Admin controls remain pending.

## 更新规则

- 新增项目级 harness 入口时，优先更新本目录和 `package.json` 根脚本。
- 领域词汇或 ADR 生命周期变化时，必须同步 `CONTEXT.md`、`docs/adr/README.md`、治理规范和 `verify:domain-context-and-adr-contract`。
- 每次 Gray / Production 运行态验证成功后，Release harness 必须 dry-run 并恢复服务器“每环境最近五个 Release”的保留上限。
- Sealed artifact stages must preserve the `0.8.16` → `0.8.17` → `0.8.18` order, promote the same Gray archive to Production, and write actual verification evidence before a stage is closed.
- Harness runner 将每次 profile 运行写入 ignored `.harness/runs/*.json`；release/validation logbook 仍是正式审计证据。
- 新增子 harness 时，必须有 README、环境模板或配置说明、根级 verify 入口，以及对应 contract。
- 本目录只记录执行地图和接入约定，不复制系统设计正文、发布记录或长期状态。
