# 2026-07 最近高频事项

## 当前高频恢复入口

- AIFork Grok FAST 请求契约灰度：
  - `2026-07-15`
  - 当前 gray：`v0.6.11` / `20260715-aifork-grok-fast-contract-v0611`
  - FAST 改用插件一致的 `duration/video_length/aspect_ratio/video_config/reference_images`，并与 SD 补充契约隔离。
  - 真实三图任务证据见对应 validation；production 保持 `v0.5.22`。

- Provider 轮询重试与 Grok FAST Data URL 灰度：
  - `2026-07-15`
  - 当前 gray：`v0.6.10` / `20260715-provider-poll-retry-grok-data-url-v0610`
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
  - 当前 gray release：`20260706-task-list-lightweight-gray-r1-v0527`
  - 注意：live verifier 不要默认打本机 `127.0.0.1:18200`，需远端 release 目录加载 gray env 后执行或显式指定已确认目标。

## 对应入口

- 当前月份说明：`README.md`
- 当日记录：`2026-07-05.md`
- 当日记录：`2026-07-02.md`
- 主计划：`docs/superpowers/plans/2026-07-05-clean-worktree-migration-maintenance-master-plan.md`
- 当前状态：`docs/memory/current-state.md`
- 旧兼容台账：`../../../../../DEVLOG.md`
