import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { projectCanvasRunFailureDiagnostic } from "../packages/shared/dist/index.js";

const baseUrl = requiredLoopbackUrl("XINGHUAN_VERIFY_BASE_URL");
const email = requiredEnvironment("XINGHUAN_VERIFY_EMAIL");
const password = requiredEnvironment("XINGHUAN_VERIFY_PASSWORD");
const providerId = process.env.XINGHUAN_IMAGE_PROVIDER_ID || "grsai";
const modelId = process.env.XINGHUAN_IMAGE_MODEL_ID || "nano-banana-fast";
const modelRecordId = process.env.XINGHUAN_IMAGE_MODEL_RECORD_ID || `${providerId}-image-${modelId}`;
const key = `task7-concurrency-${randomUUID()}`;
const planOnly = process.env.XINGHUAN_SUPERVISION_PLAN_ONLY === "1";
const scenario = text(process.env.XINGHUAN_SUPERVISION_SCENARIO || "all");
const canvasIds = [];
let cookie = "";
let cleanedCanvasCount = 0;

assert.equal(process.env.XINGHUAN_ALLOW_PAID_IMAGE_TEST, "1", "PAID_IMAGE_TEST_NOT_EXPLICITLY_ENABLED");
assert.equal(process.env.XINGHUAN_ALLOW_REAL_ASSISTANT_TEST, "1", "REAL_ASSISTANT_TEST_NOT_EXPLICITLY_ENABLED");
assert.equal(process.env.XINGHUAN_ALLOW_ISOLATED_GRAY_TEST, "1", "ISOLATED_GRAY_TEST_NOT_EXPLICITLY_ENABLED");

let successEvidence;
let failureEvidence;
try {
  const status = await request("/api/status");
  assert.equal(status.environment, "gray", `GRAY_CANDIDATE_REQUIRED:${status.environment || "unknown"}`);
  const login = await request("/api/auth/login", { method: "POST", body: { email, password } });
  assert.equal(login.authenticated, true, "GRAY_LOGIN_FAILED");

  successEvidence = scenario === "failure" ? { skipped: true, reason: "failure_only" } : await validateConcurrentSuccess();
  failureEvidence = planOnly || scenario === "success" ? { skipped: true, reason: planOnly ? "plan_only" : "success_only" } : await validateFailureAndAssistant();
} finally {
  for (const canvasId of canvasIds.reverse()) {
    await request(`/api/canvas/${encodeURIComponent(canvasId)}`, { method: "DELETE" })
      .then(() => { cleanedCanvasCount += 1; })
      .catch(() => undefined);
  }
}

assert(successEvidence && failureEvidence, "VALIDATION_EVIDENCE_INCOMPLETE");
console.log(JSON.stringify({
  ok: true,
  candidate: { environment: "gray", baseUrl },
  success: successEvidence,
  failure: failureEvidence,
  cleanupSucceeded: cleanedCanvasCount === canvasIds.length,
}, null, 2));

