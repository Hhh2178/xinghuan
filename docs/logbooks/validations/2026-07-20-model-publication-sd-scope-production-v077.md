# Model Publication and SD Scope Production v0.7.7 验证

## 结论

- 状态：`PASS_WITH_EXISTING_OBSERVABILITY_WARNINGS`。
- 复用 Gray 制品，SHA-256 保持 `5c03b0a1e22e48f6af6769412bb3853f5538ca489fb0ed81fce10ce48f39033c`。
- 严格 runtime/readiness 通过：134 Subjects、109 published、17 restricted、8 retired、506 rules、11 principals、0 failures。
- API/Worker active 且 `NRestarts=0`，Nginx 配置检查通过。
- 全量 26 个普通账号验证一致：管理员有 14 个视频模型，普通账号有 11 个；差集严格等于 3 个 SD 模型，所有非 SD 模型可见。
- 临时账号 allow 覆盖组 deny 的真实测试通过，另一账号不受影响；临时规则已清理并恢复基线。
- ungrouped 与 named group 目录验证均通过：43 models、8 image、11 video、10 RunningHub、0 resources、0 denied node types。
- request-chain 与 system observability 校验通过，近 24 小时 requestId 覆盖率 100%。系统仍报告既有 7 天任务失败累计和 24 小时 6 次 canvas revision conflict 为 critical；本次发布未扩大服务重启或权限 readiness failures。
