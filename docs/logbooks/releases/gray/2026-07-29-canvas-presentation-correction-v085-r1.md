# Canvas Presentation Correction v0.8.5 Gray

- release: `20260729-canvas-presentation-correction-v085-r1`
- version: `0.8.5`
- source branch: `release/canvas-modern-gray-v084`
- source commit: `486a456`
- archive SHA-256: `9186046C89C57E0EBB68C7BD13301BE8B6047CD0745EFD135D3A444380EF8A26`
- target: `old-server` / `101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- rollback: `20260729-canvas-modern-presentation-v084-r1`
- retention apply: `false`

## Scope

- 移除新版侧栏中与 hover/focus 自动展开重复的手动开合按钮。
- 为既有图像、视频、LLM 节点提供运行时新版视觉边界：放大排版、模型/状态文本防越界、保留现有参数、素材、任务与连线逻辑。
- 将顶栏样式切换器改为与相邻操作一致的 32px 紧凑分段控件。

## Verification

- 本地全量测试：220 个文件通过、845 项通过、4 项跳过。
- 完整单端口构建、制品版本对齐和 Release package 契约均通过。
- 部署后 API/Worker 均为 `active`；内外状态均返回 `0.8.5 / gray`；权限为 `enforced / ready`。
- 视觉与真实业务体验交由 Gray 用户在 1920×1080 继续验收。

