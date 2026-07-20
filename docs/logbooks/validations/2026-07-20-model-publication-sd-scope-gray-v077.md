# Model Publication and SD Scope Gray v0.7.7 验证

## 结论

- 状态：`PASS`。
- 本地 `npm run ci` 通过：49 个测试文件、178 项测试；全 workspace type-check、API/Web/Admin build、项目/工作区/Release Harness 与 CodeGraph 同步通过。
- 严格 runtime/readiness 通过：127 Subjects、118 published、6 restricted、3 retired、932 rules、5 principals、0 failures。
- API/Worker active 且 `NRestarts=0`，Nginx 配置检查通过。
- 全量 27 个普通账号验证一致：管理员有 13 个视频模型，普通账号有 10 个；差集严格等于 3 个 SD 模型，所有非 SD 模型可见。
- 临时为一个账号设置 SD allow 后，该账号恢复访问，而另一个账号保持拒绝；清理临时规则后两者均恢复组 deny 基线。
- ungrouped 与 named group 目录验证均通过：48 models、11 image、10 video、7 RunningHub、2 resources、0 denied node types。
- Retention dry-run/apply 均保护 current/rollback，最终保留 3 个 Release；删除 1 个明确旧 Release 并释放 `308,023,296` bytes。
