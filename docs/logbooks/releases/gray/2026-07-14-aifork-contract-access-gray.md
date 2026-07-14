# 2026-07-14 AIFork Contract And Access Gray Release

## 发布信息

- 环境：`gray`
- 版本：`v0.6.1`
- 当前 release：`20260714-aifork-contract-access-gray-r2-v061`
- 前置 release：`20260714-aifork-contract-access-gray-r1-v061`
- 发布分支：`xinghuan-integration-clean`
- 关键提交：
  - `33e1e7b` - AIFork 视频契约、专用轮询、后台会话失效处理与实际权限展示
  - `8d537af` - 持久化虚拟 `ungrouped` 权限策略

## 已验证

- 本地 `release:gray:prepare` 两次均通过：构建、版本对齐、热点治理、AIFork 契约、后台会话契约和未分组权限契约均通过。
- `r1` 部署后内网与公网 `/api/status` 均返回 `v0.6.1` / `gray`，API 与 Worker 均为 `active`。
- `r2` 部署实际应用 `020_ungrouped_permission_policy.sql`，并再次通过同一运行态验证。
- 灰度 AIFork provider 已新增并启用 `sd2-720p-fast`：
  - 请求契约写入 `duration`、`metadata.modeType`、`metadata.ratio`、`metadata.enableSound=on`、`images` 和可选 `audios`。
  - 结果路径优先 `result_url`，再回退 `data.metadata.url` 和历史 `data.output`。
- 灰度权限数据已写入唯一的 `ungrouped` 空 deny 策略：
  - 16 个未分组成员命中该允许策略。
  - `AI组` 和 `杨旭组` 没有策略，仍按默认拒绝。
  - 在实际灰度编译模块中验证：未分组成员可通过 RH 应用与工作流过滤，命名组无策略成员被过滤。
  - 已启用 RH 目录当前包含 7 个应用和 1 个工作流。

## 待浏览器验收

- 用灰度画布已登录账号提交 `sd2-720p-fast`，选择一张图片、15 秒、`9:16`。
- 确认上游请求包含 `duration=15`、`metadata.ratio=9:16`、`metadata.enableSound=on`。
- 确认任务回写为 succeeded、视频出现在画布节点，并检查时长、纵横比和音轨。
- 用一个未分组成员登录灰度，确认可见 7 个 RH 应用和 1 个工作流；用无策略命名组成员确认目录为空。

## 回滚

- 灰度回滚锚点：`/opt/apps/xinghuan-canvas-next/releases/20260714-aifork-contract-access-gray-r1-v061`
- 如需回滚，切换 `current` 软链接并重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 注意：`020_ungrouped_permission_policy.sql` 仅删除错误外键；代码回滚不自动删除灰度 `ungrouped` 策略数据。
