# Admin 十域版本口径修正 Production v0.7.3 验证

## 结论

- 使用 Gray 已验收的同一份制品晋级 Production，SHA-256 一致。
- `release:gray:verify --env=production` 通过：公网与内网状态、版本、环境和 enforced 权限模式全部匹配。
- `xinghuan-canvas.service`、`xinghuan-canvas-worker.service` 与 PostgreSQL 均为 active。
- 权限 readiness 为 ready，0 failures；数据库目标为 `xinghuan_canvas_next`。
- 发布前备份已创建并通过目录校验；Release 保留干跑与执行均成功，最终数量为 3。
- 最终磁盘状态：59G 容量、41G 已用、16G 可用、使用率 73%。
