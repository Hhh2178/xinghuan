import { createServer } from "node:http";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const png1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==";

let cookie = "";
const upstreamRequests = [];

async function main() {
  const upstream = await startMockModelScopeServer();
  const providerId = `verify-modelscope-${Date.now()}`;
  const modelId = "Qwen/Qwen-Image-2512";
  try {
    const login = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    assert(login.data?.authenticated === true, "login failed");

    const provider = await fetchJson("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerId,
        name: "Verify ModelScope Provider",
        baseUrl: upstream.url,
        protocol: "modelscope",
        enabled: true,
        apiKey: "verify-modelscope-key",
      }),
    });
    assert(provider.data?.id === providerId, "provider was not created");

    const imported = await fetchJson(`/api/admin/providers/${providerId}/import-models`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        models: [{ modelId, capability: "image", displayName: "Verify ModelScope Image" }],
      }),
    });
    const modelRecord = imported.data?.models?.find((model) => model.modelId === modelId);
    assert(Boolean(modelRecord?.id), "model was not imported");

    await fetchJson(`/api/admin/models/${modelRecord.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        executionMode: "worker_queue",
        advancedConfig: {
          executionMode: "worker_queue",
          taskIdPath: "task_id",
          taskStatusPath: "task_status",
          pollPathTemplate: "tasks/{task_id}",
          pollTimeoutMs: 60000,
          pollIntervalMs: 200,
        },
      }),
    });

    const generated = await fetchJson("/api/proxy/external/image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId,
        providerModel: modelId,
        model: modelId,
        prompt: "verification modelscope image",
        size: "1024x1024",
        n: 1,
        providerParams: { modelRecordId: modelRecord?.id, size: "1024x1024" },
      }),
    });
    const imageUrl = generated.data?.imageUrls?.[0] || "";
    assert(imageUrl.startsWith("/files/output/"), "modelscope proxy did not return local image");

    const submit = upstreamRequests.find((item) => item.kind === "submit");
    const poll = upstreamRequests.find((item) => item.kind === "poll");
    assert(submit?.headers?.["x-modelscope-async-mode"] === "true", "submit missing ModelScope async header");
    assert(poll?.headers?.["x-modelscope-task-type"] === "image_generation", "poll missing ModelScope task type header");
    assert(poll?.url === "/v1/tasks/ms_task_123", "poll path mismatch");

    const image = await fetchText(imageUrl);
    assert(image.status === 200 && /^image\//i.test(image.contentType), "saved image missing");

    console.log(JSON.stringify({
      ok: true,
      providerId,
      modelId,
      imageUrl,
      submitHeaders: submit?.headers,
      pollHeaders: poll?.headers,
    }, null, 2));
  } finally {
    if (cookie) {
      await fetchText(`/api/admin/providers/${providerId}`, { method: "DELETE" }).catch(() => undefined);
    }
    upstream.server.close();
  }
}

function startMockModelScopeServer() {
  return new Promise((resolve) => {
    let origin = "";
    let pollCount = 0;
    const server = createServer((request, response) => {
      if (request.method === "GET" && request.url === "/assets/generated.png") {
        response.writeHead(200, { "content-type": "image/png" });
        response.end(Buffer.from(png1x1, "base64"));
        return;
      }
      let text = "";
      request.on("data", (chunk) => {
        text += chunk;
      });
      request.on("end", () => {
        const body = text ? JSON.parse(text) : {};
        const headers = lowerCaseHeaders(request.headers);
        if (request.method === "GET" && request.url === "/v1/tasks/ms_task_123") {
          pollCount += 1;
          upstreamRequests.push({ kind: "poll", method: request.method, url: request.url, headers, body });
          response.writeHead(200, { "content-type": "application/json" });
          if (pollCount === 1) {
            response.end(JSON.stringify({ task_id: "ms_task_123", task_status: "RUNNING" }));
            return;
          }
          response.end(JSON.stringify({
            task_id: "ms_task_123",
            task_status: "SUCCEED",
            output_images: [`${origin}/assets/generated.png`],
          }));
          return;
        }
        upstreamRequests.push({ kind: "submit", method: request.method, url: request.url, headers, body });
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({
          task_id: "ms_task_123",
          task_status: "PENDING",
          request_id: "req_modelscope_123",
        }));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      origin = `http://127.0.0.1:${address.port}`;
      resolve({ server, url: origin });
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
