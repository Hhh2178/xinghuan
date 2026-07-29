# Canvas Sidebar Overflow v0.8.7 Gray

- release: `20260729-canvas-sidebar-overflow-v087-r1`
- version: `0.8.7`
- source branch: `release/canvas-sidebar-overflow-v087`
- source commit: `07ecd185e3d2cb2e525b43e0c47977b137f9fddd`
- archive SHA-256: `D1861E80182B184787D9BC71FCF0EB8587A0A390B9F406F95AA0517627D11D93`
- target: `old-server` / Gray
- rollback: `20260729-canvas-reset-v086-r1`
- retention apply: `false`

## Scope

- Remove the remaining `overflow-hidden` utility from the unconditional 56px canvas sidebar rail.
- Preserve the existing hover/focus state machine, four rail actions, 232px overlay panel, canvas nodes, materials, tasks, APIs, and persistence behavior.
- Add a focused regression contract that prevents the sidebar opening tag from reintroducing the clipping utility.

## Verification

- Full Vitest: 217 files total, 216 passed and 1 skipped; 842 tests total, 838 passed and 4 skipped.
- Focused sidebar contract, Web build, single-port build, agent environment readiness, and release harness passed.
- Old-server Gray API and Worker are active; public/internal status report `0.8.7 / gray`.
- Permission readiness is `enforced / ready`: 132 subjects, 125 published, 932 rules, 5 principals, and 0 failures.
- Browser acceptance at `1920x1080` passed after a forced reload: selector absent, hover and keyboard focus both expose the complete 232px panel, original background/MiniMap render, Image/Video/LLM use their original node hosts, modern markers are absent, and the document has no page-level overflow.

## Known Warning

- Package installation reported 6 high-severity audit findings. No dependency upgrade or forced audit rewrite was included in this narrow rollback patch.

## Not Performed

- No billed Agent or Provider canary.
- No Production deployment.
- No retention apply.
