import { createServer } from "node:http";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18380";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const png1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==";

let cookie = "";

async function main() {
  const agnes = await startAgnesMockServer();
  const modelscope = await startModelScopeMockServer();
  const agnesProviderId = `verify-agnes-${Date.now()}`;
  const modelscopeProviderId = `verify-modelscope-${Date.now()}`;
  try {
    await login();

    const agnesModelRecordId = await createProviderAndModel({
      providerId: agnesProviderId,
      name: "Verify Agnes Provider",
      baseUrl: agnes.url,
      protocol: "openai",
      apiKey: "verify-agnes-key",
      modelId: "agnes-image-2.1-flash",
      capability: "image",
      displayName: "Verify Agnes Image",
      advancedConfig: { executionMode: "worker_queue" },
    });

    const modelscopeModelRecordId = await createProviderAndModel({
      providerId: modelscopeProviderId,
      name: "Verify ModelScope Provider",
      baseUrl: modelscope.url,
      protocol: "modelscope",
      apiKey: "verify-modelscope-key",
      modelId: "Qwen/Qwen-Image-2512",
      capability: "image",
      displayName: "Verify ModelScope Image",
      advancedConfig: {
        executionMode: "worker_queue",
        taskIdPath: "task_id",
        taskStatusPath: "task_status",
        pollPathTemplate: "tasks/{task_id}",
        pollIntervalMs: 100,
        pollTimeoutMs: 60000,
      },
    });

    const tasks = await Promise.all([
      submitImageTask(agnesProviderId, "agnes-image-2.1-flash", agnesModelRecordId, "agnes-1"),
      submitImageTask(agnesProviderId, "agnes-image-2.1-flash", agnesModelRecordId, "agnes-2"),
      submitImageTask(modelscopeProviderId, "Qwen/Qwen-Image-2512", modelscopeModelRecordId, "modelscope-1"),
      submitImageTask(modelscopeProviderId, "Qwen/Qwen-Image-2512", modelscopeModelRecordId, "modelscope-2"),
    ]);

    const finished = await Promise.all(tasks.map((task) => waitTaskSucceeded(task.taskId)));
    const allImagesReturned = finished.every((task) => Array.isArray(task.imageUrls) && task.imageUrls[0]?.startsWith("/files/output/"));
    assert(allImagesReturned, "not all tasks returned local materialized images");
    assert(agnes.submitCount >= 2, "agnes submit count too low");
    assert(modelscope.submitCount >= 2, "modelscope submit count too low");
    assert(modelscope.pollCount >= 2, "modelscope poll count too low");
    assert(modelscope.lastSubmitHeaders["x-modelscope-async-mode"] === "true", "modelscope submit header missing");
    assert(modelscope.lastPollHeaders["x-modelscope-task-type"] === "image_generation", "modelscope poll header missing");

    console.log(JSON.stringify({
      ok: true,
      finished: finished.map((task) => ({ taskId: task.taskId, status: task.status, imageCount: task.imageUrls.length })),
      agnes: { submitCount: agnes.submitCount },
      modelscope: {
        submitCount: modelscope.submitCount,
        pollCount: modelscope.pollCount,
      },
    }, null, 2));
  } finally {
    if (cookie) {
      await deleteProvider(agnesProviderId).catch(() => undefined);
      await deleteProvider(modelscopeProviderId).catch(() => undefined);
    }
    agnes.server.close();
    modelscope.server.close();
  }
}

