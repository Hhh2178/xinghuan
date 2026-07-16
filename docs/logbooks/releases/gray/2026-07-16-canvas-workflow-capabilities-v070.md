# v0.7.0 画布工作流能力灰度发布

## 发布信息

- 版本：`v0.7.0`
- 环境：仅 gray
- release：`20260716-canvas-workflow-capabilities-gray-r1-v070`
- source commit：`b6c23aefe48abb3ba1dd4871a49ee4807652c666`
- 发布包：`dist-release/20260716-canvas-workflow-capabilities-gray-r1-v070.tar.gz`
- SHA-256：`4170F0F77C440B39489B9DA0A219A168E32B68CAB92BA7E4ED9C2AFFF292822E`
- 回滚：`20260715-permission-platform-hardening-v0613`
- Production 保持：`v0.6.13 / 20260716-permission-platform-hardening-prod-r1-v0613`

## 发布内容

- 新增受控 Python 代码节点，支持代码执行与预设新增、切换、覆盖、删除。
- 新增无端口标签节点，支持文字、字号、文字色、底色与固定状态。
- 组执行支持 1-99 次循环，单节点失败最多额外重试 3 次。
- 工作流模板改为完整弹层并复用公共工作流资源与缩略图。
- 文本分割接入自动执行并按顺序生成输出文本节点。
- 修复组锁定后节点在 mouseup 时仍提交位置的问题。
- 后台任务监控恢复完整错误日志，并移除重复更新时间列。

## 部署结果

- 灰度发布脚本通过 clean worktree gate，依赖安装成功。
- 数据库迁移：`applied=0 / skipped=22`。
- 灰度 `current` 已切换到本 release；API 与 Worker 均为 `active`。
- 内网与公网 `/api/status` 均为 `0.7.0 / gray / enforced`。
- 权限 readiness：126 subjects、117 published、9 restricted、0 retired、932 rules、4 principals、0 failures。
- 公网登录页加载正常，页面标题为“星幻 - 无限画布”，控制台 0 error / 0 warning。
- 未调用付费生成模型；未修改 production 服务、数据库、路由或 release 指针。

## 已知项

- `npm audit` 报告 1 个 low severity vulnerability，本批次未自动修改依赖。
- 当前自动化浏览器无灰度登录态，登录后的节点交互保留为人工验收项。
