import assert from "node:assert/strict";

const baseUrl = String(process.env.XINGHUAN_VERIFY_BASE_URL || "http://127.0.0.1:18200").replace(/\/$/, "");
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL || process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL || "";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD || process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD || "";
const providerHint = String(process.env.XINGHUAN_VERIFY_GRSAI_PROVIDER_NAME || "grsai").toLowerCase();
const modelHint = String(process.env.XINGHUAN_VERIFY_GRSAI_MODEL_ID || "gpt-image-2").toLowerCase();
const timeoutSeconds = Math.min(600, Math.max(30, Number(process.env.XINGHUAN_VERIFY_GRSAI_TASK_TIMEOUT_SECONDS || 360) || 360));
const expectedEnvironment = process.env.XINGHUAN_VERIFY_EXPECTED_ENVIRONMENT || "gray";
const preflightOnly = process.env.XINGHUAN_GRSAI_CANARY_PREFLIGHT_ONLY === "1";
const requestOrigin = new URL(baseUrl).origin;
const marker = `grsai-gpt-image-canary-${Date.now()}`;
let cookie = "";

assert(loginEmail, "GRSAI_CANARY_LOGIN_EMAIL_REQUIRED");
assert(loginPassword, "GRSAI_CANARY_LOGIN_PASSWORD_REQUIRED");

const status = await request("/api/status");
assert.equal(status.environment, expectedEnvironment, `GRSAI_CANARY_ENVIRONMENT_MISMATCH:${status.environment || "unknown"}`);

const login = await request("/api/auth/login", {
  method: "POST",
  body: { email: loginEmail, password: loginPassword },
});
assert.equal(login.authenticated, true, "GRSAI_CANARY_LOGIN_FAILED");

let [overview, roles, pools] = await Promise.all([
  request("/api/admin/agent-runtime/overview"),
  request("/api/admin/agent-runtime/roles"),
  request("/api/admin/agent-runtime/llm-pools"),
]);
let controls = overview.controls?.find((item) => item?.environment === expectedEnvironment);
if (process.env.XINGHUAN_RECONCILE_OBSERVE_MODE === "1" && controls && !isObserveMode(controls)) {
  await request(`/api/admin/agent-runtime/controls/${encodeURIComponent(expectedEnvironment)}`, {
    method: "PATCH",
    body: {
      revision: controls.revision,
      values: {
        agentEnabled: true,
        canvasRunsEnabled: true,
        automaticRecoveryEnabled: false,
        qualityEvaluationEnabled: false,
      },
    },
  });
  overview = await request("/api/admin/agent-runtime/overview");
  controls = overview.controls?.find((item) => item?.environment === expectedEnvironment);
}
assert.equal(overview.environment, expectedEnvironment, "GRSAI_CANARY_OVERVIEW_ENVIRONMENT_MISMATCH");
assert.equal(overview.processGates?.apiCanvasRunsEnabled, true, "GRSAI_CANARY_API_PROCESS_GATE_DISABLED");
assert.equal(overview.processGates?.workerCanvasRunsEnabled, true, "GRSAI_CANARY_WORKER_PROCESS_GATE_DISABLED");
assert.equal(controls?.agentEnabled, true, "GRSAI_CANARY_AGENT_CONTROL_DISABLED");
assert.equal(controls?.canvasRunsEnabled, true, "GRSAI_CANARY_CANVAS_RUN_CONTROL_DISABLED");
assert.equal(controls?.automaticRecoveryEnabled, false, "GRSAI_CANARY_AUTOMATIC_RECOVERY_NOT_OBSERVE_MODE");
assert.equal(controls?.qualityEvaluationEnabled, false, "GRSAI_CANARY_QUALITY_EVALUATION_NOT_OBSERVE_MODE");

const supervisionRole = roles.find((item) => item?.agentKey === "supervision-planner");
assert(supervisionRole?.publications?.some((item) => item?.environment === expectedEnvironment), "GRSAI_CANARY_SUPERVISION_PUBLICATION_MISSING");
const supervisionPool = pools.find((item) => item?.poolKey === "supervision-planning");
const supervisionVersion = supervisionPool?.versions?.find((version) =>
  version?.publications?.some((item) => item?.environment === expectedEnvironment)
  && version?.entries?.some((entry) => entry?.enabled !== false && entry?.capabilityTags?.includes("text_chat")),
);
assert(supervisionVersion, "GRSAI_CANARY_SUPERVISION_ROUTE_MISSING");
const currentRouteHealth = pools.flatMap((pool) => (pool?.versions || [])
  .filter((version) => version?.publications?.some((item) => item?.environment === expectedEnvironment))
  .flatMap((version) => (version?.entries || [])
    .filter((entry) => entry?.enabled !== false)
    .map((entry) => ({
      poolKey: pool.poolKey,
      providerId: entry.providerId,
      modelId: entry.modelId,
      state: entry.health?.state || "healthy",
    }))));

