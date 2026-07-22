# Canvas Run Quality Coordinator Split Retrospective

## Context

The staged Agent Runtime change introduced `apps/worker/src/canvas-run-quality-coordinator.ts` as a 1,028-line source file. The repository's staged source-size guard limits newly introduced source files to 800 lines, so the local commit was blocked before any release artifact could be created.

## User Impact

There was no runtime or user-visible behavior change. The blocked commit prevented a gray release that would otherwise have carried an overgrown coordinator, increasing the cost and risk of later workflow quality, routing, and recovery changes.

## Adjustment

The coordinator now owns the quality-work polling loop, transactions, route selection and state transitions. Shared quality context parsing, profile and artifact reads, message construction, budget checks, event persistence, route-state evaluation, and primitive normalization moved to `apps/worker/src/canvas-run-quality-support.ts`.

No generation task payload, provider selection, model parameter, queue name, ownership rule, or canvas execution path was changed. The split is internal to the worker quality runtime.

## Verification

- `npm run type-check --workspace=@xinghuan/worker` passed.
- `npx vitest run apps/worker/src/canvas-run-quality-coordinator.test.ts apps/worker/src/canvas-run-coordinator.test.ts` passed: 2 files, 14 tests.
- `npm run verify:staged-source-size-guard` passed with 171 staged entries.
- The coordinator is 768 lines and the extracted support module is 295 lines.

## Follow-up

Gray pressure testing will verify the same quality routing and fallback behavior against configured real models. Any user-facing or Admin usability adjustment discovered there will receive its own retrospective record before the final release evidence is closed.
