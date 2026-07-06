# Admin Form Table Drawer Standard

## Tables

- Tables need clear empty, loading, error, and pagination states.
- Batch actions must show permission and selection state.
- High-risk fields should not be hidden only inside horizontal scroll.
- Row actions should separate inspect, edit, disable, delete, and retry intent.

## Forms

- Labels, help text, required markers, errors, and save states must be visually consistent.
- Permission-disabled fields should remain readable and explain why editing is unavailable.
- Save actions must make pending, success, failure, and conflict states clear.

## Drawers

- Drawers are preferred for inspect/edit flows that should preserve table context.
- Destructive actions inside drawers require confirmation.
- Drawer titles should name the entity and current mode: inspect, edit, create, or audit.

## Modals

- Modals are reserved for confirmation, short creation flows, or blocking decisions.
- Long configuration forms should use pages or drawers instead of tall modals.
