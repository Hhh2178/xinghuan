# Canvas Agent Governance Gray v0.7.20

- release: `20260723-canvas-agent-governance-gray-r1-v0720`
- source commit: `e9cf21256e7ed2838109750cdea098b637d38425`
- archive: `20260723-canvas-agent-governance-gray-r1-v0720.tar.gz`
- rollback: `20260722-canvas-agent-runtime-gray-r1-v0719`

## Scope

- Separates the floating assistant from the independent Canvas supervision panel and keeps server-owned Run projection alive while either surface is closed.
- Adds safe GFM rendering and streaming reasoning isolation shared by Canvas and Admin.
- Adds immutable Knowledge Snapshots backed by the code node catalog, safe model projection, approved documents and controlled workflow references.
- Replaces Admin Agent governance placeholders with structured role, LLM pool, knowledge, quality, recovery and tool policy editors.
- Resolves published Agent configuration into the actual runtime prompt, LLM Pool, knowledge bounds, tools, token/timeout/cost and recovery/approval policy snapshots.
- Adds create/review/publish/runtime `chat` model validation and runtime-enforced platform tool constraints.

## Environment Boundary

- Gray only. Production remains `v0.7.18 / 20260722-canvas-revision-observability-prod-r1-v0718` and must not be restarted or reconfigured.
- GitHub is not pushed.

## Deployment

- Deployed on `2026-07-23` to `/opt/apps/xinghuan-canvas-next/releases/20260723-canvas-agent-governance-gray-r1-v0720`.
- Applied database migration `035_agent_knowledge_snapshots.sql`; the preceding 34 migrations were already present.
- Switched `current` to this release and restarted both `xinghuan-canvas-next.service` and `xinghuan-canvas-next-worker.service`.
- Retained `20260722-canvas-agent-runtime-gray-r1-v0719` as the verified rollback release.
