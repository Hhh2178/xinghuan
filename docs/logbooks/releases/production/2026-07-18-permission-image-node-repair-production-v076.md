# Permission and Image Node Repair Production v0.7.6 发布

## 发布信息

- release：`20260718-permission-image-node-repair-prod-r1-v076`
- 来源 Gray：`20260718-permission-image-node-repair-gray-r1-v076`
- source commit：`c9eaf5a4be2127463721e2343264db624917ce00`
- 与 Gray 共用制品：`dist-release/20260718-permission-image-node-repair-gray-r1-v076.tar.gz`
- 制品大小：`1,850,600` bytes
- SHA-256：`f98dc5fb45f3c68038c2653f2d026d9675fc081fd2bbc3ecc83a1047e3d4cd36`
- 回滚：`20260718-generation-artifact-stream-abort-prod-r1-v075`

## 数据保护与切换

- Production 数据库、数据目录和队列分别为 `xinghuan_canvas_next`、`/opt/apps/xinghuan-canvas/shared/data`、`xinghuan:tasks:prod`，均未复用 Gray。
- 切换前 custom dump：`/opt/apps/xinghuan-canvas/shared/backups/20260718-before-permission-image-node-repair-v076-r1.dump`。
- 备份大小 `31,051,093` bytes，SHA-256 `af1cc67e688635e3c6d756bd84d3acb94392321169621678615c6781d39fd064`，`pg_restore --list` 返回 141 条有效条目。
- `db:migrate` 跳过 24 个已应用迁移，没有重复执行迁移。

## 结果

- Production 已切换到本 release；API、Worker、output prune timer active，Nginx 配置通过，内外网状态均为 `v0.7.6 / production / enforced`。
- 严格 permission readiness 为 ready：134 Subjects、112 published、14 restricted、8 retired、452 rules、11 principals、0 failures。
- 真实认证图片链路通过：上传 PNG、`POST /api/image/resize`、下载输出 PNG 均返回 200，两个测试 Artifact 已通过正式生命周期 API 清理。
- request-chain 与 system-observability 门禁通过；近 24 小时 requestId 覆盖率 100%。
- 部署后 3 轮公网/内网 status 与首页 canary 零错误，API/Worker `NRestarts=0`。
- Worker 切换时旧进程优雅退出超过 systemd 时限，被 systemd 终止一次；新进程随后稳定 active，`NRestarts=0`，功能与 runtime gate 均通过。
- Production retention 通过受保护脚本保留当前 `v0.7.6`、回滚 `v0.7.5` 和事故证据 `v0.7.4`，移除旧 `v0.7.3` Release，释放 `307,826,688` bytes；`shared/`、备份和用户材料未触碰。
