import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, migrationUpgrade, repository, routes, viewModel, workspace, api, main, styles] = await Promise.all([
  "apps/api/db/029_agent_governance.sql",
  "apps/api/db/034_agent_definition_description.sql",
  "apps/api/src/agent-governance-repository.ts",
  "apps/api/src/admin-agent-governance-routes.ts",
  "apps/admin/src/admin-view-model.ts",
  "apps/admin/src/admin-agent-governance-workspace.tsx",
  "apps/admin/src/admin-agent-governance-api.ts",
  "apps/admin/src/main.tsx",
  "apps/admin/src/styles.css",
].map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")));

for (const table of ["xh_agent_runtime_controls", "xh_agent_knowledge_collections", "xh_agent_knowledge_documents", "xh_agent_knowledge_publications"]) {
  assert.match(migration, new RegExp(`create table if not exists ${table}`), `${table} must be durable`);
}
assert.match(migrationUpgrade, /alter table xh_agent_definitions\s+add column if not exists description text not null default ''/i, "deployed agent definitions must gain governance descriptions");
assert.match(repository, /m\.capability = 'chat'/, "governance writes must reject non-LLM models");
assert.match(repository, /set retired_at = now\(\)/, "environment publication must retire the previous projection");
assert.match(repository, /routeLlmCandidates/, "route simulation must reuse the production router");
assert.match(routes, /AGENT_TOOL_CATALOG/, "tools must come from the fixed code registry");
assert.match(routes, /CANVAS_RUN_NODE_CAPABILITIES/, "node capability endpoint must use the code-owned catalog");
assert.match(routes, /appendAudit/, "governance mutations must use the admin audit ledger");
assert.match(viewModel, /id: "automation"/, "Admin must expose a dedicated Agent operations workspace");
for (const path of ["overview", "roles", "llm-routes", "tools", "nodes", "knowledge", "quality", "recovery", "runs", "approvals", "audit"]) {
  assert.match(viewModel, new RegExp(`/admin/automation/${path}`), `stable Agent governance deep link is missing: ${path}`);
}
assert.match(main, /AdminAgentGovernanceWorkspace/, "Admin shell must lazy-load the governance workspace");
assert.match(api, /\/api\/admin\/agent-runtime/, "Admin client must use the internal governance API");
assert.match(workspace, /图片、视频、音频生成模型不进入该路由池/, "UI must explain the LLM-only boundary");
assert.match(workspace, /recommendedUpstream/, "node governance UI must expose maintained connection guidance");
assert.match(workspace, /EnvironmentBadge/, "environment publication state must be visible");
assert.match(styles, /\.agent-split-layout/, "governance workspace must have a stable master-detail layout");
assert.match(styles, /@media \(max-width: 820px\)/, "governance workspace must have a narrow viewport layout");

console.log("PASS Agent governance persistence, API, deep links, LLM-only boundary and UI contract");
