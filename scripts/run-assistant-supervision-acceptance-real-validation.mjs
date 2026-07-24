import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { projectCanvasRunFailureDiagnostic } from "../packages/shared/dist/index.js";
import pg from "pg";

const { Client } = pg;
const baseUrl = requiredLoopbackUrl("XINGHUAN_VERIFY_BASE_URL");
const adminEmail = requiredEnvironment("XINGHUAN_VERIFY_ADMIN_EMAIL");
const adminPassword = requiredEnvironment("XINGHUAN_VERIFY_ADMIN_PASSWORD");
const memberEmail = requiredEnvironment("XINGHUAN_VERIFY_MEMBER_EMAIL");
const memberPassword = requiredEnvironment("XINGHUAN_VERIFY_MEMBER_PASSWORD");
const databaseUrl = requiredEnvironment("XINGHUAN_VERIFY_DATABASE_URL");
const failureRunId = requiredEnvironment("XINGHUAN_FAILURE_RUN_ID");
const key = `task8-assistant-${randomUUID()}`;

assert.equal(process.env.XINGHUAN_ALLOW_REAL_ASSISTANT_TEST, "1", "REAL_ASSISTANT_TEST_NOT_EXPLICITLY_ENABLED");
assert.equal(process.env.XINGHUAN_ALLOW_ISOLATED_GRAY_TEST, "1", "ISOLATED_GRAY_TEST_NOT_EXPLICITLY_ENABLED");

const admin = createHttpClient();
const member = createHttpClient();
const database = new Client({ connectionString: databaseUrl });
let freezeCanvasId = "";
let originalSupervisionVersionId = "";
let temporarySupervisionVersionId = "";
let supervisionPublicationSwitched = false;
let supervisionPublicationRestored = false;

