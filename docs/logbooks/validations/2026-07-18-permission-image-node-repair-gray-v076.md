# Permission and Image Node Repair Gray v0.7.6 验证

## 结论

- 状态：`PASS_WITH_USER_VISUAL_ACCEPTANCE_PENDING`。
- 严格 runtime gate 通过：API/Worker active，内外网版本、environment、permission mode 与 readiness 全部匹配；127 Subjects、121 published、926 rules、5 principals、0 failures。
- API 与 Worker `NRestarts=0`，部署后 journal warning 为 0。
- 真实 Gray 图片链路通过：认证登录、上传 PNG、`POST /api/image/resize`、下载输出 PNG 均返回 200；两个测试 Artifact 已通过正式删除 API 清理。
- 本地 176 项测试、全 workspace type-check、API/Web/Admin production build、critical/important harness 全部通过。
- 本地 Chrome 将 51 个注册节点全部渲染，错误边界、runtime error 与 network failure 均为 0。

## 已知验收边界

- Gray permission member catalog 的普通账号与分组账号目录读取均通过；自动 account override 场景因当前数据不存在安全候选模型而返回 `NO_SAFE_MODEL_SUBJECT`，脚本未改动线上权限。账号优先于组的双向行为由 resolver 回归和 Admin scoped-write contract 覆盖。
- 通用 single-port smoke 的登录、权限、画布、上传和图片素材链路通过；其历史本地 sample video 缺失导致 5 个视频样例项失败，与本 release 无关。
- 页面视觉与管理员真实选择“组 deny + 单账号 allow”的交互体验仍由用户在 Gray 浏览器完成最终确认。
