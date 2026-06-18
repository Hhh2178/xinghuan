# ops - 无限画布 2.0 运维记录

本目录用于记录服务器、域名、部署、服务、日志、回滚和验收。

## 当前状态

- 灰度入口：`canvas-next.hhh2121.xyz`，服务端口 `127.0.0.1:18200`。
- 生产入口：`canvas.hhh2121.xyz`，服务端口 `127.0.0.1:18100`。
- 当前灰度 release：`20260618-runninghub-workspace-gray-r1-6b65dbc`。
- 当前生产 release：`20260618-v032-ui-fixes-prod-r1`。
- 当前发布版本号：`v0.3.2`。
- gray / production 可以在发布窗口内短暂指向不同 release 目录，但同一批次对外暴露的应用版本号必须保持一致。
- `Phase E` 已完成 gray / production 放行：请求链路观测、系统观测页和放行 gate 已在两套入口完成真实验收。
- `Phase E` 已补齐 gray / production rollback 样本，且长期观测治理第三批已完成灰度/正式发布。
- `2026-06-16` 已对当前 gray / production release 补做观测验收脚本热补丁，修复 `Observability` / `System Observability` 假 Provider 残留问题。
- `2026-06-16` 灰度已发布 `GRSAI` nano 路由与图像节点错误透传热修复；当前灰度实测通过 `gpt-image-2` 同步和异步图像生成，nano 模型尚未在灰度后台启用。
- `2026-06-17` 当前 gray current 已确认指向 `20260617-environment-sync-layout-v031-gray-r1-dfd5f37`，并已补跑：
  - `verify:release-preflight`
  - `verify:request-chain-observability`
  - `verify:system-observability`
- `2026-06-18` gray 已发布多生成任务状态与超时统一修复：
  - gray：`20260618-multi-generation-timeout-gray-r1-b8534f2`
  - `/api/status` 当前返回 `version = 0.3.1`
  - gray gate 已补跑：
    - `verify:release-preflight`
    - `verify:request-chain-observability`
    - `verify:system-observability`
- `2026-06-18` `v0.3.2` 已完成 gray / production 发布：
  - gray：`20260618-v032-ui-fixes-gray-r1`
  - production：`20260618-v032-ui-fixes-prod-r1`
  - 两端 `/api/status` 当前均返回 `version = 0.3.2`
  - 两端 gate 已补跑：
    - `verify:release-preflight`
    - `verify:request-chain-observability`
    - `verify:system-observability`
- `2026-06-18` gray 已继续发布 RunningHub 第一阶段工作台与单一 RH 节点改造：
  - gray：`20260618-runninghub-workspace-gray-r1-6b65dbc`
  - `/api/status` 当前返回 `version = 0.3.2`
  - gray gate 已通过：
    - `verify:release-preflight`
    - `verify:request-chain-observability`
    - `verify:system-observability`
  - 本轮未包含新的数据库 migration，但在 release 目录执行 `db:migrate` 时暴露出 `PG_DRIVER_NOT_INSTALLED`，后续需要单独修补 release 迁移依赖链
- `2026-06-17` 已将环境同步页固定工具栏布局与版本治理收口发布到 gray / production：
  - gray：`20260617-environment-sync-layout-v031-gray-r1-dfd5f37`
  - production：`20260617-environment-sync-layout-v031-prod-r1-dfd5f37`
  - 两端 `/api/status` 当前均返回 `version = 0.3.1`
- `2026-06-17` gray / production 已带上项目 atlas、文档治理收束、CodeGraph hook、生成库素材访问链路、柏拉图 multipart 视频接入和 release gate 闭环。
- `2026-06-17` production 已切到 `20260617-environment-sync-layout-v031-prod-r1-dfd5f37`，并已完成本机与公网 gate 复验。
- `2026-06-17` 柏拉图真实验收已通过：
  - gray：`grok-1.5-video-6s` 成功返回本地视频落库
  - production：`grok-1.5-video-6s` 在一次上游繁忙重试后成功返回本地视频落库
- `2026-06-17` 已新增后台“环境同步”能力：
  - 支持 `gray -> production` 与 `production -> gray`
  - 支持用户 / 服务商差异预览、逐项勾选、全选、冲突裁决
  - 当前 gray / production 均已完成真实双向联调
  - 当前已补标准验收入口：
    - `npm run verify:environment-sync-smoke`
  - 依赖：
    - `XINGHUAN_ENVIRONMENT_SYNC_TOKEN`
    - `XINGHUAN_GRAY_API_BASE_URL`
    - `XINGHUAN_PRODUCTION_API_BASE_URL`
