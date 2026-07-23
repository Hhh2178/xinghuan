# Canvas Agent Experience Phase 1 Retirement Validation

## Scope

- Baseline: Gray v0.7.19 audit, current branch checkpoint after v0.7.20 governance.
- Change: retire free planning tools, free-document knowledge writes, canvas-manager bootstrap and eleven-page Admin product surface from all new runtime paths.
- Compatibility: keep migrations, historical records, historical Knowledge Snapshots, GET reads and retired tool names.
- Safety: no GitHub push, no Gray deployment, no Production mutation.

## Behavior Evidence

- New runtime configuration rejects `canvas.patch.propose` and the other retired catalog entries with `AGENT_CONFIGURATION_TOOL_RETIRED`.
- Historical configuration reads preserve retired names, while Agent Orchestrator removes them before task validation and Run snapshot creation.
- New Knowledge Snapshot calls pass `includePublishedDocuments: false` and an empty collection allowlist.
- Knowledge collection/document/status/publication writes return HTTP 410 with `AGENT_KNOWLEDGE_WRITES_RETIRED`; repository mutations are not called.
- Admin exposes `controls`, `models`, `policies`, and `activity`; old eleven-page paths resolve to one of these domains.

## Verification

- Focused Vitest: 8 files, 37 tests passed.
- `npm run build -w @xinghuan/agent-core`: passed.
- `npm run build -w @xinghuan/api`: passed.
- `npm run build -w @xinghuan/admin`: passed.
- `npm run verify:agent-runtime-architecture-contract`: passed against ADR 0004.
- `npm run verify:agent-governance-contract`: passed.
- `npm run verify:admin-view-model-contract`: passed, including legacy route adapters.
- `npm run verify:file-hotspot-budgets`: passed.
- `git diff --check`: passed.

## Remaining

- Phase 2 workflow variables and all later Workflow Region, supervision, selector, assistant visual, full Harness and Gray runtime verification remain pending.
- Production remains out of scope and was not contacted during this phase.
