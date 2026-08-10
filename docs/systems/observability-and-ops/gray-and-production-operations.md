# Gray 与 Production 运维

## 当前环境

- gray：`gray.zezhen.xyz`
- production：`zezhen.xyz`
- provider files：`files.zezhen.xyz`

当前发布目标为泽臻新服务器；旧服务器与旧域名仅作为显式回滚来源，不是发布脚本默认目标。

## HTTP 安全基线

- API 跨域来源由 `XINGHUAN_CORS_ALLOWED_ORIGINS` 管理；只允许逗号分隔的完整 HTTPS Origin，禁止配置 `*`。同源请求始终可用，`files.zezhen.xyz` 的跨域素材读取必须显式列出正式和 Gray 页面 Origin。
- Nginx 响应头模板：`ops/nginx/snippets/xinghuan-security-headers.conf.example`。它提供 CSP、HSTS、frame/object 限制、referrer 与权限策略；每次 Nginx 更新后必须执行 `nginx -t` 并以未知 Origin 预检确认返回 `403`。
- API 回归入口：`npm run verify:http-cors`。发布后应同时验证可信 Origin 获得精确的 `Access-Control-Allow-Origin`，未知 Origin 不获得 CORS 响应头且预检被拒绝。

## 当前要求

- 当前运行态判断先看 `ops/README.md`
- 发布后要做 gate 与页面级复查
- gray / production 的版本口径不能长期分叉

## Sealed archive promotion

每个版本先生成一个带 `BUILD-MANIFEST.json` 的 runtime-only archive 和相邻 `.tar.gz.sha256`。Gray 上传 archive 与 sidecar，远端在解包前执行 `sha256sum -c`，随后 `npm ci --omit=dev`、数据库迁移和服务重启；readiness 通过编译 CLI 验证。Production 必须复用 Gray 已验收的同一 archive/SHA，不允许重新构建。

当前本地封装 proof（候选版本 0.8.16）：`dist-release/20260803-sealed-production-artifact-v0816-r1.tar.gz`，185 个 manifest 内容文件、211 个 tar 条目、禁止项 0，sidecar SHA `9916bb3e74c04f092469e5019d3a1e6ea38d3376cedc23a5c2d784160d3dc9a0`。这只是可执行本地证据，不代表已完成 Gray/Production 实际部署。
