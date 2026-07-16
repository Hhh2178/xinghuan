# Auth 与 Users 系统

## 这个系统负责什么

Auth 与 Users 系统负责登录、会话、多用户隔离、ownership、revision 保护、CSRF 和后台用户治理。

## 关键代码入口

- `apps/api/src/server.ts`
- 认证与后台用户相关接口

## 建议阅读顺序

1. `session-and-csrf.md`
2. `revision-and-ownership-guard.md`
3. `permissions-and-administrator-boundary.md`

## 相关系统

- `../api/`
- `../admin/`
