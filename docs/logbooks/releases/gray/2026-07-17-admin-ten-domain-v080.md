# Admin 十域信息架构 Gray v0.8.0 发布

## 发布信息

- release：`20260717-admin-ten-domain-gray-r1-v080`
- source commit：`1c78243c3ce0466af9f60d4281ce8f6bddf504cf`
- 发布包：`dist-release/20260717-admin-ten-domain-gray-r1-v080.tar.gz`
- SHA-256：`ac9ab0d9eb5c5753e2f8ab5fe8b61ad259ff3d04dec436895b856df490a25987`
- 回滚：`20260717-audit-rankings-gray-r2-v072`
- Production：保持 `v0.7.2` / `20260717-audit-rankings-prod-r1-v072`，本批次未触碰。

## 发布内容

- Admin 从五个宽泛工作域重构为十个一级业务域：运营总览、账号与组织、权限与安全、Provider 与模型、RH 管理、ComfyUI 管理、内容与资源、任务与运行、数据分析与审计、系统与发布。
- 二级页面使用稳定 URL，并支持刷新恢复、深链及浏览器前进/后退。
- RH 与 ComfyUI 职责彻底分离；ComfyUI 仅重排既有实例配置、工作流和日志视图，未扩展冻结中的后端能力。
- 数据加载按业务域分流，页面使用动态 import；Admin 主壳生产 chunk 从约 534 kB 降至约 261 kB。
- 补齐路由错误边界、键盘焦点态、100/180/240ms 动效 Token 和 `prefers-reduced-motion` 降级。

## 数据保护

- 本批次为 Admin 前端信息架构、路由和设计体系改造，无数据库 schema 或业务数据写入变更。
- `db:migrate` 结果为 `applied: 0 / skipped: 23`。

## 结果

- Gray API 与 Worker 均为 `active`；内网和公网状态为 `v0.8.0 / gray / enforced`。
- 权限 readiness 为 `ready=true`：127 Subjects、121 published、3 restricted、3 retired、926 rules、5 principals、0 failures。
- 本地 1440×1000 mock-auth 页面验收覆盖十域导航、关键深链及 History 前进/后退；线上现有登录态浏览器控制通道超时，未伪造新的真实登录页面截图证据。

