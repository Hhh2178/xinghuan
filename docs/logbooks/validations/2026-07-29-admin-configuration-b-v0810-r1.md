# Admin Configuration B v0.8.10 Gray Validation

- release: `20260729-admin-configuration-b-v0810-r1`
- environment: `gray`
- target profile: `old-server`
- source commit: `266e0f03abecf92a68abab11199bab49e3bca154`
- archive SHA-256: `1048df04ac131e9887d94103b4407be9be3155137c13424d8b3d86567173c7f2`

## Automated Gates

- B focused Vitest passed with 5 files and 10 tests; full Vitest passed with 223 files passed, 1 skipped, 854 tests passed, and 4 skipped.
- Full workspace build and Provider, RunningHub, ComfyUI, runtime settings, revision, and environment-sync contracts passed.
- The environment-sync permission contract independently protects both internal routes and independently requires the token header on both remote transports.
- Visual docs, design token, component registry, Authority/readiness, hotspot/watchlist, staged-source, release-logbook, and release-worktree gates passed.
- Project, workspace, and release Harness passed; deployment applied 0 migrations and skipped 46 existing migrations.
- Runtime verification confirmed current release `20260729-admin-configuration-b-v0810-r1`, API/Worker active, public/internal `0.8.10 / gray`, and permission `enforced / ready` with zero failures.
- Server-side remote preflight, request-chain observability, system observability, and environment-sync no-op smoke passed.

## Browser Acceptance

- All six authenticated routes were inspected once at exactly `1920x1080` with the assistant dock open: `/admin/capabilities/providers`, `/admin/capabilities/models`, `/admin/rh`, `/admin/comfyui`, `/admin/system/runtime-settings`, and `/admin/system/environment-sync`.
- Every route rendered exactly one H1, zero topbar H1s, zero legacy focus cards, one configuration context, no document or `.admin-main` horizontal overflow, and no assistant/workbench overlap.
- Provider, model, RunningHub, and environment sync rendered the expected shared rail/editor geometry; ComfyUI and runtime settings correctly use the lighter configuration template without manufacturing empty slots.
- `.admin-main` retained `overflow-y: auto` as the scroll owner. No nested card descendants were detected inside cards or configuration slots.
- The long ComfyUI machine hostname is intentionally truncated with ellipsis inside its card; document and main-content widths remain bounded.
- The model route's assistant context still labels the page as `providers`. This is recorded as a non-blocking context-label residual for a later Admin assistant-context correction.
- Screenshots are ignored runtime artifacts under `output/playwright/admin-configuration-b-v0810-gray-*-1920x1080.png`.

## Result

- Admin B configuration workbenches passed old-server Gray acceptance. B is complete and C realtime/data workspaces are active.
- Production, billed canaries, and retention apply were not performed.
