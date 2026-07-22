import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const files = {
  context: await read("CONTEXT.md"),
  docsIndex: await read("docs/INDEX.md"),
  systems: await read("docs/systems/README.md"),
  systemReadme: await read("docs/systems/agent-runtime/README.md"),
  adrIndex: await read("docs/adr/README.md"),
  adr: await read("docs/adr/0003-canvas-agent-runtime-and-llm-routing.md"),
  spec: await read("docs/superpowers/specs/2026-07-22-canvas-agent-runtime-and-llm-routing.md"),
  plan: await read("docs/superpowers/plans/2026-07-22-canvas-agent-runtime-and-llm-routing-implementation.md"),
  packageJson: JSON.parse(await read("package.json")),
  migration: await read("apps/api/db/026_canvas_agent_runtime.sql"),
  agentMigration: await read("apps/api/db/027_internal_agent_llm_routing.sql"),
  qualityMigration: await read("apps/api/db/028_artifact_quality_and_recovery.sql"),
  workerLeaseMigration: await read("apps/api/db/030_canvas_run_worker_leases.sql"),
  compiler: await read("packages/agent-core/src/workflow-compiler.ts"),
  kernel: await read("packages/agent-core/src/canvas-run-kernel.ts"),
  nodeCapabilities: await read("packages/agent-core/src/node-execution-capabilities.ts"),
  deterministicRuntime: await read("packages/agent-core/src/deterministic-node-runtime.ts"),
  repository: await read("apps/api/src/canvas-run-repository.ts"),
  service: await read("apps/api/src/canvas-run-service.ts"),
  routes: await read("apps/api/src/canvas-run-routes.ts"),
  orchestrator: await read("apps/api/src/agent-orchestrator.ts"),
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
  workerEntry: await read("apps/worker/src/worker.ts"),
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

for (const term of ["Canvas Run", "Agent Run", "LLM Routing Pool", "Artifact Evaluation"]) {
  assert.match(files.context, new RegExp(term), `CONTEXT.md missing ${term}`);
}

assert.match(files.adr, /\*\*Status:\*\* Accepted/, "Agent Runtime ADR must be Accepted before implementation");
assert.match(files.adrIndex, /0003-canvas-agent-runtime-and-llm-routing/, "ADR index missing Agent Runtime decision");
assert.match(files.docsIndex, /docs\/systems\/agent-runtime\/README\.md/, "docs index missing Agent Runtime system entry");
assert.match(files.systems, /agent-runtime\//, "systems index missing Agent Runtime entry");
assert.match(files.systemReadme, /尚未完成实现/, "system README must keep current implementation distinct from target architecture");
assert.match(files.systemReadme, /XINGHUAN_CANVAS_RUNS_ENABLED=true/, "system README must document the Canvas Run feature gate");

for (const table of ["xh_canvas_runs", "xh_canvas_run_steps", "xh_canvas_run_events", "xh_canvas_run_commands", "xh_task_attempts", "xh_agent_approvals"]) {
  assert.match(files.migration, new RegExp(`create table if not exists ${table}`), `Canvas Run migration missing ${table}`);
}
assert.match(files.compiler, /compileCanvasSnapshotRunPlan/, "server compiler must compile persisted canvas snapshots");
assert.match(files.kernel, /resolveRunnableCanvasRunSteps/, "Canvas Run kernel scheduling contract is missing");
assert.match(files.nodeCapabilities, /CANVAS_RUN_NODE_CAPABILITIES/, "node execution capability catalog is missing");
assert.match(files.nodeCapabilities, /buildNodeCapabilityPromptContext/, "node capability catalog must project bounded Agent context");
assert.match(files.nodeCapabilities, /recommendedUpstream/, "node capability catalog must record recommended workflow connections");
assert.match(files.nodeCapabilities, /commonFailureCodes/, "node capability catalog must record recoverable failure categories");
assert.match(files.deterministicRuntime, /NATIVE_DETERMINISTIC_NODE_TYPES/, "deterministic server node contract is missing");
assert.match(files.deterministicRuntime, /pick-from-set/, "deterministic single-input binding contract is missing");
assert.match(files.repository, /owner_id = \$2 for share/, "Canvas Run creation must lock owner-scoped canvas revision");
assert.match(files.repository, /event_sequence = event_sequence \+ 1/, "Canvas Run events must use an atomic sequence");
assert.match(files.service, /readOwnedCanvasSnapshot/, "Canvas Run service must compile from owner-scoped persistence");
assert.match(files.routes, /idempotencyKey/, "Canvas Run write routes must require idempotency keys");
assert.match(files.workerLeaseMigration, /lease_expires_at/, "Canvas Run Worker steps must use expiring leases");
assert.match(files.workerLeaseMigration, /dispatch_enqueued_at/, "Canvas Run task dispatch must have durable queue acknowledgement");
assert.match(files.workerCoordinator, /for update of s skip locked/, "Canvas Run Worker claims must be multi-instance safe");
assert.match(files.workerCoordinator, /taskQueueNameForCapability/, "Canvas Run Worker must reuse capability queues");
assert.match(files.workerCoordinator, /xh_agent_approvals/, "generation model switches requiring approval must enter the approval ledger");
assert.match(files.workerCoordinator, /CANVAS_RUN_MAX_COST/, "Canvas Run Worker must enforce the persisted cost budget");
assert.match(files.workerCoordinator, /executeDeterministicNode/, "Canvas Run Worker must settle supported deterministic nodes without Provider tasks");
assert.match(files.workerEntry, /XINGHUAN_CANVAS_RUN_WORKER_ENABLED/, "Canvas Run Worker consumer must have an explicit environment gate");

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
assert.match(files.toolGateway, /authorizeAgentToolCall/, "Tool Gateway must reauthorize every invocation");
assert.match(files.assistantProtocol, /mode: "agent" \| "fallback"/, "assistant protocol must expose internal Agent mode");
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
  "Workflow Compiler",
  "Canvas Run Kernel",
  "Agent Orchestrator",
  "Tool Gateway",
  "LLM Routing Pool",
  "只用于 Agent 的 LLM 角色",
  "不管理图片、视频或音频生成模型",
  "proposal + approval",
]) {
  assert.match(files.spec, new RegExp(escapeRegex(anchor)), `Agent Runtime spec missing boundary: ${anchor}`);
}

assert.match(files.plan, /legacy browser runtime 与新内核并行/, "implementation plan must preserve staged runtime migration");
assert.match(files.plan, /Production 需要用户单独授权/, "implementation plan must preserve production authorization boundary");

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
