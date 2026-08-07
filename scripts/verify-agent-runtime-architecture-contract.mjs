import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const files = {
  context: await read("CONTEXT.md"),
  docsIndex: await read("docs/INDEX.md"),
  systems: await read("docs/systems/README.md"),
  systemReadme: await read("docs/systems/agent-runtime/README.md"),
  design: await read("DESIGN.md"),
  canvasRegistry: await read("docs/systems/canvas/frontend-design/visual-component-registry.md"),
  adminRegistry: await read("docs/systems/admin/frontend-design/visual-component-registry.md"),
  adrIndex: await read("docs/adr/README.md"),
  adr: await read("docs/adr/0004-workflow-scoped-deterministic-supervision.md"),
  analyzedSupervisionAdr: await read("docs/adr/0005-agent-analyzed-deterministic-supervision.md"),
  spec: await read("docs/superpowers/specs/2026-07-23-canvas-agent-experience-redesign-requirements.md"),
  plan: await read("docs/superpowers/plans/2026-07-23-canvas-agent-experience-redesign-implementation.md"),
  packageJson: JSON.parse(await read("package.json")),
  migration: await read("apps/api/db/026_canvas_agent_runtime.sql"),
  agentMigration: await read("apps/api/db/027_internal_agent_llm_routing.sql"),
  qualityMigration: await read("apps/api/db/028_artifact_quality_and_recovery.sql"),
  knowledgeMigration: await read("apps/api/db/035_agent_knowledge_snapshots.sql"),
  workerLeaseMigration: await read("apps/api/db/030_canvas_run_worker_leases.sql"),
  recoveryRuntimeMigration: await read("apps/api/db/039_canvas_run_recovery_runtime.sql"),
  candidateSelectorMigration: await read("apps/api/db/040_smart_candidate_selector.sql"),
  executionLayerMigration: await read("apps/api/db/044_canvas_run_execution_layers.sql"),
  compiler: await read("packages/agent-core/src/workflow-compiler.ts"),
  agentAnalysis: await read("packages/agent-core/src/canvas-run-agent-analysis.ts"),
  kernel: await read("packages/agent-core/src/canvas-run-kernel.ts"),
  nodeCapabilities: await read("packages/agent-core/src/node-execution-capabilities.ts"),
  knowledgeCore: await read("packages/agent-core/src/knowledge-snapshot.ts"),
  toolCatalog: await read("packages/agent-core/src/agent-tool-catalog.ts"),
  deterministicRuntime: await read("packages/agent-core/src/deterministic-node-runtime.ts"),
  candidateSelectorCore: await read("packages/agent-core/src/smart-candidate-selector.ts"),
  repository: await read("apps/api/src/canvas-run-repository.ts"),
  service: await read("apps/api/src/canvas-run-service.ts"),
  agentAnalysisService: await read("apps/api/src/canvas-run-agent-analysis-service.ts"),
  modelPreflight: await read("apps/api/src/canvas-run-model-preflight.ts"),
  routes: await read("apps/api/src/canvas-run-routes.ts"),
  candidateSelectionApi: await read("apps/api/src/canvas-run-candidate-selection.ts"),
  orchestrator: await read("apps/api/src/agent-orchestrator.ts"),
  agentRunRepository: await read("apps/api/src/agent-run-repository.ts"),
  knowledgeRepository: await read("apps/api/src/agent-knowledge-snapshot-repository.ts"),
  knowledgeTools: await read("apps/api/src/agent-knowledge-tools.ts"),
  llmRouting: await read("packages/agent-core/src/llm-routing.ts"),
  llmRepository: await read("apps/api/src/llm-routing-repository.ts"),
  toolGateway: await read("apps/api/src/agent-tool-gateway.ts"),
  assistantProtocol: await read("packages/shared/src/assistant-chat.ts"),
  artifactEvaluation: await read("packages/agent-core/src/artifact-evaluation.ts"),
  failureRecovery: await read("packages/agent-core/src/failure-recovery.ts"),
  qualityRepository: await read("apps/api/src/artifact-quality-repository.ts"),
  qualityService: await read("apps/api/src/artifact-quality-service.ts"),
  recoveryService: await read("apps/api/src/generation-recovery-service.ts"),
  workerCoordinator: await read("apps/worker/src/canvas-run-coordinator.ts"),
  workerRecoveryRuntime: await read("apps/worker/src/canvas-run-recovery-runtime.ts"),
  workerRecoveryStore: await read("apps/worker/src/canvas-run-recovery-store.ts"),
  workerCandidateSelector: await read("apps/worker/src/canvas-run-candidate-selector.ts"),
  workerQualityCoordinator: await read("apps/worker/src/canvas-run-quality-coordinator.ts"),
  workerEntry: await read("apps/worker/src/worker.ts"),
  agentRuntimeGates: await read("packages/shared/src/agent-runtime-gates.ts"),
  webApp: await read("apps/web/src/App.tsx"),
  assistantShell: await read("apps/web/src/components/canvas-assistant/CanvasAssistantShell.tsx"),
  supervisionDock: await read("apps/web/src/components/canvas-agent/CanvasSupervisionDock.tsx"),
  runSupervisor: await read("apps/web/src/components/canvas-agent/CanvasRunSupervisor.tsx"),
  supervisionPlanView: await read("apps/web/src/components/canvas-agent/CanvasSupervisionPlanView.tsx"),
  runViewModel: await read("apps/web/src/components/canvas-agent/canvas-run-view-model.ts"),
  nodeRegistry: await read("apps/web/src/config/nodeRegistry.ts"),
  candidateSelectorNode: await read("apps/web/src/components/nodes/SmartCandidateSelectorNode.tsx"),
  candidateSelectionPanel: await read("apps/web/src/components/canvas-agent/CanvasCandidateSelectionPanel.tsx"),
  legacyAssistantRuntime: await readMany([
    "apps/api/src/server.ts",
    "apps/api/src/settings-repository.ts",
    "apps/api/src/admin-assistant-settings-routes.ts",
    "packages/shared/src/assistant-chat.ts",
    "apps/web/src/components/CanvasAssistant.tsx",
    "config/canvas-next.env.example",
    "config/canvas-production.env.example",
  ]),
};

