# AI Governance And Supervision Gray v0.7.43

- release: `20260725-ai-governance-supervision-gray-r1-v0743`
- source commit: `5ddc9da`
- rollback: `20260724-channel-health-surface-gray-r1-v0742`
- Production: unchanged at `v0.7.18`

## Scope

- Separates frontend and backend AI-assistant governance and keeps Provider/model task identity readable in Admin.
- Delivers Provider/model channel-health hierarchy, RunningHub Standard Model image/video dispatch, and AI-supervision planning, concurrency, failure diagnosis, and assistant failure-context integration.
- Applies migrations `043_task_execution_identity_snapshot.sql` and `044_canvas_run_execution_layers.sql` to Gray only.

## Deployment

- Installed release under `/opt/apps/xinghuan-canvas-next/releases/20260725-ai-governance-supervision-gray-r1-v0743` and switched the Gray `current` symlink.
- Restarted only Gray API and Worker services. Production was not deployed, restarted, or mutated.
- Gray bootstrap exposed missing published backend-assistant and supervision routing data. The existing Admin governance bootstrap was run in Gray, then the required assistant and supervision Agent configuration versions and route pools were reviewed, approved, and published. This creates auditable Gray-only configuration history; it does not change source code or Production data.

## Evidence

- Release preparation passed the base and RunningHub contracts, production build, Project Harness, assistant/supervision contracts, and package version alignment.
- Runtime verification confirmed internal/public `0.7.43 / gray / enforced`, active Gray API/Worker, database `xinghuan_canvas_gray`, and ready permission state with no failures.
- Deployed-release smoke checks passed for Admin task pagination, environment sync, Provider task service, and Provider Worker dispatch.
- Post-deploy authenticated calls confirmed both Canvas and Admin assistants returned `mode=agent`; their response lengths were `802` and `2287` respectively.
- The authoritative pre-deploy real Provider, real Agent and real Canvas supervision acceptance is `../../validations/2026-07-24-ai-governance-provider-supervision-real-acceptance.md`.

## Visual Scope

The user explicitly waived dual-viewport visual verification for this release. No new `1920x1080` or `2560x1440` browser matrix was run or claimed.
