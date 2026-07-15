# v0.6.6 AICopy SD Final Content Gray Release

## Release

- Version: `v0.6.6`
- Environment: gray only
- Release: pending
- Production remains `v0.5.22`.

## Changes

- Stop AICopy polling when a successful terminal response has no embedded media URL and continue through the final `/content` endpoint.
- Download protected final content with in-memory Provider authorization scoped to the exact Provider origin.
- Keep download credentials non-enumerable and out of all persisted task data.
- Persist a sanitized AICopy request summary for mode, ratio, duration, sound, and media-count diagnosis.

## Verification

Local contract, type, and build checks passed. Gray deployment, runtime verification, and the authorized six-second `sd2-720p-mini` task remain pending.
