import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL || "http://127.0.0.1:18200";
const email = process.env.XINGHUAN_VERIFY_EMAIL || process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL || "";
const password = process.env.XINGHUAN_VERIFY_PASSWORD || process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD || "";
const providerId = "grsai";
const modelId = "nano-banana-fast";
const modelRecordId = "grsai-image-nano-banana-fast";
const key = `gray-chain-${randomUUID()}`;
let cookie = "";

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { origin: baseUrl, referer: `${baseUrl}/`, ...(cookie ? { cookie } : {}), ...(options.headers || {}) },
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
  const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  assert.equal(login.authenticated, true, "GRAY_LOGIN_FAILED");

  const created = await request("/api/canvas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: `Gray AI image chain ${key}` }) });
  const canvasId = text(created.id);
  assert(canvasId, "CANVAS_CREATE_FAILED");
  const imageData = (prompt) => ({ prompt, generationCount: 3, taskCapability: "image", backendProviderId: providerId, providerModel: modelId, providerParams: { modelRecordId, sourceNodeId: key, sourceCanvasId: canvasId } });
  await request(`/api/canvas/${encodeURIComponent(canvasId)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
    revision: created.revision,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      { id: `${key}-image-1`, type: "image", position: { x: 80, y: 120 }, data: imageData("A premium cobalt-blue glass perfume bottle, centered studio product photo, square composition") },
      { id: `${key}-selector`, type: "smart-candidate-selector", position: { x: 440, y: 120 }, data: { selectorMediaKind: "image", selectorMode: "manual", selectorMaximum: 1, selectorMinimumConfidence: 0 } },
      { id: `${key}-image-2`, type: "image", position: { x: 760, y: 120 }, data: imageData("Restyle the selected bottle into jade-green glass on brushed steel while preserving its centered composition") },
      { id: `${key}-resize`, type: "resize", position: { x: 1120, y: 120 }, data: { width: 768, height: 768, fit: "contain" } },
    ],
    edges: [
      { id: `${key}-e1`, source: `${key}-image-1`, target: `${key}-selector` },
      { id: `${key}-e2`, source: `${key}-selector`, target: `${key}-image-2` },
      { id: `${key}-e3`, source: `${key}-image-2`, target: `${key}-resize` },
    ],
  }) });

  const run = await request("/api/canvas-runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ canvasId, idempotencyKey: `${key}-create`, budget: { maxTaskCount: 8, maxAttemptsPerStep: 1, maxDurationSeconds: 900 } }) });
  await request(`/api/canvas-runs/${encodeURIComponent(run.id)}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `${key}-start` }) });

  let selection = null;
  let terminal = null;
  for (let attempt = 0; attempt < 540; attempt += 1) {
    const current = await request(`/api/canvas-runs/${encodeURIComponent(run.id)}`);
    if (!selection) {
      const pending = await request(`/api/canvas-runs/${encodeURIComponent(run.id)}/candidate-selections`);
      const item = Array.isArray(pending.items) ? pending.items[0] : null;
      const artifactId = text(item?.candidates?.[0]?.artifactId);
      if (item && artifactId) {
        selection = await request(`/api/canvas-runs/${encodeURIComponent(run.id)}/candidate-selections/${encodeURIComponent(item.stepId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedArtifactIds: [artifactId], idempotencyKey: `${key}-select` }) });
      }
    }
    if (["succeeded", "failed", "cancelled"].includes(text(current.status))) { terminal = current; break; }
    await wait(2_000);
  }
  assert.equal(terminal?.status, "succeeded", `CANVAS_CHAIN_NOT_SUCCEEDED:${terminal?.status || "timeout"}`);
  const events = await request(`/api/canvas-runs/${encodeURIComponent(run.id)}/events`);
  assert(selection, "CANDIDATE_SELECTION_NOT_RECORDED");
  console.log(JSON.stringify({ ok: true, canvasId, runId: run.id, selectedArtifactIds: selection.selectedArtifactIds || [], events: events.items || [] }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.stack || error.message : String(error)); process.exitCode = 1; });
