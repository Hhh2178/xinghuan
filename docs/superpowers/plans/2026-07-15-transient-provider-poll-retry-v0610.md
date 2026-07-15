# Transient Provider Poll Retry v0.6.10 Plan

## Goal

Prevent a single transient provider gateway or network failure from permanently failing an already-submitted generation task, without resubmitting billable work or changing provider-specific payload and result contracts.

## Confirmed Production Failure

- Production Worker received an upstream Nginx `502` while polling `api.aicopy.top` and immediately marked the local task failed.
- The same model and poll path completed hundreds of tasks, so the endpoint configuration is not the cause.
- Current polling helpers throw on every non-2xx response and have no transient retry boundary.

## Scope

Apply one shared retry helper to idempotent Worker GET polling for:

- APIMart-compatible video tasks;
- AICopy video tasks;
- APIMart final video lookup;
- APIMart-compatible image tasks;
- ModelScope image tasks.

RunningHub and provider-specific clients with independent scheduling contracts remain unchanged in this batch.

## Compatibility Rules

1. Never retry generation submission or any other billable POST.
2. Retry only network failures, HTTP `408`, `425`, `429`, and `5xx`.
3. Preserve the current behavior for successful responses, ordinary `4xx`, provider business failures, parsing, completion, cancellation, and overall polling timeouts.
4. Default to four retries after the initial request, using capped exponential backoff with jitter.
5. Respect a valid `Retry-After` response header within the configured delay cap.
6. Record sanitized retry diagnostics through the existing heartbeat callback; never persist response bodies, credentials, or provider headers.

## Verification

- Unit regression: `502 -> 200` recovers without a second submission.
- Unit regression: network failure and `503` recover with bounded delays.
- Unit regression: ordinary `400` is not retried.
- Unit regression: persistent `502` stops after the retry limit and preserves the final provider response.
- Existing AICopy, APIMart, ModelScope, Worker split, type, and build checks remain green.
- Gray verification uses local mock upstreams only; no paid provider model is called.
- Production remains `v0.5.22`.

## AIFork Grok FAST Multi-reference Follow-up

Gray tasks using `grok-imagine-video-1.5-fast` failed twice at reference slot 3 with `Asset upload returned 403`.

Evidence:

- all three signed gray provider-file URLs shared the same unexpired 20-minute window;
- AIFork/Grok fetched all three files successfully with HTTP `200` before the task failed;
- all three inputs were valid RGB PNG files with the same `941 x 1672` geometry;
- both attempts failed specifically at `Video input reference 3`, after the upstream submit had already created a task.

The failure is therefore inside AIFork's Grok asset-upload step, not the canvas upload, signature, file-size, or Cloudflare download path. Automatic task resubmission is prohibited because it can duplicate billable work.

The follow-up Grok contract evidence separates two request families:

- generic `grok-imagine-1.0-video` uses `duration`, `video_length`, `aspect_ratio`, `resolution`, nested `video_config`, and `reference_images` with 1-7 Data URLs;
- GROK 1.5 Preview-style models use `seconds`, derived `size`, and `images`, with image content supplied as Data URLs.

The model input-capability card therefore owns both the maximum reference count and an independent `referenceImageTransport` selector (`url` by default, `data_url` opt-in). Data URL conversion happens only in API/Worker memory, reads only the current account's bounded local material files, and never persists Base64 in the task payload or logs. Gray enables `data_url` only for `api.aicopy.top` + `grok-imagine-video-1.5-fast`; its existing six-image limit and `seconds/size/images` mapping remain unchanged. Nested request-contract bindings remain available for future generic Grok models without hard-coding their fields into the canvas.
