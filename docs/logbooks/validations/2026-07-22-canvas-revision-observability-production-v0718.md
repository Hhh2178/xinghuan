# 画布 Revision 协调与观测基线 Production v0.7.18 验证

## 发布前与运行态

- Gray 已验收制品复用；Production worktree clean、deploy dry-run 和数据库备份通过。
- current：`/opt/apps/xinghuan-canvas/releases/20260722-canvas-revision-observability-prod-r1-v0718`。
- API / Worker / output-prune timer：`active / active / active`。
- 内网与公网状态：`0.7.18 / production / enforced`。
- 权限 readiness：142 subjects、121 published、13 restricted、8 retired、2820 rules、11 principals、0 failures；数据库 `xinghuan_canvas_next` 匹配。
- Nginx 配置检查通过；首页、公网首页和 `/api/status` 正常；响应保留 `x-request-id`。
- 最终启动后的 Production API error journal 为空。

## 观测与功能 Smoke

- request-chain observability 通过，审计动作链完整。
- system observability 通过：任务 24h 失败 78/459，失败率 16.99%，状态 warning；revision conflict 57 次、影响 19 个对象，按 7d 日均 37.71 与 critical 阈值 75.42 评估为 warning。
- revision conflict verifier 通过：初始 revision 1，保存到 2，auto-save 不递增 revision；stale write 返回 409 `CANVAS_REVISION_CONFLICT`，currentRevision 2。

## 异常与恢复

- 首次切换因 `RETIRED_SUBJECT_RULE` 启动门禁失败，未将该状态标记为成功。
- 通过受控权限 reconciliation 修复数据库漂移后，Production API/Worker 已恢复并重新切换 v0.7.18；最终严格 runtime verifier 全部通过。

## Production 边界

- 未修改 Production env 中的密钥、连接串、数据库目标或队列 namespace。
- Gray 当前 release 未变；本轮 Production 复用 Gray 已验收版本。

## Retention

- Production retention dry-run 与 apply 均通过；保留 current、rollback 和第三个最近 release，共 3 个。
- 受控脚本只清理 `/opt/apps/xinghuan-canvas/releases/` 下 5 个旧 release，未触碰 shared、数据库、备份或用户数据。
