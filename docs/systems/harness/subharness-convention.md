# Subharness Convention

## 目标

子 harness 是某个外部接入、机器侧进程或复杂子系统的独立执行骨架。它必须接入项目总 harness，但不能复制项目总规则。

## 必备文件

每个子 harness 至少应满足以下条件：

- 有清晰的 workspace 或系统 README。
- 有环境变量模板、配置模块或部署模板。
- 有根级 `verify:*` 脚本入口。
- 有独立 contract 脚本验证 README、配置、部署模板和关键调用入口。
- 在 `docs/systems/harness/workspace-verify-release-map.md` 中登记。

## 推荐命名

- 根级验证脚本：`verify:<system>-<purpose>`
- 契约脚本文件：`scripts/verify-<system>-<purpose>-contract.mjs`
- workspace README：`apps/<workspace>/README.md`
- env 模板：`apps/<workspace>/.env.example` 或 `config/<system>.env.example`
- systemd 模板：`ops/systemd/<service-name>.service.example`

## ComfyUI 当前样板

当前 ComfyUI connector 已具备：

- `apps/comfyui-connector/README.md`
- `apps/comfyui-connector/.env.example`
- `apps/comfyui-connector/src/config.ts`
- `ops/systemd/xinghuan-comfyui-connector.service.example`
- `scripts/verify-comfyui-connector-harness-contract.mjs`
- `npm run verify:comfyui-connector-harness`

后续 ComfyUI instance pool、共享工作流管理、机器级工作流管理都应继续沿用这套结构。

## 禁止事项

- 不在子 harness 中复制 `AGENTS.md` 的总规则。
- 不在子 harness 中复制 release 记录正文。
- 不把本地运行缓存、临时状态或真实密钥写入仓库。
- 不把 `.agent/` 作为当前项目的正式执行入口；如果后续确实需要本地自动化覆盖层，应默认本地忽略且只引用现有真源。