- 灰度与生产是两套 Nginx 入口、端口和 release 目录，且各自维护独立 release 指针；但当前 PostgreSQL 数据库目标仍未彻底拆分。
- 异步视频 Provider 模板规范主文档见 `../docs/prd/v0.1.0/provider-async-video-template-spec.md`。
- 项目总纲与 AI 阅读入口见 `../docs/project-atlas/README.md`。
- 服务器维护与健康检查总手册见 `../docs/project-atlas/server-maintenance-and-healthchecks.md`。
- 仓库结构和当前 worktree 说明见 `../docs/repo-structure.md`。
- Provider 生成任务标准化灰度/生产切换清单见 `provider-generation-task-rollout-checklist-2026-06-12.md`。
- 数据库目标防呆与防空画布误清理发布记录见 `database-target-guard-release-2026-06-13.md`。
- 多用户正式化加固验收方案见 `production-multi-user-acceptance-plan-2026-06-13.md`。
- 多用户正式化实施主方案见 `../docs/production-multi-user-hardening-plan-2026-06-13.md`。
- Phase A 灰度多用户隔离真实验收记录见 `phase-a-gray-multi-user-acceptance-2026-06-13.md`。
- 发布前快照与回滚基线 Runbook 见 `release-preflight-snapshot-runbook-2026-06-13.md`。
- Phase B 画布 Revision 冲突防护灰度发布记录见 `phase-b-canvas-revision-gray-2026-06-13.md`。
- Phase B 资源库 Revision 冲突防护灰度发布记录见 `phase-b-resource-revision-gray-2026-06-13.md`。
- Phase B 后台关键设置 Revision 冲突防护灰度发布记录见 `phase-b-admin-settings-revision-gray-2026-06-13.md`。
- Phase C 第一批会话治理灰度/生产发布记录见 `phase-c-session-governance-release-2026-06-15.md`。
- Phase C 第二批 CSRF 同源防护灰度/生产发布记录见 `phase-c-csrf-origin-release-2026-06-15.md`。
- Phase C 第三批登录限流本地验收记录见 `phase-c-login-rate-limit-local-validation-2026-06-15.md`。
- Phase C 第三批登录限流灰度发布记录见 `phase-c-login-rate-limit-gray-2026-06-15.md`。
- Phase C 第三批登录限流灰度/生产发布记录见 `phase-c-login-rate-limit-release-2026-06-15.md`。
- Phase D 本地任务状态机与分页验收记录见 `phase-d-local-validation-2026-06-15.md`。
- Phase D 发布缺口与放行门槛记录见 `phase-d-release-gap-and-rollout-gate-2026-06-15.md`。
- Phase D 灰度发布记录见 `phase-d-gray-release-2026-06-15.md`。
- Phase D 正式发布记录见 `phase-d-production-release-2026-06-15.md`。
- Phase E 灰度发布记录见 `phase-e-observability-gray-release-2026-06-15.md`。
- Phase E 正式发布记录见 `phase-e-observability-production-release-2026-06-15.md`。
- Phase E 长期观测治理第一批灰度发布记录见 `phase-e-observability-governance-gray-release-2026-06-15.md`。
- Phase E 长期观测治理第一批正式发布记录见 `phase-e-observability-governance-production-release-2026-06-15.md`。
- Phase E 长期观测治理第二批灰度发布记录见 `phase-e-observability-governance-batch2-gray-release-2026-06-15.md`。
- Phase E 长期观测治理第二批正式发布记录见 `phase-e-observability-governance-batch2-production-release-2026-06-15.md`。
- Phase E 长期观测治理第三批灰度发布记录见 `phase-e-observability-governance-batch3-gray-release-2026-06-15.md`。
- Phase E 长期观测治理第三批正式发布记录见 `phase-e-observability-governance-batch3-production-release-2026-06-15.md`。
- Phase E 当前放行 gate 入口见 `phase-e-observability-release-gate-2026-06-15.md`。
- Phase E 正式环境 rollback 演练记录见 `phase-e-observability-production-rollback-2026-06-15.md`。
- Phase E 观测验收脚本测试 Provider 清理热补丁记录见 `phase-e-observability-script-cleanup-hotfix-2026-06-16.md`。
- `GRSAI` nano 路由与图像节点错误透传灰度发布记录见 `grsai-nano-error-ux-gray-release-2026-06-16.md`。

## 当前运行态 / 当前放行入口

