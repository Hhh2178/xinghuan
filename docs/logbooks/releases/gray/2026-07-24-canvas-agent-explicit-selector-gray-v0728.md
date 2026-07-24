# Canvas Agent Explicit Selector Gray v0.7.28

- release: `20260724-canvas-agent-explicit-selector-gray-r1-v0728`
- source commit: `5969f197374fc014eead9bd08ec6b15de99ca1f1`
- archive: `20260724-canvas-agent-explicit-selector-gray-r1-v0728.tar.gz`
- rollback: `20260724-canvas-agent-run-projection-gray-r1-v0727`

## Scope

- Completes the Gray `v0.7.19` Canvas Agent experience redesign through Workflow Region variables, deterministic stages, bounded AI supervision, explicit smart candidate selection and the simplified four-domain Admin governance surface.
- Preserves reusable server-owned Run, routing, recovery, quality, audit and safe Assistant rendering capabilities while retiring free-planning roles, canvas-wide management and active free-knowledge writes.
- Makes explicit `smart-candidate-selector` steps the only candidate truncation boundary for Workflow Region Runs; image and video steps retain their complete Artifact set.
- Preserves the selected Run as the frontend projection owner and prevents delayed reads or SSE updates from rewriting another Run.
- Charges successful image batches from the provider request count and the creation-time pricing snapshot.

## Environment Boundary

- Gray only. Production remains `v0.7.18 / 20260722-canvas-revision-observability-prod-r1-v0718` and was not restarted, reconfigured or mutated.
- No GitHub push was performed.

## Deployment

- Deployed on `2026-07-24` to `/opt/apps/xinghuan-canvas-next/releases/20260724-canvas-agent-explicit-selector-gray-r1-v0728`.
- Standard public/internal runtime verification passed for Gray `v0.7.28`; API and Worker remained active and Worker restart count stayed at zero.
- The verified rollback release is `20260724-canvas-agent-run-projection-gray-r1-v0727`.
- Retention dry-run and apply retained current `v0.7.28`, rollback `v0.7.27` and recent `v0.7.26`, `v0.7.25`, `v0.7.24`; eight older Gray release directories were removed through the governed script, releasing `2,796,126,208` bytes.
- Post-retention runtime verification again returned public/internal `0.7.28 / gray / enforced`, the expected current release and active API/Worker services.
- Runtime, behavior, PC visual and retention evidence is recorded in `../../validations/2026-07-24-canvas-agent-experience-gray-v0728.md`.
