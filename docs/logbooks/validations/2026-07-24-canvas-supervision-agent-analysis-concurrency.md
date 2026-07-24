# 2026-07-24 Canvas Supervision Agent Analysis And Concurrency Validation

## Scope And Boundary

- Branch: `feature/canvas-agent-runtime`
- Gray baseline: `v0.7.42`
- Candidate API/Worker: isolated loopback `127.0.0.1:18248` on the Gray server
- Candidate database: disposable clone of Gray with migrations `043` and `044` applied only to the clone
- Candidate Redis, data directory, processes and publications: isolated under `/tmp/xh-task7-candidate-20260724`
- Formal Gray `current`, systemd, Nginx, database schema, Redis and release state: unchanged
- Production and GitHub: untouched
- No credentials, cookies, Provider keys, signed URLs, prompts containing user data or owner identities are recorded here

## Implemented Contract

- Workflow compilation freezes deterministic `executionLayers`; parallel stages keep equally ready independent steps in one layer and every later layer waits for earlier dependencies.
- `supervision-planner` receives only a sanitized graph. Its response is parsed from bounded JSON candidates, validated against step identity, dependency, layer and maximum-parallelism constraints, then frozen with the linked Agent Run.
- Provider request estimation is deterministic. Only generation-capable steps count, using frozen `generationCount`; selectors, outputs and other deterministic steps count as zero.
- Worker generation and smart-selector claims are restricted to the minimum incomplete layer. Legacy `NULL execution_layer` rows map to compatibility layer `0`.
- The real Worker loop records layer start/completion events. Final completed layers are appended before `canvas_run.succeeded`, including quality-coordinator terminal paths.
- Canvas projects the frozen analysis, concurrency groups, serial constraints, risks, request count and active layer.

## Automated Verification

Fresh passing gates:

```text
npx vitest run <Task 7 nine-file focused set>
  9 files / 76 tests passed
npm run test:canvas-run-postgres-integration
  4 tests passed; migrations 001-044 present
npm run test:canvas-run-local-e2e
  SSE, Last-Event-ID, task settlement, pause/resume, cancel and every execution-layer start/completion passed
npm run verify:agent-runtime-architecture-contract
npm run verify:canvas-workflow-capabilities-contract
npm run type-check
npm run build
```

The PostgreSQL gate first exposed post-migration legacy rows with `execution_layer=NULL`; both generation and selector claims now treat them as layer `0`. The local E2E then exposed that the continuous Worker loop omitted layer recording and that the final layer could be terminal before its completion event. Both failures were reproduced before their fixes and are now asserted by the gate.

## Real Planner Preflight

Plan-only Run:

- Run ID: `canvas_run_602eb030-1c69-4c82-8494-b7893ea7e83b`
- Agent Run ID: `agent_run_2b0856a1-e45f-4897-908e-61105bf9188c`
- Agent analysis: `completed`
- Execution layer widths: `[2, 1, 1, 1]`
- Deterministic request estimate: `7` (`3 + 3 + selector 0 + downstream 1 + output 0`)
- Effective concurrency: `2`

The first real planner response included reasoning text and fenced JSON and used string serial constraints. The parser now extracts the final bounded JSON object, while the stricter prompt requires object-shaped constraints. Invalid identities or shapes still degrade deterministically and cannot change execution layers.

## Real Concurrent Image Chain

Successful candidate Run:

- Run ID: `canvas_run_5493817a-3707-4430-80c0-ccd531e162bb`
- Upstream task A: `task-32f63da5-c7cf-4210-a2ae-5e8ee459df8b`, `3` Provider requests, `3` images
- Upstream task B: `task-36b44546-4c31-457f-b55d-176a834cdca2`, `3` Provider requests, `3` images
- Downstream image task: `task-f249cd16-4d2d-4d0c-85ca-2af6cbb0f338`, `1` Provider request, `1` image
- Upstream start timestamps differed by about `1.017s`
- Actual task interval overlap: `83.55s`
- AI candidate evaluation completed before the downstream image task was dispatched
- Final Run state: `succeeded`
- All four layer-start and layer-completion assertions passed before Harness evidence collection

The Harness later called a nonexistent Admin task-detail GET route and stopped while collecting timestamps. The read-only collector now uses the owner-scoped provider task status route. The Run, task state, counts and overlap above were recovered from the disposable clone before cleanup; generated media URLs are intentionally omitted.

## Real Failure And Assistant Diagnosis

Failure Run:

- Run ID: `canvas_run_573aa05a-36a3-432c-bf5b-ea9eeea0ff59`
- Layer 0 real image step: `succeeded`
- Layer 1 isolated unreachable image Provider step: `failed`
- Normalized category/title: `provider / 渠道拒绝了本次请求`
- Assistant mode: `agent`
- Assistant response length: `1535` characters
- Run event count: `15`

The real frontend Assistant consumed the normalized failure diagnostic, separated observed facts, possible cause and repairs, and discussed the already completed unaffected step. The disposable Canvas was deleted after evidence collection.

## Provider Variations And Residual Risk

- GRSAI variations produced both successful three-image batches and intermittent `google gemini timeout` failures.
- The alternate configured `nano-banana` channel produced a complete successful chain, but later pure text-to-image batches intermittently returned upstream `422` safety/generation rejection for otherwise benign prompts.
- A later GRSAI stress Run completed both `3/3` upstream batches, AI selection and a downstream retry task, but the Run finished `failed` after an earlier downstream `result not exist` attempt. The successful happy-path Run above proves the requested chain; this recovery-edge observation remains an explicit completion-audit risk before Gray deployment.

## Decision

Task 7 implementation, deterministic/Agent authority boundary, PostgreSQL scheduling, local E2E and real multi-branch/failure behavior are validated for local commit. Gray deployment remains paused. Task 8 owns authenticated frontend/backend Assistant acceptance, frozen configuration behavior and exact `1920x1080` / `2560x1440` visual acceptance; the recovery-edge observation must remain visible through the final Gray approval gate.