for (const term of ["Canvas Run", "Agent Run", "Assistant Conversation", "Knowledge Snapshot", "Canvas Patch Proposal", "LLM Routing Pool", "Artifact Evaluation"]) {
  assert.match(files.context, new RegExp(term), `CONTEXT.md missing ${term}`);
}

assert.match(files.adr, /\*\*Status:\*\* Accepted/, "Agent Runtime ADR must be Accepted before implementation");
assert.match(files.analyzedSupervisionAdr, /\*\*Status:\*\* Accepted/, "Agent-analyzed supervision ADR must be Accepted");
assert.match(files.analyzedSupervisionAdr, /只能输出并发建议/, "Agent analysis must remain advisory");
assert.match(files.analyzedSupervisionAdr, /deterministic|确定性/i, "deterministic execution must remain authoritative");
assert.match(files.adrIndex, /0004-workflow-scoped-deterministic-supervision/, "ADR index missing current workflow supervision decision");
assert.match(files.adrIndex, /0005-agent-analyzed-deterministic-supervision/, "ADR index missing Agent-analyzed supervision decision");
assert.match(files.docsIndex, /docs\/systems\/agent-runtime\/README\.md/, "docs index missing Agent Runtime system entry");
assert.match(files.systems, /agent-runtime\//, "systems index missing Agent Runtime entry");
assert.match(files.systemReadme, /尚未完成实现/, "system README must keep current implementation distinct from target architecture");
assert.match(files.systemReadme, /XINGHUAN_CANVAS_RUNS_ENABLED=true/, "system README must document the Canvas Run feature gate");
assert.match(files.systemReadme, /`AI 托管` 入口独立控制该面板/, "system README must record the landed product separation");
assert.match(files.design, /AI 入口按任务分离/, "design system must separate assistant and supervision identities");
assert.match(files.canvasRegistry, /CanvasSupervisionTrigger/, "canvas registry must define an independent supervision trigger");
assert.match(files.canvasRegistry, /AssistantMarkdown/, "canvas registry must define the shared safe Markdown renderer");
assert.match(files.adminRegistry, /AdminVersionedConfigEditor/, "admin registry must define structured versioned Agent configuration editing");
assert.match(files.webApp, /xh-topbar-supervision-trigger/, "Canvas top bar must own the independent supervision trigger");
assert.match(files.webApp, /<CanvasSupervisionDock/, "App shell must own supervision visibility");
assert.doesNotMatch(files.assistantShell, /CanvasRunSupervisor|agent-assistant-tabs|penguin:open-run-supervisor/, "floating Assistant must not own supervision UI or events");
assert.match(files.supervisionDock, /useCanvasRunProjection/, "supervision controller must keep the server projection mounted independently");
assert.match(files.nodeRegistry, /type: 'canvas-agent'.*hidden: true/, "legacy canvas-agent node must not remain in the new-node catalog");

for (const table of ["xh_canvas_runs", "xh_canvas_run_steps", "xh_canvas_run_events", "xh_canvas_run_commands", "xh_task_attempts", "xh_agent_approvals"]) {
  assert.match(files.migration, new RegExp(`create table if not exists ${table}`), `Canvas Run migration missing ${table}`);
}
assert.match(files.compiler, /compileCanvasSnapshotRunPlan/, "server compiler must compile persisted canvas snapshots");
assert.match(files.compiler, /deriveExecutionLayers/, "Canvas Run compiler must derive deterministic execution layers");
assert.match(files.compiler, /executionLayer/, "compiled steps must freeze their deterministic execution layer");
assert.match(files.agentAnalysis, /validateCanvasRunAgentAnalysis/, "Agent analysis must pass through a deterministic validator");
assert.match(files.agentAnalysis, /DEPENDENCY_CONFLICT/, "Agent concurrency suggestions must reject dependency and cross-layer conflicts");
assert.match(files.agentAnalysis, /degradedCanvasRunAgentAnalysis/, "Agent analysis must provide deterministic fallback");
assert.match(files.kernel, /resolveRunnableCanvasRunSteps/, "Canvas Run kernel scheduling contract is missing");
assert.match(files.nodeCapabilities, /CANVAS_RUN_NODE_CAPABILITIES/, "node execution capability catalog is missing");
assert.match(files.nodeCapabilities, /buildNodeCapabilityPromptContext/, "node capability catalog must project bounded Agent context");
assert.match(files.nodeCapabilities, /recommendedUpstream/, "node capability catalog must record recommended workflow connections");
assert.match(files.nodeCapabilities, /commonFailureCodes/, "node capability catalog must record recoverable failure categories");
assert.match(files.nodeCapabilities, /connectionRules/, "node capability catalog must record explicit connection rules");
assert.match(files.nodeCapabilities, /usageExamples/, "node capability catalog must record usage examples");
assert.match(files.nodeCapabilities, /alternativeNodeTypes/, "node capability catalog must record alternatives");
assert.match(files.deterministicRuntime, /NATIVE_DETERMINISTIC_NODE_TYPES/, "deterministic server node contract is missing");
assert.match(files.deterministicRuntime, /pick-from-set/, "deterministic single-input binding contract is missing");
assert.match(files.repository, /owner_id = \$2 for share/, "Canvas Run creation must lock owner-scoped canvas revision");
assert.match(files.repository, /event_sequence = event_sequence \+ 1/, "Canvas Run events must use an atomic sequence");
assert.match(files.service, /readOwnedCanvasSnapshot/, "Canvas Run service must compile from owner-scoped persistence");
assert.match(files.service, /effectiveConcurrency/, "Canvas Run creation must freeze validated effective concurrency");
assert.match(files.agentAnalysisService, /sanitizedGraph/, "supervision planning must send only a sanitized graph to the Agent");
assert.doesNotMatch(files.agentAnalysisService.match(/function sanitizedGraph[\s\S]*?\n}/)?.[0] || "", /prompt|executionPayload|apiKey|secret/i, "sanitized planner graph must exclude prompts, execution payloads and secrets");
assert.match(files.agentAnalysisService, /degradedCanvasRunAgentAnalysis/, "Agent analysis failure must degrade without blocking Run creation");
assert.match(files.routes, /idempotencyKey/, "Canvas Run write routes must require idempotency keys");
assert.match(files.workerLeaseMigration, /lease_expires_at/, "Canvas Run Worker steps must use expiring leases");
assert.match(files.workerLeaseMigration, /dispatch_enqueued_at/, "Canvas Run task dispatch must have durable queue acknowledgement");
assert.match(files.workerCoordinator, /for update of s, r skip locked/, "Canvas Run Worker claims must lock both step and Run for multi-instance-safe concurrency enforcement");
assert.match(files.executionLayerMigration, /execution_layer/, "Canvas Run steps must persist execution layers");
assert.match(files.workerCoordinator, /min\(coalesce\(layer_step\.execution_layer, 0\)\)/, "Worker claims must stay within the minimum incomplete execution layer and support legacy rows");
assert.match(files.workerCandidateSelector, /min\(coalesce\(layer_step\.execution_layer, 0\)\)/, "smart candidate claims must stay within the minimum incomplete execution layer");
assert.match(files.workerCoordinator, /canvas_run\.execution_layer_started/, "Worker must emit durable execution-layer start events");
assert.match(files.workerCoordinator, /canvas_run\.execution_layer_completed/, "Worker must emit durable execution-layer completion events");
assert.match(files.workerCoordinator, /taskQueueNameForCapability/, "Canvas Run Worker must reuse capability queues");
assert.match(files.workerCoordinator, /xh_agent_approvals/, "generation model switches requiring approval must enter the approval ledger");
assert.match(files.workerCoordinator, /CANVAS_RUN_MAX_COST/, "Canvas Run Worker must enforce the persisted cost budget");
assert.match(files.workerCoordinator, /executeDeterministicNode/, "Canvas Run Worker must settle supported deterministic nodes without Provider tasks");
assert.match(files.modelPreflight, /resolveCanvasRunPlanModelReferences/, "Canvas Run start must preflight legacy and frozen model records");
assert.match(files.modelPreflight, /CANVAS_RUN_MODEL_AMBIGUOUS/, "legacy model names must fail closed when catalog resolution is ambiguous");
assert.match(files.recoveryRuntimeMigration, /retry_not_before/, "recovery backoff must use dedicated retry timing rather than lease expiry");
assert.match(files.recoveryRuntimeMigration, /recovery_overrides/, "recovery choices must use audited runtime overrides rather than mutate the Run Plan");
assert.match(files.recoveryRuntimeMigration, /rewrite_prompt_for_review/, "the recovery ledger must support governed prompt-review rewrites");
assert.match(files.workerCoordinator, /insert into xh_task_attempts/, "Canvas Run dispatch must write task-attempt ledger rows");
assert.match(files.workerCoordinator, /status = 'retry_wait'/, "Canvas Run retry backoff must have a dedicated step state");
assert.match(files.workerCoordinator, /d\.status not in \('succeeded', 'skipped'\)/, "downstream steps must remain blocked until upstream recovery succeeds");
assert.match(files.workerRecoveryRuntime, /retryExhaustionPolicy === "compatible_fallback"/, "runtime fallback must honor the frozen retry-exhaustion policy");
assert.match(files.workerRecoveryRuntime, /mergeCanvasRunRecoveryOverrides/, "dispatch must overlay audited recovery choices without rewriting the immutable plan");
assert.match(files.workerRecoveryStore, /insert into xh_recovery_decisions/, "Worker recovery must write the Recovery Decision ledger");
assert.match(files.workerRecoveryStore, /p\.role = 'recovery'.*p\.scenario = 'prompt-review-rewrite'/s, "prompt rewrites must use a published governed recovery route");
assert.match(files.workerRecoveryStore, /input_before_snapshot.*input_after_snapshot.*diff_snapshot/s, "prompt rewrite decisions must retain before, after and bounded diff evidence");
assert.match(files.candidateSelectorMigration, /xh_canvas_run_candidate_artifacts/, "candidate selection must use a run-scoped artifact ledger");
assert.match(files.candidateSelectorMigration, /candidate.*selected.*not_selected/s, "candidate ledger must distinguish selected and not-selected artifacts");
assert.match(files.candidateSelectorMigration, /selection_mode.*manual.*ai/s, "selection audit must record manual versus AI mode");
assert.match(files.candidateSelectorMigration, /owner_id, idempotency_key/, "manual selection commands must be idempotent per owner");
assert.match(files.candidateSelectorCore, /resolveSmartCandidateBarrier/, "smart selector must keep an explicit completion barrier");
assert.match(files.candidateSelectorCore, /SMART_CANDIDATE_MEDIA_KIND_MISMATCH/, "smart selector must reject mixed media candidates");
assert.match(files.candidateSelectorCore, /SMART_CANDIDATE_MANUAL_SELECTION_INVALID/, "manual selection must be checked against frozen candidates and Top K");
assert.doesNotMatch(files.deterministicRuntime, /smart-candidate-selector/, "smart selector must remain a governed workflow gate rather than a deterministic picker alias");
assert.match(files.workerCandidateSelector, /for update of s, r skip locked/, "selector initialization must atomically claim the Step and Run");
assert.match(files.workerCandidateSelector, /candidate_context/, "selector initialization must freeze server-owned provenance");
assert.match(files.workerCandidateSelector, /SMART_CANDIDATE_SELECTOR_MEDIA_KIND_MISMATCH/, "selector runtime must match candidates against the frozen media mode");
assert.match(files.workerQualityCoordinator, /variableAlignment.*noteAlignment/s, "AI selection must evaluate variable and user-note alignment");
assert.match(files.workerQualityCoordinator, /status in \('blocked', 'ready'\)/, "selection pruning must not cancel dispatched or running work");
assert.match(files.candidateSelectionApi, /r\.owner_id = \$2.*for update of r, s/s, "manual selection must lock an owner-scoped Run and selector Step");
assert.match(files.candidateSelectionApi, /for update of r, s[\s\S]*idempotency_key = \$2/, "manual replay must be checked after the Run and Step lock");
assert.match(files.candidateSelectionApi, /sameIds\(replaySelectedArtifactIds, requestedArtifactIds\)/, "manual replay must reject a changed selected-artifact set");
assert.match(files.candidateSelectionApi, /selection_mode.*manual/s, "manual overrides must be written to the selection ledger");
assert.match(files.routes, /candidate-selections/, "Canvas Run routes must expose governed candidate read and selection commands");
assert.match(files.candidateSelectorNode, /selectorMediaKind.*selectorMode.*selectorMaximum.*selectorMinimumConfidence/s, "selector node must expose media, mode, Top K and confidence controls");
assert.match(files.candidateSelectorNode, /criteria-text/, "selector node must expose a separate criteria port");
assert.match(files.candidateSelectionPanel, /readCanvasRunCandidateSelections.*selectCanvasRunCandidates/s, "supervision UI must read frozen candidates and submit through the owner-scoped API");
assert.match(files.workerEntry, /readAgentRuntimeProcessGates\(process\.env\)/, "Canvas Run Worker consumer must use the shared process gate reader");
assert.match(files.agentRuntimeGates, /XINGHUAN_CANVAS_RUN_WORKER_ENABLED/, "shared process gate reader must own the Worker environment flag");