if (preflightOnly) {
  console.log(JSON.stringify({
    ok: true,
    preflightOnly: true,
    environment: status.environment,
    processGates: overview.processGates,
    controls,
    supervisionPublicationReady: true,
    supervisionRouteReady: true,
    metrics: overview.metrics,
    currentRouteHealth,
  }, null, 2));
  process.exit(0);
}

assert.equal(process.env.XINGHUAN_ALLOW_PAID_IMAGE_TEST, "1", "PAID_IMAGE_TEST_NOT_EXPLICITLY_ENABLED");

const providers = await request("/api/admin/providers");
const provider = providers.find((item) =>
  String(item?.protocol || "").toLowerCase() === "grsai_draw"
  && item?.enabled === true
  && `${item?.id || ""} ${item?.name || ""}`.toLowerCase().includes(providerHint),
);
assert(provider?.id, "GRSAI_CANARY_PROVIDER_NOT_FOUND");

const models = await request("/api/admin/models");
const model = models.find((item) =>
  item?.providerId === provider.id
  && item?.enabled === true
  && String(item?.capability || "").toLowerCase() === "image"
  && String(item?.modelId || "").toLowerCase().includes(modelHint),
);
assert(model?.id, "GRSAI_CANARY_MODEL_NOT_FOUND");

const beforeArtifacts = await request("/api/generation-library/items?kind=image");
const beforeIds = new Set(beforeArtifacts.map((item) => item?.id).filter(Boolean));

const task = await request("/api/admin/tasks", {
  method: "POST",
  body: {
    title: `GRSAI GPT image canary ${marker}`,
    status: "queued",
    providerId: provider.id,
    modelId: model.id,
    payload: {
      kind: "image",
      taskCapability: "image",
      prompt: "A single matte black cube centered on a clean light gray studio background, soft shadow, no text",
      size: "1024x1024",
      aspectRatio: "1:1",
      n: 1,
      sourceNodeId: marker,
      sourceCanvasId: marker,
    },
  },
});
assert(task?.id, "GRSAI_CANARY_TASK_CREATE_FAILED");

let completedTask = null;
for (let attempt = 0; attempt < timeoutSeconds; attempt += 1) {
  await sleep(1000);
  completedTask = await request(`/api/admin/tasks/${encodeURIComponent(task.id)}`);
  if (["succeeded", "failed", "cancelled"].includes(completedTask?.status)) break;
}

assert.equal(completedTask?.status, "succeeded", `GRSAI_CANARY_TASK_NOT_SUCCEEDED:${completedTask?.status || "missing"}`);
assert.equal(completedTask?.result?.adapter, "grsai-image", "GRSAI_CANARY_ADAPTER_MISMATCH");

const afterArtifacts = await request("/api/generation-library/items?kind=image");
const artifact = afterArtifacts.find((item) =>
  !beforeIds.has(item?.id)
  && (item?.taskId === task.id || item?.sourceNodeId === marker),
);
assert(artifact?.id, "GRSAI_CANARY_ARTIFACT_NOT_FOUND");
assert(String(artifact.fileUrl || "").startsWith("/files/output/"), "GRSAI_CANARY_ARTIFACT_NOT_MATERIALIZED");

const file = await requestRaw(artifact.previewUrl || artifact.fileUrl);
assert.equal(file.response.status, 200, `GRSAI_CANARY_FILE_HTTP_${file.response.status}`);
assert.match(file.response.headers.get("content-type") || "", /^image\//i, "GRSAI_CANARY_FILE_NOT_IMAGE");

console.log(JSON.stringify({
  ok: true,
  environment: status.environment,
  providerId: provider.id,
  modelId: model.modelId,
  taskId: task.id,
  taskStatus: completedTask.status,
  adapter: completedTask.result.adapter,
  generationArtifactId: artifact.id,
  fileUrl: artifact.fileUrl,
  requestedImages: 1,
}, null, 2));

async function request(pathname, input = {}) {
  const { response, payload } = await requestRaw(pathname, input);
  if (!response.ok) {
    const message = typeof payload === "object" ? JSON.stringify(payload) : String(payload);
    throw new Error(`${pathname}:HTTP_${response.status}:${message.slice(0, 500)}`);
  }
  return payload?.data ?? payload;
}

async function requestRaw(pathname, input = {}) {
  const response = await fetch(new URL(pathname, `${baseUrl}/`), {
    method: input.method || "GET",
    headers: {
      accept: "application/json",
      ...(input.body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
      ...(input.method && input.method !== "GET" ? { origin: requestOrigin, referer: `${requestOrigin}/` } : {}),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    signal: AbortSignal.timeout(20_000),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  const raw = await response.text();
  let payload = raw;
  try { payload = raw ? JSON.parse(raw) : {}; } catch { /* Keep non-JSON file bodies opaque. */ }
  return { response, payload };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isObserveMode(value) {
  return value?.agentEnabled === true
    && value?.canvasRunsEnabled === true
    && value?.automaticRecoveryEnabled === false
    && value?.qualityEvaluationEnabled === false;
}
