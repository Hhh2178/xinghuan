# Canvas Sidebar Overflow v0.8.7 Gray Validation

- release: `20260729-canvas-sidebar-overflow-v087-r1`
- environment: `gray`
- target profile: `old-server`
- source commit: `07ecd185e3d2cb2e525b43e0c47977b137f9fddd`
- archive SHA-256: `D1861E80182B184787D9BC71FCF0EB8587A0A390B9F406F95AA0517627D11D93`

## Automated Gates

- The regression test first failed on the sidebar opening tag's `overflow-hidden` utility, then passed after the one-line removal.
- Full Vitest passed with 216 files passed, 1 skipped, 838 tests passed, and 4 skipped.
- `npm --workspace @xinghuan/web run build`, `verify:agent-environment-readiness-contract`, `harness:verify:release`, and `release:gray:prepare` passed.
- Deployment applied 0 migrations and skipped 46 existing migrations.
- Runtime verification confirmed API and Worker active, current release `20260729-canvas-sidebar-overflow-v087-r1`, public/internal `0.8.7 / gray`, and permission `enforced / ready` with zero failures.

## Browser Acceptance

- Viewport: exactly `1920x1080`; document scroll dimensions equal client dimensions.
- A forced reload showed `v0.8.7` and no canvas presentation selector.
- Collapsed rail: `data-expanded=false`, panel opacity `0`, parent overflow `visible`.
- Hover rail: `data-expanded=true`; after the 160ms transition, the 232px panel had opacity `1`, pointer events enabled, and was not clipped outside the 56px rail.
- Keyboard path: with the pointer away, focus moved from `打开画布列表` to `新建画布`; `:focus-within=true`, panel opacity `1`, and the panel remained fully visible.
- React Flow background and MiniMap each rendered once; modern presentation markers counted `0`.
- Existing Image, Video, and LLM nodes used `react-flow__node-image`, `react-flow__node-video`, and `react-flow__node-llm` with the original `t8-node-serial-host` child and no modern attribute.

## Result

- Canvas rollback visual acceptance passed on old-server Gray `v0.8.7`.
- Production, billed canaries, and retention apply were not performed.
