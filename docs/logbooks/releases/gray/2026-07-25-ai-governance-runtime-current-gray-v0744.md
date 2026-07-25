# AI Governance Runtime Current Gray v0.7.44

- release: `20260725-ai-governance-runtime-current-gray-r1-v0744`
- source commit: `待发布提交写入后更新`
- rollback: `20260725-ai-governance-supervision-gray-r1-v0743`
- Production: unchanged at `v0.7.18`

## Scope

- 推送当前代码中的 Canvas/后台 AI 助手、AI 托管运行时和统一运行投影。
- 启用智能候选选择器 provenance 修复、质量评估、批量媒体执行及人类可读节点身份。
- 保持 AI 助手与托管面板不重叠，并保留 PC 端运行态反馈、IME 和文本选择修复。

## Deployment

- 目标：`canvas-next.hhh2121.xyz` Gray 环境。
- 仅重启 Gray API 与 Worker；不切换 Production 域名、不修改 Production 数据。
- 数据库迁移由发布脚本在 Gray release 目录执行，并复用 Gray shared 环境配置。

## Evidence

- 本地完整 Vitest：`730 passed / 4 skipped`。
- PostgreSQL Canvas Run 集成：`4 passed`；Canvas Run 本地 E2E 的 SSE、settlement、pause/resume、cancellation 均通过。
- Project、Workspace、Release Harness、类型检查及 Web/Admin/ComfyUI 构建通过。
- 隔离 Gray Candidate 真实运行通过：双分支候选选择、单分支多候选质量评估、下游生成和前后台 assistant agent 模式。
- 正式 Gray 旧版本曾复现旧的 `SMART_CANDIDATE_PROVENANCE_INCOMPLETE`；本 release 包含该修复。

## Visual Scope

- 按用户要求仅做 PC 端视觉验收；未执行其他窗口尺寸矩阵。
