# 2026-07 最近高频事项

> 当前版本与环境状态以根 `package.json`、`config/environments.json` 和 `ops/current/release-state.json` 为准；本页只保留导航和历史摘要，不复制运行态事实。

## 当前高频恢复入口

- Agent / Harness authority model 治理重构：
  - `2026-07-16`
  - 完成 AGENTS 路由收敛、环境与 release state 权威文件、通用 release interface、Harness evidence runner。
  - 继续修复 retired permission subject 规则漂移，并补齐日志索引契约。

- AIFork Grok FAST 请求契约与图片预处理灰度：
  - `2026-07-15`
  - 历史记录：`20260715-aifork-grok-fast-preprocess-v0612`
  - FAST 改用插件一致的请求契约，并将参考图按 JPEG/1024/85 预处理；与 SD 补充契约隔离。
  - 真实三图任务证据见对应 validation；production 保持 `v0.5.22`。

- Provider 轮询重试与 Grok FAST Data URL 灰度：
  - `2026-07-15`
  - 历史记录：`20260715-provider-poll-retry-grok-data-url-v0610`
  - 幂等 GET 瞬时错误可受控重试，生成 POST 不重试；FAST 最多 6 张参考图按模型使用 Data URL。
  - 免费轮询 Mock、三图 Mock 和 1080P 助手开关验收通过；production 保持 `v0.5.22`。

- Clean worktree 迁移与结构治理当前口径：
  - `2026-07-05`
  - 当前活跃分支：`xinghuan-integration-clean`
  - ComfyUI 功能开发已暂停封存；下一步是 B2/B3/E1/F1 结构批次完成或明确延期
- ComfyUI 实例池 clean integration 分支：
  - `2026-07-02`
- ComfyUI connector harness 工程化：
  - `2026-07-02`
- 项目级 harness 入口层：
  - `2026-07-02`
- 主入口状态漂移修复：
  - `2026-07-03`
- 结构改进与性能优化规划（roadmap + execution-plan）：
  - `2026-07-04`
- Clean migration master plan revision：
  - `2026-07-05`
- Repository boundary gray release repair：
  - `2026-07-06`
  - 注意：live verifier 需通过 `config/environments.json` 选择目标，不要依赖本机默认端口。

## 对应入口

- 当前月份说明：`README.md`
- 当日记录：`2026-07-16.md`
- 历史当日记录：`2026-07-15.md`、`2026-07-05.md`
- 主计划：`docs/superpowers/plans/2026-07-05-clean-worktree-migration-maintenance-master-plan.md`
- 当前状态：`docs/memory/current-state.md`
- 旧兼容台账：`../../../../../DEVLOG.md`
