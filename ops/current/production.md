# 当前 Production 运行态

- 入口域名：`canvas.hhh2121.xyz`
- 服务端口：`127.0.0.1:18100`
- 当前版本：`v0.4.12`
- 当前 release：`20260623-runninghub-poll-resume-prod-r1-v0412`
- 当前发布索引：`../../docs/logbooks/releases/current-release-index.md`
- 当前运行材料：
  - `../production-deploy-runbook.md`
  - `../production-acceptance-checklist.md`
  - `../../docs/logbooks/releases/production/2026-06-23-runninghub-poll-resume-production.md`

## 当前数据库实态

- 当前 production `canvas.env` 仍指向数据库：`xinghuan_canvas_next`
- `XINGHUAN_EXPECTED_DATABASE_NAME` 当前也为：`xinghuan_canvas_next`
- 这代表生产运行位当前仍与历史共享库口径一致，尚未切到独立命名的 production 库

## 当前 systemd / nginx 模板

- `../systemd/xinghuan-canvas.service.example`
- `../systemd/xinghuan-canvas-worker.service.example`
- `../systemd/xinghuan-canvas-output-prune.service.example`
- `../systemd/xinghuan-canvas-output-prune.timer.example`
- `../nginx/canvas.hhh2121.xyz.conf.example`
