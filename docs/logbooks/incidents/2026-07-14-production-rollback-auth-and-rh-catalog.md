# Production Rollback: Admin Session and RH Catalog Visibility

Date: 2026-07-14

## Status

Production was rolled back from `v0.5.27` to `v0.5.22` at 15:44 CST. API and worker were verified active after the rollback. Gray remains on `v0.5.27`; the `v0.6.1` repair candidate is prepared for gray validation.

## Trigger

- The admin user-group creation form returned `AUTH_REQUIRED`.
- Non-admin users saw an empty RunningHub catalog although the admin permission UI appeared to allow RH entries.

## Evidence

- Production access log recorded `GET /api/admin/user-groups => 401` at 15:34 CST and `POST /api/admin/user-groups => 401` at 15:38 CST from the admin page.
- `AUTH_REQUIRED` is emitted before the admin route handler when no valid session is present. The group creation route itself was not reached.
- The admin frontend retained its previously loaded state after the session became invalid, so it showed an inline form error instead of returning to login.
- Production data currently contains one empty group and no group-permission-policy rows. All 19 enabled member accounts have no `group_id`.
- For non-admin accounts without a policy, `policyForUser()` produces a default deny policy containing `"*"` for both RunningHub app and workflow catalogs. The public catalog filter therefore returns no RH entries for every ungrouped member.

## Rollback

- Previous release: `20260702-envsync-admin-sections-prod-r1-v0522`
- Current symlink was changed to that release.
- `xinghuan-canvas.service` restarted at 15:44 CST.
- `xinghuan-canvas-worker.service` completed graceful shutdown of the old worker and became active on the rollback release at 15:45 CST.
- Verified both `http://127.0.0.1:18100/api/status` and `https://canvas.hhh2121.xyz/api/status` return `version=0.5.22`, `environment=production`.

## Required Repair Before Re-promotion

1. Treat an `AUTH_REQUIRED` response in the admin client as a session-loss event: clear local admin state and return to login with a clear message.
2. Add an integration test that logs in, creates a group, refreshes the admin data, and confirms the group and its initial policy exist.
3. Make the `未分组` permission bucket explicit and manageable, or migrate existing members to a named group with an explicit policy before default-deny enforcement is enabled.
4. Add an authenticated member catalog test that proves an allowed ungrouped/grouped user receives the expected RH apps and workflows, while a denied user receives no restricted entries.
5. Re-run the AIFork SD video adapter repair recorded in `2026-07-14-aifork-sd-video-adapter-contract-mismatch.md` before production promotion.
