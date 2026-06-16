# 生产位准备记录 - 2026-06-07

## 目标

- 对 `canvas.hhh2121.xyz` / `127.0.0.1:18100` 生产位做第一次服务器侧准备。
- 只做安全的目录和模板落地，不启服务、不切域名。

## 服务器检查结果

检查时间：`2026-06-07`

生产位当前状态：

- `/opt/apps/xinghuan-canvas/` 初始不存在。
- `/opt/apps/xinghuan-canvas/current` 不存在。
- `/etc/nginx/sites-available/canvas.hhh2121.xyz` 不存在。
- `/etc/systemd/system/xinghuan-canvas.service` 不存在。
- `/etc/systemd/system/xinghuan-canvas-worker.service` 不存在。
- `/opt/apps/xinghuan-canvas/shared/canvas.env` 不存在。

同时确认灰度运行底座仍正常：

- `xinghuan-canvas-next.service` 为 `active`
- `xinghuan-canvas-next-worker.service` 为 `active`
- `nginx` 为 `active`
- `postgresql` 为 `active`
- `redis-server` 为 `active`

## 本次执行

1. 创建生产目录结构：

```text
/opt/apps/xinghuan-canvas/
/opt/apps/xinghuan-canvas/releases
/opt/apps/xinghuan-canvas/shared/data
/opt/apps/xinghuan-canvas/shared/logs
```

2. 将本地生产环境模板上传到服务器，并落为：

```text
/opt/apps/xinghuan-canvas/shared/canvas.env.example
```

3. 将生产 Nginx 和 systemd 模板安装到服务器：

```text
/etc/nginx/sites-available/canvas.hhh2121.xyz
/etc/systemd/system/xinghuan-canvas.service
/etc/systemd/system/xinghuan-canvas-worker.service
/etc/systemd/system/xinghuan-canvas-output-prune.service
/etc/systemd/system/xinghuan-canvas-output-prune.timer
```

4. 执行 `systemd-analyze verify` 校验生产 unit。

5. 确认真正的生产环境文件仍未创建：

```text
/opt/apps/xinghuan-canvas/shared/canvas.env
```

## 当前状态

- 生产目录骨架已存在。
- 生产 env 示例已存在。
- 生产 Nginx/systemd 模板已安装到服务器，但仍保持 `disabled` / `not enabled`。
- 生产 active env 仍不存在。
- 生产 release 目录仍为空。

## 验证结果

- `/etc/nginx/sites-enabled/canvas.hhh2121.xyz` 仍不存在，说明生产站点未启用。
- `systemctl is-enabled xinghuan-canvas.service` 返回 `disabled`。
- `systemctl is-enabled xinghuan-canvas-worker.service` 返回 `disabled`。
- `systemctl is-enabled xinghuan-canvas-output-prune.timer` 返回 `disabled`。
- `systemd-analyze verify` 未对本次新增的生产 unit 报错。
- 校验时出现一条与本项目无关的历史警告：`tat_agent.service` 仍引用旧的 `/var/run` 路径。

## 下一步

- 填写真实 `canvas.env`。
- 准备生产 release 并在 `18100` 做本机 smoke。
- 视准备情况决定是否启用 production Nginx site 和相关 systemd 单元。

## 继续推进记录

执行时间：`2026-06-07`

### 生产 env 与 release

- 已从灰度环境文件派生生产 active env：

```text
/opt/apps/xinghuan-canvas/shared/canvas.env
```

- 已确认生产 env 关键运行项：

```text
XINGHUAN_APP_ENV=production
XINGHUAN_API_PORT=18100
XINGHUAN_DATA_DIR=/opt/apps/xinghuan-canvas/shared/data
XINGHUAN_WEB_DIST_DIR=/opt/apps/xinghuan-canvas/current/apps/web/dist
XINGHUAN_ADMIN_DIST_DIR=/opt/apps/xinghuan-canvas/current/apps/admin/dist
XINGHUAN_TASK_QUEUE=xinghuan:tasks:prod
XINGHUAN_WORKER_ID=canvas-worker-1
```

- 已创建生产 release：

```text
/opt/apps/xinghuan-canvas/releases/20260606-1604-phase3-prod-prep
```

- 已建立 production `current`：

```text
/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260606-1604-phase3-prod-prep
```

### 18100 本机 smoke

已启动生产 API 和 Worker：

- `xinghuan-canvas.service` 为 `active`
- `xinghuan-canvas-worker.service` 为 `active`
- `127.0.0.1:18100` 已监听
- `/api/status` 返回 `environment=production`

已执行生产端口自动验收：

- `npm run verify:single-port` 通过，覆盖登录、后台、用户隔离、画布保存、上传和 SPA fallback。
- `npm run verify:canvas-resource-api` 通过，当前生产位返回 `canvasCount=0`、`imageResourceCount=0`。
- `npm run verify:task-lifecycle` 通过，原任务进入 `cancelled`，重试任务进入 `running`。
- `npm run verify:worker-output-materials` 通过，返回输出素材 `/files/output/task_output_task-1780733666575-mj87s4_1.png`。
- `npm run cleanup:output-materials:dry-run` 通过，且正确读取生产 shared data：`/opt/apps/xinghuan-canvas/shared/data`。

### systemd 与 Nginx

已将生产 systemd 设为开机启用：

- `xinghuan-canvas.service` 为 `active` / `enabled`
- `xinghuan-canvas-worker.service` 为 `active` / `enabled`
- `xinghuan-canvas-output-prune.timer` 为 `active` / `enabled`

生产 Nginx 站点仍未启用：

```text
/etc/nginx/sites-enabled/canvas.hhh2121.xyz
```

当前返回 `NGINX_PROD_NOT_ENABLED`，说明正式域名仍未切到生产服务。

## 当前下一步

- 启用 `/etc/nginx/sites-enabled/canvas.hhh2121.xyz`。
- 执行 `sudo nginx -t` 与 reload。
- 验证 `https://canvas.hhh2121.xyz/api/status` 与登录/后台/画布 smoke。
