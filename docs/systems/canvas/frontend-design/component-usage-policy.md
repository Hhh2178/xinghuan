# Canvas Component Usage Policy

## Primary Layer

Use `@xinghuan/ui` for canvas-side reusable UI.

## Allowed Low-Level Patterns

Radix-style primitives may be used for accessible Dialog, Popover, Tooltip, Select, and Context Menu behavior when wrapped in project components.

## shadcn-style Usage

shadcn-style components may be copied or adapted into `@xinghuan/ui` only when they are themed and owned by this repository.

## Node Component Ownership

- Node shell, title, status chip, parameter row, section header, runtime panel, and output preview should become project-owned components.
- Node-specific UI may extend shared parts, but should not fork base interaction rules.
- New provider nodes should document any visual exception in this directory or in the relevant system docs.

## Not Allowed

- Do not place raw Ant Design or MUI controls inside canvas nodes.
- Do not create one-off node controls when an existing project component can be extended.
- Do not hide required execution parameters behind default internal scroll areas.
- Do not use admin-only table/form visual language as the default canvas node language.
