import { createServer } from "node:http";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const png1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==";

let cookie = "";
let submitRequest = null;
let pollRequest = null;

async function main() {
  const login = await fetchJson("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  assert(login.data?.authenticated === true, "login failed");

  const system = await fetchJson("/api/admin/system");
  assert(system.data?.redis?.status === "connected", "redis is not connected");
  assert(system.data?.database?.status === "connected", "database is not connected");

  await verifyWorkerGrsaiSuccessScenario();
  await verifyWorkerGrsaiRetriesNonJsonGatewayFailure();
  await verifyWorkerGrsaiStopsAfterGatewayRetryExhaustion();
}

async function verifyWorkerGrsaiSuccessScenario() {
  const upstream = await startMockGrsaiServer({ kind: "success" });
  const result = await runWorkerScenario({
    providerId: `verify-worker-grsai-${Date.now()}`,
    providerName: "Verify Worker GRSAI Provider",
    modelId: "verify-worker-grsai-model",
    modelDisplayName: "Verify Worker GRSAI Model",
    prompt: "worker grsai image adapter prompt",
    expectedFinalStatus: "succeeded",
  }, upstream);

  assert(result.task?.result?.adapter === "grsai-image", "worker did not use grsai image adapter");
  assert(result.task?.result?.modelId === "verify-worker-grsai-model", "worker result model mismatch");
  assert(Array.isArray(result.task?.result?.imageUrls) && result.task.result.imageUrls[0] === "https://cdn.example.test/grsai-worker-image.png", "worker image result missing");
  assert(result.task?.result?.taskId === "task-worker-grsai-1", "worker task id mismatch");
  assert(result.submitRequest?.body?.model === "verify-worker-grsai-model", "submit model mismatch");
  assert(result.submitRequest?.body?.prompt === "worker grsai image adapter prompt", "submit prompt mismatch");
  assert(result.submitRequest?.body?.aspectRatio === "3:4", "submit aspect ratio mismatch");
  assert(result.submitRequest?.body?.size === "1024x1024", "submit size mismatch");
  assert(Array.isArray(result.submitRequest?.body?.urls) && /^data:image\/png;base64,/.test(result.submitRequest.body.urls[0] || ""), "submit local reference was not inlined");
  assert(result.submitRequest?.authorization === "Bearer verify-worker-grsai-key", "submit auth mismatch");
  assert(result.pollRequest?.body?.taskId === "task-worker-grsai-1", "poll task id mismatch");

  console.log(
    JSON.stringify(
      {
        ok: true,
        taskId: result.taskId,
        status: result.task.status,
        adapter: result.task.result.adapter,
        imageCount: result.task.result.imageCount,
        upstream: {
          submitModel: result.submitRequest.body.model,
          pollTaskId: result.pollRequest.body.taskId,
          authorization: result.submitRequest.authorization ? "present" : "missing",
        },
      },
      null,
      2,
    ),
  );
}

async function verifyWorkerGrsaiRetriesNonJsonGatewayFailure() {
  const upstream = await startMockGrsaiServer({ kind: "non_json_retry_then_success" });
  const result = await runWorkerScenario({
    providerId: `verify-worker-grsai-retry-${Date.now()}`,
    providerName: "Verify Worker GRSAI Retry Provider",
    modelId: "verify-worker-grsai-retry-model",
    modelDisplayName: "Verify Worker GRSAI Retry Model",
    prompt: "worker grsai retry non-json gateway",
    expectedFinalStatus: "succeeded",
  }, upstream);

  assert(result.upstreamState.pollAttempts === 3, `expected 3 poll attempts, got ${result.upstreamState.pollAttempts}`);
  assert(Array.isArray(result.task?.result?.imageUrls) && result.task.result.imageUrls[0] === "https://cdn.example.test/grsai-worker-retry-image.png", "worker retry image result missing");
  console.log("PASS worker grsai image adapter retries non-JSON gateway poll failures");
}

async function verifyWorkerGrsaiStopsAfterGatewayRetryExhaustion() {
  const upstream = await startMockGrsaiServer({ kind: "non_json_retry_exhaust" });
  const result = await runWorkerScenario({
    providerId: `verify-worker-grsai-exhaust-${Date.now()}`,
    providerName: "Verify Worker GRSAI Exhaust Provider",
    modelId: "verify-worker-grsai-exhaust-model",
    modelDisplayName: "Verify Worker GRSAI Exhaust Model",
    prompt: "worker grsai retry exhaustion",
    expectedFinalStatus: "failed",
  }, upstream);

  assert(result.upstreamState.pollAttempts === 5, `expected 5 poll attempts before exhaustion, got ${result.upstreamState.pollAttempts}`);
  assert(/temporarily unavailable/i.test(String(result.task?.result?.failureReason || "")), "failure reason should preserve gateway body text");
  assert(Number(result.task?.result?.upstreamHttpStatus) === 502, "upstream http status should be preserved on worker failure");
  console.log("PASS worker grsai image adapter stops retrying after gateway exhaustion");
}

async function runWorkerScenario(config, upstream) {
  const providerId = config.providerId;
  let taskId = "";
  try {
    submitRequest = null;
    pollRequest = null;

    const provider = await fetchJson("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerId,
        name: config.providerName,
        baseUrl: upstream.url,
        protocol: "grsai_draw",
        enabled: true,
        apiKey: "verify-worker-grsai-key",
      }),
    });
    assert(provider.data?.id === providerId, "provider was not created");

    const imported = await fetchJson(`/api/admin/providers/${providerId}/import-models`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        models: [
          {
            modelId: config.modelId,
            capability: "image",
            displayName: config.modelDisplayName,
            protocolOverride: "grsai_draw",
          },
        ],
      }),
    });
    const modelRecord = imported.data?.models?.find((model) => model.modelId === config.modelId);
    assert(Boolean(modelRecord?.id), "model was not imported");

    const uploadForm = new FormData();
    uploadForm.set("file", new Blob([Buffer.from(png1x1, "base64")], { type: "image/png" }), "worker-grsai-reference.png");
    const uploadedReference = await fetchJson("/api/files/upload", { method: "POST", body: uploadForm });
    const referenceUrl = uploadedReference.data?.url || "";
    assert(referenceUrl.startsWith("/files/input/"), "reference image was not uploaded");

    const created = await fetchJson("/api/admin/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `${config.providerName} ${Date.now()}`,
        status: "queued",
        providerId,
        modelId: modelRecord.id,
        payload: {
          kind: "image",
          prompt: config.prompt,
          size: "1024x1024",
          aspectRatio: "3:4",
          n: 1,
          images: [referenceUrl],
        },
      }),
    });
    taskId = created.data?.id || "";
    assert(taskId, "task was not created");

    let task = null;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await sleep(1000);
      const tasks = await fetchJson("/api/admin/tasks");
      task = tasks.data?.find((item) => item.id === taskId);
      if (task?.status === config.expectedFinalStatus) break;
      if (config.expectedFinalStatus === "succeeded" && task?.status === "failed") {
        throw new Error(`task failed unexpectedly: ${(task.logs || []).join(" | ")}`);
      }
    }

    assert(task?.status === config.expectedFinalStatus, `task did not reach expected status=${config.expectedFinalStatus}, current=${task?.status || "missing"}`);
    return { taskId, task, submitRequest, pollRequest, upstreamState: upstream.state };
  } finally {
    if (cookie) {
      await fetchText(`/api/admin/providers/${providerId}`, { method: "DELETE" }).catch(() => undefined);
    }
    upstream.server.close();
  }
}

