import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, migrationUpgrade, repository, routes, viewModel, workspace, supervisionWorkspaceNav, assistantWorkspace, api, main, styles, roleEditor, poolEditor, knowledgeEditor, qualityEditor, purposes, assistantSettingsDomain, server] = await Promise.all([
  "apps/api/db/029_agent_governance.sql",
  "apps/api/db/034_agent_definition_description.sql",
  "apps/api/src/agent-governance-repository.ts",
  "apps/api/src/admin-agent-governance-routes.ts",
  "apps/admin/src/admin-view-model.ts",
  "apps/admin/src/admin-agent-governance-workspace.tsx",
  "apps/admin/src/admin-supervision-workspace-nav.tsx",
  "apps/admin/src/admin-assistant-governance-workspace.tsx",
  "apps/admin/src/admin-agent-governance-api.ts",
  "apps/admin/src/main.tsx",
  "apps/admin/src/styles.css",
  "apps/admin/src/admin-agent-role-configuration-editor.tsx",
  "apps/admin/src/admin-agent-pool-editor.tsx",
  "apps/admin/src/admin-agent-knowledge-editor.tsx",
  "apps/admin/src/admin-agent-quality-editor.tsx",
  "apps/admin/src/admin-agent-governance-purpose.ts",
  "apps/api/src/assistant-settings-domain.ts",
  "apps/api/src/server.ts",
].map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")));

for (const table of ["xh_agent_runtime_controls", "xh_agent_knowledge_collections", "xh_agent_knowledge_documents", "xh_agent_knowledge_publications"]) {
  assert.match(migration, new RegExp(`create table if not exists ${table}`), `${table} must be durable`);
}
assert.match(migrationUpgrade, /alter table xh_agent_definitions\s+add column if not exists description text not null default ''/i, "deployed agent definitions must gain governance descriptions");
assert.match(repository, /m\.capability = 'chat'/, "governance writes must reject non-LLM models");
assert.match(repository, /validateLlmPoolVersionForPublication/, "route approval/publication must revalidate stored model capability");
assert.match(repository, /normalizeToolPolicyConstraints/, "tool policy writes must normalize runtime constraints");
assert.match(repository, /set retired_at = now\(\)/, "environment publication must retire the previous projection");
assert.match(repository, /routeLlmCandidates/, "route simulation must reuse the production router");
assert.match(routes, /ACTIVE_AGENT_TOOL_CATALOG/, "new governance writes must use the active code registry");
assert.match(routes, /RETIRED_AGENT_TOOL_CATALOG/, "historical retired tools must remain explicit and readable");
assert.match(routes, /AGENT_KNOWLEDGE_WRITES_RETIRED/, "retired knowledge writes must return an explicit deprecation response");
assert.match(routes, /CANVAS_RUN_NODE_CAPABILITIES/, "node capability endpoint must use the code-owned catalog");
assert.match(routes, /appendAudit/, "governance mutations must use the admin audit ledger");
assert.match(viewModel, /id: "automation"/, "Admin must expose a dedicated Agent operations workspace");
for (const path of ["assistants", "supervision", "activity"]) {
  assert.match(viewModel, new RegExp(`/admin/automation/${path}`), `stable Agent governance deep link is missing: ${path}`);
}
assert.match(viewModel, /legacyAgentRuntimeViewAliases/, "legacy Agent governance deep links must map to the three current task domains");
assert.doesNotMatch(viewModel, /id: "knowledge"[^\n]+path: "\/admin\/automation\/knowledge"/, "retired knowledge CMS must not remain a first-class navigation item");
assert.match(main, /AdminAgentGovernanceWorkspace/, "Admin shell must lazy-load the governance workspace");
assert.match(main, /AdminAssistantGovernanceWorkspace/, "Admin shell must lazy-load the separated assistant governance workspace");
assert.match(api, /\/api\/admin\/agent-runtime/, "Admin client must use the internal governance API");
assert.match(workspace, /图片、视频、音频生成模型不进入该路由池/, "UI must explain the LLM-only boundary");
assert.match(workspace, /EnvironmentBadge/, "environment publication state must be visible");
for (const key of ["overview", "environment", "planner", "routing", "quality", "recovery"]) {
  assert.match(supervisionWorkspaceNav, new RegExp(`key: "${key}"`), `supervision task workspace is missing: ${key}`);
  assert.match(workspace, new RegExp(`navigation\\.active === "${key}"`), `supervision must render only the active ${key} workspace`);
}
assert.match(supervisionWorkspaceNav, /pending: SupervisionWorkspaceKey \| null/, "supervision navigation must retain a pending target while a dirty editor stays mounted");
assert.match(workspace, /放弃并切换/, "dirty supervision navigation must require explicit discard confirmation");
assert.match(workspace, /onDirtyChange/, "supervision editors must report unsaved drafts to the workspace boundary");
assert.doesNotMatch(workspace, /function ModelsView|function PoliciesView/, "supervision governance must not regress to the previous continuous vertical stack");
assert.match(repository, /admin-assistant-planner/, "Backend assistant must have its own bounded definition");
assert.match(assistantWorkspace, /publicationMode="read-only"/, "Assistant environment publications must be visible without inline switching");
assert.match(purposes, /generation-recovery/, "Recovery governance must use the canonical bounded definition");
assert.match(purposes, /artifact-checker/, "Candidate evaluation governance must use the canonical bounded definition");
assert.doesNotMatch(workspace, /createRole\(|RoleSelect|新建角色/, "current MVP must not expose arbitrary internal role creation");
assert.match(workspace, /历史配置/, "retired and non-MVP definitions must remain visible as read-only history");
assert.match(workspace, /purposeRouteTemplates/, "new LLM pools must be created only from bounded purpose templates");
assert.doesNotMatch(workspace, /角色.*<RoleSelect|role:\s*"planner"/, "current MVP must not ask administrators to choose raw runtime roles");
assert.match(styles, /\.agent-split-layout/, "governance workspace must have a stable master-detail layout");
assert.match(styles, /\.supervision-workbench/, "supervision governance must have a bounded task workbench surface");
assert.match(styles, /\.supervision-workspace-surface__content[^}]+overflow:\s*auto/s, "the active supervision workspace must own its content scrolling");
assert.match(styles, /\.assistant-governance-segments/, "assistant governance must have a stable desktop segmented layout");
assert.match(roleEditor, /cloneRoleVersion/, "role editor must copy an immutable version into a draft");
assert.match(roleEditor, /保存为新草稿/, "role editor must save a new draft instead of mutating a version");
assert.match(roleEditor, /diffAgentRuntimeConfiguration/, "role editor must show structured field differences");
assert.match(roleEditor, /onDirtyChange/, "role drafts must report dirty state to workspace navigation");
assert.doesNotMatch(roleEditor, /JSON\.parse|JSON\.stringify|<textarea[^>]+json/i, "role editor must not expose raw JSON editing");
assert.match(poolEditor, /entries\.map/, "LLM pool editor must support multiple model entries");
assert.match(poolEditor, /createPoolVersion/, "LLM pool editor must publish immutable route versions");
assert.match(poolEditor, /onDirtyChange/, "route drafts must report dirty state to workspace navigation");
assert.match(roleEditor, /回滚/, "role lifecycle must make rollback explicit");
assert.match(poolEditor, /回滚/, "route lifecycle must make rollback explicit");
assert.match(qualityEditor, /回滚/, "quality lifecycle must make rollback explicit");
assert.doesNotMatch(workspace, /AdminAgentKnowledgeEditor/, "retired free-document knowledge CMS must not be reachable from the current workspace");
assert.match(knowledgeEditor, /AssistantMarkdown/, "historical knowledge editor remains readable for compatibility evidence");
assert.match(qualityEditor, /thresholds|weights/, "quality editor must expose structured scoring thresholds and weights");
assert.match(qualityEditor, /onDirtyChange/, "quality drafts must report dirty state to workspace navigation");
for (const editor of [roleEditor, poolEditor, qualityEditor]) {
  assert.match(editor, /agent-version-history/, "active configuration and version history must remain visually separated");
}
assert.match(workspace, /agent-success-banner/, "governance mutations must expose success feedback");
assert.match(assistantSettingsDomain, /frontendAssistantAgentKey/, "frontend assistant must have a scoped definition key");
assert.match(assistantSettingsDomain, /backendAssistantAgentKey/, "backend assistant must have a scoped definition key");
assert.match(server, /assistantAgentKeyForScope\(settings, input\.scope\)/, "assistant runs must resolve the definition by request scope");

console.log("PASS Agent governance persistence, API, deep links, LLM-only boundary and UI contract");
