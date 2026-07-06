# Node Design Standard

## Required Node Regions

1. Header: icon, node name, workflow/model selector, status.
2. Body: parameter groups, mapped inputs, helper text.
3. Runtime: queue/running/success/failure state.
4. Output: one normal generation output port unless the system contract explicitly requires more.

## Geometry

- Nodes use adaptive height.
- Internal scroll is not the default solution for long parameter lists.
- Ports must align to stable connection positions.
- Header controls should not push ports out of predictable positions.
- Parameter-heavy nodes should use grouping, progressive disclosure, or external edit panels before using internal scroll.

## Header

- The icon, node title, selector, and runtime status must align on one visual axis.
- If workflow or model choice defines the node behavior, the selector belongs in the header region.
- If workflows belong to machine instances, machine selection must appear before workflow selection.

## Parameter Rows

- Labels align consistently.
- Required fields are explicit.
- Defaults are visible.
- Hidden fields must be controlled by backend exposure rules or node configuration.
- Parameter rows should preserve user input when validation fails.

## Runtime State

- Running, queued, failed, cancelled, and complete states must share one consistent visual grammar.
- Failure text must be actionable and should point to retry, settings, permission, or provider status when possible.
- Runtime diagnostics belong in an expandable detail surface, not as extra primary controls.

## Output Rules

- Generation-style nodes should expose one normal output port by default.
- Extra diagnostic output belongs in details panels, not extra ports, unless a workflow contract requires it.
- Output preview and output connection controls must not compete for the same visual location.
