# v0.6.4 AICopy SD Video Input Modes Gray Release

## Release

- Version: `v0.6.4`
- Release ID: `20260715-aicopy-sd-video-input-modes-v064`
- Deploy path: `/opt/apps/xinghuan-canvas-next/releases/20260715-aicopy-sd-video-input-modes-v064`
- Domain: `canvas-next.hhh2121.xyz`
- Port: `127.0.0.1:18200`
- Package size: `1.64 MB`
- Production: unchanged at `v0.5.22`

## Delivered

- Explicit AICopy transport protocol with per-model SD request-contract opt-in.
- Fixed SD sound binding, duration, ratio, ordered images/audios, and result-path extraction.
- Four universal video input modes: reference, first frame, last frame, first-last frame.
- Reference-image maximum configured per model instead of separate single/multi-reference video toggles.
- Authoritative API validation and HTTP 400-compatible input errors.
- Worker contract isolation so non-AICopy Providers do not receive SD fields.
- Scoped model configurator with dry-run, transaction, idempotence, and `0600` backups.
- APIMart `{preview_video_size}` compatibility alias discovered during live regression.

## Verification

- Release runtime verifier passed after one transient pre-TLS connection reset.
- API and Worker are active; public and internal status return `0.6.4 / gray`.
- Model configuration is visible through the authenticated public model catalog and survives service restart.
- External proxy, Worker queue, and 49-node browser render smokes passed.
- Controlled AICopy task has the correct sanitized queued payload. The supplied completed media is 15 seconds, but `1254x720` landscape with no audio stream; ratio and sound acceptance failed at the upstream contract boundary.
- Further paid generation is frozen until the provider contract or plugin source confirms the exact ratio and sound fields.

Detailed evidence: `../../validations/2026-07-15-aicopy-sd-video-input-modes.md`.

## Rollback

- Previous gray release: `/opt/apps/xinghuan-canvas-next/releases/20260714-user-group-postgres-atomic-v063`.
- Model configuration backups are under `/opt/apps/xinghuan-canvas-next/shared/data/config-backups/` with mode `0600`.
- Rollback must restore only the selected model record, then restart `xinghuan-canvas-next.service` and `xinghuan-canvas-next-worker.service`.
