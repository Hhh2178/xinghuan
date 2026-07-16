# v0.7.0 文本分割输出隔离灰度发布

## 发布信息

- 版本：`v0.7.0`
- 环境：仅 gray
- release：`20260716-canvas-text-split-output-gray-r2-v070`
- source commit：`4ecb470d5fea35bb5c374ba3638c30525d2d1702`
- 发布包：`dist-release/20260716-canvas-text-split-output-gray-r2-v070.tar.gz`
- SHA-256：`c11dac0f82a4713b8c308f544dd29ff3a00d7f1c997a16612fe112663889cbc8`
- 回滚：`20260716-canvas-workflow-capabilities-gray-r1-v070`
- Production 保持：`v0.6.13 / 20260716-permission-platform-hardening-prod-r1-v0613`

## 发布内容

- TextSplit 自动生成的 OutputNode 增加上游素材隔离标记。
- 输出节点保留从 TextSplit 到各分段输出的画布连线，但只显示自身 `directOutputText`。
- 普通 OutputNode 继续按原行为收集上游素材，不受本次修复影响。

## 部署结果

- 灰度 `current` 已切换到本 release，API 与 Worker 均为 `active`。
- 数据库迁移 `applied=0 / skipped=22`。
- 内网和公网 `/api/status` 均为 `0.7.0 / gray / enforced`。
- 权限 readiness 为 ready，`126 / 118 / 7 / 1 / 940 / 4`，failures 为空。
- GitHub 连接在发布时不可达，本地分支暂时领先远端 1 个提交；不影响固定 commit 的 Gray 发布包和运行态，恢复连接后补推。
- 未修改 production 服务、数据库、路由或 release 指针。

## 已知项

- 需要使用真实灰度账号重跑文本分割，确认每个输出素材框只显示对应分段。
- `npm audit` 仍报告 1 个 low severity vulnerability，本批次未自动改依赖。
