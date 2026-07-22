# Agent Chat Routing Writeback Contract

## Context

After the Gray Planner route was republished with the required `text_chat` capability tag, the floating Assistant still returned fallback. Concurrent Canvas Runs reached the AICopy Worker Chat Adapter but the configured Grok upstream reported an unavailable channel.

## Root Cause

- The API-side Agent Model Adapter rejected the already normalized `aicopy` protocol even though the Worker Chat Adapter now accepts it as OpenAI-compatible.
- `xh_llm_route_entry_health` upsert used the same untyped positional counters in both insert and conflict-update expressions. PostgreSQL could not infer a stable type for the success counter, so Agent runs failed while recording their outcome and obscured the original adapter error.

## Change

- Align API and Worker Chat allowlists by accepting `aicopy` on the API OpenAI-compatible path.
- Cast all route-health counter and latency parameters to `integer` at the SQL boundary.
- Add a repository test that locks the explicit typed-counter contract.
- Update the provider protocol system record.

## Verification

- Run the LLM routing repository test, API and Worker type-checks, the Agent contracts and Project Harness.
- Rebuild and redeploy the same Gray `v0.7.19` release.
- Retest the floating Assistant using the published Planner route, then select a verified live LLM candidate for Canvas Run pressure if the original upstream Grok channel remains unavailable.

## Scope And Rollback

No model, Provider credential, task payload, queue or user ownership behavior changes. The SQL casts and protocol allowlist can be reverted independently; historical audit and run rows remain intact.
