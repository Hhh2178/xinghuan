# Assistant Current Workflow Context

## Context

Gray authenticated UI acceptance showed that a user could ask the floating assistant to inspect the current canvas, but the request contained no workflow attachment unless the user had manually selected a node and clicked a context card. The API then reduced workflow cards to counts and node types, so group order, topology and model selection were unavailable to the Agent.

## User Impact

The assistant returned a technically honest but unhelpful request for manually copied node and group details. This contradicts the product promise that the Agent can assist with actual canvas workflow production and supervision.

## Adjustment

- The floating assistant now offers and automatically includes a `当前画布` workflow card whenever a canvas is active, unless the user already attached another workflow card.
- The Web projection limits the attachment to 40 nodes and 80 edges and includes only workflow-relevant fields such as group ordering, membership, prompt, model identity, task capability and quality/recovery settings.
- The API replaces count-only workflow summaries with a bounded topology/model projection and independently removes sensitive key-like fields, including nested Provider parameters.

## Verification

- Added a focused API test proving topology and model settings remain available while key/token-like fields are removed.
- API and Web type-checks pass.
- Gray release will be rebuilt under the existing `v0.7.19` release ID and the authenticated assistant acceptance will be repeated.

## Scope And Rollback

This change only enriches the read-only assistant prompt context. It does not alter Canvas Run plans, task execution, Provider selection, model parameters, ownership, routing pools or Agent tool permissions. Reverting the frontend auto-attachment and API summary import restores the previous manual-context behavior.
