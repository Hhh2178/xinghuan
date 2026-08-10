# 会话与 CSRF

## 当前稳定规则

- 登录、登出、后台写操作、画布写入等危险请求都受同源校验保护
- 会话支持查看、撤销与活跃态治理
- 登录限流已经纳入正式治理
- API 不使用通配符 credentialed CORS。带 `Origin` 的跨域请求仅允许环境变量 `XINGHUAN_CORS_ALLOWED_ORIGINS` 列出的精确 Origin；同源请求保持可用，未知来源不返回 CORS 响应头。
- 未受信任 Origin 的 CORS 预检必须返回 `403 CORS_ORIGIN_NOT_ALLOWED`，不能降级为浏览器可读取的跨域错误响应。

## 高风险点

- 本地验证脚本写请求必须带 same-origin `Origin`
- 会话撤销后旧 cookie 不能继续通过 `/api/auth/me`
- 调整环境域名或新增前端子域时，必须先显式加入对应环境的 CORS allowlist，并运行 `npm run verify:http-cors`；不得恢复 `*` 与 `credentials` 的组合。
