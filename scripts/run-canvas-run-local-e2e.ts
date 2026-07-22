import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

import { Client } from "pg";

const baseUrl = requiredLoopbackUrl("XINGHUAN_CANVAS_E2E_BASE_URL");
const databaseUrl = requiredEnvironment("XINGHUAN_CANVAS_E2E_DATABASE_URL");
const redisUrl = requiredLoopbackUrl("XINGHUAN_CANVAS_E2E_REDIS_URL");
const adminEmail = requiredEnvironment("XINGHUAN_CANVAS_E2E_ADMIN_EMAIL");
const adminPassword = requiredEnvironment("XINGHUAN_CANVAS_E2E_ADMIN_PASSWORD");
const runKey = `canvas-e2e-${randomUUID()}`;
const requestOrigin = new URL(baseUrl).origin;
let cookie = "";

const mock = await startMockChatProvider();
const worker = startWorker();

try {
  await waitForWorker(worker);
  await request("/api/auth/login", { method: "POST", body: { email: adminEmail, password: adminPassword }, captureCookie: true });
  const providerId = `${runKey}-provider`;
  await request("/api/admin/providers", { method: "POST", body: { id: providerId, name: "Local Canvas Run E2E Provider", baseUrl: mock.url, protocol: "openai", enabled: true, apiKey: "local-e2e-only" } });
  const imported = await request<{ models?: Array<{ id?: string; modelId?: string }> }>(`/api/admin/providers/${encodeURIComponent(providerId)}/import-models`, { method: "POST", body: { models: [{ modelId: "local-e2e-chat", capability: "chat", displayName: "Local Canvas Run E2E Chat" }] } });
  const modelRecordId = String(imported.models?.find((model) => model.modelId === "local-e2e-chat")?.id || "");
  assert(modelRecordId, "CANVAS_E2E_MODEL_IMPORT_FAILED");

  const canvasId = await createNativeChatCanvas(providerId, modelRecordId);
  const successRun = await createRun(canvasId, "success");
  const sseEvent = await readFirstSseEvent(successRun.id);
  assert.equal(sseEvent.eventType, "canvas_run.created", "CANVAS_E2E_SSE_EVENT_MISSING");
  await command(successRun.id, "start", "success-start");
  assert.equal((await waitForTerminalRun(successRun.id)).status, "succeeded", "CANVAS_E2E_RUN_NOT_SUCCEEDED");
  const reconnectEvent = await readFirstSseEvent(successRun.id, sseEvent.sequence);
  assert(Number(reconnectEvent.sequence) > Number(sseEvent.sequence), "CANVAS_E2E_SSE_RECONNECT_MISSING");
  const events = await request<{ items?: Array<{ eventType?: string; payload?: Record<string, unknown> }> }>(`/api/canvas-runs/${encodeURIComponent(successRun.id)}/events`);
  const taskId = String(events.items?.find((event) => event.eventType === "canvas_run.step_dispatched")?.payload?.taskId || "");
  assert(taskId, "CANVAS_E2E_TASK_DISPATCH_EVENT_MISSING");
  assert(events.items?.some((event) => event.eventType === "canvas_run.step_succeeded" && event.payload?.deterministic === true), "CANVAS_E2E_DETERMINISTIC_STEP_MISSING");
  await assertTaskSettled(taskId);

  const pausedRun = await createRun(canvasId, "pause-resume");
  await command(pausedRun.id, "start", "pause-resume-start");
  await command(pausedRun.id, "pause", "pause-resume-pause");
  assert.equal((await request<{ status?: string }>(`/api/canvas-runs/${encodeURIComponent(pausedRun.id)}`)).status, "paused", "CANVAS_E2E_PAUSE_FAILED");
  await command(pausedRun.id, "resume", "pause-resume-resume");
  assert.equal((await waitForTerminalRun(pausedRun.id)).status, "succeeded", "CANVAS_E2E_RESUME_FAILED");

  const cancelledRun = await createRun(canvasId, "cancel");
  await command(cancelledRun.id, "cancel", "cancel-run");
  assert.equal((await request<{ status?: string }>(`/api/canvas-runs/${encodeURIComponent(cancelledRun.id)}`)).status, "cancelled", "CANVAS_E2E_CANCEL_FAILED");
  console.log(JSON.stringify({ ok: true, integration: "canvas-run-local-e2e", sse: true, taskSettled: true, pauseResume: true, cancel: true }));
} finally {
  worker.kill("SIGTERM");
  await mock.close();
}

async function createNativeChatCanvas(providerId: string, modelRecordId: string) {
  const created = await request<{ id: string; revision: number }>("/api/canvas", { method: "POST", body: { name: "Local Canvas Run E2E" } });
  await request(`/api/canvas/${encodeURIComponent(created.id)}`, { method: "PUT", body: {
    nodes: [
      { id: `${runKey}-text`, type: "text", position: { x: 80, y: 80 }, data: { prompt: "Return a concise local E2E response." } },
      { id: `${runKey}-llm`, type: "llm", position: { x: 420, y: 80 }, data: { backendProviderId: providerId, backendModelId: modelRecordId, providerModel: "local-e2e-chat", taskCapability: "chat", messages: [{ role: "user", content: "Return a concise local E2E response." }] } },
    ],
    edges: [{ id: `${runKey}-text-to-llm`, source: `${runKey}-text`, target: `${runKey}-llm` }], viewport: { x: 0, y: 0, zoom: 1 }, revision: created.revision,
  } });
  return created.id;
}

function createRun(canvasId: string, suffix: string) {
  return request<{ id: string }>("/api/canvas-runs", { method: "POST", body: { canvasId, idempotencyKey: `${runKey}-${suffix}`, budget: { maxTaskCount: 3, maxAttemptsPerStep: 1, maxDurationSeconds: 120 } } });
}

