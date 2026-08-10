# 泽臻 `.xyz` 域名路由验证

- `https://zezhen.xyz/api/status` returned `0.8.28 / production / enforced` with a trusted certificate.
- `https://www.zezhen.xyz/api/status` returned `0.8.28 / production / enforced` with a trusted certificate.
- `https://gray.zezhen.xyz/api/status` returned `0.8.28 / gray / enforced` with a trusted certificate.
- `https://files.zezhen.xyz/` returned the expected protected-route `404` with a trusted certificate.
- HTTP on all four hosts redirects to HTTPS. Nginx syntax validation passed and all four new-server API/Worker services are active.
