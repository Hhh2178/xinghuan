# 权限目录与媒体参考契约 Gray v0.7.10 验证

- 状态：`PASS`
- 定向测试：权限 registrar/reconciliation、权限访问状态、视频输入校验、AICOPY adapter、SD profile 配置。
- 运行态：Gray `0.7.10 / gray / enforced`，API/Worker active；权限 readiness `ready=true`，failures `0`，subjects `128`，published `122`，restricted `3`，retired `3`。
- 模型契约：按次模型为 `sd2-per-request`，三个按秒模型为 `sd2-per-second`；参考视频/音频 `max=10`、`default=2`，真实配置写入完成。
- 任务链路验证：契约测试覆盖 `input.media[]`、图片参考计数和媒体计数映射；本轮未在 Gray 触发新的外部计费任务，Production 未操作。
- Production 保持 `v0.7.8`，本轮不执行 retention/prune。