function startMockGrsaiServer(scenario) {
  return new Promise((resolve) => {
    const state = { pollAttempts: 0 };
    const server = createServer((request, response) => {
      let text = "";
      request.on("data", (chunk) => {
        text += chunk;
      });
      request.on("end", () => {
        const body = text ? JSON.parse(text) : {};
        if (request.url === "/v1/draw/completions") {
          submitRequest = {
            method: request.method,
            url: request.url,
            authorization: request.headers.authorization,
            body,
          };
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({
            code: 0,
            data: {
              id: "task-worker-grsai-1",
              status: "pending",
            },
          }));
          return;
        }
        if (request.url === "/v1/draw/result") {
          state.pollAttempts += 1;
          pollRequest = {
            method: request.method,
            url: request.url,
            authorization: request.headers.authorization,
            body,
          };
          if (scenario.kind === "non_json_retry_then_success") {
            if (state.pollAttempts <= 2) {
              response.writeHead(502, { "content-type": "text/html" });
              response.end("<html><body>temporarily unavailable</body></html>");
              return;
            }
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify({
              code: 0,
              data: {
                id: "task-worker-grsai-1",
                status: "succeeded",
                results: [{ url: "https://cdn.example.test/grsai-worker-retry-image.png" }],
              },
            }));
            return;
          }
          if (scenario.kind === "non_json_retry_exhaust") {
            response.writeHead(502, { "content-type": "text/html" });
            response.end("<html><body>temporarily unavailable</body></html>");
            return;
          }
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({
            code: 0,
            data: {
              id: "task-worker-grsai-1",
              status: "succeeded",
              results: [{ url: "https://cdn.example.test/grsai-worker-image.png" }],
            },
          }));
          return;
        }
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: `Unexpected path ${request.url}` }));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}`, state });
    });
  });
}

async function fetchText(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  return { status: response.status, text: await response.text() };
}

async function fetchJson(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${text}`);
  return JSON.parse(text);
}

function withCookie(options = {}) {
  return {
    ...options,
    headers: {
      origin: baseUrl,
      referer: `${baseUrl}/`,
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  };
}

function captureCookie(response) {
  const raw = response.headers.get("set-cookie");
  if (!raw) return;
  cookie = raw.split(";")[0];
}

function toUrl(pathname) {
  if (String(pathname).startsWith("http://") || String(pathname).startsWith("https://")) return pathname;
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
