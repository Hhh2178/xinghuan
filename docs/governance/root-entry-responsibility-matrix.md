# Root Entry Responsibility Matrix

## Purpose

This file defines what each root entry is allowed to own. It prevents future agents from copying current state, release evidence, system design, and daily logs into multiple places.

## Entry Rules

| Entry | Primary role | Allowed content | Must link to | Not allowed |
| --- | --- | --- | --- | --- |
| `AGENTS.md` | AI constitution | Safety rules, reading order, collaboration rules, update duties | `docs/INDEX.md`, `docs/governance/`, `docs/systems/harness/` | Long release history, implementation details, duplicated system specs |
| `README.md` | Project overview | One current-state summary, worktree root, navigation links | `docs/INDEX.md`, `ops/current/`, `docs/logbooks/releases/current-release-index.md` | Multiple current-state sections, daily logs, provider internals |
| `CONTEXT.md` | Domain context | Canonical terms, entity boundaries, cross-system invariants | `docs/adr/`, `docs/systems/`, `docs/governance/domain-context-and-adr-standard.md` | Versions, release evidence, implementation detail, unapproved target state |
| `MEMORY.md` | Long-term memory compatibility entry | Stable judgments and links into `docs/memory/` | `docs/memory/README.md`, `docs/memory/current-state.md` | Daily progress, detailed release runbooks |
| `DEVLOG.md` | Legacy log compatibility entry | Log policy and current month links | `docs/logbooks/daily/` | New daily records in root |
| `ops/README.md` | Operations entry | Current gray/production summary and ops links | `ops/current/gray.md`, `ops/current/production.md`, `docs/logbooks/releases/` | Product specs, system design, unrelated historical notes |

## Update Rule

When a current-state fact changes, update its canonical source first. Root entries may only keep a short summary and a link.

When a domain term or invariant changes, update `CONTEXT.md`. When an architectural choice changes, create or supersede an ADR instead of rewriting current-state or system documentation as proposal text.

## Verification

Run:

```bash
npm run verify:documentation-entry-contract
```
