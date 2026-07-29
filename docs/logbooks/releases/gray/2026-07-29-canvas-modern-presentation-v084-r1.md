# Canvas Modern Presentation v0.8.4 Gray

- release: `20260729-canvas-modern-presentation-v084-r1`
- version: `0.8.4`
- source branch: `release/canvas-modern-gray-v084`
- source commit: `4dae4a7`
- archive SHA-256: `A9346633281B3A60506025B36007E9B45E27F85717DAC8A75503D67E06A95BAC`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- rollback: `20260728-plato-output-recovery-v083-r22`
- retention apply: `false`

## Scope

- 保持旧画布为默认展示，新增用户可选的现代画布视觉。
- 现代模式包含悬浮可折叠侧栏、增强点阵、生成节点可读性样式和 MiniMap/悬浮层层级修复。
- 不改变节点数据、素材输入、任务提交、Provider 调用或产物回传链路。

## Verification

- 全量测试：220 个测试文件通过、844 项通过、4 项跳过。
- 完整构建、单端口制品构建和制品内版本对齐均通过。
- 发布后 Gray API/Worker 为 active；内外 `/api/status` 均为 `0.8.4 / gray`；权限为 `enforced / ready`。
- 浏览器视觉验收和真实业务体验保留给 Gray 用户继续验证。
