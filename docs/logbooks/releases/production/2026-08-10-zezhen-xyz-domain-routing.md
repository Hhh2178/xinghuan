# 泽臻 `.xyz` 域名路由切换

- target: new server `43.131.246.222`
- production: `zezhen.xyz`, `www.zezhen.xyz`
- gray: `gray.zezhen.xyz`
- provider files: `files.zezhen.xyz`

## Applied

- Added the three `.xyz` HTTPS routes alongside the existing `.online` compatibility routes.
- Issued a Let’s Encrypt certificate for the four `.xyz` names. The certificate expires on 2026-11-08 and Certbot renewal is enabled.
- Updated the new-server release target URLs and both runtime `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN` values.
- Restarted new-server API and Worker services after the environment update. No application release, database migration, user-data migration, or old-server change was performed.
