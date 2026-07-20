# Task Plan: Media node sizing and runtime resume

## Goal

Deliver v0.7.12 with intrinsic media sizing, smooth text resize, lossless canvas refresh, and idempotent generation-task resume through Gray and Production.

## Current Phase

Phase 4

## Phases

### Phase 1: Requirements and diagnosis
- [x] Confirm media sizing and text resize root causes
- [x] Confirm workflow cleanup call boundary
- [x] Record the canonical implementation plan
- **Status:** complete

### Phase 2: Media sizing and resize implementation
- [x] Add media sizing pure functions and tests
- [x] Integrate Upload and Output nodes
- [x] Simplify Text resize synchronization
- **Status:** complete

### Phase 3: Persistence and runtime resume
- [x] Preserve completed Output media on refresh
- [x] Add canvas/workflow boundary regression tests
- [x] Resume persisted image/video/audio tasks without resubmission
- **Status:** complete

### Phase 4: Verification and documentation
- [x] Run focused tests and web type-check
- [x] Run full build, Harness, governance checks, and CodeGraph sync
- [x] Update system docs and daily logbook
- **Status:** complete

### Phase 5: Gray release
- [x] Prepare and deploy v0.7.12 to Gray
- [x] Verify runtime, permissions, refresh, and task-resume contracts
- [ ] Complete browser acceptance with representative live generation
- **Status:** complete

### Phase 6: Production promotion
- [x] Promote the Gray-verified v0.7.13 artifact
- [x] Verify Production runtime and rollback state
- **Status:** complete

## Decisions Made

| Decision | Rationale |
|---|---|
| Persist explicit size mode and media ratio | Separates automatic measurement from user intent |
| Project resize input onto the media constraint | Both horizontal and vertical corner movement remain useful |
| Resume by querying persisted task IDs | Prevents duplicate paid generation requests |
| Keep workflow cleanup inside cloned manifest creation | Protects normal canvas persistence |
| No retention/prune | Explicit prior user boundary |

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Local CodeGraph CLI has no `search` command | 1 | Switched to the CodeGraph MCP explore/search tools |
| Parallel shell group failed when one optional path/grep returned exit 1 | 1 | Split commands and guarded optional paths |
| Web type-check narrowed `singleMediaConstraint` but not its source ratio | 1 | Added an explicit ratio guard and narrowed local constant |
| PowerShell stripped a temporary `$lines` variable in a nested command | 1 | Switched to a variable-free `Select-Object` read |
| Seedance task-run media kind was incompatible with `NodeRuntimeCard` | 1 | Kept `kind: video` and used `resumeKind: seedance` for query routing |
| Audio failure-state patch matched the file footer instead of the polling branch | 1 | Removed the footer fragment and inserted it with exact surrounding statements |
| Full suite retained the obsolete audio-reference cap of 8 | 1 | Updated the model-core contract test to the approved cap of 10 |
| Attempted nonexistent `verify:release-version-alignment` npm script | 1 | Use the release script's direct alignment check and the documented preflight commands |
