# v0.7.0 默认开放权限与画布恢复 Gray 验证

## 本地验证

- 专项测试：7 个文件、19 项通过。
- 全量测试：40 个文件、135 项通过。
- 单端口 build、Admin build、全 workspace type-check 通过。
- lint：0 error；201 条既有 warning。
- Project / Workspace / Release Harness 与 CodeGraph 通过。
- 管理员边界、permission hardening、release package、authority 和 staged gate 通过。
- push Hook 在两个提交上均完整执行 CI 并通过。

## Gray 运行态

- release：`/opt/apps/xinghuan-canvas-next/releases/20260716-default-open-canvas-recovery-gray-r2-v070`。
- API/Worker：`active / active`。
- 内网/公网：`0.7.0 / gray / enforced`。
- 数据库：`xinghuan_canvas_gray`。
- readiness：ready，`127 / 123 / 3 / 1 / 942 / 5 / failures=0`。
- 默认关闭迁移二次 dry-run：candidates 0、blocked 0。
- 测试组旧 deny-list 五类均为空，总限制数 0。

## 成员验收

- 真实成员登录和 `/api/canvas` 请求成功。
- PostgreSQL 画布首次恢复后为 4，重复请求仍为 4；备份 hash 继续通过。
- 浏览器实际显示“画布 4”，原画布和 3 个恢复画布节点数为 `1 / 4 / 6 / 1`。
- 节点侧栏显示素材、核心、RH、ComfyUI、工具和辅助节点；控制台 0 error / 0 warning。
- `/api/me/permissions`：node deny 0、无 `*`。
- 公共工作流列表有 1 项，目标工作流可见。
- 成员调用分类新增、工作流新增、资源编辑均返回 `403 / ADMIN_REQUIRED`；本地 HTTP 测试覆盖全部管理路由。

## 换组与 ownership

- 在 Gray 事务内临时把测试账号指向另一组，确认组 ID 已变化。
- 画布、个人资源、任务 ID 集合前后均完全相等；画布集合为 4。
- 事务最终 `ROLLBACK`，测试账号组归属没有持久变化。

## UI 验收

- Provider rail 计算样式为 `sticky / top 120px / height 760px`。
- Admin 主区滚动 1200px 后 rail 为 `top 140 / bottom 900 / viewport 900`，“新增平台”仍在视口内。
- 权限页实际显示 `统一权限生效 / 正常 / 127 / 123 / 942`。
- 默认开放说明和管理员公共资源治理不进入授权目录的文案实际可见。
- 截图证据：`output/playwright/gray-member-canvas.png`、`gray-admin-provider-sticky.png`、`gray-admin-permission-default-open-r2.png`（ignored runtime artifacts，不提交 Git）。

## Production 边界

- 只读确认 Production 仍为 `v0.6.13 / production / enforced`。
- release 仍为 `20260716-permission-platform-hardening-prod-r1-v0613`。
- 本轮未重启、未写入、未切换 Production。

## 结论

Gray 默认开放、管理员硬边界、孤立画布恢复、换组 ownership、节点摘要和服务商 sticky 均通过自动化与真实页面验收。