await database.connect();
try {
  const status = await member.request("/api/status");
  assert.equal(status.environment, "gray", `GRAY_CANDIDATE_REQUIRED:${status.environment || "unknown"}`);
  assert.equal((await admin.request("/api/auth/login", { method: "POST", body: { email: adminEmail, password: adminPassword } })).authenticated, true, "ADMIN_LOGIN_FAILED");
  assert.equal((await member.request("/api/auth/login", { method: "POST", body: { email: memberEmail, password: memberPassword } })).authenticated, true, "MEMBER_LOGIN_FAILED");

  const forbidden = await member.requestRaw("/api/admin/assistant/chat", {
    method: "POST",
    body: { message: "permission boundary probe", scope: "admin", idempotencyKey: `${key}-forbidden` },
  });
  assert.equal(forbidden.status, 403, `MEMBER_ADMIN_ASSISTANT_NOT_FORBIDDEN:${forbidden.status}`);

  await admin.request("/api/admin/agent-runtime/bootstrap", { method: "POST", body: {} });
  await ensureAgentPublication("assistant-planner", "assistant-diagnosis");
  await ensureAgentPublication("admin-assistant-planner", "admin-assistant-diagnosis");
  await ensureAgentPublication("supervision-planner", "supervision-planning");
  await ensurePoolPublication("assistant-diagnosis");
  await ensurePoolPublication("admin-assistant-diagnosis");
  await ensurePoolPublication("supervision-planning");

  const failureRun = await admin.request(`/api/canvas-runs/${encodeURIComponent(failureRunId)}`);
  const failureEventsResponse = await admin.request(`/api/canvas-runs/${encodeURIComponent(failureRunId)}/events`);
  const failureEvents = Array.isArray(failureEventsResponse.items) ? failureEventsResponse.items : [];
  const failureEvent = [...failureEvents].reverse().find((event) => event.eventType === "canvas_run.step_failed");
  assert(failureEvent, "REAL_FAILURE_EVENT_MISSING");
  const failurePayload = object(failureEvent.payload);
  const plan = object(failureRun.planSnapshot);
  const planSteps = Array.isArray(plan.steps) ? plan.steps : [];
  const failedStepId = text(failureEvent.runStepId || failureEvent.runStepKey || failurePayload.runStepId);
  const failedStep = planSteps.find((step) => text(step.id) === failedStepId) || planSteps.find((step) => text(step.nodeId) === text(failurePayload.nodeId));
  const diagnostic = projectCanvasRunFailureDiagnostic({
    code: failurePayload.code || failurePayload.failureClass,
    eventType: failureEvent.eventType,
    message: failurePayload.message || failurePayload.error,
    reason: failurePayload.reason,
    failureCategory: failurePayload.failureCategory,
    providerDiagnostic: failurePayload.providerDiagnostic,
    waitReason: failurePayload.waitReason,
    runId: failureRunId,
    runStepId: failedStepId,
    nodeId: failedStep?.nodeId,
    nodeType: failedStep?.nodeType,
    providerName: failurePayload.providerName,
    modelName: failurePayload.modelName,
    taskId: failurePayload.taskId,
    requestId: failurePayload.requestId,
    upstreamHttpStatus: failurePayload.upstreamHttpStatus,
  });

  const frontendIdempotencyKey = `${key}-frontend`;
  const frontend = await admin.request("/api/assistant/chat", {
    method: "POST",
    body: {
      scope: "canvas",
      conversationId: `${key}-frontend-conversation`,
      idempotencyKey: frontendIdempotencyKey,
      message: "请分析当前选中的工作流、已经生成的 AI 托管执行计划和真实失败。说明并发与串行顺序，区分事实、可能原因和修复动作；不要建议已经退役的旧 Agent 托管节点。",
      attachments: [
        workflowAttachment(failureRun),
        {
          id: `${key}-plan`,
          kind: "node",
          title: "当前 AI 托管执行计划",
          summary: `Run ${failureRunId} / ${failureRun.status}`,
          payload: {
            source: "canvas_run_plan",
            runId: failureRunId,
            nodeId: failedStep?.nodeId,
            nodeType: failedStep?.nodeType,
            planContext: {
              status: failureRun.status,
              executionLayers: Array.isArray(plan.executionLayers) ? plan.executionLayers : [],
              agentAnalysis: plan.agentAnalysis,
              stepCount: planSteps.length,
            },
          },
        },
        {
          id: `${key}-failure`,
          kind: "node",
          title: "当前 AI 托管失败诊断",
          summary: diagnostic.title,
          payload: {
            source: "canvas_run_error",
            runId: failureRunId,
            nodeId: failedStep?.nodeId,
            nodeType: failedStep?.nodeType,
            diagnostic,
          },
        },
      ],
    },
  });
  const frontendText = assistantText(frontend);
  assert.equal(frontend.mode, "agent", `FRONTEND_ASSISTANT_NOT_AGENT:${frontend.mode || "unknown"}`);
  assert(frontendText.length >= 120, "FRONTEND_ASSISTANT_RESPONSE_TOO_SHORT");
  assert(/并发|串行|执行层|顺序/.test(frontendText), "FRONTEND_ASSISTANT_MISSED_PLAN_ORDER");
  assert(/事实|观察|失败|可能原因/.test(frontendText), "FRONTEND_ASSISTANT_MISSED_FAILURE_ANALYSIS");
  assert(!containsPositiveRetiredNodeAdvice(frontendText), "FRONTEND_ASSISTANT_RECOMMENDED_RETIRED_HOSTING_NODE");

  const frontendRuntime = await readAgentRuntimeEvidence(adminEmail, frontendIdempotencyKey);
  assert.equal(frontendRuntime.agentKey, "assistant-planner", `FRONTEND_AGENT_KEY_INVALID:${frontendRuntime.agentKey}`);
  assert.equal(frontendRuntime.poolKey, "assistant-diagnosis", `FRONTEND_POOL_KEY_INVALID:${frontendRuntime.poolKey}`);

  const backendIdempotencyKey = `${key}-backend`;
  const backend = await admin.request("/api/admin/assistant/chat", {
    method: "POST",
    body: {
      scope: "admin",
      conversationId: `${key}-backend-conversation`,
      idempotencyKey: backendIdempotencyKey,
      message: "请只依据附加的后台任务、Provider 和审计证据，分析这次真实失败，给出事实、可能原因、检查顺序和安全修复建议。",
      attachments: [
        {
          id: `${key}-task`,
          kind: "task",
          title: "失败的生成任务",
          summary: `${diagnostic.technical.code} / ${diagnostic.title}`,
          payload: { id: diagnostic.technical.taskId, taskId: diagnostic.technical.taskId, status: "failed", capability: failedStep?.capability || "image" },
        },
        {
          id: `${key}-provider`,
          kind: "provider",
          title: diagnostic.technical.providerName || "失败渠道",
          summary: diagnostic.observed.upstreamMessage || diagnostic.title,
          payload: { id: failurePayload.providerId, providerId: failurePayload.providerId, status: "failed", capability: failedStep?.capability || "image", protocol: failurePayload.protocol },
        },
        {
          id: `${key}-audit`,
          kind: "audit",
          title: failureEvent.eventType,
          summary: `Canvas Run ${failureRunId} 在步骤 ${failedStepId} 失败`,
          payload: { id: failureEvent.id, auditId: failureEvent.id, action: failureEvent.eventType, targetType: "canvas-run", targetId: failureRunId, status: "failed" },
        },
      ],
    },
  });
  const backendText = assistantText(backend);
  assert.equal(backend.mode, "agent", `BACKEND_ASSISTANT_NOT_AGENT:${backend.mode || "unknown"}`);
  assert(backendText.length >= 120, "BACKEND_ASSISTANT_RESPONSE_TOO_SHORT");
  assert(/任务|Provider|渠道|失败/.test(backendText), "BACKEND_ASSISTANT_MISSED_ADMIN_EVIDENCE");
  assert(/原因|检查|修复|处理/.test(backendText), "BACKEND_ASSISTANT_MISSED_DIAGNOSIS");

  const backendRuntime = await readAgentRuntimeEvidence(adminEmail, backendIdempotencyKey);
  assert.equal(backendRuntime.agentKey, "admin-assistant-planner", `BACKEND_AGENT_KEY_INVALID:${backendRuntime.agentKey}`);
  assert.equal(backendRuntime.poolKey, "admin-assistant-diagnosis", `BACKEND_POOL_KEY_INVALID:${backendRuntime.poolKey}`);
  assert.notEqual(backendRuntime.configurationVersionId, frontendRuntime.configurationVersionId, "ASSISTANT_CONFIGURATION_NOT_SEPARATED");
  assert.notEqual(backendRuntime.poolVersionId, frontendRuntime.poolVersionId, "ASSISTANT_ROUTE_POOL_NOT_SEPARATED");

  const freeze = await verifySupervisionConfigurationFreeze();
  console.log(JSON.stringify({
    ok: true,
    environment: "gray",
    failureRun: {
      runId: failureRunId,
      status: failureRun.status,
      eventCount: failureEvents.length,
      diagnosticCode: diagnostic.technical.code,
      diagnosticCategory: diagnostic.category,
      failedNodeType: failedStep?.nodeType || "",
      taskId: diagnostic.technical.taskId || "",
    },
    frontendAssistant: {
      mode: frontend.mode,
      responseLength: frontendText.length,
      agentRunId: frontendRuntime.agentRunId,
      agentKey: frontendRuntime.agentKey,
      configurationVersionId: frontendRuntime.configurationVersionId,
      poolKey: frontendRuntime.poolKey,
      poolVersionId: frontendRuntime.poolVersionId,
      selectedProviderId: frontendRuntime.selectedProviderId,
      selectedModelId: frontendRuntime.selectedModelId,
      retiredNodeAdviceAbsent: true,
    },
    backendAssistant: {
      mode: backend.mode,
      responseLength: backendText.length,
      agentRunId: backendRuntime.agentRunId,
      agentKey: backendRuntime.agentKey,
      configurationVersionId: backendRuntime.configurationVersionId,
      poolKey: backendRuntime.poolKey,
      poolVersionId: backendRuntime.poolVersionId,
      selectedProviderId: backendRuntime.selectedProviderId,
      selectedModelId: backendRuntime.selectedModelId,
      memberEndpointForbidden: true,
    },
    supervisionConfigurationFreeze: freeze,
  }, null, 2));
} finally {
  if (supervisionPublicationSwitched && originalSupervisionVersionId && !supervisionPublicationRestored) {
    await admin.request(`/api/admin/agent-runtime/agent-configurations/${encodeURIComponent(originalSupervisionVersionId)}/publish`, {
      method: "POST",
      body: { environment: "gray" },
    }).then(() => { supervisionPublicationRestored = true; });
  }
  if (freezeCanvasId) {
    await member.request(`/api/canvas/${encodeURIComponent(freezeCanvasId)}`, { method: "DELETE" }).catch(() => undefined);
  }
  await database.end();
}

