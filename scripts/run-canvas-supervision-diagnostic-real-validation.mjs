import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { projectCanvasRunFailureDiagnostic } from '../packages/shared/dist/index.js';

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL || 'http://127.0.0.1:18246';
const email = process.env.XINGHUAN_VERIFY_EMAIL || process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL || '';
const password = process.env.XINGHUAN_VERIFY_PASSWORD || process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD || '';
const key = `task6-supervision-diagnostic-${randomUUID()}`;
const providerId = process.env.XINGHUAN_IMAGE_PROVIDER_ID || 'grsai';
const modelId = process.env.XINGHUAN_IMAGE_MODEL_ID || 'nano-banana-fast';
const modelRecordId = process.env.XINGHUAN_IMAGE_MODEL_RECORD_ID || `${providerId}-image-${modelId}`;
let cookie = '';
let canvasId = '';
let validationResult;
let cleanupSucceeded = false;

assert.equal(process.env.XINGHUAN_ALLOW_PAID_IMAGE_TEST, '1', 'PAID_IMAGE_TEST_NOT_EXPLICITLY_ENABLED');
assert.equal(process.env.XINGHUAN_ALLOW_REAL_ASSISTANT_TEST, '1', 'REAL_ASSISTANT_TEST_NOT_EXPLICITLY_ENABLED');
assert(email && password, 'GRAY_LOGIN_CREDENTIALS_NOT_CONFIGURED');

