# 生产切换预检 - 2026-06-06

## 目的

- 为后续 `canvas.hhh2121.xyz` -> `127.0.0.1:18100` 正式切换准备最小可执行预检清单。
- 当前只做准备，不直接切生产。

## 当前基线

- 灰度当前 release：`20260607-0218-phase3-runninghub-workflow-gray`
- 灰度域名：`https://canvas-next.hhh2121.xyz`
- 生产预留域名：`https://canvas.hhh2121.xyz`
- 灰度端口：`127.0.0.1:18200`
- 生产预留端口：`127.0.0.1:18100`
- 灰度管理员 bootstrap 凭据：已与服务器环境重新对齐，并验证服务器本地登录成功。
- `2026-06-07` 最新复验结果：本机与灰度 `npm run verify:single-port` 均已通过，历史 `POST /api/admin/providers` `401` 未再复现。
- RunningHub 目录链路已通过 contract/API 验收，但按用户要求暂缓真实工作流卡片录入、字段展开和预览运行测试。

## 上线前必须再次确认

- 灰度 `npm run verify:single-port` 通过。
- 灰度 `npm run verify:canvas-resource-api` 通过。
- 灰度 `npm run verify:task-lifecycle` 通过。
- 灰度 `npm run verify:worker-output-materials` 通过。
- 灰度 `npm run cleanup:output-materials:dry-run` 通过。
- 灰度 `npm run verify:grsai-draw-gray` 通过。
- 灰度 `npm run verify:worker` 通过。
- 灰度 `npm run verify:runninghub-workflow-contract` 与 `npm run verify:runninghub-workflow-api` 通过；仅证明目录链路可用，不代表真实工作流已验收。
- 灰度输出素材节点单图/单视频预览修复已验收，不再出现历史固定高度导致的大块空白面板。
- `xinghuan-canvas-next.service` 为 `active`。
- `xinghuan-canvas-next-worker.service` 为 `active`。
- PostgreSQL、Redis、Nginx 均为 `active`。
- `canvas.hhh2121.xyz` DNS 已指向 `101.33.75.38`。
- 生产 Nginx 站点模板已安装到 `/etc/nginx/sites-available/canvas.hhh2121.xyz`，但尚未启用。
- 生产 systemd 模板已安装到 `/etc/systemd/system/`，但相关 unit 仍为 `disabled`。
- 生产模板文件已补齐：
  - `config/canvas-production.env.example`
  - `ops/production-prep-2026-06-07.md`
  - `ops/production-deploy-runbook.md`
  - `ops/production-acceptance-checklist.md`
  - `ops/nginx/canvas.hhh2121.xyz.conf.example`
  - `ops/systemd/xinghuan-canvas*.example`
- 服务器侧已创建 `/opt/apps/xinghuan-canvas/releases`、`shared/data`、`shared/logs`，并落下 `shared/canvas.env.example`；active env 和 production current 仍不存在。
- 生产 active env 已创建：`/opt/apps/xinghuan-canvas/shared/canvas.env`。
- 生产 release 已创建并设为 current：`20260606-1604-phase3-prod-prep`。
- `127.0.0.1:18100` 本机 smoke 已通过：`verify:single-port`、`verify:canvas-resource-api`、`verify:task-lifecycle`、`verify:worker-output-materials`、`cleanup:output-materials:dry-run`。
- `xinghuan-canvas.service`、`xinghuan-canvas-worker.service`、`xinghuan-canvas-output-prune.timer` 已为 `active` / `enabled`。
- production Nginx site 已启用，`canvas.hhh2121.xyz` 已通过 certbot 签发 HTTPS 证书。
- `https://canvas.hhh2121.xyz` 公网 smoke 已通过：`verify:single-port`、`verify:canvas-resource-api`、`verify:task-lifecycle`、`verify:worker-output-materials`、`cleanup:output-materials:dry-run`。
- 已确认 GRSAI Provider/模型在生产后台中存在且启用。
- 已确认管理员已知晓 bootstrap 密码后续要轮换。

## 建议发布动作

1. 以灰度当前 release 为基准创建生产 release。
2. 在生产 release 上执行 `npm ci` 和 `npm run build:single-port`。
3. 将生产 `current` 指向新 release。
4. 启动生产 API/Worker 服务，监听 `127.0.0.1:18100`。
5. 先验证本机 `curl http://127.0.0.1:18100/api/status`。
6. 再切 Nginx/域名到 `canvas.hhh2121.xyz`。
7. 发布后立即执行生产版同步/异步 GRSAI、登录、画布、后台最小 smoke。

## 当前不建议直接生产切换的原因

- 生产 `127.0.0.1:18100` 独立环境文件、systemd 单元、日志路径和数据路径仍需按正式环境再核对，不能只复用灰度配置。
- 生产本机服务和公网 HTTPS smoke 均已通过；后续重点转为发布后观察、密码轮换和独立数据库策略评估。
- 生产域名切换前还需要基于当前灰度 release 再做一轮最小 smoke，确认登录、后台、画布、任务和素材链路在生产位可复现。
- RunningHub 真实工作流卡片、字段展开和预览运行验收已按用户要求暂缓，因此当前不能把 RH 真实工作流能力视为生产切换前已验收能力。
- bootstrap 密码和密钥轮换流程还未进入正式运维形态。
- 更完整的厂商专用适配、生产级审计和密钥治理仍在后续阶段。
