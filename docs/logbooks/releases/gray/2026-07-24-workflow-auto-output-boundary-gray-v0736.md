# Workflow Automatic Output Boundary Gray v0.7.36

- release: `20260724-workflow-auto-output-boundary-gray-r1-v0736`
- source commit: `f6a1236`
- rollback: `20260724-canvas-resize-materialized-gray-r1-v0735`

## Scope

- Prevents Canvas-generated terminal display Output leaves from invalidating a Workflow Region Run Plan.
- Requires the generated Output ID, generated edge ID, one input and no output before treating the leaf as display-only.
- Retains the explicit Workflow Input/Output boundary rule for all ordinary cross-region connections.

## Boundary

- Gray only. Deployment and actual paid image-workflow validation are pending.
- Production is not restarted, reconfigured or mutated. No GitHub push occurred.
