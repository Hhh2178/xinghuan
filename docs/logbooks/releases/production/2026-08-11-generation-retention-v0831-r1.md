# v0.8.31 新服务器 Production 生成素材保留时效

- release: `20260811-generation-retention-v0831-r1`
- source commit: `a4dbdf137907155ef33b1c12ffacd70a6fee9c50`
- artifact: reuses the Gray-verified AES-256-GCM archive
- encrypted artifact SHA-256: `3dc97d8bf8db4ac9c49df0fc162f822c84eac32472bf8dea001d3b0dd56c7e24`
- sealed archive SHA-256: `a083acaf5eed5dfc55500aac543e53964c431e55d3126067918b57037a999a7b`
- deployed target: new-server Production `zezhen.xyz`
- rollback release: `20260811-provider-media-edge-v0830-r1`

Production reused the exact encrypted artifact accepted by Gray. Before changing runtime state, the database and environment file were backed up. The database setting and environment fallback were changed from 10 and 3 days respectively to 15 days, and 1,651 active historical artifacts were extended to at least `created_at + 15 days` across the controlled backfill and deployment window.

The reconciliation dry-run reported 1,399 migrated records whose binaries were intentionally absent on the new server and 75 expired ephemeral uploads. No manual Production apply or binary deletion was performed in this release window; the enabled timer remains the authoritative scheduled cleanup path.