async function validateConcurrentSuccess() {
  const created = await createCanvas(`Task 7 concurrent success ${key}`);
  const workflowId = `${key}-success-workflow`;
  const branchA = `${key}-branch-a`;
  const branchB = `${key}-branch-b`;
  const selector = `${key}-selector`;
  const downstream = `${key}-downstream`;
  const output = `${key}-output`;
  const stageGroup = `${key}-success-stage`;
  const imageData = (prompt, generationCount) => ({
    prompt,
    generationCount,
    taskCapability: "image",
    backendProviderId: providerId,
    providerModel: modelId,
    providerParams: { modelRecordId, sourceNodeId: key, sourceCanvasId: created.id },
  });

  await saveWorkflow(created, {
    workflowId,
    name: "Task 7 concurrent image convergence",
    stageGroupId: stageGroup,
    nodes: [
      { id: stageGroup, type: "groupBox", position: { x: 60, y: 80 }, data: { name: "Parallel image supervision", width: 1420, height: 700, memberIds: [branchA, branchB, selector, downstream, output] } },
      { id: branchA, type: "image", position: { x: 100, y: 120 }, data: imageData("Premium cobalt glass perfume bottle, front view, clean white studio, centered square product photo", 3) },
      { id: branchB, type: "image", position: { x: 100, y: 520 }, data: imageData("Premium cobalt glass perfume bottle, three-quarter view, clean white studio, centered square product photo", 3) },
      { id: selector, type: "smart-candidate-selector", position: { x: 520, y: 320 }, data: { selectorMediaKind: "image", selectorMode: "ai", selectorMaximum: 1, selectorMinimumConfidence: 0, selectorLowConfidencePolicy: "stop", selectorNote: "Select the clearest premium product composition with a complete bottle and neutral background." } },
      { id: downstream, type: "image", position: { x: 900, y: 320 }, data: imageData("Restyle the selected bottle into jade-green glass on brushed steel while preserving product geometry and composition", 1) },
      { id: output, type: "output", position: { x: 1280, y: 320 }, data: {} },
    ],
    edges: [
      { id: `${key}-success-a-selector`, source: branchA, target: selector },
      { id: `${key}-success-b-selector`, source: branchB, target: selector },
      { id: `${key}-success-selector-downstream`, source: selector, target: downstream },
      { id: `${key}-success-downstream-output`, source: downstream, target: output },
    ],
  });

  const run = await createAndStartRun(created.id, workflowId, `${key}-success`, 12, 2);
  if (planOnly) {
    const plan = object(run.planSnapshot);
    const steps = Array.isArray(plan.steps) ? plan.steps : [];
    const stepByNode = new Map(steps.map((step) => [text(step.nodeId), step]));
    const layers = Array.isArray(plan.executionLayers) ? plan.executionLayers : [];
    assert.deepEqual(layers.map((layer) => layer.stepIds), [
      [requiredStep(stepByNode, branchA).id, requiredStep(stepByNode, branchB).id],
      [requiredStep(stepByNode, selector).id],
      [requiredStep(stepByNode, downstream).id],
      [requiredStep(stepByNode, output).id],
    ], "DETERMINISTIC_EXECUTION_LAYERS_INVALID");
    assert.equal(plan.agentAnalysis?.status, "completed", `AGENT_ANALYSIS_NOT_COMPLETED:${plan.agentAnalysis?.degradationReason || "unknown"}`);
    assert.equal(Number(plan.agentAnalysis?.estimatedRequestCount), 7, "DETERMINISTIC_REQUEST_ESTIMATE_INVALID");
    assert.equal(Number(run.configurationSnapshot?.effectiveConcurrency), 2, "EFFECTIVE_CONCURRENCY_INVALID");
    return { planOnly: true, runId: run.id, agentRunId: plan.agentRunId, executionLayers: layers.map((layer) => layer.stepIds.length), estimatedRequestCount: plan.agentAnalysis.estimatedRequestCount, effectiveConcurrency: run.configurationSnapshot.effectiveConcurrency };
  }
  const terminal = await waitForTerminalRun(run.id, 1_800_000);
  const events = await readRunEvents(run.id);
  const terminalFailure = [...events].reverse().find((event) => event.eventType === "canvas_run.step_failed");
  const failedRuntimeStep = Array.isArray(terminal.steps) ? terminal.steps.find((step) => step.status === "failed") : null;
  const terminalFailureCode = text(terminalFailure?.payload?.code || terminalFailure?.payload?.failureClass || terminalFailure?.payload?.message || failedRuntimeStep?.error?.code || failedRuntimeStep?.error?.reason);
  assert.equal(terminal.status, "succeeded", `CONCURRENT_RUN_NOT_SUCCEEDED:${terminal.status}:${terminalFailureCode || "unknown"}`);
  const plan = object(terminal.planSnapshot);
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const stepByNode = new Map(steps.map((step) => [text(step.nodeId), step]));
  const branchAStep = requiredStep(stepByNode, branchA);
  const branchBStep = requiredStep(stepByNode, branchB);
  const selectorStep = requiredStep(stepByNode, selector);
  const downstreamStep = requiredStep(stepByNode, downstream);
  const outputStep = requiredStep(stepByNode, output);

  const layers = Array.isArray(plan.executionLayers) ? plan.executionLayers : [];
  assert.deepEqual(layers.map((layer) => layer.stepIds), [
    [branchAStep.id, branchBStep.id],
    [selectorStep.id],
    [downstreamStep.id],
    [outputStep.id],
  ], "DETERMINISTIC_EXECUTION_LAYERS_INVALID");
  assert.equal(plan.agentAnalysis?.status, "completed", `AGENT_ANALYSIS_NOT_COMPLETED:${plan.agentAnalysis?.degradationReason || "unknown"}`);
  assert(text(plan.agentRunId), "SUPERVISION_AGENT_RUN_LINK_MISSING");
  assert(events.some((event) => event.eventType === "canvas_run.analysis_completed"), "ANALYSIS_COMPLETED_EVENT_MISSING");
  assertLayerEvents(events, 4);

  const taskIds = dispatchedTaskIds(events);
  const branchATask = await readTask(requiredTaskId(taskIds, branchAStep.id));
  const branchBTask = await readTask(requiredTaskId(taskIds, branchBStep.id));
  const downstreamTask = await readTask(requiredTaskId(taskIds, downstreamStep.id));
  const branchAInterval = taskInterval(branchATask);
  const branchBInterval = taskInterval(branchBTask);
  assert(intervalsOverlap(branchAInterval, branchBInterval), "UPSTREAM_PROVIDER_TASKS_DID_NOT_OVERLAP");
  assert.equal(Number(branchATask.result?.providerRequestCount), 3, "BRANCH_A_REQUEST_COUNT_INVALID");
  assert.equal(Number(branchBTask.result?.providerRequestCount), 3, "BRANCH_B_REQUEST_COUNT_INVALID");
  assert.equal(Number(branchATask.result?.imageCount), 3, "BRANCH_A_IMAGE_COUNT_INVALID");
  assert.equal(Number(branchBTask.result?.imageCount), 3, "BRANCH_B_IMAGE_COUNT_INVALID");
  assert(Number(downstreamTask.result?.imageCount) >= 1, "DOWNSTREAM_IMAGE_OUTPUT_MISSING");

  const selectionResponse = await request(`/api/canvas-runs/${encodeURIComponent(run.id)}/candidate-selections`);
  const selections = Array.isArray(selectionResponse.items) ? selectionResponse.items : [];
  const selected = selections.find((item) => item.stepId === selectorStep.id);
  assert(selected && Array.isArray(selected.selectedArtifactIds) && selected.selectedArtifactIds.length === 1, "AI_CANDIDATE_SELECTION_MISSING");
  const selectorCompletedAt = eventTime(events, "canvas_run.step_succeeded", selectorStep.id);
  assert(selectorCompletedAt >= Math.max(branchAInterval.finishedAt, branchBInterval.finishedAt), "CONVERGENCE_COMPLETED_BEFORE_UPSTREAM_TASKS");
  assert(downstreamTask.createdAt >= selectorCompletedAt, "DOWNSTREAM_DISPATCHED_BEFORE_CONVERGENCE");

  return {
    runId: run.id,
    agentRunId: plan.agentRunId,
    analysisStatus: plan.agentAnalysis.status,
    effectiveConcurrency: terminal.configurationSnapshot?.effectiveConcurrency,
    executionLayers: layers.map((layer) => layer.stepIds.length),
    upstreamTasks: [
      { taskId: branchATask.id, providerRequestCount: branchATask.result.providerRequestCount, imageCount: branchATask.result.imageCount, ...branchAInterval },
      { taskId: branchBTask.id, providerRequestCount: branchBTask.result.providerRequestCount, imageCount: branchBTask.result.imageCount, ...branchBInterval },
    ],
    upstreamOverlapMilliseconds: overlapMilliseconds(branchAInterval, branchBInterval),
    selectionMode: selected.selectionMode,
    selectedCount: selected.selectedArtifactIds.length,
    downstream: { taskId: downstreamTask.id, imageCount: downstreamTask.result.imageCount },
    eventCount: events.length,
  };
}