async function ensureAgentPublication(agentKey, expectedPoolKey) {
  let roles = await admin.request("/api/admin/agent-runtime/roles");
  let definition = roles.find((item) => item.agentKey === agentKey);
  assert(definition, `AGENT_DEFINITION_MISSING:${agentKey}`);
  let publication = definition.publications?.find((item) => item.environment === "gray");
  let publishedVersion = definition.versions?.find((item) => item.id === publication?.configurationVersionId);
  if (!publication || text(publishedVersion?.configuration?.llmPoolKey) !== expectedPoolKey) {
    const source = publishedVersion || [...(definition.versions || [])].sort((left, right) => right.version - left.version)[0];
    assert(source, `AGENT_VERSION_MISSING:${agentKey}`);
    const version = await admin.request(`/api/admin/agent-runtime/roles/${encodeURIComponent(definition.id)}/versions`, {
      method: "POST",
      body: { configuration: { ...object(source.configuration), llmPoolKey: expectedPoolKey } },
    });
    await approveAndPublish(`/api/admin/agent-runtime/agent-configurations/${encodeURIComponent(version.id)}`, version.status || "draft");
    roles = await admin.request("/api/admin/agent-runtime/roles");
    definition = roles.find((item) => item.agentKey === agentKey);
    publication = definition?.publications?.find((item) => item.environment === "gray");
    publishedVersion = definition?.versions?.find((item) => item.id === publication?.configurationVersionId);
  }
  assert(publication, `AGENT_GRAY_PUBLICATION_MISSING:${agentKey}`);
  assert.equal(text(publishedVersion?.configuration?.llmPoolKey), expectedPoolKey, `AGENT_POOL_KEY_INVALID:${agentKey}`);
  return { definition, publication };
}

