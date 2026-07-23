# Canvas Agent Runtime Phase 11 Knowledge Snapshot Validation

## Scope

- Branch: `feature/canvas-agent-runtime`
- Candidate/runtime baseline: `v0.7.19`
- Target: local code, migration contracts and runtime assembly
- Gray: not deployed, queried or mutated in Phase 11
- Production: not opened, queried, deployed or changed

## Authority And Persistence

- `node-execution-capabilities.ts` remains the single code authority for node facts. Every entry now has ports/cardinality, explicit connection rules, usage examples, alternatives, failure codes and allowed Agent actions.
- `knowledge-snapshot.ts` owns deterministic safe model projection, exact model queries, bounded document retrieval, snapshot canonicalization, workflow validation and patch previews.
- Migration `035_agent_knowledge_snapshots.sql` creates owner/environment/audience-scoped immutable snapshots and adds `knowledge_snapshot_id` to Agent Runs. A database trigger rejects snapshot update/delete.
- Snapshot JSON locks node catalog version/hash/projection, model catalog revision/hash/projection, approved active document publications including historical body/hash, and controlled workflow-template references.
- The model catalog SQL projection does not select Provider base URL, API key or advanced configuration.

## Runtime Behavior

- Agent Orchestrator creates or reuses a Knowledge Snapshot before creating a new Agent Run.
- Agent Run insertion requires the snapshot ID; idempotent replay keeps the original Run and original snapshot even if catalogs later change.
- Assistant knowledge no longer reads current publications directly into the prompt. It retrieves only from the locked Run snapshot with fixed collection allowlist, audience, environment, topK and token budget, and emits stable `knowledge://...` citations.
- Published documents may later retire without changing the body available to historical Runs. Runtime repository scanning and arbitrary filesystem retrieval do not exist.

## Tool And Proposal Boundary

- Fixed tool catalog entries exist for exact node/model reads, safe model filtering, bounded document retrieval, and workflow inspect/search/validate.
- Tool implementations re-read snapshots by `owner_id` and reject audience/environment mismatches.
- Caller payloads cannot widen document collection allowlist, topK or token budget.
- `canvas.patch.propose` validates operation shapes and returns before/after/validation evidence. It remains `approvalRequired: true` and never applies a structural edit automatically.

## Verification Evidence

- Phase 11 focused tests: 7 files / 16 tests passed.
- Knowledge and workflow tool tests: 2 tests passed.
- Full Vitest: 113 files passed, 1 skipped; 398 tests passed, 4 skipped.
- All workspace type checks passed.
- Full monorepo production build passed.
- Agent Runtime architecture contract passed with new migration, snapshot, secret-exclusion and tool assertions.
- File hotspot budgets and `git diff --check` passed.
- CodeGraph impact kept the new pure domain -> API repository/orchestrator direction; no Web/Admin/Worker reverse dependency was introduced.

The final `npm run harness:verify:project` passed in `58.2s`, including documentation/ADR, Agent architecture, governance, all workspace type checks, API build, hotspot, dependency-security, package-export and quick-acceptance gates.

Phase 11 is complete. Phase 12 is limited to the structured Admin editing, version lifecycle and runtime-effective published configuration chain; Gray remains deferred to Phase 14.
