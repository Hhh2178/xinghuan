# 生产验收清单

目标域名：`canvas.hhh2121.xyz`

目标端口：`127.0.0.1:18100`

## 服务层

- `systemctl status xinghuan-canvas` 为 `active`。
- `systemctl status xinghuan-canvas-worker` 为 `active`。
- `systemctl status xinghuan-canvas-output-prune.timer` 为 `active`。
- `curl -fsS http://127.0.0.1:18100/api/status` 返回 `xinghuan-api`。
- `curl -fsS http://127.0.0.1:18100/` 返回 Web HTML。
- `sudo nginx -t` 通过。
- Nginx reload 后无 `502`。

## 域名层

- `https://canvas.hhh2121.xyz/` 可打开星幻画板。
- `https://canvas.hhh2121.xyz/api/status` 返回 `xinghuan-api`。
- 浏览器网络请求不出现 `18200`、`18300`、`18310`、`18766`。

## 功能层

- 管理员可登录生产站点。
- `/admin` 可打开并进入总览页。
- 已启用的 GRSAI Provider/模型在后台可见。
- 创建画布成功。
- 保存 1 个文本节点成功。
- 刷新后仍能读取该画布和节点。
- 上传素材成功。
- 上传后的 `/files/input/*` 可访问。
- 发起 1 个最小图像任务成功，任务可进入 `running` 或 `succeeded`。
- 若任务成功，输出素材可在资源库看到。
- 任意前端路由刷新不 `404`。

## 视觉层

- 首屏显示 `星幻无限画布`。
- 默认画板为科技黑视觉。
- 左侧节点面板、顶部工具条、中心画布不散乱。
- ReactFlow 画布可见。
- `/admin` 总览页布局正常，无明显按钮错位或溢出。

## 运行边界

- 生产环境文件不指向灰度 `canvas-next.env`。
- 生产数据目录不复用灰度 `shared/data`。
- 生产日志目录不复用灰度 `shared/logs`。
- 生产 Redis 队列不复用灰度 `xinghuan:tasks`。
- `XINGHUAN_EXPECTED_DATABASE_NAME` 已设置为正式数据库名。
- `psql "$XINGHUAN_DATABASE_URL" -Atc "select current_database();"` 返回值与 `XINGHUAN_EXPECTED_DATABASE_NAME` 一致。
- RunningHub 真实工作流能力本轮不作为生产切换前必验项。

## 回滚验收

- `current` 可指回上一 release。
- 服务重启后 `/api/status` 和 `/` 恢复。
- 域名回切或服务回滚后无持续 `502`。