async function ensurePoolPublication(poolKey) {
  let pools = await admin.request("/api/admin/agent-runtime/llm-pools");
  let pool = pools.find((item) => item.poolKey === poolKey);
  assert(pool, `LLM_POOL_MISSING:${poolKey}`);
  let version = pool.versions?.find((item) => item.publications?.some((publication) => publication.environment === "gray"));
  if (!version) {
    const donor = pools
      .filter((item) => item.role === "planner" && item.scenario === "assistant-chat")
      .flatMap((item) => item.versions || [])
      .filter((item) => item.publications?.some((publication) => publication.environment === "gray"))
      .sort((left, right) => right.version - left.version)
      .find((item) => item.entries?.some((entry) => entry.enabled));
    assert(donor, `LLM_POOL_DONOR_MISSING:${poolKey}`);
    const created = await admin.request(`/api/admin/agent-runtime/llm-pools/${encodeURIComponent(pool.id)}/versions`, {
      method: "POST",
      body: {
        policy: donor.policy || { failureThreshold: 2, cooldownMs: 30_000 },
        entries: donor.entries.filter((entry) => entry.enabled).map((entry) => ({
          modelId: entry.modelId,
          providerId: entry.providerId,
          capabilityTags: [...(entry.capabilityTags || [])],
          priority: entry.priority,
          weight: entry.weight,
          estimatedCost: entry.estimatedCost,
          enabled: true,
        })),
      },
    });
    await approveAndPublish(`/api/admin/agent-runtime/llm-pool-versions/${encodeURIComponent(created.id)}`, created.status || "draft");
    pools = await admin.request("/api/admin/agent-runtime/llm-pools");
    pool = pools.find((item) => item.poolKey === poolKey);
    version = pool?.versions?.find((item) => item.publications?.some((publication) => publication.environment === "gray"));
  }
  assert(version, `LLM_POOL_GRAY_PUBLICATION_MISSING:${poolKey}`);
  return { pool, version };
}

