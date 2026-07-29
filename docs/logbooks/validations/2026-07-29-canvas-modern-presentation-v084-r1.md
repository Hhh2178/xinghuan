# Canvas Modern Presentation v0.8.4 Gray Validation

- release: `20260729-canvas-modern-presentation-v084-r1`
- environment: `gray`
- target: `old-server` / `101.33.75.38:728`

## Passed

- Gray 当前 release 指向 `20260729-canvas-modern-presentation-v084-r1`。
- `xinghuan-canvas-next.service` 与 `xinghuan-canvas-next-worker.service` 均为 `active`。
- 内网与公网状态均返回 `xinghuan-api / 0.8.4 / gray`。
- 权限 readiness 返回 `ready=true`、`mode=enforced`、无 failures。

## Pending user acceptance

- 1920×1080 下确认旧视觉仍为默认，现代画布开关可用。
- 确认现代侧栏悬浮展开、点阵、节点文字与 MiniMap 均可见且不遮挡。
- 根据业务需要继续执行真实素材和生成链路验收。

## Retention note

- 只读 retention dry-run 未执行成功：脚本未使用 `old-server` profile，连接到另一台配置服务器后被拒绝。没有执行 apply 或删除操作。
