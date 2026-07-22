# AICopy Chat Worker Parity

## Context

The first Gray Agent Runtime pressure run completed two `nano-banana-fast` image Canvas Runs but failed every Grok LLM Canvas Run before an upstream request. The task model belonged to an enabled `aicopy` Provider configured for OpenAI-compatible chat.

## Root Cause

`executeChatTask` normalized the `aicopy` protocol but excluded it from its allowed protocol list. The ordinary Provider chat proxy already treats this path as OpenAI-compatible, so the catalog/control-plane configuration and Worker execution contract disagreed.

## Change

- Added `aicopy` to the Worker Chat Adapter's OpenAI-compatible protocol allowlist.
- Extended the Worker Adapter contract to assert that `executeChatTask` retains this support.
- Updated the Worker execution-chain system record with the supported Chat protocol boundary.

## Verification

- Run Worker type-check and `verify:worker-adapter-contract`.
- Rebuild and redeploy the same Gray `v0.7.19` release only after the focused checks pass.
- Repeat the Grok Canvas Run and floating Assistant pressure checks with no change to Production.

## Scope And Rollback

This change only enables the existing OpenAI-compatible request path for an already supported normalized protocol. It does not alter provider credentials, model settings, task ownership, queue limits, or generation adapters. Reverting the single allowlist entry restores the prior rejection behavior.
