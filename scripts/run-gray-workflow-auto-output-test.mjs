import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL || "https://canvas-next.hhh2121.xyz";
const email = process.env.XINGHUAN_VERIFY_EMAIL || process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL || "";
const password = process.env.XINGHUAN_VERIFY_PASSWORD || process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD || "";
const key = `gray-auto-output-${randomUUID()}`;
let cookie = "";

function wait(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      origin: baseUrl,
      referer: `${baseUrl}/`,
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  const body = await response.text();
  if (!response.ok) throw new Error(`${pathname}:HTTP_${response.status}:${body.slice(0, 600)}`);
  const parsed = body ? JSON.parse(body) : {};
  return parsed.data ?? parsed;
}

async function main() {
  assert.equal(process.env.XINGHUAN_ALLOW_PAID_IMAGE_TEST, "1", "PAID_IMAGE_TEST_NOT_EXPLICITLY_ENABLED");
  assert(email && password, "GRAY_LOGIN_CREDENTIALS_NOT_CONFIGURED");
  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.authenticated, true, "GRAY_LOGIN_FAILED");

  const created = await request("/api/canvas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: `Gray workflow automatic output ${key}` }),
  });
  const canvasId = text(created.id);
  assert(canvasId, "CANVAS_CREATE_FAILED");

  const imageId = "task-image-0";
  const outputId = `output-auto-${imageId}-${Date.now()}-image-test`;
  const workflowId = `workflow-${key}`;
  await request(`/api/canvas/${encodeURIComponent(canvasId)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      revision: created.revision,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: imageId,
          type: "image",
          position: { x: 120, y: 160 },
          data: {
            prompt: "A luminous jade-green glass perfume bottle, centered premium studio product photo, square composition",
            generationCount: 3,
            taskCapability: "image",
            backendProviderId: "grsai",
            providerModel: "nano-banana-fast",
            providerParams: { modelRecordId: "grsai-image-nano-banana-fast", sourceNodeId: key, sourceCanvasId: canvasId },
          },
        },
        { id: outputId, type: "output", position: { x: 520, y: 160 }, data: {} },
      ],
      edges: [{ id: `e-auto-${outputId}`, source: imageId, target: outputId }],
      workflows: [{
        schemaVersion: 1,
        id: workflowId,
        name: "Automatic Output Boundary",
        revision: 1,
        memberNodeIds: [imageId],
        variables: [],
        inputValues: {},
        bindings: [],
        region: { x: 40, y: 80, width: 400, height: 360, color: "#2F6B5F" },
      }],
    }),
  });

  const run = await request("/api/canvas-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      canvasId,
      workflowId,
      runScope: "workflow",
      idempotencyKey: `${key}-create`,
      budget: { maxTaskCount: 4, maxAttemptsPerStep: 1, maxDurationSeconds: 900 },
    }),
  });
  assert.equal(text(run.workflowId), workflowId, "WORKFLOW_RUN_NOT_CREATED");
  assert.equal(run.planSnapshot?.steps?.length, 1, "DISPLAY_OUTPUT_LEAF_ENTERED_PLAN");
  assert.equal(text(run.planSnapshot?.steps?.[0]?.nodeId), imageId, "IMAGE_STEP_MISSING_FROM_PLAN");

  await request(`/api/canvas-runs/${encodeURIComponent(run.id)}/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idempotencyKey: `${key}-start` }),
  });

  let terminal = null;
  for (let attempt = 0; attempt < 540; attempt += 1) {
    const current = await request(`/api/canvas-runs/${encodeURIComponent(run.id)}`);
    if (["succeeded", "failed", "cancelled"].includes(text(current.status))) {
      terminal = current;
      break;
    }
    await wait(2_000);
  }
  assert.equal(terminal?.status, "succeeded", `WORKFLOW_AUTO_OUTPUT_RUN_NOT_SUCCEEDED:${terminal?.status || "timeout"}`);
  const events = await request(`/api/canvas-runs/${encodeURIComponent(run.id)}/events`);
  console.log(JSON.stringify({
    ok: true,
    canvasId,
    workflowId,
    outputId,
    runId: run.id,
    status: terminal.status,
    steps: terminal.planSnapshot?.steps?.map((step) => ({ nodeId: step.nodeId, type: step.nodeType })),
    events: events.items || [],
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
