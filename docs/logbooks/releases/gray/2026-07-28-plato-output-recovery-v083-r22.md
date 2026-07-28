# Plato Output Recovery v0.8.3 Gray

- release: `20260728-plato-output-recovery-v083-r22`
- version: `0.8.3`
- source commit: `5a7456ab40f8a91d11873b967aa2e9a6e80d0c5a`
- archive SHA-256: `8F0DCDF561920A0D0897E2193BF288F4E817EFC58F00F8B6F489F84E4FED9837`
- target: `ubuntu@101.33.75.38:728`
- release root: `/opt/apps/xinghuan-canvas-next`
- previous current: `20260728-artifact-materialization-idempotency-v083-r21`
- rollback: `20260728-artifact-materialization-idempotency-v083-r21`
- retentionApplyRun: `false`

## Scope

- Add `provider_poll_resume` recovery so a failed local video task with an existing upstream task ID resumes polling the same Provider task instead of submitting and billing again.
- Keep polling and bandwidth-constrained materialization alive with operation heartbeats; make the stale-task reaper conditional and requeue eligible video tasks for polling-only recovery.
- Retry output downloads, resume interrupted video transfers with HTTP Range, and promote `.part` files atomically.
- Separate upstream routing/capacity failures from model configuration and local materialization failures; expose an accurate Admin `恢复结果` action.

## Verification

- Full repository verification before packaging passed: 213 test files passed plus 1 skipped; 830 tests passed plus 4 skipped; API, Worker and Admin builds passed.
- Gray r22 deployed successfully. API/Worker are active; internal/public status is `0.8.3 / gray`; permission readiness is enforced and ready.
- Five concurrent Aifork Grok Preview first-frame tasks all reached Provider completion and local materialization. The five local MP4 files total 40,660,629 bytes and were readable through Range requests.
- Five Plato 6-second reference-image submissions were rejected by the upstream distributor before task creation with `no available platform`; no upstream task IDs existed, so these are upstream channel-capacity failures rather than local return failures.
- Production remains frozen at v0.7.17 per user instruction; no Production deployment or mutation ran for r22.
