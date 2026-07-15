# AICopy SD Final Content And Mini Validation Plan

## Goal

Repair the AICopy SD completion boundary, preserve authenticated final-content retrieval without persisting credentials, and validate the complete gray path with one authorized six-second `sd2-720p-mini` first-frame generation.

## Confirmed Failures

1. AICopy may report `completed` without a media URL in the polling response. The Worker currently waits for both a terminal status and a URL, so the local task keeps polling after the provider has completed.
2. The documented `/v1/videos/{task_id}/content` endpoint requires Provider authorization. The generic output materializer downloads remote video URLs without credentials and would receive `401`.
3. Existing task records do not preserve a safe summary of the exact AICopy payload shape, which prevents a definitive local-versus-provider diagnosis for ignored `images`, `metadata.modeType`, and `metadata.ratio`.

## Design

- When AICopy returns a successful terminal status without a URL, synthesize the configured final-content path and stop polling.
- Attach the Provider download headers to the in-memory execution result through a non-enumerable symbol.
- Apply those headers only when the output URL origin exactly matches the configured Provider origin.
- Allow only `Authorization` and `X-API-Key` in the ephemeral download context.
- Never serialize the download context into task results, runtime events, logs, resources, or API responses.
- Persist a sanitized request summary containing only adapter, model, duration, ratio, mode, sound flag, media counts, and contract activation.

## Test Sequence

1. Red/green contract: completed poll response without URL resolves to `/videos/{task_id}/content`.
2. Red/green materializer: a protected video fixture requires Bearer authorization and the credential is absent from `JSON.stringify(result)`.
3. Run AICopy adapter, video input, task service, polling split, all workspace type checks, and the single-port build.
4. Publish diagnostic gray `v0.6.6`, then publish final gray `v0.6.7` after preserving `aicopy` in Worker protocol normalization; production remains unchanged.
5. Configure `sd2-720p-mini` with the explicit AICopy SD contract if its gray record is not already canonical.
6. Submit one six-second first-frame task using the supplied woman image and prompt `她跳桑巴舞`.
7. Verify persisted request summary, terminal task state, local materialized video, encoded duration/dimensions/audio, and visual first-frame identity.

## Paid-Test Guardrail

- One initial paid task is authorized.
- First-frame and generic reference modes both serialize one image as `image2video`; their UI assignment differences remain covered offline.
- A second paid task is allowed only after the local protocol-normalization defect is fixed and a free mock proves the exact outbound JSON and automatic result recovery.
