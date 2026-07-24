# Canvas Workflow Membership Connection Repair

## Goal

Repair the Canvas case where a compatible node rendered inside a Workflow Region is absent from that workflow's `memberNodeIds`, causing a valid user connection to fail without explanation.

## Observed Fixture

The user-provided export contains one Workflow Region. `task-image-0` is a member, while `smart-candidate-selector-1784865872270-3yd6` is visually inside its region but is not a member. Both ports accept `image`; the current boundary guard rejects the connection because the selector is unowned.

## Decision

For an otherwise type-compatible connection, if exactly one endpoint is a member of a workflow and the other endpoint is wholly inside that workflow's visible region, Canvas will add the unowned endpoint to the workflow and create the edge as one user action. This increments that workflow revision once.

The repair does not infer membership for nodes outside the visible region, nodes already owned by another workflow, or invalid Workflow Input/Output directions. Those remain blocked by the existing boundary rules.

## Compatibility

Existing workflow membership and edges are unchanged on load. The new rule only applies to a new interactive connection. The resulting edge is internal to the workflow and therefore participates in the normal Workflow Run snapshot and compiler graph.

## Verification

- A focused unit test reproduces the exported image-to-selector membership drift.
- The test confirms that an outside node remains blocked and that existing members remain direct.
- Canvas type checking, focused web tests, relevant project Harness, and a local PC interaction check run before the local commit.
