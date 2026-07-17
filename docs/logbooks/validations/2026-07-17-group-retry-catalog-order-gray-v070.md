# v0.7.0 组重试与目录排序 Gray 验证

- Push Hook：41 个测试文件、143 项测试、全 workspace type-check 和完整构建通过。
- 专项：Provider/模型排序 13 项；组重试覆盖 0、默认 3、上限 10。
- 发布包 SHA-256 与服务器归档一致，`023` 迁移存在且只应用一次。
- 数据完整性：12 组关键关系旧记录 `missing=0`；16 条 retired Subject 规则为唯一受控删除。
- API/Worker active，内外网状态、enforced readiness 和数据库目标通过。
- 可逆排序验收：12 Provider、2 模型分组、公共目录顺序通过；成员接口返回 403；原顺序已恢复。
- Playwright：登录页完整，关键请求 200，控制台 0 error / 0 warning，加载约 1.93s。