async function validateFailureAndAssistant() {
  const failingProviderId = `${key}-unreachable-provider`;
  const failingModelId = `${key}-unreachable-image`;
  await request("/api/admin/providers", { method: "POST", body: { id: failingProviderId, name: "Task 7 isolated unreachable image provider", baseUrl: "http://127.0.0.1:1/v1", protocol: "openai", enabled: true, apiKey: "isolated-failure-only" } });
  const imported = await request(`/api/admin/providers/${encodeURIComponent(failingProviderId)}/import-models`, { method: "POST", body: { models: [{ modelId: failingModelId, capability: "image", displayName: "Task 7 unreachable image" }] } });
  const failingModelRecordId = text(imported.models?.find((model) => model.modelId === failingModelId)?.id);
  assert(failingModelRecordId, "FAILING_IMAGE_MODEL_IMPORT_FAILED");

  const created = await createCanvas(`Task 7 failure recovery ${key}`);
  const workflowId = `${key}-failure-workflow`;
  const validNode = `${key}-failure-valid`;
  const failingNode = `${key}-failure-provider`;
  const stageGroup = `${key}-failure-stage`;
  await saveWorkflow(created, {
    workflowId,
    name: "Task 7 isolated failure branch",
    stageGroupId: stageGroup,
    stageMode: "serial",
    nodes: [
      { id: stageGroup, type: "groupBox", position: { x: 60, y: 80 }, data: { name: "Parallel failure validation", width: 760, height: 720, memberIds: [validNode, failingNode] } },
      { id: validNode, type: "image", position: { x: 100, y: 120 }, data: { prompt: "A small green hill under a clear blue sky, no people, natural landscape photography", generationCount: 1, taskCapability: "image", backendProviderId: providerId, providerModel: modelId, providerParams: { modelRecordId, sourceNodeId: key, sourceCanvasId: created.id } } },
      { id: failingNode, type: "image", position: { x: 100, y: 500 }, data: { prompt: "A small blue lake under a clear sky, no people, natural landscape photography", generationCount: 1, taskCapability: "image", backendProviderId: failingProviderId, providerModel: failingModelId, providerParams: { modelRecordId: failingModelRecordId, sourceNodeId: key, sourceCanvasId: created.id } } },
    ],
    edges: [],
  });

  const run = await createAndStartRun(created.id, workflowId, `${key}-failure`, 4, 0);
  const terminal = await waitForTerminalRun(run.id, 900_000);
  assert.equal(terminal.status, "failed", `FAILURE_RUN_NOT_FAILED:${terminal.status}`);
  const events = await readRunEvents(run.id);
  const steps = Array.isArray(terminal.planSnapshot?.steps) ? terminal.planSnapshot.steps : [];
  const validStep = steps.find((step) => step.nodeId === validNode);
  const failedStep = steps.find((step) => step.nodeId === failingNode);
  assert(validStep && failedStep, "FAILURE_RUN_STEPS_MISSING");
  const validEvent = events.find((event) => event.eventType === "canvas_run.step_succeeded" && eventPlanStepId(event) === validStep.id);
  const failureEvent = [...events].reverse().find((event) => event.eventType === "canvas_run.step_failed" && eventPlanStepId(event) === failedStep.id);
  assert(validEvent, "UNAFFECTED_BRANCH_DID_NOT_REMAIN_SUCCEEDED");
  assert(failureEvent, "FAILED_BRANCH_EVENT_MISSING");

  const payload = object(failureEvent.payload);
  const diagnostic = projectCanvasRunFailureDiagnostic({
    code: payload.code || payload.failureClass,
    eventType: failureEvent.eventType,
    message: payload.message || payload.error,
    reason: payload.reason,
    failureCategory: payload.failureCategory,
    providerDiagnostic: payload.providerDiagnostic,
    runId: run.id,
    runStepId: failedStep.id,
    nodeId: failingNode,
    nodeType: failedStep.nodeType,
    providerName: payload.providerName,
    modelName: payload.modelName,
    taskId: payload.taskId,
    requestId: payload.requestId,
    upstreamHttpStatus: payload.upstreamHttpStatus,
  });
  const assistant = await request("/api/assistant/chat", {
    method: "POST",
    body: {
      scope: "canvas",
      conversationId: `${key}-failure-conversation`,
      idempotencyKey: `${key}-failure-assistant`,
      message: "请只依据附加的真实 AI 托管诊断，区分已观察事实、可能原因、受影响步骤和修复动作，并说明另一条已完成分支是否受影响。",
      attachments: [{
        id: `canvas-run-failure-${run.id}-${failedStep.id}`,
        kind: "node",
        title: `失败节点 ${failedStep.nodeType}`,
        summary: diagnostic.title,
        payload: { source: "canvas_run_error", runId: run.id, nodeId: failingNode, nodeType: failedStep.nodeType, diagnostic },
      }],
    },
  });
  const assistantText = text(assistant.content?.text || assistant.message || assistant.rawAssistant);
  assert.equal(assistant.mode, "agent", `ASSISTANT_NOT_AGENT_MODE:${assistant.mode || "unknown"}`);
  assert(assistantText.length >= 80, "ASSISTANT_RESPONSE_TOO_SHORT");
  assert(/事实|观察|已完成|成功/.test(assistantText), "ASSISTANT_DID_NOT_SEPARATE_OBSERVED_FACTS");
  assert(/原因|可能/.test(assistantText), "ASSISTANT_DID_NOT_SEPARATE_POSSIBLE_CAUSE");
  assert(/修复|处理|检查|重试/.test(assistantText), "ASSISTANT_DID_NOT_PROPOSE_REPAIR");
  assert(assistantText.includes(diagnostic.technical.code) || assistantText.includes(failedStep.nodeType), "ASSISTANT_DID_NOT_REFERENCE_EXACT_DIAGNOSTIC");

  return {
    runId: run.id,
    finalStatus: terminal.status,
    unaffectedStepStatus: "succeeded",
    failedStepStatus: "failed",
    diagnostic: { category: diagnostic.category, code: diagnostic.technical.code, title: diagnostic.title, retryability: diagnostic.retryability },
    assistantMode: assistant.mode,
    assistantResponseLength: assistantText.length,
    eventCount: events.length,
  };
}

