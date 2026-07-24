# Gray Upload Authentication And Video Prompt Preflight Issues

Status: open

## Upload `AUTH_REQUIRED`

- Environment: Gray.
- Symptom: material upload can intermittently render `AUTH_REQUIRED`; refreshing the page makes the same workflow available again.
- User evidence: the failure is visible in the Canvas upload surface and does not persist after a browser refresh.
- Impact: an upload can appear to fail even when the user has a valid session after refresh.
- Current hypothesis: the client-side upload request sometimes observes stale or missing authentication/session state. This is not yet a root-cause conclusion.
- Required evidence before a fix: capture request URL, status, request ID, current-user/session response and cookie/CSRF state from one failing attempt; compare it with the succeeding refresh attempt without recording secrets.
- Investigation boundary: client upload request construction, authenticated file routes, session refresh/CSRF handling, and any cached request credentials.

## SD Video Prompt Length Preflight

- Environment: Gray.
- Symptom: an SD video generation node displays a platform error for a `4387`-byte prompt exceeding a `4096`-byte limit before a Provider task is submitted.
- Impact: the platform rejects valid user intent locally and prevents the configured Provider from applying its own model-specific contract or returning its own diagnostic.
- Code evidence: `apps/api/src/provider-generation-task-service.ts` invokes `validateVideoPromptBytes(prompt, resolveVideoPromptByteLimit(...))` in `submitVideoTask` before task persistence and queue dispatch.
- Expected behavior: do not impose a platform-wide video prompt byte cap. Preserve only transport/infrastructure safety limits where unavoidable; the configured Provider/model contract should determine whether a submitted prompt is accepted. Provider rejection must be recorded as upstream feedback rather than synthesized as a front-end/platform preflight failure.
- Regression coverage required for the correction: a prompt above `4096` bytes reaches task creation and queue dispatch for an SD model; a real Provider rejection, if any, remains visible in the task result.
