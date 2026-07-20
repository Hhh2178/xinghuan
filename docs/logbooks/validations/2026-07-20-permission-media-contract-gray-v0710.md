# 权限目录与媒体参考契约 Gray v0.7.10 验证

- 状态：`待灰度部署后验证`
- 定向测试：权限 registrar/reconciliation、权限访问状态、视频输入校验、AICOPY adapter、SD profile 配置。
- 预期运行态：Gray `0.7.10 / gray / enforced`，API/Worker active，权限 readiness 无失败。
- 预期契约：参考视频/音频 `max=10`、`default=2`；真实任务 `input.media[]` 与 `providerRequestSummary.mediaCount` 均大于 0。
- Production 保持 `v0.7.8`，本轮不执行 retention/prune。
