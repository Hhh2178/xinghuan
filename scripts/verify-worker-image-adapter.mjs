import { createServer } from "node:http";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const png1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==";

let cookie = "";
let upstreamRequest = null;

async function main() {
  const upstream = await startMockOpenAiServer();
  const providerId = `verify-worker-image-${Date.now()}`;
  const modelId = "verify-worker-image-model";
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
        name: "Verify Worker Image Provider",
        baseUrl: upstream.url,
        protocol: "openai",
        enabled: true,
        apiKey: "verify-worker-key",
      }),
    });
    assert(provider.data?.id === providerId, "provider was not created");

    const imported = await fetchJson(`/api/admin/providers/${providerId}/import-models`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        models: [{ modelId, capability: "image", displayName: "Verify Worker Image Model" }],
      }),
    });
    const modelRecord = imported.data?.models?.find((model) => model.modelId === modelId);
    assert(Boolean(modelRecord?.id), "model was not imported");

    const prompt = "worker image adapter prompt";
    const created = await fetchJson("/api/admin/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `worker image adapter ${Date.now()}`,
        status: "queued",
        providerId,
        modelId: modelRecord.id,
        payload: {
          kind: "image",
          prompt,
          size: "1024x1024",
          aspectRatio: "1:1",
          n: 1,
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
    assert(task?.result?.adapter === "openai-image", "worker did not use image adapter");
    assert(task?.result?.modelId === modelId, "worker result model mismatch");
    assert(Array.isArray(task?.result?.imageUrls) && task.result.imageUrls[0]?.startsWith("data:image/png;base64,"), "worker image result missing");
    assert(upstreamRequest?.body?.model === modelId, "upstream model mismatch");
    assert(upstreamRequest?.body?.prompt === prompt, "upstream prompt mismatch");
    assert(upstreamRequest?.authorization === "Bearer verify-worker-key", "upstream auth mismatch");

    console.log(JSON.stringify({
      ok: true,
      taskId,
      status: task.status,
      adapter: task.result.adapter,
      imageCount: task.result.imageCount,
      upstream: {
        model: upstreamRequest.body.model,
        prompt: upstreamRequest.body.prompt,
        authorization: upstreamRequest.authorization ? "present" : "missing",
      },
    }, null, 2));
  } finally {
    if (cookie) {
      await fetchText(`/api/admin/providers/${providerId}`, { method: "DELETE" }).catch(() => undefined);
    }
    upstream.server.close();
  }
}

function startMockOpenAiServer() {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      let text = "";
      request.on("data", (chunk) => {
        text += chunk;
      });
      request.on("end", () => {
        upstreamRequest = {
          method: request.method,
          url: request.url,
          authorization: request.headers.authorization,
          body: text ? JSON.parse(text) : {},
        };
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ data: [{ b64_json: png1x1 }] }));
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
