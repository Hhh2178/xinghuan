# Admin Foundation A v0.8.9 Gray Validation

- release: `20260729-admin-foundation-a-v089-r1`
- environment: `gray`
- target profile: `old-server`
- source commit: `97309b0524208913c73936a27cdbdd497e1d55c8`
- archive SHA-256: `68E5D127955780B6A3DD984E501175B0AF8B52B334D41FC7051B794F33E346F8`

## Automated Gates

- The page-identity contract failed before the shared band owned the H1, then passed after the focused shell correction.
- Full Vitest passed with 218 files passed, 1 skipped, 844 tests passed, and 4 skipped.
- Admin/Web builds, single-port build, design contracts, release harness, and Gray prepare passed.
- Deployment applied 0 migrations and skipped 46 existing migrations.
- Runtime verification confirmed current release `20260729-admin-foundation-a-v089-r1`, API/Worker active, public/internal `0.8.9 / gray`, and permission `enforced / ready` with zero failures.

## Browser Acceptance

- Viewport and document dimensions were exactly `1920x1080`; page horizontal and vertical overflow were both false. The scroll owner remained `.admin-main` with `overflow-y: auto`.
- Exactly one H1 rendered (`总览`); topbar H1, legacy workspace focus card, and overview single-page tablist counts were all zero.
- One five-item summary strip rendered at `top=256.59px`, fully inside the first viewport; its computed background used the documented shell gradient.
- Three data panels used computed neutral surface `rgb(13, 26, 42)`; 89 status pills rendered text-backed states for the live dataset.
- Provider URLs, task titles, and model IDs wrapped without overlap. Sidebar, topbar, data tables, main scrollbar, and the open assistant dock remained coherent.
- Screenshot: ignored runtime artifact `output/playwright/admin-foundation-a-v089-gray-overview-1920x1080.png`.

## Result

- Admin A shared foundation and `/admin/overview` pilot passed old-server Gray acceptance.
- Production, billed canaries, and retention apply were not performed.
