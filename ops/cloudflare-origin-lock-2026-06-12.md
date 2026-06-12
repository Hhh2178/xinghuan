# Cloudflare 源站封口验收 - 2026-06-12

## 目标

- 在用户已将主要 Web 域名切到 Cloudflare 橙云后，补齐画布站点的源站封口。
- 确保 `canvas.hhh2121.xyz`、`canvas-next.hhh2121.xyz` 不再允许通过已知源站 IP 直接绕过 Cloudflare 访问。
- 复核 `hermes.hhh2121.xyz` 的现有封口仍正常。
- 评估 `files.hhh2121.xyz` 是否可以一并封口，以及封口后的实际影响。

## 补充状态更新

本记录初版完成时，`files.hhh2121.xyz` 仍处于灰云直连状态，因此当时没有直接保留封口。

在后续执行中，用户已将 `files.hhh2121.xyz` 切换为 Cloudflare 橙云，随后已完成该站点的源站封口和复验：

- 公网访问：
  - `https://files.hhh2121.xyz/images/smoke.txt` => `200`
  - `https://files.hhh2121.xyz/healthz` => `200`
  - 响应头显示 `Server: cloudflare`
- 源站直打：
  - `--resolve files.hhh2121.xyz:443:101.33.75.38 https://files.hhh2121.xyz/images/smoke.txt` => `403`
  - `--resolve files.hhh2121.xyz:443:101.33.75.38 https://files.hhh2121.xyz/healthz` => `200`

说明：

- `files.hhh2121.xyz` 的真实静态文件路径已经完成 Cloudflare 源站封口。
- `/healthz` 仍保留简单健康检查返回 `200`，这是单独 `location` 的预期行为，不代表静态文件仍可被绕过。
- 从服务器本机视角，短时间内可能还会因为本地 DNS/递归缓存尚未刷新，访问 `https://files.hhh2121.xyz/...` 时命中旧源站解析并得到 `403`；这不代表公网链路异常，只是本机缓存未完全收敛。

## 现网核查结论

- `hermes.hhh2121.xyz`
  - 既有 Nginx vhost 已包含 `/etc/nginx/snippets/cloudflare-only.conf`。
  - 直打 `101.33.75.38` 并带 `Host: hermes.hhh2121.xyz` 时返回 `403`。
  - 通过公网域名访问时，未登录会正确跳转到 Cloudflare Access。
- `canvas.hhh2121.xyz`
  - 原先未做 Cloudflare 源站白名单。
  - 改造前直打源站 HTTPS 可返回站点页面，存在绕过风险。
- `canvas-next.hhh2121.xyz`
  - 原先未做 Cloudflare 源站白名单。
  - 改造前直打源站 HTTP/HTTPS 均可返回站点内容，存在绕过风险。
- `files.hhh2121.xyz`
  - 与画布主站不同，是独立静态文件站。
  - 初始核查时该域名仍是灰云直连，因此不能直接套用 Cloudflare 源站白名单。
  - 在用户切为橙云后，已完成同样的源站封口，最新状态见本文件“补充状态更新”。

## 实施内容

已在服务器上为以下 vhost 增加 Cloudflare 源站白名单：

- `/etc/nginx/sites-available/canvas.hhh2121.xyz`
- `/etc/nginx/sites-available/canvas-next.hhh2121.xyz`

采用方式：

- 在 HTTP 与 HTTPS 对应 server block 中都加入：
  - `include /etc/nginx/snippets/cloudflare-only.conf;`
- 不改动现有 `proxy_pass`、超时、Header 转发和应用入口逻辑。

执行过程：

- 对目标 vhost 先创建带时间戳的备份副本。
- 修改后执行：
  - `sudo nginx -t`
  - `sudo systemctl reload nginx`

## 为什么初版没有保留 files 站点的封口

初版曾给 `files.hhh2121.xyz` 加入同样的源站白名单，但随即复验发现：

- 服务器侧解析 `files.hhh2121.xyz -> 101.33.75.38`
- 公网真实静态文件 `https://files.hhh2121.xyz/images/smoke.txt` 会落到源站直连路径
- 在该前提下，白名单会让静态文件访问直接变成 `403`

因此为了避免误伤当时的文件服务，初版执行中先回退了 `files.hhh2121.xyz` 的白名单改动。

初版阶段结论：

- `files.hhh2121.xyz` 当时暂不适合仅靠 Nginx 侧强封
- 若后续要彻底封口，前提是先把 `files.hhh2121.xyz` 真正切到 Cloudflare 橙云，或拆到独立可控入口

## 验收结果

### 公网链路

- `GET https://canvas.hhh2121.xyz` => `200`，`Server: cloudflare`
- `GET https://canvas-next.hhh2121.xyz` => `200`，`Server: cloudflare`
- `GET https://canvas.hhh2121.xyz/api/status` => `200`，`environment=production`
- `GET https://canvas-next.hhh2121.xyz/api/status` => `200`，`environment=gray`
- `GET https://hermes.hhh2121.xyz` => `302` 跳转到 Cloudflare Access

### 源站直打

- `--resolve canvas.hhh2121.xyz:443:101.33.75.38` => `403`
- `--resolve canvas-next.hhh2121.xyz:443:101.33.75.38` => `403`
- `--resolve hermes.hhh2121.xyz:443:101.33.75.38` => `403`

说明：

- 生产画布、灰度画布、Hermes 三个主要 Web 入口都已完成源站封口。

### 文件站现状

初版执行完成时：

- `https://files.hhh2121.xyz/images/smoke.txt` 可正常返回静态文件
- `--resolve files.hhh2121.xyz:443:101.33.75.38 https://files.hhh2121.xyz/images/smoke.txt` 也能直接访问

补充更新后：

- `https://files.hhh2121.xyz/images/smoke.txt` => `200`
- `--resolve files.hhh2121.xyz:443:101.33.75.38 https://files.hhh2121.xyz/images/smoke.txt` => `403`

说明：

- `files.hhh2121.xyz` 现在已经完成封口。
- 需要注意服务器本机短时 DNS 缓存带来的假性 `403` 现象，公网访问本身已正常。

### Provider 文件中转链路

- 默认直连 IP 的 `/api/provider-files/...` 入口未纳入本轮白名单封锁。
- 直打 `http://101.33.75.38/api/provider-files/test/input/test.png` 仍返回应用层 `403` JSON，而不是 Nginx 白名单拦截。

说明：

- 本轮 `canvas` / `canvas-next` 封口没有误伤当前依赖 `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=http://101.33.75.38` 的上游素材回抓设计。

## 最终结论

- 已完成封口：
  - `canvas.hhh2121.xyz`
  - `canvas-next.hhh2121.xyz`
  - `hermes.hhh2121.xyz`
  - `files.hhh2121.xyz`

## 后续建议

- 当前后续重点不再是“是否给 `files` 封口”，而是：
  - 持续确认本机/服务器解析缓存收敛后不再误判
  - 后续将 Provider 回抓素材链路逐步从裸 IP 迁出，避免长期保留 `http://101.33.75.38/api/provider-files/...` 作为上游回抓出口
