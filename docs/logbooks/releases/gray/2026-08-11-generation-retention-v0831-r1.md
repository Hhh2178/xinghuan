# v0.8.31 新服务器 Gray 生成素材保留时效

- release: `20260811-generation-retention-v0831-r1`
- source commit: `a4dbdf137907155ef33b1c12ffacd70a6fee9c50`
- encrypted artifact SHA-256: `3dc97d8bf8db4ac9c49df0fc162f822c84eac32472bf8dea001d3b0dd56c7e24`
- sealed archive SHA-256: `a083acaf5eed5dfc55500aac543e53964c431e55d3126067918b57037a999a7b`
- deployed target: new-server Gray `gray.zezhen.xyz`
- rollback release: `20260811-provider-media-edge-v0830-r1`

The Worker and legacy API now calculate artifact expiry from the authoritative `materialLifecycle.outputRetentionDays` setting. The Canvas drawer reads the same value through the authenticated generation-library settings route, and the sealed release includes the reconciliation script required by the output-prune systemd service.

Gray database and environment fallback retention were aligned to 15 days after a database backup. API/Worker status, permission readiness, reconciliation dry-run, output-prune service execution, and the public HTTPS status endpoint passed.
