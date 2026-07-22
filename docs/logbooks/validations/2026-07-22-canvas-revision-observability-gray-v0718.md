# 画布 Revision 协调与观测基线 Gray v0.7.18 验证

## 自动化与构建

- 定向测试 12/12；全量测试 `69 files / 237 tests` 通过。
- 全 workspace type-check、生产构建、`npm run ci`、Harness、CodeGraph、staged 发布门禁通过。
- Gray runtime verifier：current、App/Worker active、内外状态 `0.7.18 / gray / enforced`，权限 readiness 128/122/3/3/932/5，0 failures。

## 远端 Smoke

- system observability：数据库 `xinghuan_canvas_gray` 与 expected target 匹配；审计 requestId coverage 24h 为 100%。
- revision conflict verifier：初始 revision 1，保存到 2，auto-save 不递增 revision；stale write 返回 409 `CANVAS_REVISION_CONFLICT`，currentRevision 2。
- admin task pagination：分页、failed/status 过滤、image capability 过滤和轻量字段契约通过。
- environment sync：gray -> production preview、provider no-op skip apply 与两条审计记录通过。

## 观测结果

- Gray 当前 24h revision conflict 为 3 次，影响 2 个对象；7d 日均 2.57、critical 阈值 20，健康状态为 warning（`conflicts_observed`）。
- Gray 当前任务 24h 失败 8/12，任务健康为 critical；这是小样本真实失败趋势，不通过删除记录或伪造健康状态处理。

## 双标签浏览器

- 使用一次性 Gray 管理员验证账号访问 `https://canvas-next.hhh2121.xyz`，账号和画布已在验证后删除。
- 标签 A 新增第二个文本节点后，标签 B 自动同步为两个节点。
- 标签 B 输入 `dirty-local-change` 后，标签 A 再次保存；标签 B 本地内容保留，未被远端覆盖。
- 全新浏览器会话控制台 0 errors / 0 warnings；旧会话唯一 401 来自故意尝试无效默认账号，未计入验证结果。

## Production 边界

- 本轮没有执行 Production deploy、restart、migration 或配置写入。
- Production canonical state 保持 `v0.7.17 / 20260721-admin-health-visual-resource-domain-prod-r1-v0717`。

## Retention

- Gray retention dry-run 与 apply 均通过；保留 current、rollback 和第三个最近 release，共 3 个。
- 受控脚本只删除 `/opt/apps/xinghuan-canvas-next/releases/20260721-node-cost-badge-placement-gray-r2-v0717`，未触碰 shared、数据库、备份或用户数据。