function command(runId: string, action: "start" | "pause" | "resume" | "cancel", suffix: string) {
  return request(`/api/canvas-runs/${encodeURIComponent(runId)}/${action}`, { method: "POST", body: { idempotencyKey: `${runKey}-${suffix}` } });
}

async function waitForTerminalRun(runId: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const run = await request<{ status?: string }>(`/api/canvas-runs/${encodeURIComponent(runId)}`);
    if (["succeeded", "failed", "cancelled"].includes(String(run.status))) return run;
    await wait(250);
  }
  throw new Error("CANVAS_E2E_RUN_TIMEOUT");
}

async function readFirstSseEvent(runId: string, lastEventId?: number) {
  const controller = new AbortController();
  try {
    const response = await fetch(new URL(`/api/canvas-runs/${encodeURIComponent(runId)}/events/stream`, baseUrl), { headers: { accept: "text/event-stream", cookie, ...(lastEventId === undefined ? {} : { "last-event-id": String(lastEventId) }) }, signal: controller.signal });
    assert.equal(response.status, 200, "CANVAS_E2E_SSE_STATUS_INVALID");
    const reader = response.body?.getReader();
    assert(reader, "CANVAS_E2E_SSE_BODY_MISSING");
    const deadline = Date.now() + 5_000;
    let body = "";
    while (Date.now() < deadline) {
      const chunk = await Promise.race([reader.read(), wait(1_000).then(() => ({ done: false, value: undefined }))]);
      if (chunk.value) body += new TextDecoder().decode(chunk.value);
      const match = body.match(/id: (\d+)\nevent: run-event\ndata: (.+)\n\n/);
      if (match) return { ...JSON.parse(match[2]) as { eventType?: string }, sequence: Number(match[1]) };
      if (chunk.done) break;
    }
    throw new Error("CANVAS_E2E_SSE_TIMEOUT");
  } finally {
    controller.abort();
  }
}

async function assertTaskSettled(taskId: string) {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000 });
  await client.connect();
  try {
    const result = await client.query<{ status: string }>("select status from xh_tasks where id = $1", [taskId]);
    assert.equal(result.rows[0]?.status, "succeeded", "CANVAS_E2E_TASK_NOT_SETTLED");
  } finally {
    await client.end();
  }
}

function startWorker() {
  return spawn(process.execPath, ["--import", "tsx", "apps/worker/src/worker.ts"], { cwd: process.cwd(), env: {
    ...process.env, DATABASE_URL: databaseUrl, XINGHUAN_DATABASE_URL: databaseUrl, XINGHUAN_REDIS_URL: redisUrl,
    XINGHUAN_APP_ENV: "local", XINGHUAN_CANVAS_RUN_WORKER_ENABLED: "true", XINGHUAN_CANVAS_RUN_POLL_INTERVAL_MS: "250",
    XINGHUAN_WORKER_POLL_TIMEOUT_SECONDS: "1", XINGHUAN_WORKER_QUEUE_REFRESH_INTERVAL_MS: "500", XINGHUAN_WORKER_ID: `${runKey}-worker`,
  }, stdio: ["ignore", "pipe", "pipe"] });
}

async function waitForWorker(worker: ReturnType<typeof startWorker>) {
  let stderr = "";
  worker.stderr?.on("data", (chunk) => { stderr += String(chunk); });
  await wait(500);
  if (worker.exitCode !== null) throw new Error(`CANVAS_E2E_WORKER_EXITED:${worker.exitCode}:${stderr.slice(-500)}`);
}

function request<T = Record<string, unknown>>(path: string, input: { method?: string; body?: unknown; captureCookie?: boolean } = {}) {
  return (async () => {
    const response = await fetch(new URL(path, baseUrl), { method: input.method || "GET", headers: { accept: "application/json", ...(input.body === undefined ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}), ...(input.method && input.method !== "GET" ? { origin: requestOrigin } : {}) }, body: input.body === undefined ? undefined : JSON.stringify(input.body) });
    if (input.captureCookie) cookie = String(response.headers.get("set-cookie") || "").split(";")[0];
    const text = await response.text();
    const parsed = text ? JSON.parse(text) as { data?: T; error?: string; message?: string } : {};
    if (!response.ok) throw new Error(`CANVAS_E2E_API_FAILED:${input.method || "GET"}:${path}:${response.status}:${parsed.error || parsed.message || "unknown"}`);
    return (parsed.data ?? parsed) as T;
  })();
}

function startMockChatProvider() {
  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    const server = createServer((request, response) => {
      if (request.method === "POST" && /\/chat\/completions$/.test(request.url || "")) return void setTimeout(() => { response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ id: "local-e2e-chat", choices: [{ message: { role: "assistant", content: "Local Canvas Run E2E response." }, finish_reason: "stop" }] })); }, 350);
      response.writeHead(404).end();
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object", "CANVAS_E2E_MOCK_ADDRESS_MISSING");
      resolve({ url: `http://127.0.0.1:${address.port}`, close: () => new Promise((done, reject) => server.close((error) => error ? reject(error) : done())) });
    });
  });
}

function requiredEnvironment(name: string) { const value = String(process.env[name] || "").trim(); if (!value) throw new Error(`${name}_REQUIRED`); return value; }
function requiredLoopbackUrl(name: string) { const value = requiredEnvironment(name); const url = new URL(value); if (!["http:", "https:", "redis:", "rediss:"].includes(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`${name}_LOOPBACK_REQUIRED`); return url.toString(); }
function wait(milliseconds: number) { return new Promise<void>((resolve) => setTimeout(resolve, milliseconds)); }
