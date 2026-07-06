# Canvas Frontend Design

This directory is the canonical long-term design standard for the canvas-side product UI.

## Reading Order

1. `canvas-visual-language.md`
2. `node-design-standard.md`
3. `interaction-and-overlay-standard.md`
4. `component-usage-policy.md`
5. `verification-checklist.md`

## Scope

This standard applies to canvas nodes, ports, overlays, context menus, workflow selectors, parameter editors, output displays, runtime states, and canvas-side reusable UI.

## Boundary

Canvas UI should not inherit a full admin component library visual language. Use `@xinghuan/ui` as the project design-system layer and add low-level accessible primitives only when they can be themed into the canvas visual language.
