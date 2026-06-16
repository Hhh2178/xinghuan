# Provider Files 公网出口切换 - 2026-06-12

## 目标

- 去掉 `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=http://101.33.75.38` 带来的裸 IP 暴露。
- 不打断上游 Provider 对参考图/音频素材的匿名回抓。
- 同时解决灰度和生产共用一个公网素材出口时的环境串流问题。

## 最终采用方案

本次没有新增 `provider-files.hhh2121.xyz` 子域名，而是直接把现有已橙云封口的：

- `https://files.hhh2121.xyz`

升级为 **Provider 文件公网出口域名**。

核心思路：

1. 继续复用 `/api/provider-files/...` 签名读取链路。
2. 在签名 URL 中增加环境作用域：
   - `/api/provider-files/gray/...`
   - `/api/provider-files/production/...`
   - 本地保留 `local`
3. `files.hhh2121.xyz` Nginx 按作用域把请求分别代理到：
   - `127.0.0.1:18200` 灰度
   - `127.0.0.1:18100` 正式
4. 历史灰度裸 IP URL：
   - `http://101.33.75.38/api/provider-files/...`
   不再直接出内容，而是 `302` 跳转到 `files.hhh2121.xyz`

## 为什么不用新增子域名

- 当前没有现成的 Cloudflare 自动化入口可直接安全写入 DNS。
- `files.hhh2121.xyz` 已经完成橙云代理、HTTPS 证书和源站封口，属于现成可控入口。
- 直接复用 `files` 域名可以更快完成从裸 IP 到受控公网出口的切换，同时不引入新的 DNS 发布等待。

因此本次采用的是：

- **现有受控域名 + 路径级专用出口 + 环境作用域分流**

而不是：

- 新增一枚专用子域名

## 代码变更

### `apps/api/src/provider-file-access.ts`

- 新增 `ProviderFileScope`：
  - `local`
  - `gray`
  - `production`
- 签名 URL 生成时可带 scope。
- HMAC 签名加入 scope，避免环境路径被替换后继续复用。
- 解析请求时同时兼容：
  - 旧格式：`/api/provider-files/{userId}/{bucket}/{filename}`
  - 新格式：`/api/provider-files/{scope}/{userId}/{bucket}/{filename}`

### `apps/api/src/external-proxy.ts`

- 生成 Provider 参考素材 URL 时，把当前环境 scope 一并传入签名工具。

### `apps/api/src/server.ts`

- 通过 `environment` 把：
  - `gray`
  - `production`
  - `local`
 传递给外部代理签名逻辑。

## 服务器变更

### 环境变量

已更新：

- `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
- `/opt/apps/xinghuan-canvas/shared/canvas.env`

统一为：

- `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN=https://files.hhh2121.xyz`

### `files.hhh2121.xyz` Nginx

已新增：

- `/api/provider-files/gray/` -> `127.0.0.1:18200`
- `/api/provider-files/production/` -> `127.0.0.1:18100`

并保留历史灰度兼容：

- 旧格式 `/api/provider-files/{userId}/...` 仍由 `files` 域名转发到灰度 `18200`

### 裸 IP 入口

`/etc/nginx/sites-available/hermes-media-relay` 中原来的：

- `http://101.33.75.38/api/provider-files/...`

已改为：

- `302` 跳转到 `https://files.hhh2121.xyz$request_uri`

这意味着裸 IP 不再直接承载文件内容。

## 验收结果

### 直接签名 URL 验证

灰度 scoped URL：

- `https://files.hhh2121.xyz/api/provider-files/gray/...` => `200`

生产 scoped URL：

- `https://files.hhh2121.xyz/api/provider-files/production/...` => `200`

旧裸 IP 灰度 URL：

- `http://101.33.75.38/api/provider-files/...` => `302`
- 跳转目标为 `https://files.hhh2121.xyz/api/provider-files/...`

### 灰度真实脚本验收

`verify-external-image-proxy.mjs`：

- 全部通过
- 证明灰度图像代理生成的新参考素材 URL 已走 `files` 域名签名链路

`verify-external-video-proxy.mjs`：

- 通过
- 覆盖同步视频、APIMart 异步视频、通用异步视频、Agnes 异步视频

### 生产真实脚本验收

`verify-external-image-proxy.mjs`：

- 全部通过
- 证明正式环境图像代理生成的新参考素材 URL 已走 `files` 域名签名链路

### 公网状态

- `https://canvas-next.hhh2121.xyz/api/status` => `environment=gray`
- `https://canvas.hhh2121.xyz/api/status` => `environment=production`

## 当前结论

- 裸 IP 已经不再作为 Provider 文件公网主出口。
- 新生成的灰度/生产参考素材回抓 URL 已统一改走 `files.hhh2121.xyz`。
- 灰度和生产在同一出口域名下已通过 scope 分流，不再共指向 `18200`。
- 旧灰度裸 IP URL 仍有跳转兼容，不会立刻把在途请求打断。

## 后续建议

- 待观察一段时间后，可评估是否彻底下线历史旧格式 `/api/provider-files/{userId}/...` 的灰度兼容路由。
- 若后续具备 DNS 自动化能力，再决定是否把 Provider 回抓出口从 `files.hhh2121.xyz` 再拆成独立子域名。
