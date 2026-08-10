# v0.8.29 新服务器 HTTP 安全加固验证

- Gray and Production API/Worker services are active and return `v0.8.29 / enforced`.
- Trusted `zezhen.xyz` and `gray.zezhen.xyz` Origins receive exact CORS headers; `untrusted.example` preflight returns `403 CORS_ORIGIN_NOT_ALLOWED` without a CORS allow-origin header.
- `files.zezhen.xyz` retains trusted cross-subdomain access and withholds CORS headers from unknown Origins.
- Public responses include CSP, HSTS, frame/object restrictions, referrer and permissions policies, cross-origin policies, and `X-Robots-Tag: noindex, nofollow, noarchive`.
- Nginx syntax check passed after TLS global baseline was set to TLS 1.2/1.3. `npm audit --omit=dev` reports zero vulnerabilities.
