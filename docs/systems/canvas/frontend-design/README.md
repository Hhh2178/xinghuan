# Canvas Frontend Design

This directory is the canonical long-term design standard for the canvas-side product UI.

## Reading Order

1. `canvas-visual-language.md`
2. `design-tokens.md`
3. `visual-component-registry.md`
4. `functional-component-registry.md`
5. `node-design-standard.md`
6. `node-composition-patterns.md`
7. `interaction-and-overlay-standard.md`
8. `component-usage-policy.md`
9. `rh-comfyui-deduplication-map.md`
10. `verification-checklist.md`

## Scope

This standard applies to canvas nodes, ports, overlays, context menus, workflow selectors, parameter editors, output displays, runtime states, and canvas-side reusable UI.

## Boundary

Canvas UI should not inherit a full admin component library visual language. Use `@xinghuan/ui` as the project design-system layer and add low-level accessible primitives only when they can be themed into the canvas visual language.

## Component Registry Rule

Future provider, workflow, and generation nodes should check `visual-component-registry.md`, `functional-component-registry.md`, and `node-composition-patterns.md` before implementation. RH and ComfyUI are reference cases only; do not copy their local structures into new nodes.
