# Gray Release: LLM Media and Admin Freshness

- Release: `20260810-llm-media-admin-freshness-v0829-r2`
- Version: `0.8.29`
- Source commit: `317fcbea99f832ddee9867fa76094083d6e30d10`
- Environments: old-server Gray and new-server Gray
- Encrypted artifact SHA-256: `4805c2b8498b59718f6436dc453dacaf8b2f0d7a4b38d332640293e7334d70c5`
- Plain sealed archive SHA-256: `2ceee4cdc66de9cb6c4867b972f2f9ecbd0019808fb580fe07e817cc6aba2e14`

Deployment applied migration `050_admin_change_revisions.sql` (`applied=1`, `skipped=49`) on both Gray databases. API and Worker remained active, and internal/public status returned `0.8.29` with `permissionMode=enforced`. The release directory and encrypted artifact were verified on each target; temporary transfer files were removed.
