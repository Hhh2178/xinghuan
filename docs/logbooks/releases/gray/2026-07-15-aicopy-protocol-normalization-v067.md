# v0.6.7 AICopy Protocol Normalization Gray Release

## Release

- Version: `v0.6.7`
- Environment: gray only
- Release: `20260715-aicopy-protocol-normalization-v067`
- Production remains `v0.5.22`.

## Changes

- Preserve `aicopy` in Worker protocol normalization so AICopy tasks reach the dedicated request serializer and poller.
- Retain the `v0.6.6` completed-without-URL fallback, origin-scoped authenticated content download, and non-serialized credential context.
- Add a real Worker mock harness that validates the official SD request body, terminal poll response without URL, authenticated `/content` download, local materialization, and final succeeded task state.
- Add guarded diagnostic and one-task recovery scripts for completed AICopy tasks; neither script creates a generation task without an explicit environment flag.

## Verification

- Worker adapter normalization regression: passed.
- AICopy adapter and completed-without-URL contract: passed.
- Authenticated output materializer: passed.
- All workspace type checks: passed.
- Gray Worker mock and runtime verification: pending deployment.
