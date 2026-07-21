# Canvas Design Verification Checklist

- Node title, icon, selector, body, runtime, and output regions are visually aligned.
- Parameter rows are readable without opening developer tools.
- Required and optional parameters are distinguishable.
- Node height adapts when parameter count increases.
- Connection ports remain stable after parameter expansion.
- Context menu actions show permission-sensitive states.
- Canvas-side UI uses `@xinghuan/ui` or wrapped low-level primitives.
- Admin-only component styling does not leak into canvas nodes.
- Machine-first workflow selection is used when workflows belong to machine instances.
- Errors preserve user input and show actionable next steps.
- Priced generation nodes show a compact top-left cost badge; unpriced/disabled models show neither the badge nor its coin icon.
- Provider/model switching updates the preview immediately, while completed tasks retain their immutable snapshot amount after reload.
