import { createServer } from "node:http";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const png1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==";

let cookie = "";

async function main() {
  const upstream = await startMockOpenAiServer();
  const providerId = `verify-worker-output-${Date.now()}`;
  const modelId = "verify-worker-output-model";
  const sourceNodeId = `output-node-${Date.now()}`;
  const sourceCanvasId = `canvas-${Date.now()}`;
  try {
    const login = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    assert(login.data?.authenticated === true, "login failed");

    const beforeItems = await fetchJson("/api/resources/items?kind=image");
    const beforeIds = new Set((beforeItems.data || []).map((item) => item.id));

    const provider = await fetchJson("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerId,
        name: "Verify Worker Output Provider",
        baseUrl: upstream.url,
        protocol: "openai",
        enabled: true,
        apiKey: "verify-worker-output-key",
      }),
    });
    assert(provider.data?.id === providerId, "provider was not created");

    const imported = await fetchJson(`/api/admin/providers/${providerId}/import-models`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        models: [{ modelId, capability: "image", displayName: "Verify Worker Output Model" }],
      }),
    });
    const modelRecord = imported.data?.models?.find((model) => model.modelId === modelId);
    assert(Boolean(modelRecord?.id), "model was not imported");

    const created = await fetchJson("/api/admin/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `worker output material ${Date.now()}`,
        status: "queued",
        providerId,
        modelId: modelRecord.id,
        payload: {
          kind: "image",
          prompt: "worker output material prompt",
          size: "1024x1024",
          aspectRatio: "1:1",
          n: 1,
          sourceNodeId,
          sourceCanvasId,
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

    const afterItems = await fetchJson("/api/resources/items?kind=image");
    const createdItems = (afterItems.data || []).filter((item) => !beforeIds.has(item.id));
    const resourceItem = createdItems.find((item) => item.taskId === taskId || item.sourceNodeId === sourceNodeId);

    assert(createdItems.length > 0, "worker did not create any new image resource items");
    assert(resourceItem, "worker did not create a resource item linked to the task output");
    assert(resourceItem.fileUrl?.startsWith("/files/output/"), "resource item fileUrl was not materialized to local output");
    assert(resourceItem.sourceNodeId === sourceNodeId, "resource item sourceNodeId mismatch");
    assert(resourceItem.sourceCanvasId === sourceCanvasId, "resource item sourceCanvasId mismatch");

    const savedFile = await fetchText(resourceItem.fileUrl);
    assert(savedFile.status === 200, `materialized file is not readable, status=${savedFile.status}`);

    console.log(JSON.stringify({
      ok: true,
      taskId,
      resourceItemId: resourceItem.id,
      fileUrl: resourceItem.fileUrl,
      sourceNodeId: resourceItem.sourceNodeId,
      sourceCanvasId: resourceItem.sourceCanvasId,
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