for (const table of ["xh_agent_definitions", "xh_agent_runs", "xh_agent_actions", "xh_llm_route_pools", "xh_llm_route_pool_versions", "xh_llm_route_entries", "xh_llm_route_entry_health", "xh_llm_route_decisions"]) {
  assert.match(files.agentMigration, new RegExp(`create table if not exists ${table}`), `internal Agent migration missing ${table}`);
}
assert.match(files.agentMigration, /model_capability_snapshot = 'chat'/, "LLM route entries must be database-constrained to chat models");
assert.match(files.llmRouting, /non_llm_capability/, "LLM router must hard-reject non-LLM capabilities");
assert.match(files.llmRouting, /quality_failure/, "LLM router must separate quality and technical failures");
assert.match(files.llmRepository, /m\.capability = 'chat'/, "LLM repository must join only chat models");
assert.match(files.orchestrator, /validateAgentRoleTask/, "Agent Orchestrator must run bounded role tasks");
assert.match(files.orchestrator, /recordDecision/, "Agent Orchestrator must persist route decisions");
assert.match(files.orchestrator, /messagesWithNodeCapabilities/, "planning roles must receive the maintained node capability context");
assert.match(files.orchestrator, /knowledgeSnapshots\.createSnapshot/, "Agent Orchestrator must lock knowledge before creating a Run");
assert.match(files.orchestrator, /includePublishedDocuments: false/, "new Agent Runs must not ingest retired free-document knowledge");
assert.match(files.orchestrator, /!isRetiredAgentTool\(tool\)/, "new Agent Runs must strip retired free-planning tools from historical publications");
assert.match(files.agentRunRepository, /knowledge_snapshot_id/, "Agent Runs must reference their immutable Knowledge Snapshot");
assert.match(files.repository, /canvas_run\.analysis_started/, "Canvas Run creation must audit analysis start");
assert.match(files.repository, /canvas_run\.analysis_completed/, "Canvas Run creation must audit successful analysis");
assert.match(files.repository, /canvas_run\.analysis_degraded/, "Canvas Run creation must audit deterministic degradation");
assert.match(files.repository, /canvas_run_id = \$1/, "Canvas Run creation must link the planner Agent Run when present");
assert.match(files.knowledgeMigration, /AGENT_KNOWLEDGE_SNAPSHOT_IMMUTABLE/, "Knowledge Snapshots must reject mutation");
assert.match(files.knowledgeRepository, /projectAgentModelCatalog/, "Knowledge repository must build the safe model projection from SQL catalogs");
assert.doesNotMatch(files.knowledgeRepository.match(/select m\.id[\s\S]*?from xh_models m/)?.[0] || "", /base_url|api_key|advanced_config/i, "Agent model projection query must not select Provider secrets");
assert.match(files.knowledgeCore, /collectionAllowlist/, "document retrieval must enforce a collection allowlist before ranking");
for (const tool of ["knowledge.node.get", "knowledge.model.get"]) {
  assert.match(files.toolCatalog, new RegExp(tool.replaceAll(".", "\\.")), `active bounded knowledge tool missing: ${tool}`);
}
for (const tool of ["knowledge.documents.search", "canvas.workflow.inspect", "canvas.workflow.search", "canvas.workflow.validate", "canvas.patch.propose"]) {
  assert.match(files.toolCatalog, new RegExp(tool.replaceAll(".", "\\.")), `retired tool compatibility record missing: ${tool}`);
  assert.match(files.knowledgeTools, new RegExp(tool.replaceAll(".", "\\.")), `retired tool historical implementation missing: ${tool}`);
}
assert.match(files.toolCatalog, /RETIRED_AGENT_TOOL_CATALOG/, "retired tools must be separated from the active publication catalog");
assert.match(files.toolGateway, /authorizeAgentToolCall/, "Tool Gateway must reauthorize every invocation");
assert.match(files.toolGateway, /AGENT_TOOL_CALL_LIMIT_EXCEEDED/, "Tool Gateway must enforce published per-Run call limits");
assert.match(files.toolGateway, /requireCanvasRevision/, "Tool Gateway must honor published revision policy");
assert.match(files.toolGateway, /requireBudget/, "Tool Gateway must honor published budget policy");
assert.match(files.assistantProtocol, /mode: "agent" \| "fallback"/, "assistant protocol must expose internal Agent mode");
assert.match(files.runViewModel, /buildCanvasRunAnalysisView/, "Canvas must project the frozen Agent analysis");
assert.match(files.runViewModel, /canvas_run\.execution_layer_started/, "Canvas must project the active execution layer from audited events");
assert.match(files.runSupervisor, /CanvasSupervisionPlanView analysis=\{analysis\}/, "Canvas supervision must route projected analysis into the Plan workspace");
assert.match(files.supervisionPlanView, /AI 链路分析/, "Canvas supervision must render the Agent analysis visibly");
assert.match(files.supervisionPlanView, /当前执行层/, "Canvas supervision must render live execution-layer progress");
assert.doesNotMatch(files.legacyAssistantRuntime, /\bhermes\b/i, "active assistant runtime must not retain a Hermes dependency");

