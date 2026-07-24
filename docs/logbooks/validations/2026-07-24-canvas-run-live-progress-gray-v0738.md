# Canvas Run Live Progress Gray v0.7.38 Validation

## Local

- Worker image/video batch, task-progress parsing and Canvas node projection regressions pass `16/16`.
- Worker and Web TypeScript checks pass.

## Gray Runtime

- Release `20260724-canvas-run-live-progress-gray-r1-v0738` passed public/internal `0.7.38 / gray / enforced` status checks. API and Worker are active; all 41 migrations remain current.
- Authenticated Canvas verification created and started `canvas_run_95dece5e-acad-4d59-951a-1c089f0867c8` with a three-image node. The Canvas and supervision panel both reached `运行中 0/3`; the Worker then persisted two completed provider requests and two distinct upstream task IDs while the third was polling.
- This run exposed duplicate durable `step_progress` events for the same count. It did not alter provider submission or the live Canvas label, but requires the immediate `v0.7.39` deduplication patch before final acceptance.
