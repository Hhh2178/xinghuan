# AIFork SD Video Adapter Contract Mismatch

Date: 2026-07-14

## Status

The request contract and input modes were completed by `v0.6.4`, but a Worker protocol-normalization omission kept downgrading `aicopy` to `openai`. Diagnostic gray `v0.6.6` reproduced the defect with an authorized six-second mini task. Final gray repair is targeted at `v0.6.7`; production remains unchanged.

## Scope

- Provider: `aifork` (`protocol=aicopy`, `https://api.aicopy.top`)
- Affected model family: `sd2-720p`, `sd2-720p-fast`, `sd2-720p-mini` and other AIFork SD variants that use the same request contract.
- Example upstream task: `task_KEuc2B0G9QBkIF1iaUQLEnqBoCCKFnkI`

## Observed Behavior

- AIFork reports the upstream task as `SUCCESS` / `completed`.
- The produced video can fall back to a four-second, non-vertical, silent output even when the canvas selected 15 seconds, `9:16`, and sound.
- The canvas task remains `running` and does not receive a usable output URL.

## Evidence

The AIFork SD full-series contract requires:

```json
{
  "model": "sd2-720p-fast",
  "prompt": "...",
  "duration": 15,
  "metadata": {
    "modeType": "image2video",
    "ratio": "9:16",
    "enableSound": "on"
  },
  "images": ["https://..."],
  "audios": []
}
```

The persisted canvas task configuration instead routes the model through the generic AICopy mapping:

```json
{
  "requestMapping": { "ratio": "size", "duration": "seconds", "images": "images" },
  "requestValueTypes": { "duration": "string" },
  "requestValueTemplates": { "size": "{preview_video_size}" },
  "resultVideoPath": "data.output"
}
```

That generic adapter cannot construct dynamic nested `metadata` values or optional `audios`. It therefore sends `seconds` and `size`, which this SD branch does not use for the documented controls.

The completed upstream response places the video at root `result_url` and `data.metadata.url`, while the worker currently looks only at `data.output`. The direct metadata URL can be HTTP; the worker should prefer the HTTPS `result_url` or the documented `/v1/videos/{task_id}/content` fallback.

## Impact

- SD full-series video controls are not trustworthy in the canvas.
- Successfully generated upstream videos can remain permanently `running` in the canvas and never materialize as node output.
- The active example task is affected and requires post-fix recovery or re-run.

## Required Repair

1. Add a model-family-specific AIFork SD request builder that sends `duration`, `metadata.modeType`, `metadata.ratio`, `metadata.enableSound`, `images`, and optional `audios`.
2. Add a worker-side AIFork poller, rather than using the APIMart poller, and accept `result_url`, `data.metadata.url`, and `data.output`.
3. Prefer an HTTPS content URL before writing the output back to the canvas.
4. Add fixtures for Grok Preview, Seedance nine-image, and SD full-series AIFork contracts so one model family cannot silently inherit another model's fields.
5. Re-run a 15-second `9:16` SD task and verify duration, dimensions, audio track, task completion, and canvas output materialization.

## 2026-07-15 Diagnostic Addendum

- `normalizeProtocol()` in the Worker omitted `aicopy`, even though API normalization, task persistence, Provider records, and model contracts all accepted it.
- The real mini task therefore applied the top-level image but skipped the dedicated nested `metadata` serializer and AICopy completion path.
- The completed paid output was recovered through an authenticated `/content?variant=video` request and written to the user's output library without a second submission.
- A permanent regression now requires Worker protocol normalization to preserve `aicopy`.
