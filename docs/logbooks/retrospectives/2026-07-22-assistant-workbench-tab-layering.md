# Assistant Workbench Tab Layering

## Context

During Gray UI acceptance, the floating assistant correctly returned an Agent answer after receiving the current-workflow context. The conversation scroller then intercepted pointer events for the `托管` tab, so users could no longer switch from analysis to Canvas Run supervision.

## Root Cause

The workbench placed the context strip and conversation in the same grid row and pulled the conversation upward with a negative margin. Once messages existed, that overlap extended across the tab bar.

## Adjustment

The workbench now has separate grid rows for header, tabs, context strip, conversation and composer. The supervisor spans the lower three content rows. The negative-margin overlap is removed, so the tab navigation remains independently clickable regardless of message volume.

## Verification

- Rebuild the Gray Web bundle under the existing `v0.7.19` release ID.
- Repeat authenticated desktop, narrow-desktop and mobile acceptance, including switching from a completed collaboration response to the supervision tab.

## Scope And Rollback

This is a CSS grid-layout repair only. It does not change assistant prompts, Canvas Run state, SSE, task execution, Provider/model selection or permissions. Reverting the row assignments restores the prior visual layout and its interaction defect.