async function login() {
  const result = await fetchJson("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  assert(result.data?.authenticated === true, "login failed");
}

async function createProviderAndModel({ providerId, name, baseUrl, protocol, apiKey, modelId, capability, displayName, advancedConfig }) {
  await fetchJson("/api/admin/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: providerId,
      name,
      baseUrl,
      protocol,
      enabled: true,
      apiKey,
    }),
  });
  const imported = await fetchJson(`/api/admin/providers/${providerId}/import-models`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      models: [{ modelId, capability, displayName }],
    }),
  });
  const modelRecord = imported.data?.models?.find((item) => item.modelId === modelId);
  assert(modelRecord?.id, `model import failed for ${modelId}`);
  await fetchJson(`/api/admin/models/${modelRecord.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      executionMode: "worker_queue",
      advancedConfig,
    }),
  });
  return modelRecord.id;
}

async function submitImageTask(providerId, modelId, modelRecordId, prompt) {
  const result = await fetchJson("/api/proxy/external/image/task", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerId,
      providerModel: modelId,
      model: modelId,
      prompt,
      providerParams: { modelRecordId },
      size: "1024x1024",
      n: 1,
    }),
  });
  assert(result.data?.taskId, `task submit failed for ${prompt}`);
  return result.data;
}

async function waitTaskSucceeded(taskId) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await fetchJson(`/api/proxy/external/image/task/${encodeURIComponent(taskId)}`);
    if (result.data?.status === "succeeded") return result.data;
    if (result.data?.status === "failed") {
      throw new Error(`task failed ${taskId}: ${result.data?.error || result.data?.logs?.join(" | ") || "unknown"}`);
    }
    await sleep(200);
  }
  throw new Error(`task timeout ${taskId}`);
}

async function deleteProvider(providerId) {
  return fetchText(`/api/admin/providers/${providerId}`, { method: "DELETE" });
}

function startAgnesMockServer() {
  return new Promise((resolve) => {
    let origin = "";
    const state = { submitCount: 0 };
    const server = createServer((request, response) => {
      if (request.method === "GET" && request.url === "/assets/agnes.png") {
        response.writeHead(200, { "content-type": "image/png" });
        response.end(Buffer.from(png1x1, "base64"));
        return;
      }
      let text = "";
      request.on("data", (chunk) => {
        text += chunk;
      });
      request.on("end", () => {
        state.submitCount += 1;
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({
          data: [{ url: `${origin}/assets/agnes.png` }],
        }));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      origin = `http://127.0.0.1:${address.port}`;
      resolve({ server, url: origin, get submitCount() { return state.submitCount; } });
    });
  });
}

function startModelScopeMockServer() {
  return new Promise((resolve) => {
    let origin = "";
    const state = {
      submitCount: 0,
      pollCount: 0,
      lastSubmitHeaders: {},
      lastPollHeaders: {},
    };
    const server = createServer((request, response) => {
      if (request.method === "GET" && request.url?.startsWith("/assets/modelscope-")) {
        response.writeHead(200, { "content-type": "image/png" });
        response.end(Buffer.from(png1x1, "base64"));
        return;
      }
      let text = "";
      request.on("data", (chunk) => {
        text += chunk;
      });
      request.on("end", () => {
        const headers = lowerCaseHeaders(request.headers);
        if (request.method === "GET" && request.url?.startsWith("/v1/tasks/")) {
          state.pollCount += 1;
          state.lastPollHeaders = headers;
          const taskId = request.url.split("/").pop();
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({
            task_id: taskId,
            task_status: "SUCCEED",
            output_images: [`${origin}/assets/${taskId}.png`],
          }));
          return;
        }
        state.submitCount += 1;
        state.lastSubmitHeaders = headers;
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({
          task_id: `modelscope-task-${state.submitCount}`,
          task_status: "PENDING",
          request_id: `req-${state.submitCount}`,
        }));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      origin = `http://127.0.0.1:${address.port}`;
      resolve({
        server,
        url: origin,
        get submitCount() { return state.submitCount; },
        get pollCount() { return state.pollCount; },
        get lastSubmitHeaders() { return state.lastSubmitHeaders; },
        get lastPollHeaders() { return state.lastPollHeaders; },
      });
    });
  });
}

function lowerCaseHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value.join(",") : String(value || "")]));
}

async function fetchText(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  return { status: response.status, text: await response.text(), contentType: response.headers.get("content-type") || "" };
}

async function fetchJson(pathname, options, config = {}) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  const text = await response.text();
  if (!response.ok && !config.allowFailure) throw new Error(`${pathname} returned ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

function withCookie(options = {}) {
  return {
    ...options,
    headers: {
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
