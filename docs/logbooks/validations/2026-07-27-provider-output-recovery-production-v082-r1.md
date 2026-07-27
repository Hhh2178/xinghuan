# Provider Output Recovery v0.8.2 Production Validation

- release: `20260727-provider-output-recovery-v082-r1`
- version: `0.8.2`
- source commit: `55aa3d9`
- archive SHA-256: `F1607BADC97988CD79E3C9FBA344F67839257BFB3C466AAF5409E3418BF8B6A1`

## Promotion Basis

- 本地全量测试、构建、Worker/API 契约和发布治理通过。
- 旧服务器 Gray 已运行同一 archive，内部/公网状态、API/Worker 和权限 readiness 全部通过。
- Production 复用 Gray 已验收版本 `0.8.2`，不额外递增版本。

## Runtime

| 项目 | 结果 |
|---|---|
| current release | `/opt/apps/xinghuan-canvas/releases/20260727-provider-output-recovery-v082-r1` |
| 内部与公网状态 | 均返回 `0.8.2 / production / enforced` |
| API/Worker | `xinghuan-canvas.service` 与 `xinghuan-canvas-worker.service` 均为 `active` |
| 权限 readiness | `ready=true`，154 subjects、126 published、20 restricted、8 retired、2832 rules、11 principals、0 failures |
| 首页与后台 | `https://canvas.hhh2121.xyz/` 与 `/admin/` 均返回 HTTP 200 |

## Agent Runtime Repair

- 修复前 PostgreSQL 备份：`/opt/apps/xinghuan-canvas/shared/backups/20260727-before-agent-governance-bootstrap-v082.dump`（85,942,617 bytes）。
- 根因一：Production 已有 Agent governance schema，但没有 bootstrap Agent definition/configuration 和 route pool。
- 根因二：Production runtime control 记录缺失，安全默认值使 `agentEnabled=false`。
- 根因三：首次发布 route 的 capability snapshot 为空，planner 需要 `text_chat`，触发 `LLM_ROUTE_UNAVAILABLE:planner:assistant-chat`。
- 通过审计 Admin API 初始化 8 个 Agent definition/configuration 和 3 个 route pool；发布前台助手、后台助手、托管 planner 的 Agent v1 与 route v2。
- route v2 主候选为 Grok 4.5，fallback 为 GPT-5.6 Terra，均带 `text_chat` capability snapshot。
- Production runtime preset 为 `observe`：`agentEnabled=true`、`canvasRunsEnabled=true`、`automaticRecoveryEnabled=false`、`qualityEvaluationEnabled=false`。
- 真实验收：前台助手返回 `mode=agent`（内容长度 34）；后台助手返回 `mode=agent`（内容长度 39）。未将 fallback 误报为通过。

## Seven-day Task Evidence

- succeeded 2,172；failed 801；cancelled 96。
- 失败分类：`upstream_business_failed=364`、`unknown=237`、`upstream_poll_gateway_failed=111`、`upstream_poll_timeout=37`、`quota_or_credits=37`、`model_config=9`。
- Provider 成功但本地失败识别到 1 个；历史任务未带新版恢复投影，`outputRecoveryAvailable=true` 为 0。
- 详细链路与加固结论：`../../records/worker/2026-07-27-generation-delivery-and-agent-hardening-audit.md`。

## Audit Finding

- `0.8.2` 审计确认 recover-output 存在 API 写 `result.outputRecoveryMode`、Worker 读 `payload.outputRecoveryMode` 的契约缺陷。
- 在后续补丁完成 Gray 端到端验收前，Production 不应使用“恢复产物”按钮，也不能把该入口视为“不重新提交 Provider”的可靠保证。

## Isolation

- 旧服务器 Gray 内部与公网状态仍返回 `0.8.2 / gray / enforced`。
- Gray API/Worker 保持 `active`，current 仍指向同名 `v0.8.2` release。

## Retention Dry Run

- Production 当前共有 7 个 release；dry-run 计划保留 5 个。
- current `20260727-provider-output-recovery-v082-r1` 与 rollback `20260726-video-prompt-provider-limit-v081-r1` 均被保护。
- 本轮 `apply=false`，未删除任何 release。

## Boundary

- 仅操作旧服务器 Production；新服务器和 Gray 本轮不操作。
- retention 已完成 dry-run，本批次未直接清理历史 release。
