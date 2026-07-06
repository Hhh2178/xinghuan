# Canvas Visual Language

## Product Direction

The canvas is a node-based AIGC creative workspace. It should feel like a precise creative instrument, not a generic management dashboard.

## Layout Principles

- Prioritize node clarity, connection readability, and runtime status visibility.
- Keep node chrome compact but not cramped.
- Prefer adaptive height over hidden internal scroll when parameters are important for execution.
- Keep machine, provider, workflow, and model selectors close to the node region they define.
- Preserve connection readability before decorative density.

## Color And State

- Use neutral dark surfaces for node bodies.
- Use one accent family for active, selected, and running states.
- Use distinct warning and destructive colors for failed, cancelled, and blocked states.
- Avoid making status rely on color alone; pair color with text, icon, or shape.

## Typography

- Node title, subtitle, parameter label, helper text, and runtime text must have distinct sizes and weights.
- Parameter labels should remain readable at normal zoom and should not collapse into icon-only controls.
- Runtime state text should be shorter than configuration text and should not compete with primary inputs.

## Motion

- Motion should explain state changes such as running, completing, failing, expanding, and connecting.
- Avoid decorative motion that reduces canvas performance.
- Long-running states may use subtle progress or pulse treatments, but must not obscure parameters or output ports.
