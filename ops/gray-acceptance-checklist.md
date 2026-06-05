# 灰度验收清单

目标域名：`canvas-next.hhh2121.xyz`

目标端口：`127.0.0.1:18200`

## 服务层

- `systemctl status xinghuan-canvas-next` 为 active。
- `curl -fsS http://127.0.0.1:18200/api/status` 返回 `xinghuan-api`。
- `curl -fsS http://127.0.0.1:18200/` 返回 Web HTML。
- `sudo nginx -t` 通过。
- Nginx reload 后无 502。

## 域名层

- `https://canvas-next.hhh2121.xyz/` 可打开星幻画板。
- `https://canvas-next.hhh2121.xyz/api/status` 返回 `xinghuan-api`。
- 浏览器网络请求不出现 `18300`、`18310`、`18766`。

## 功能层

- 创建画布成功。
- 保存 1 个文本节点成功。
- 刷新后仍能读取该画布和节点。
- 上传素材成功。
- 上传后的 `/files/input/*` 可访问。
- 任意前端路由刷新不 404。

## 视觉层

- 首屏显示 `星幻无限画布`。
- 默认画板为科技黑视觉。
- 左侧节点面板、顶部工具条、中心画布不散乱。
- ReactFlow 画布可见。
- RH 节点分组若出现，暂不作为本阶段阻塞项。

## 安全与边界

- 不打印真实密钥。
- 不提交服务器环境文件。
- 不修改内部代理项目服务。
- 不切生产域名。
- 不批量删除服务器文件或目录。

## 回滚验收

- `current` 可指回上一 release。
- 服务重启后 `/api/status` 和 `/` 恢复。
- Nginx 配置不需要更换 upstream。
