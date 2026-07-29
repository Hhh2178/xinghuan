# Canvas Modern Presentation QA

Date: 2026-07-29  
Scope: `feature/canvas-agent-runtime`, Modern Canvas opt-in visual presentation.  
Release boundary: no Gray or Production deployment is authorized by this record.

## Automated evidence

| Check | Result |
| --- | --- |
| Presentation store fallback and per-user isolation | Pass |
| Presentation toggle accessibility markup | Pass |
| Modern sidebar overlay / CSS scope contract | Pass |
| Canvas runtime / Background / MiniMap preservation contract | Pass |
| Node presentation and material-origin contract | Pass |
| Image / Video / LLM existing upstream material hook preservation | Pass |
| Web TypeScript check | Pass |

## Desktop manual acceptance checklist (1920×1080)

The following requires an authenticated non-production or Gray browser session and is intentionally not marked passed by static tests.

- [ ] A user without a stored preference opens Legacy Canvas by default.
- [ ] The topbar switch selects Modern Canvas, survives refresh for that same user, and leaves another user's preference unchanged.
- [ ] Switching mode preserves the current canvas, viewport, selection, undo history, active generation cards and live task updates.
- [ ] In Modern Canvas, the 56px left icon rail expands on hover and keyboard focus; its 232px panel overlays the canvas rather than shifting nodes.
- [ ] The background dot grid is visibly stronger while nodes and selected edges remain clear.
- [ ] MiniMap remains visible, pannable and zoomable in an empty canvas and a dense canvas; it does not overlap the default Assistant launcher.
- [ ] Image node: model/provider, prompt, reference materials, local removal, upstream exclusion/recovery, ordering, active/success/error runtime cards remain usable.
- [ ] Video node: model/provider, first-frame/reference materials, key parameters, active/success/error runtime cards remain usable.
- [ ] LLM node: model/provider, system/user input, upstream text/image/video context, active/success/error cards remain usable.
- [ ] Long Chinese/English model, provider and error text stays within its node without covering buttons, material thumbnails or handles.

## Notes

- Existing material arrays, ordering, remove, upstream exclusion and restore callbacks are unchanged; Modern Canvas only introduces data attributes and scoped visual styles.
- Provider submission, task polling, retry/cancel, persistence and output delivery are outside this visual change and must not be altered by its verification.
