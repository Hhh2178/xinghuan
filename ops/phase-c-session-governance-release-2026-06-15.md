# Phase C 第一批会话治理发布记录

日期: `2026-06-15`

## 目标

- 为登录会话补充元数据：
  - `last_seen_at`
  - `ip`
  - `user_agent`
  - `revoked_at`
- 后台增加会话查看与强制下线能力。
- 保证会话撤销后，成员现有登录态立即失效。

## 代码与迁移

- 新增迁移：
  - `apps/api/db/012_session_governance.sql`
- 后端：
  - 登录时记录 `ip` / `userAgent` / `lastSeenAt`
  - 会话改为支持 `revokedAt`，不再只靠删除实现失效
  - `/api/admin/sessions` 提供后台会话列表
  - `/api/admin/sessions/:id/revoke` 提供强制下线
  - 已登录请求会按节流策略刷新 `lastSeenAt`
- 后台：
  - 用户页新增“活跃会话”表
  - 管理员可查看账号、角色、最近活跃、来源 IP、客户端、状态
  - 支持对非当前会话执行“强制下线”
- 验收：
  - 新增 `scripts/verify-admin-session-governance.mjs`
  - 新增 package 入口 `verify:admin-session-governance`

## 灰度发布

- release: `20260615-phase-c-session-governance-gray-r1`
- current:
  - `/opt/apps/xinghuan-canvas-next/releases/20260615-phase-c-session-governance-gray-r1`
- `db:migrate`:
  - `applied = ["012_session_governance.sql"]`
- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 验收：
  - `verify-admin-session-governance = ok`
  - `verify-multi-user-isolation = ok`

## 生产发布

- release: `20260615-phase-c-session-governance-prod-r1`
- current:
  - `/opt/apps/xinghuan-canvas/releases/20260615-phase-c-session-governance-prod-r1`
- `db:migrate`:
  - `applied = ["012_session_governance.sql"]`
- 服务状态：
  - `xinghuan-canvas.service = active`
  - `xinghuan-canvas-worker.service = active`
  - `xinghuan-canvas-output-prune.timer = active`
- 验收：
  - `verify-admin-session-governance = ok`
  - `verify-multi-user-isolation = ok`

## 当前结论

- Phase C 第一批“会话治理”已经上线到灰度与生产。
- 当前已具备：
  - 后台查看活跃会话
  - 强制下线
  - 会话来源与最近活跃追踪
- Phase C 仍未完成：
  - 写操作 CSRF 防护
  - 登录限流与失败计数
  - 更完整的审计来源信息治理
