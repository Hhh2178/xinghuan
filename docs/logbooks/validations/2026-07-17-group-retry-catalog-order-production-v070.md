# v0.7.0 组重试与目录排序 Production 验证

- 使用与 Gray 完全相同的归档和 SHA-256。
- 发布前全库备份和 12 组关键关系清单通过；发布后所有旧业务关系 `missing=0`。
- 受控差异：备份后清理 16 条 retired Subject 规则；启动自动新增 2 个权限 Subject。
- 迁移：仅应用 `023`；Provider/模型 `sort_order` 无 null。
- 运行态：API、Worker、output prune timer、Nginx、内外网状态均通过。
- 权限：enforced readiness failures=0；普通成员调用管理员排序接口为 403。
- 排序：12 Provider、56 模型中 10 模型分组完成换序、公共目录核对和原顺序恢复。
- 观测：request-id 覆盖率 100%，发布后 API/Worker error 级日志无条目。
- Playwright：发布前后页面结构一致，控制台均为 0 error / 0 warning；1.64s -> 1.20s。