try {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(login.authenticated, true, 'GRAY_LOGIN_FAILED');

  const created = await request('/api/canvas', {
    method: 'POST',
    body: { name: `Disposable supervision diagnostic ${key}` },
  });
  canvasId = text(created.id);
  assert(canvasId, 'CANVAS_CREATE_FAILED');

  const imageNodeId = `${key}-image`;
  const selectorNodeId = `${key}-selector`;
  const workflowId = `${key}-workflow`;
  await request(`/api/canvas/${encodeURIComponent(canvasId)}`, {
    method: 'PUT',
    body: {
      revision: created.revision,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: imageNodeId,
          type: 'image',
          position: { x: 120, y: 160 },
          data: {
            prompt: 'A single cobalt glass perfume bottle, clean studio product photo, square composition',
            generationCount: 1,
            taskCapability: 'image',
            backendProviderId: providerId,
            providerModel: modelId,
            providerParams: { modelRecordId, sourceNodeId: key, sourceCanvasId: canvasId },
          },
        },
        {
          id: selectorNodeId,
          type: 'smart-candidate-selector',
          position: { x: 520, y: 160 },
          data: {
            selectorMediaKind: 'image',
            selectorMode: 'manual',
            selectorMaximum: 1,
            selectorMinimumConfidence: 0,
          },
        },
      ],
      edges: [{ id: `${key}-edge`, source: imageNodeId, target: selectorNodeId }],
      workflows: [{
        schemaVersion: 1,
        id: workflowId,
        name: 'Disposable diagnostic workflow',
        revision: 1,
        memberNodeIds: [imageNodeId, selectorNodeId],
        variables: [],
        inputValues: {},
        bindings: [],
        region: { x: 60, y: 100, width: 760, height: 420, color: '#2F6B5F' },
      }],
    },
  });

  const run = await request('/api/canvas-runs', {
    method: 'POST',
    body: {
      canvasId,
      workflowId,
      runScope: 'workflow',
      idempotencyKey: `${key}-create`,
      budget: { maxTaskCount: 2, maxAttemptsPerStep: 1, maxDurationSeconds: 600 },
    },
  });
  const runId = text(run.id);
  assert(runId, 'CANVAS_RUN_CREATE_FAILED');

  await request(`/api/canvas-runs/${encodeURIComponent(runId)}/start`, {
    method: 'POST',
    body: { idempotencyKey: `${key}-start` },
  });

  let terminal;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const current = await request(`/api/canvas-runs/${encodeURIComponent(runId)}`);
    if (['succeeded', 'failed', 'cancelled'].includes(text(current.status))) {
      terminal = current;
      break;
    }
    await wait(2_000);
  }
  assert.equal(terminal?.status, 'failed', `EXPECTED_FAILED_RUN:${terminal?.status || 'timeout'}`);

  const eventResponse = await request(`/api/canvas-runs/${encodeURIComponent(runId)}/events`);
  const events = Array.isArray(eventResponse.items) ? eventResponse.items : [];
  const failureEvent = [...events].reverse().find((event) => event.eventType === 'canvas_run.step_failed');
  assert(failureEvent, 'STEP_FAILURE_EVENT_MISSING');
  const failureStep = terminal.planSnapshot?.steps?.find((step) => step.id === failureEvent.runStepId || step.id === failureEvent.runStepKey);
  const payload = object(failureEvent.payload);
  const diagnostic = projectCanvasRunFailureDiagnostic({
    code: payload.code || payload.failureClass,
    eventType: failureEvent.eventType,
    message: payload.message || payload.error,
    reason: payload.reason,
    failureCategory: payload.failureCategory,
    providerDiagnostic: payload.providerDiagnostic,
    waitReason: payload.waitReason,
    runId,
    runStepId: failureEvent.runStepId || failureEvent.runStepKey,
    nodeId: failureStep?.nodeId,
    nodeType: failureStep?.nodeType,
    stepNumber: terminal.planSnapshot?.steps?.findIndex((step) => step.id === failureStep?.id) + 1,
    providerName: payload.providerName,
    modelName: payload.modelName,
    taskId: payload.taskId,
    requestId: payload.requestId,
    upstreamHttpStatus: payload.upstreamHttpStatus,
  });
  assert.equal(diagnostic.category, 'input', `UNEXPECTED_DIAGNOSTIC_CATEGORY:${diagnostic.category}`);

  const assistant = await request('/api/assistant/chat', {
    method: 'POST',
    body: {
      scope: 'canvas',
      conversationId: `${key}-conversation`,
      idempotencyKey: `${key}-assistant`,
      message: '请只依据附加的真实运行诊断，区分已观察事实、可能原因、受影响步骤和修复动作。',
      attachments: [{
        id: `canvas-run-failure-${runId}-${diagnostic.location.runStepId || diagnostic.technical.code}`,
        kind: 'node',
        title: diagnostic.location.nodeType ? `失败节点 ${diagnostic.location.nodeType}` : 'AI 托管失败诊断',
        summary: diagnostic.title,
        payload: {
          source: 'canvas_run_error',
          runId,
          nodeId: diagnostic.location.nodeId,
          nodeType: diagnostic.location.nodeType,
          diagnostic,
        },
      }],
    },
  });
  const assistantText = text(assistant.content?.text || assistant.message || assistant.rawAssistant);
  assert.equal(assistant.mode, 'agent', `ASSISTANT_NOT_AGENT_MODE:${assistant.mode || 'unknown'}`);
  assert(assistantText.length >= 80, 'ASSISTANT_RESPONSE_TOO_SHORT');
  assert(/候选|输入|节点/.test(assistantText), 'ASSISTANT_DID_NOT_REFERENCE_FAILURE_FACTS');
  assert(/原因|可能/.test(assistantText), 'ASSISTANT_DID_NOT_SEPARATE_CAUSE');
  assert(/修复|处理|连接|生成/.test(assistantText), 'ASSISTANT_DID_NOT_PROPOSE_REPAIR');
  const exactEvidence = {
    referencesDiagnosticTitle: assistantText.includes(diagnostic.title),
    referencesStableCode: assistantText.includes(diagnostic.technical.code),
    referencesNodeType: Boolean(diagnostic.location.nodeType && assistantText.includes(diagnostic.location.nodeType)),
  };
  assert(Object.values(exactEvidence).some(Boolean), 'ASSISTANT_DID_NOT_REFERENCE_EXACT_DIAGNOSTIC');

  validationResult = {
    ok: true,
    runId,
    workflowId,
    finalStatus: terminal.status,
    failureCode: diagnostic.technical.code,
    diagnosticCategory: diagnostic.category,
    diagnosticTitle: diagnostic.title,
    failedNodeType: diagnostic.location.nodeType,
    assistantMode: assistant.mode,
    assistantResponseLength: assistantText.length,
    assistantEvidence: {
      referencesFailureFacts: /候选|输入|节点/.test(assistantText),
      separatesCause: /原因|可能/.test(assistantText),
      proposesRepair: /修复|处理|连接|生成/.test(assistantText),
      ...exactEvidence,
    },
    eventCount: events.length,
  };
} finally {
  if (canvasId) {
    await request(`/api/canvas/${encodeURIComponent(canvasId)}`, { method: 'DELETE' });
    cleanupSucceeded = true;
  }
}

assert(validationResult, 'VALIDATION_RESULT_MISSING');
console.log(JSON.stringify({ ...validationResult, cleanupSucceeded }, null, 2));

async function request(pathname, input = {}) {
  const response = await fetch(new URL(pathname, baseUrl), {
    method: input.method || 'GET',
    headers: {
      accept: 'application/json',
      ...(input.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...(input.method && input.method !== 'GET' ? { origin: new URL(baseUrl).origin, referer: `${new URL(baseUrl).origin}/` } : {}),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';', 1)[0];
  const raw = await response.text();
  const parsed = raw ? JSON.parse(raw) : {};
  if (!response.ok) throw new Error(`${pathname}:HTTP_${response.status}:${text(parsed.error || parsed.message || raw).slice(0, 400)}`);
  return parsed.data ?? parsed;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
