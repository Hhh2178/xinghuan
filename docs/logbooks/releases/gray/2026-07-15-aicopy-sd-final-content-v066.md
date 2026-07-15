# v0.6.6 AICopy SD Final Content Gray Release

## Release

- Version: `v0.6.6`
- Environment: gray only
- Release: `20260715-aicopy-sd-final-content-v066`
- Production remains `v0.5.22`.

## Changes

- Stop AICopy polling when a successful terminal response has no embedded media URL and continue through the final `/content` endpoint.
- Download protected final content with in-memory Provider authorization scoped to the exact Provider origin.
- Keep download credentials non-enumerable and out of all persisted task data.
- Persist a sanitized AICopy request summary for mode, ratio, duration, sound, and media-count diagnosis.

## Verification

Gray deployment and runtime verification passed. The authorized `sd2-720p-mini` task exposed a remaining Worker defect: `normalizeProtocol()` omitted `aicopy`, so runtime execution downgraded to `openai`. This release is diagnostic and is superseded by the `v0.6.7` protocol-normalization repair.