- `server-connection.md`
- `provider-generation-task-rollout-checklist-2026-06-12.md`
- `database-target-guard-release-2026-06-13.md`
- `production-multi-user-acceptance-plan-2026-06-13.md`
- `phase-a-gray-multi-user-acceptance-2026-06-13.md`
- `release-preflight-snapshot-runbook-2026-06-13.md`
- `phase-b-canvas-revision-gray-2026-06-13.md`
- `phase-b-resource-revision-gray-2026-06-13.md`
- `phase-b-admin-settings-revision-gray-2026-06-13.md`
- `phase-c-session-governance-release-2026-06-15.md`
- `phase-c-csrf-origin-release-2026-06-15.md`
- `phase-c-login-rate-limit-local-validation-2026-06-15.md`
- `phase-c-login-rate-limit-gray-2026-06-15.md`
- `phase-c-login-rate-limit-release-2026-06-15.md`
- `phase-d-local-validation-2026-06-15.md`
- `phase-d-release-gap-and-rollout-gate-2026-06-15.md`
- `phase-d-gray-release-2026-06-15.md`
- `phase-d-production-release-2026-06-15.md`
- `phase-e-observability-gray-release-2026-06-15.md`
- `phase-e-observability-production-release-2026-06-15.md`
- `phase-e-observability-governance-gray-release-2026-06-15.md`
- `phase-e-observability-governance-production-release-2026-06-15.md`
- `phase-e-observability-governance-batch2-gray-release-2026-06-15.md`
- `phase-e-observability-governance-batch2-production-release-2026-06-15.md`
- `phase-e-observability-governance-batch3-gray-release-2026-06-15.md`
- `phase-e-observability-governance-batch3-production-release-2026-06-15.md`
- `phase-e-observability-release-gate-2026-06-15.md`
- `phase-e-observability-production-rollback-2026-06-15.md`
- `phase-e-observability-script-cleanup-hotfix-2026-06-16.md`
- `grsai-nano-error-ux-gray-release-2026-06-16.md`
- `atlas-gray-release-2026-06-17.md`
- `atlas-production-release-2026-06-17.md`
- `plato-provider-rollout-2026-06-17.md`
- `environment-sync-release-2026-06-17.md`
- `multi-generation-timeout-gray-release-2026-06-18.md`
- `release-v032-gray-and-production-2026-06-18.md`
- `runninghub-workspace-gray-release-2026-06-18.md`

当前入口只保留仍直接用于当前值守、放行判断、回滚判断或最新 release 追溯的材料。早期 UI / 助手 / Provider / 基础设施阶段记录一律从这里移出，转入 `archive/` 批次索引。

## 当前灰度材料

- `gray-deploy-runbook.md`
- `nginx/canvas-next.hhh2121.xyz.conf.example`
- `systemd/xinghuan-canvas-next.service.example`
- `systemd/xinghuan-canvas-next-worker.service.example`
- `systemd/xinghuan-canvas-next-output-prune.service.example`
- `systemd/xinghuan-canvas-next-output-prune.timer.example`

## 当前生产材料

- `production-deploy-runbook.md`
- `production-acceptance-checklist.md`
- `nginx/canvas.hhh2121.xyz.conf.example`
- `systemd/xinghuan-canvas.service.example`
- `systemd/xinghuan-canvas-worker.service.example`
- `systemd/xinghuan-canvas-output-prune.service.example`
- `systemd/xinghuan-canvas-output-prune.timer.example`

## 历史发布记录

以下材料已归档到 `archive/`，保留为历史审计证据，不再作为当前运行态入口：

- `archive/2026-06-initial-rollout/`
  - 初始灰度、认证、后台、安全、数据库切换、旧画布清理和第一轮运行态落地材料
- `archive/2026-06-assistant-and-ui-rollout/`
  - 2026-06-08 到 2026-06-10 的本机清理、Hermes 联调、助手 UI 和生成数量早期闭环记录
- `archive/2026-06-provider-and-infra-rollout/`
  - 2026-06-12 的 Provider 任务化、并发治理、ModelScope 协议、Cloudflare 与 files 域名阶段性记录
- `archive/2026-06-phase3-rollout/`
  - Phase 3 初期灰度、生产切换、节点验收、入口 UI 和首轮产品闭环发布材料

## 清理规则

- 不批量删除文件或目录。
- 不使用递归删除命令。
- 不清理运行期数据、密钥、服务器环境文件或用户素材。
- 如需删除历史文档，必须先列出单个明确路径，再逐个删除。
- 历史材料优先移动到 `archive/`，不要直接删除。