async function createCanvas(name) {
  const created = await request("/api/canvas", { method: "POST", body: { name } });
  const id = text(created.id);
  assert(id, "CANVAS_CREATE_FAILED");
  canvasIds.push(id);
  return { id, revision: created.revision };
}

async function saveWorkflow(created, input) {
  await request(`/api/canvas/${encodeURIComponent(created.id)}`, {
    method: "PUT",
    body: {
      revision: created.revision,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: input.nodes,
      edges: input.edges,
      workflows: [{
        schemaVersion: 1,
        id: input.workflowId,
        name: input.name,
        revision: 1,
        memberNodeIds: input.nodes.map((node) => node.id),
        variables: [],
        inputValues: {},
        bindings: [],
        stages: [{ id: `${input.stageGroupId}-stage`, name: "Validation stage", sourceGroupNodeId: input.stageGroupId, order: 0, mode: input.stageMode === "serial" ? "serial" : "parallel", skipped: false }],
        supervisionDefaults: { stageConcurrency: 2, candidateSelectionMode: "ai", candidateSelectionCount: 1, candidateMinimumConfidence: 0 },
        region: { x: 40, y: 60, width: 1540, height: 820, color: "#2F6B5F" },
      }],
    },
  });
}

async function createAndStartRun(canvasId, workflowId, suffix, maxTaskCount, retryCount) {
  const run = await request("/api/canvas-runs", {
    method: "POST",
    body: {
      canvasId,
      workflowId,
      runScope: "workflow",
      idempotencyKey: `${suffix}-create`,
      configuration: { stageConcurrency: 2, defaultRetryCount: retryCount, retryExhaustionPolicy: "stop", candidateSelectionMode: "ai", candidateSelectionCount: 1, candidateMinimumConfidence: 0 },
      budget: { maxTaskCount, maxAttemptsPerStep: retryCount + 1, maxDurationSeconds: 1_800 },
    },
  });
  assert(text(run.id), "CANVAS_RUN_CREATE_FAILED");
  if (!planOnly) await request(`/api/canvas-runs/${encodeURIComponent(run.id)}/start`, { method: "POST", body: { idempotencyKey: `${suffix}-start` } });
  return run;
}

