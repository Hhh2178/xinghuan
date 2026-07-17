# v0.7.1 权限、归属与文本拆分 Gray 验证

## 本地门禁

- `npm run ci`：43 个测试文件、158 项测试通过；所有 workspace type-check 与构建通过。
- `npm run lint`：0 errors；201 条既有 warnings。
- `harness:verify:release`、`harness:verify:workspace` 与 CodeGraph sync 通过。
- 发布审查覆盖率复核为 88%，最终 RunningHub owner 快照阻断项已修复并有契约测试。

## 运行时

- release symlink：`/opt/apps/xinghuan-canvas-next/releases/20260717-permission-owner-textsplit-gray-r2-v071`。
- API / Worker：均为 `active`。
- 内网与公网状态：`0.7.1 / gray / enforced`。
- 权限 readiness：`ready=true`，127 Subjects、926 Rules、0 failures。
- 数据库目标：`xinghuan_canvas_gray`。

## 数据完整性与业务验收

- 发布前后用户哈希：`d31afeeff38b4f5af46c870858e12eb5`。
- 发布前后画布哈希：`f71f33cea99ceef04cf6ca33d67343f3`。
- 发布前后素材哈希：`d3def611a7f24720d55c3a727d64b234`。
- 临时用户组创建、默认策略保存、用户组删除均成功，随后关键业务哈希不变。
- 管理任务分页与过滤通过；验证器修正为保留完整 `logs`、排除重型 `payload/result`。
- 环境同步 preview 与 skip no-op apply 通过；普通分组/未分组成员目录验证通过。
- 可选账号权限覆盖场景因 Gray 没有满足前置条件的安全模型 Subject 而未执行规则写入，不作为阻断项。

## 审计用量统计

- 真实 Gray 近 30 天：199 次 succeeded 生成。
- 分组统计 4 行、账号统计 6 行、模型统计 16 行、RunningHub 统计 7 行。
- 实际账号下钻返回模型明细 14 行、RunningHub 明细 5 行，账号归属与统计一致。
- 统计口径仅包含 `succeeded` 任务，支持 today / 7d / 30d、分组、能力、Provider 与账号筛选。

## 页面验收

- Playwright 打开 `https://canvas-next.hhh2121.xyz/` 成功。
- 页面标题为“星幻 - 无限画布”，登录主视觉、邮箱、密码与登录按钮均可见。
- 控制台：0 errors、0 warnings。
- 截图：`output/playwright/gray-v071-r2-home.png`（本地 ignored 运行证据，不入 Git）。
