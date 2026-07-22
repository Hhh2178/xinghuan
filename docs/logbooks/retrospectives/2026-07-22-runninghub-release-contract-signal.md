# RunningHub Release Contract Signal Retrospective

## Context

The `runninghub` Gray release preset was stopped before packaging. Its static Worker contract expected `executeTask(task: TaskRow)` exactly, while the Agent Runtime adds an optional `AbortSignal` parameter so Gemini native-media work can be cancelled without leaving a provider-side operation running.

## Diagnosis

The direct feedback loop was `node scripts/verify-runninghub-worker-and-label-contract.mjs`. It failed deterministically. Source inspection confirmed the required behavior was still present and ordered correctly:

1. normalize the Provider protocol;
2. dispatch `runninghub` to `executeRunningHubTask` before any capability path;
3. dispatch image, video, audio and chat by capability.

The only mismatch was a stale single-argument function-signature assertion.

## Adjustment

The contract now accepts the existing one-argument form or the optional `AbortSignal` form, while retaining its assertions for protocol normalization, RunningHub-first dispatch and the image capability branch.

This does not change Worker execution, Provider inputs, task queues, model selection, Canvas Run behavior, or RunningHub request handling.

## Verification

- The direct failing contract is rerun after the adjustment.
- The `runninghub` Gray release prepare preset is rerun with the same `20260722-canvas-agent-runtime-gray-r1-v0719` release ID.
- No server connection, Gray deployment, Production deployment, or GitHub push occurred before this correction.

## Prevention

Static contracts that protect dispatch ordering should avoid over-constraining compatible function signatures when an optional cancellation channel is part of the supported Worker contract.