async function waitForTerminalRun(runId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await request(`/api/canvas-runs/${encodeURIComponent(runId)}`);
    if (["succeeded", "failed", "cancelled"].includes(text(run.status))) return run;
    await wait(2_000);
  }
  throw new Error(`CANVAS_RUN_TIMEOUT:${runId}`);
}

async function readRunEvents(runId) {
  const response = await request(`/api/canvas-runs/${encodeURIComponent(runId)}/events`);
  return Array.isArray(response.items) ? response.items : [];
}

async function readTask(taskId) {
  const task = await request(`/api/proxy/external/image/task/${encodeURIComponent(taskId)}`);
  assert.equal(task.status, "succeeded", `TASK_NOT_SUCCEEDED:${taskId}:${task.status}`);
  return { ...task, result: object(task.result) };
}

function dispatchedTaskIds(events) {
  return new Map(events
    .filter((event) => event.eventType === "canvas_run.step_dispatched" && text(event.payload?.taskId))
    .map((event) => [eventPlanStepId(event), text(event.payload.taskId)]));
}

function requiredTaskId(taskIds, stepId) {
  const taskId = taskIds.get(stepId);
  assert(taskId, `DISPATCHED_TASK_MISSING:${stepId}`);
  return taskId;
}

function requiredStep(stepByNode, nodeId) {
  const step = stepByNode.get(nodeId);
  assert(step, `PLAN_STEP_MISSING:${nodeId}`);
  return step;
}

