# v0.1.0 Changelog

## 2026-06-04

- 本机真实测试密钥落地：
  - 新建被忽略的 `.env.local`，用于保存 GRSAI 和 ToAPIs 测试 Key。
  - 验证 `.env.local` 命中 `.gitignore`，不会被普通 Git 提交追踪。
  - 文档与 Git 提交不记录真实 Key 值。
- 初始化 Git 前的密钥治理补充：
  - 更新 `.gitignore` 中文注释，明确 `.env` 和 `.env.*` 为本机密钥文件。
  - 新增 `config/secrets-placement.md`，记录 GRSAI 和 ToAPIs 测试密钥的环境变量名与安全放置方式。
  - 真实 Key 不写入 Markdown 文档，不进入 Git。
  - 初始化 Git 仓库，初始提交 `5f1dc08 docs: initialize infinite canvas 2 project`。
- 补充测试服务商与服务器状态：
  - 新增 `config/.env.local.example`。
  - 新增 `config/provider-test-matrix.md`，记录 GRSAI `gpt-image-2` 和 ToAPIs Grok Video 的文档地址、模型、环境变量名和验收重点。
  - 新增 `ops/server-state-2026-06-04.md`，记录腾讯云服务器磁盘、旧项目目录占用、服务状态、端口和 2.0 部署影响。
  - 新增 `.gitignore`，忽略 `.env` 与 `.env.*`，避免真实密钥进入 Git。
  - 更新 `MEMORY.md` 和 `progress.md`。
  - 真实 API Key 未写入 Markdown 文档。
- 初始化无限画布 2.0 项目治理文档。
- 新增根级 `AGENTS.md`、`MEMORY.md`、`DEVLOG.md`。
- 新增 `docs/prd/README.md`。
- 新增 `docs/prd/v0.1.0/` 文档集：
  - `prd.md`
  - `spec.md`
  - `design.md`
  - `plan.md`
  - `progress.md`
  - `decisions.md`
  - `release.md`
  - `changelog.md`
- 明确旧 Node Banana 改造项目不再作为主干。
- 明确 2.0 初始方向：基底选型、通用节点、模型后台、云端项目、用户隔离、任务系统和素材空间。

Git 关联：

- 当前为文档初始化，尚未建立 2.0 Git 仓库提交。
