# ops - 无限画布 2.0 运维记录

本目录用于记录服务器、域名、部署、服务、日志、回滚和验收。

## 当前状态

- 灰度入口：`canvas-next.hhh2121.xyz`，服务端口 `127.0.0.1:18200`。
- 生产入口：`canvas.hhh2121.xyz`，服务端口 `127.0.0.1:18100`。
- 当前灰度 release：`20260616-grsai-nano-error-ux-gray-r1-ee04792`。
- 当前生产 release：`20260615-phase-e-observability-governance-batch3-prod-r2`。
- `Phase E` 已完成 gray / production 放行：请求链路观测、系统观测页和放行 gate 已在两套入口完成真实验收。
- `Phase E` 已补齐 gray / production rollback 样本，且长期观测治理第三批已完成灰度/正式发布。
- `2026-06-16` 已对当前 gray / production release 补做观测验收脚本热补丁，修复 `Observability` / `System Observability` 假 Provider 残留问题。
- `2026-06-16` 灰度已发布 `GRSAI` nano 路由与图像节点错误透传热修复；当前灰度实测通过 `gpt-image-2` 同步和异步图像生成，nano 模型尚未在灰度后台启用。
- `2026-06-16` 当前 gray current 已确认指向 `20260616-grsai-nano-error-ux-gray-r1-ee04792`，并已补跑：
  - `verify:release-preflight`
  - `verify:request-chain-observability`
  - `verify:system-observability`
- 灰度与生产是两套 Nginx 入口、端口和 release 目录，且各自维护独立 release 指针；但当前 PostgreSQL 数据库目标仍未彻底拆分。
- 异步视频 Provider 模板规范主文档见 `../docs/prd/v0.1.0/provider-async-video-template-spec.md`。
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
