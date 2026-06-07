import { createServer } from "node:http";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";

let cookie = "";
let submitRequest = null;
let pollRequest = null;

async function main() {
  const upstream = await startMockGrsaiServer();
  const providerId = `verify-worker-grsai-${Date.now()}`;
  const modelId = "verify-worker-grsai-model";
  try {
    const login = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    assert(login.data?.authenticated === true, "login failed");

    const system = await fetchJson("/api/admin/system");
    assert(system.data?.redis?.status === "connected", "redis is not connected");
    assert(system.data?.database?.status === "connected", "database is not connected");

    const provider = await fetchJson("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerId,
        name: "Verify Worker GRSAI Provider",
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
            modelId,
            capability: "image",
            displayName: "Verify Worker GRSAI Model",
            protocolOverride: "grsai_draw",
          },
        ],
      }),
    });
    const modelRecord = imported.data?.models?.find((model) => model.modelId === modelId);
    assert(Boolean(modelRecord?.id), "model was not imported");

    const prompt = "worker grsai image adapter prompt";
    const created = await fetchJson("/api/admin/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `worker grsai image adapter ${Date.now()}`,
        status: "queued",
        providerId,
        modelId: modelRecord.id,
        payload: {
          kind: "image",
          prompt,
          size: "1024x1024",
          aspectRatio: "3:4",
          n: 1,
          images: ["https://example.test/reference.png"],
        },
      }),
    });
    const taskId = created.data?.id;
    assert(Boolean(taskId), "task was not created");

    let task = null;
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await sleep(1000);
      const tasks = await fetchJson("/api/admin/tasks");
      task = tasks.data?.find((item) => item.id === taskId);
      if (task?.status === "succeeded") break;
      if (task?.status === "failed") throw new Error(`task failed: ${(task.logs || []).join(" | ")}`);
    }

    assert(task?.status === "succeeded", `task did not succeed, current status=${task?.status || "missing"}`);
    assert(task?.result?.adapter === "grsai-image", "worker did not use grsai image adapter");
    assert(task?.result?.modelId === modelId, "worker result model mismatch");
    assert(Array.isArray(task?.result?.imageUrls) && task.result.imageUrls[0] === "https://cdn.example.test/grsai-worker-image.png", "worker image result missing");
    assert(task?.result?.taskId === "task-worker-grsai-1", "worker task id mismatch");
    assert(submitRequest?.body?.model === modelId, "submit model mismatch");
    assert(submitRequest?.body?.prompt === prompt, "submit prompt mismatch");
    assert(submitRequest?.body?.aspectRatio === "3:4", "submit aspect ratio mismatch");
    assert(submitRequest?.body?.size === "1024x1024", "submit size mismatch");
    assert(Array.isArray(submitRequest?.body?.urls) && submitRequest.body.urls[0] === "https://example.test/reference.png", "submit urls mismatch");
    assert(submitRequest?.authorization === "Bearer verify-worker-grsai-key", "submit auth mismatch");
    assert(pollRequest?.body?.taskId === "task-worker-grsai-1", "poll task id mismatch");

    console.log(
      JSON.stringify(
        {
          ok: true,
          taskId,
          status: task.status,
          adapter: task.result.adapter,
          imageCount: task.result.imageCount,
          upstream: {
            submitModel: submitRequest.body.model,
            pollTaskId: pollRequest.body.taskId,
            authorization: submitRequest.authorization ? "present" : "missing",
          },
        },
        null,
        2,
      ),
    );
  } finally {
    if (cookie) {
      await fetchText(`/api/admin/providers/${providerId}`, { method: "DELETE" }).catch(() => undefined);
    }
    upstream.server.close();
  }
}

function startMockGrsaiServer() {
  return new Promise((resolve) => {
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
          pollRequest = {
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
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
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
