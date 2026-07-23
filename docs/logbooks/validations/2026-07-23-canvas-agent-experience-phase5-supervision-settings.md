# Canvas Agent Experience Phase 5 Supervision Settings Validation

## Scope

- Baseline: Gray v0.7.19 audit, local `feature/canvas-agent-runtime` branch.
- Change: workflow Run overview, four-layer supervision settings, remembered owner settings, immutable Run snapshots, node retry overrides, stage concurrency and structured failure diagnostics.
- Safety: local browser and local API only; no GitHub push, no Gray deployment, no Production contact.

## Domain And Runtime Evidence

- Resolution order is platform limits -> workflow defaults -> owner+canvas+workflow remembered settings -> apply-once Run overrides.
- Migration `038_workflow_supervision_settings.sql` stores remembered settings by owner, canvas and workflow with a monotonically increasing revision. GET/PUT/DELETE routes remain owner-scoped.
- Run creation freezes resolved settings, field sources, overridden fields and clamped fields in the configuration snapshot. Budget, duration and stable node-ID retry overrides are frozen with the Run and cannot drift with later edits.
- Worker claim enforces Run-level stage concurrency and uses a node retry override before the workflow default. Run events map through `runStepKey/nodeId`, so failed-node diagnostics no longer depend on mismatched event IDs.
- The Web API client rejects malformed successful settings responses such as `200 null` and surfaces a readable error. A focused regression test covers this boundary.

## Browser Evidence

- At `1440x900`, the settings drawer replaced the supervision main view instead of overlapping it. AI/manual selection, retry `5`, stage concurrency `6` and confidence `82%` all rendered and updated.
- Advanced settings displayed stable node numbering as `01 · 主视觉生成` and accepted a node-specific retry override.
- Apply-once returned to the main view with `本次覆盖已就绪 / 仅下一次 Run`. Remember changed the resolved source indicator to `个人记忆 r1`.
- At `390x844`, document and body width were both 390 pixels; the panel stayed within `8..382`, had no horizontal overflow, and its sticky action footer remained visible and unobscured.
- A clean authenticated local session reported zero console errors and warnings.
- Screenshots:
  - `output/playwright/phase5-supervision-settings-1440x900.png`
  - `output/playwright/phase5-supervision-settings-390x844.png`
  - `output/playwright/phase5-supervision-settings-advanced-1440x900.png`
  - `output/playwright/phase5-supervision-settings-node-override-1440x900.png`

## Verification

- Focused Vitest: 9 files, 67 tests passed.
- Shared, API, Web and Worker builds passed.
- API, Web and Worker type-check passed.
- `verify:canvas-assistant-ui-contract`, `verify:file-hotspot-budgets`, `verify:hotspot-watchlist-contract` and `git diff --check` passed.
- CodeGraph was synced after source changes and reported an up-to-date index.

## Local Runtime Boundary

- Local single-port mode has no PostgreSQL Agent Runtime. Real remembered-setting persistence, immutable Run locking and Worker execution correctly stop at that boundary.
- Repository, service, route and Worker behavior is covered by focused tests. The same settings persistence and Run execution paths must be repeated against an isolated PostgreSQL harness or Gray before final acceptance.

## Incident

- The first Web builds failed with `ENOTEMPTY` and then `EPERM` because the task-owned single-port API held a static logo file. Only the explicit local launcher/API PIDs on port 18200 were stopped; Web then built successfully and the service was restarted through `npm run start:single-port`.

## Remaining

- Phase 6 owns bounded retry, compatible model/provider fallback, prompt-review rewrite, safe parameter repair, upstream gating and Gray `modelRecordId` preflight repair.
- Full isolated PostgreSQL, Harness and Gray runtime validation remain Phase 10/11 work.
