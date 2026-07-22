# 画布 Revision 协调与观测基线 Production v0.7.18

- release：`20260722-canvas-revision-observability-prod-r1-v0718`
- source artifact：Gray 已验收 `20260722-canvas-revision-observability-gray-r1-v0718.tar.gz`
- source commit：`5fd2b5d`
- 部署时间：`2026-07-22`
- 回滚：`20260721-admin-health-visual-resource-domain-prod-r1-v0717`

## 晋级内容

- 复用 Gray 已验收的 Web Locks + BroadcastChannel 画布保存协调。
- 干净标签自动同步远端 revision，有本地改动的标签在写入前暂停，服务端 optimistic lock 保留。
- revision conflict 健康改为 7d/30d 基线、倍率阈值和影响对象数评估。

## 数据与启动修复

- 切换前备份：`20260722-before-canvas-revision-observability-v0718-r1.dump`，75,520,511 bytes。
- 首次 Production 启动发现 2 条 retired subject rule 引用，服务门禁报 `PERMISSION_RUNTIME_NOT_READY:RETIRED_SUBJECT_RULE`。
- 已停止重启循环，执行 Production `permissions:reconcile --missing-policy=unresolved --apply`；事务计划 13 subject updates / 44 rule upserts / 44 rule deletes，unresolved 0，二次计划幂等。
- Production 数据库仍为 `xinghuan_canvas_next`，与预期目标一致。

## 发布边界

- Production 仅使用 `/opt/apps/xinghuan-canvas/` 与 `canvas.env`，未触碰 Gray 目录、数据库和队列。
- 依赖安装仍报告既有 1 low / 2 high 审计项，本轮不执行无审查自动升级。
