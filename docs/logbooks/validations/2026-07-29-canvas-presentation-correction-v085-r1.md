# Canvas Presentation Correction v0.8.5 Gray Validation

- release: `20260729-canvas-presentation-correction-v085-r1`
- environment: `gray`
- target: `old-server` / `101.33.75.38:728`

## Passed

- `npm test`: 220 个文件通过、845 项通过、4 项跳过。
- `npm --workspace @xinghuan/web run build` 与单端口 Release 构建通过。
- Gray 当前 release 指向 `20260729-canvas-presentation-correction-v085-r1`。
- API 与 Worker 均为 `active`；内网与公网状态均为 `xinghuan-api / 0.8.5 / gray`。
- 权限 readiness 为 `ready=true`、`mode=enforced`，无 failures。

## Pending user acceptance

- 在 1920×1080 下确认新版侧栏只含画布列表、创建、搜索、AI 托管四个有效入口。
- 确认已有图像、视频、LLM 节点在切换新版后自动呈现新版布局，切回旧版后恢复旧视觉。
- 确认顶栏 `画布样式` 分段控件与相邻按钮对齐，长模型名、错误文本和上游素材均不越界。

