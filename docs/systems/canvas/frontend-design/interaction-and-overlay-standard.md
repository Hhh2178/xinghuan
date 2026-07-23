# Interaction And Overlay Standard

## Context Menu

- Context menu actions must be grouped by intent.
- Save to library and publish to public library actions must show permission state.
- Destructive actions must be separated from routine actions.
- Permission-gated actions should remain visible when useful, but disabled with a clear reason.
- Pointer menus should prefer opening to the cursor's right, flip left when horizontal space is insufficient, and clamp their measured height inside a 12 px viewport inset.
- Menus taller than the available viewport must keep their header and actions reachable through internal vertical scrolling; fixed height estimates are not an acceptable positioning contract.

## Selectors

- Workflow or provider selectors should live in the node header area when they define the node's core behavior.
- Machine-first selection is required when workflows belong to machine instances.
- Selectors should show loading, empty, unavailable, and permission-denied states.

## Dialogs And Popovers

- Dialogs handle destructive, multi-step, or permission-sensitive actions.
- Popovers handle lightweight selection and inspection.
- Long forms should use a dialog or side panel rather than expanding a node into an unreadable block.
- Canvas pointer overlays should reuse `ViewportFloatingPanel` so context and quick-add menus share one measured viewport-boundary implementation.

## Assistant And Supervision Overlays

- Desktop Assistant launchers snap to a safe viewport edge and keep the workbench outside a stable launcher gap; persisted offsets may move the panel away from the launcher but must never overlap it.
- Native panel resize must persist the untransformed border-box size. Responsive viewport clamps are temporary and must not overwrite the user's preferred desktop size.
- Assistant and Supervision avoidance uses measured rectangles. Fixed guessed offsets are not an acceptable geometry contract.
- At `900px` and below, Assistant and Supervision use one controlled near-full-viewport drawer and are mutually exclusive. The active drawer must own the top overlay stacking context so its header controls remain reachable.
- At narrow widths, the node Sidebar becomes an off-canvas drawer and the top bar uses icon commands; closing the Sidebar must restore the full Canvas width without horizontal overflow.

## Error States

- Errors must show actionable text and preserve user input.
- Provider, permission, validation, and network errors should use distinct copy.
- Retry actions must not hide the original failed state until a new run starts.

## Keyboard And Pointer Behavior

- Canvas panning, node dragging, text selection, and menu interaction must not fight each other.
- Inputs inside nodes must preserve normal keyboard editing behavior.
- Context menus and popovers must close predictably on escape, outside click, or selection.