async function approveAndPublish(prefix, initialStatus) {
  let status = initialStatus;
  if (status === "draft") {
    await admin.request(`${prefix}/status`, { method: "POST", body: { status: "review" } });
    status = "review";
  }
  if (status === "review") {
    await admin.request(`${prefix}/status`, { method: "POST", body: { status: "approved" } });
    status = "approved";
  }
  assert.equal(status, "approved", `VERSION_NOT_APPROVABLE:${status}`);
  await admin.request(`${prefix}/publish`, { method: "POST", body: { environment: "gray" } });
}

async function readAgentRuntimeEvidence(email, idempotencyKey) {
  const result = await database.query(
    `select r.id as agent_run_id, d.agent_key, r.configuration_version_id,
      p.pool_key, dec.pool_version_id, dec.selected_provider_id, dec.selected_model_id
     from xh_agent_runs r
     join xh_users u on u.id = r.owner_id
     join xh_agent_definitions d on d.id = r.agent_definition_id
     left join xh_llm_route_decisions dec on dec.agent_run_id = r.id
     left join xh_llm_route_pools p on p.id = dec.pool_id
     where u.email = $1 and r.idempotency_key = $2
     order by dec.created_at asc nulls last limit 1`,
    [email, idempotencyKey],
  );
  const row = result.rows[0];
  assert(row, `AGENT_RUNTIME_EVIDENCE_MISSING:${idempotencyKey}`);
  return {
    agentRunId: text(row.agent_run_id),
    agentKey: text(row.agent_key),
    configurationVersionId: text(row.configuration_version_id),
    poolKey: text(row.pool_key),
    poolVersionId: text(row.pool_version_id),
    selectedProviderId: text(row.selected_provider_id),
    selectedModelId: text(row.selected_model_id),
  };
}