for (const table of ["xh_artifact_quality_profiles", "xh_artifact_evaluations", "xh_artifact_selections", "xh_recovery_decisions"]) {
  assert.match(files.qualityMigration, new RegExp(`create table if not exists ${table}`), `quality/recovery migration missing ${table}`);
}
assert.match(files.artifactEvaluation, /temporalCoherence/, "video evaluation must include temporal scoring");
assert.match(files.failureRecovery, /retry_same_configuration/, "recovery must start with bounded same-configuration retry");
assert.match(files.failureRecovery, /switch_generation_model/, "recovery must support node-configured generation alternatives");
assert.match(files.qualityRepository, /jsonb_set\(s\.input_binding/, "artifact selection must atomically update downstream input binding");
assert.match(files.qualityService, /readOwnedEvaluations/, "selection must read scores from owner-scoped evaluation records");
assert.match(files.recoveryService, /planSnapshot/, "generation alternatives must come from the immutable Run Plan");
assert.doesNotMatch(files.qualityMigration, /alternative_llm_model/, "generation recovery must not reuse LLM route concepts");

for (const anchor of [
  "参数化工作流上的 AI 托管",
  "工作流变量设计",
  "工作流区域：独立运行边界",
  "智能候选选择器",
  "AI 助手边界",
  "不触碰 Production",
]) {
  assert.match(files.spec, new RegExp(escapeRegex(anchor)), `Agent Runtime spec missing boundary: ${anchor}`);
}

assert.match(files.plan, /旧 Canvas Run、Agent 配置、知识与 proposal 保持历史读取/, "implementation plan must preserve staged runtime migration");
assert.match(files.plan, /Production 不进入本计划的部署或回滚链/, "implementation plan must preserve production authorization boundary");

const scripts = files.packageJson.scripts || {};
assert.equal(
  scripts["verify:agent-runtime-architecture-contract"],
  "node scripts/verify-agent-runtime-architecture-contract.mjs",
  "package.json missing Agent Runtime architecture contract entry",
);
assert.match(
  scripts["harness:verify:project"] || "",
  /verify:agent-runtime-architecture-contract/,
  "project harness must include Agent Runtime architecture contract",
);

console.log(JSON.stringify({ ok: true, contract: "agent-runtime-architecture" }, null, 2));

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

async function readMany(paths) {
  return (await Promise.all(paths.map(read))).join("\n");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