function taskInterval(task) {
  const startedAt = Date.parse(text(task.result.startedAt)) || Number(task.createdAt);
  const finishedAt = Date.parse(text(task.result.completedAt)) || Number(task.finalizedAt);
  assert(Number.isFinite(startedAt) && Number.isFinite(finishedAt), `TASK_INTERVAL_INVALID:${task.id}`);
  return { startedAt, finishedAt };
}

function intervalsOverlap(left, right) {
  return Math.max(left.startedAt, right.startedAt) < Math.min(left.finishedAt, right.finishedAt);
}

function overlapMilliseconds(left, right) {
  return Math.max(0, Math.min(left.finishedAt, right.finishedAt) - Math.max(left.startedAt, right.startedAt));
}

function eventTime(events, eventType, stepId) {
  const event = events.find((item) => item.eventType === eventType && eventPlanStepId(item) === stepId);
  assert(event, `RUN_EVENT_MISSING:${eventType}:${stepId}`);
  return Number(event.createdAt);
}

function eventPlanStepId(event) {
  return text(event?.runStepKey) || text(event?.runStepId);
}

function assertLayerEvents(events, layerCount) {
  for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
    assert(events.some((event) => event.eventType === "canvas_run.execution_layer_started" && Number(event.payload?.layerIndex) === layerIndex), `LAYER_START_EVENT_MISSING:${layerIndex}`);
    assert(events.some((event) => event.eventType === "canvas_run.execution_layer_completed" && Number(event.payload?.layerIndex) === layerIndex), `LAYER_COMPLETE_EVENT_MISSING:${layerIndex}`);
  }
}

async function request(pathname, input = {}) {
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
  const parsed = raw ? JSON.parse(raw) : {};
  if (!response.ok) throw new Error(`${pathname}:HTTP_${response.status}:${text(parsed.error || parsed.message || raw).slice(0, 400)}`);
  return parsed.data ?? parsed;
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

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