async function verifySupervisionConfigurationFreeze() {
  const roles = await admin.request("/api/admin/agent-runtime/roles");
  const planner = roles.find((item) => item.agentKey === "supervision-planner");
  assert(planner, "SUPERVISION_PLANNER_MISSING");
  const publication = planner.publications?.find((item) => item.environment === "gray");
  assert(publication, "SUPERVISION_PUBLICATION_MISSING");
  originalSupervisionVersionId = text(publication.configurationVersionId);
  const source = planner.versions?.find((item) => item.id === originalSupervisionVersionId);
  assert(source, "SUPERVISION_SOURCE_VERSION_MISSING");

  const canvas = await member.request("/api/canvas", { method: "POST", body: { name: `Task 8 configuration freeze ${key}` } });
  freezeCanvasId = text(canvas.id);
  assert(freezeCanvasId, "FREEZE_CANVAS_CREATE_FAILED");
  const workflowId = `${key}-freeze-workflow`;
  const groupId = `${key}-freeze-group`;
  const textId = `${key}-text`;
  const outputId = `${key}-output`;
  await member.request(`/api/canvas/${encodeURIComponent(freezeCanvasId)}`, {
    method: "PUT",
    body: {
      revision: canvas.revision,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        { id: groupId, type: "groupBox", position: { x: 40, y: 40 }, data: { name: "Configuration freeze", width: 900, height: 420, memberIds: [textId, outputId] } },
        { id: textId, type: "text", position: { x: 100, y: 140 }, data: { text: "Configuration freeze validation" } },
        { id: outputId, type: "output", position: { x: 600, y: 140 }, data: {} },
      ],
      edges: [{ id: `${key}-freeze-edge`, source: textId, target: outputId }],
      workflows: [{
        schemaVersion: 1,
        id: workflowId,
        name: "Configuration freeze validation",
        revision: 1,
        memberNodeIds: [groupId, textId, outputId],
        variables: [],
        inputValues: {},
        bindings: [],
        stages: [{ id: `${groupId}-stage`, name: "Freeze stage", sourceGroupNodeId: groupId, order: 0, mode: "serial", skipped: false }],
        supervisionDefaults: { stageConcurrency: 1, candidateSelectionMode: "ai", candidateSelectionCount: 1, candidateMinimumConfidence: 0 },
        region: { x: 40, y: 40, width: 900, height: 420, color: "#2F6B5F" },
      }],
    },
  });

  const runA = await createPlanOnlyRun(workflowId, `${key}-run-a`);
  const runAAgentId = text(runA.planSnapshot?.agentRunId);
  assert(runAAgentId, "RUN_A_AGENT_LINK_MISSING");
  const runABefore = await readAgentRunConfiguration(runAAgentId);
  assert.equal(runABefore, originalSupervisionVersionId, "RUN_A_DID_NOT_USE_ORIGINAL_CONFIGURATION");

  const temporary = await admin.request(`/api/admin/agent-runtime/roles/${encodeURIComponent(planner.id)}/versions`, {
    method: "POST",
    body: {
      configuration: {
        ...object(source.configuration),
        roleDescription: `${text(source.configuration?.roleDescription) || "Supervision planner"} [isolated freeze ${key}]`,
      },
    },
  });
  temporarySupervisionVersionId = text(temporary.id);
  assert(temporarySupervisionVersionId, "TEMPORARY_SUPERVISION_VERSION_MISSING");
  await approveAndPublish(`/api/admin/agent-runtime/agent-configurations/${encodeURIComponent(temporarySupervisionVersionId)}`, temporary.status || "draft");
  supervisionPublicationSwitched = true;

  const runB = await createPlanOnlyRun(workflowId, `${key}-run-b`);
  const runBAgentId = text(runB.planSnapshot?.agentRunId);
  assert(runBAgentId, "RUN_B_AGENT_LINK_MISSING");
  const [runAAfter, runBConfiguration] = await Promise.all([
    readAgentRunConfiguration(runAAgentId),
    readAgentRunConfiguration(runBAgentId),
  ]);
  assert.equal(runAAfter, originalSupervisionVersionId, "RUN_A_CONFIGURATION_MUTATED");
  assert.equal(runBConfiguration, temporarySupervisionVersionId, "RUN_B_DID_NOT_USE_TEMPORARY_CONFIGURATION");

  await admin.request(`/api/admin/agent-runtime/agent-configurations/${encodeURIComponent(originalSupervisionVersionId)}/publish`, {
    method: "POST",
    body: { environment: "gray" },
  });
  supervisionPublicationRestored = true;

  return {
    runAId: runA.id,
    runAAgentRunId: runAAgentId,
    runAConfigurationVersionIdBefore: runABefore,
    runAConfigurationVersionIdAfter: runAAfter,
    runBId: runB.id,
    runBAgentRunId: runBAgentId,
    runBConfigurationVersionId: runBConfiguration,
    temporaryConfigurationVersionId: temporarySupervisionVersionId,
    originalConfigurationVersionId: originalSupervisionVersionId,
    publicationRestored: true,
  };
}

