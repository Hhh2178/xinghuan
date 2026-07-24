# Provider Model Channel Health Gray v0.7.41

- release: `20260724-provider-model-channel-health-gray-r1-v0741`
- source commit: `be4f23d`
- rollback: `20260724-canvas-run-progress-lock-gray-r1-v0740`

## Scope

- Adds additive Migration 042 for owner-scoped Provider/model feedback.
- Adds settled-only two-hour reliability aggregation, ETag reads, user-facing channel status and Admin reliability analytics.
- Does not change task execution, Provider routing, production, or GitHub state.

## Pre-deploy Evidence

- Full test suite: `151` files passed, `590` tests passed, `4` skipped.
- Full workspace build, project Harness, workspace Harness, and the channel-health contract Harness passed.
- Local runtime starts successfully; isolated local PostgreSQL was unavailable, so Gray must provide migration and authenticated task/vote evidence.
