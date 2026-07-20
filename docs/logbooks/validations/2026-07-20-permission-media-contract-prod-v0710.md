# 权限目录与媒体参考契约 Production v0.7.10 验证

- 状态：`PASS`
- Production 目标：`canvas.hhh2121.xyz`，数据库目标为生产专用 `xinghuan_canvas_next`。
- 验收结果：版本 `0.7.10`、环境 `production`；API/Worker active，内外网 `/api/status` 一致，权限 readiness `ready=true`。
- 权限 readiness：subjects `140`，published `121`，restricted `13`，retired `6`，rules `2772`，principals `11`，failures `0`。
- 启动前发现旧 retired subject rule 导致 readiness gate 拒绝；已完成生产库权限 reconcile，dry-run 后 apply，最终幂等通过。
- 回滚锚点：`20260720-aicopy-video-contract-scope-prod-r1-v078`。
- Production 模型配置已同步：按次模型 `sd2-per-request`，三个按秒模型 `sd2-per-second`；参考视频/音频均为 `max=10`、`default=2`。