async function createPlanOnlyRun(workflowId, idempotencyKey) {
  return member.request("/api/canvas-runs", {
    method: "POST",
    body: {
      canvasId: freezeCanvasId,
      workflowId,
      runScope: "workflow",
      idempotencyKey,
      configuration: { stageConcurrency: 1, defaultRetryCount: 0, retryExhaustionPolicy: "stop", candidateSelectionMode: "ai", candidateSelectionCount: 1, candidateMinimumConfidence: 0 },
      budget: { maxTaskCount: 2, maxAttemptsPerStep: 1, maxDurationSeconds: 300 },
    },
  });
}

async function readAgentRunConfiguration(agentRunId) {
  const result = await database.query("select configuration_version_id from xh_agent_runs where id = $1", [agentRunId]);
  assert(result.rows[0], `AGENT_RUN_NOT_FOUND:${agentRunId}`);
  return text(result.rows[0].configuration_version_id);
}

function workflowAttachment(run) {
  const plan = object(run.planSnapshot);
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const nodes = steps.map((step) => ({
    id: text(step.nodeId),
    type: text(step.nodeType),
    data: { label: text(step.label || step.nodeType), taskCapability: text(step.capability), generationAlternatives: step.generationAlternatives },
  }));
  const edges = steps.flatMap((step) => (Array.isArray(step.dependsOn) ? step.dependsOn : []).map((source) => ({
    id: `${source}-${step.id}`,
    source: text(steps.find((candidate) => candidate.id === source)?.nodeId || source),
    target: text(step.nodeId),
  })));
  return {
    id: `${key}-workflow`,
    kind: "workflow",
    title: "当前选中的工作流区域",
    summary: `${steps.length} 个计划步骤 / ${Array.isArray(plan.executionLayers) ? plan.executionLayers.length : 0} 个执行层`,
    payload: { nodes, edges },
  };
}

function createHttpClient() {
  let cookie = "";
  async function requestRaw(pathname, input = {}) {
    const response = await fetch(new URL(pathname, baseUrl), {
      method: input.method || "GET",
      headers: {
        accept: "application/json",
        ...(input.body === undefined ? {} : { "content-type": "application/json" }),
        ...(cookie ? { cookie } : {}),
        ...(input.method && input.method !== "GET" ? { origin: new URL(baseUrl).origin, referer: `${new URL(baseUrl).origin}/` } : {}),
      },
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";", 1)[0];
    const raw = await response.text();
    let parsed = {};
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { message: raw }; }
    return { status: response.status, ok: response.ok, parsed };
  }
  async function request(pathname, input = {}) {
    const result = await requestRaw(pathname, input);
    if (!result.ok) throw new Error(`${pathname}:HTTP_${result.status}:${text(result.parsed?.error || result.parsed?.message).slice(0, 400)}`);
    return result.parsed.data ?? result.parsed;
  }
  return { request, requestRaw };
}

function assistantText(result) {
  return text(result.content?.text || result.message || result.rawAssistant);
}

function containsPositiveRetiredNodeAdvice(value) {
  const normalized = value.replace(/[`*_]/g, "");
  const matches = [...normalized.matchAll(/(新增|添加|创建|拖入).{0,16}(?:AI|Agent|canvas-agent).{0,8}托管.{0,8}节点/gi)];
  return matches.some((match) => {
    const prefix = normalized.slice(Math.max(0, (match.index || 0) - 16), match.index || 0);
    return !/(不要|不得|禁止|无需|不应)/.test(prefix);
  });
}

function requiredEnvironment(name) {
  const value = text(process.env[name]);
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function requiredLoopbackUrl(name) {
  const value = requiredEnvironment(name);
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`${name}_LOOPBACK_REQUIRED`);
  return url.toString();
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
