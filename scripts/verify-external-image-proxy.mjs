import { createServer } from "node:http";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const png1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==";
const asyncModelId = "verify-image-async-model";

let cookie = "";
const upstreamRequests = [];

async function main() {
  const upstream = await startMockOpenAiServer();
  const providerId = `verify-image-${Date.now()}`;
  const modelId = "verify-image-model";
  const asyncProviderId = `verify-image-async-${Date.now()}`;
  const results = [];
  try {
    const login = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    results.push(["POST /api/auth/login", login.data?.authenticated === true]);

    const provider = await fetchJson("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerId,
        name: "Verify Image Provider",
        baseUrl: upstream.url,
        protocol: "openai",
        enabled: true,
        apiKey: "verify-key",
      }),
    });
    results.push(["POST /api/admin/providers", provider.data?.id === providerId]);

    const asyncProvider = await fetchJson("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: asyncProviderId,
        name: "Verify Async Image Provider",
        baseUrl: upstream.url,
        protocol: "apimart",
        enabled: true,
        apiKey: "verify-key",
      }),
    });
    results.push(["POST /api/admin/providers async", asyncProvider.data?.id === asyncProviderId]);

    const imported = await fetchJson(`/api/admin/providers/${providerId}/import-models`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        models: [{ modelId, capability: "image", displayName: "Verify Image Model" }],
      }),
    });
    const modelRecord = imported.data?.models?.find((model) => model.modelId === modelId);
    results.push(["POST /api/admin/providers/:id/import-models", Boolean(modelRecord?.id)]);

    const importedAsync = await fetchJson(`/api/admin/providers/${asyncProviderId}/import-models`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        models: [{ modelId: asyncModelId, capability: "image", displayName: "Verify Async Image Model" }],
      }),
    });
    const asyncModelRecord = importedAsync.data?.models?.find((model) => model.modelId === asyncModelId);
    results.push(["POST /api/admin/providers/:id/import-models async", Boolean(asyncModelRecord?.id)]);

    const uploadForm = new FormData();
    uploadForm.set("file", new Blob([Buffer.from(png1x1, "base64")], { type: "image/png" }), "reference.png");
    const uploadedReference = await fetchJson("/api/files/upload", { method: "POST", body: uploadForm });
    const referenceUrl = uploadedReference.data?.url || "";
    results.push(["POST /api/files/upload reference", referenceUrl.startsWith("/files/input/")]);

    const generated = await fetchJson("/api/proxy/external/image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId,
        providerModel: modelId,
        model: modelId,
        prompt: "verification image",
        images: [referenceUrl],
        size: "1024x1024",
        n: 1,
        providerParams: { modelRecordId: modelRecord?.id, aspectRatio: "1:1", size: "1024x1024" },
      }),
    });
    const imageUrl = generated.data?.imageUrls?.[0] || "";
    results.push(["POST /api/proxy/external/image returns local image", imageUrl.startsWith("/files/output/")]);
    const syncSubmit = upstreamRequests.find((item) => item.kind === "sync-submit");
    results.push(["Proxy forwards selected provider model", syncSubmit?.body?.model === modelId]);
    results.push(["Proxy forwards prompt", syncSubmit?.body?.prompt === "verification image"]);
    const providerReferenceUrl = syncSubmit?.body?.image?.[0] || "";
    results.push(["Proxy creates signed provider reference URL", isSignedProviderReferenceUrl(providerReferenceUrl)]);
    results.push(["Proxy sends auth header", syncSubmit?.authorization === "Bearer verify-key"]);

    const image = await fetchText(imageUrl);
    results.push(["GET generated /files/output image", image.status === 200 && /^image\//i.test(image.contentType)]);
    const providerReference = await fetch(toUrl(providerReferenceUrl));
    results.push(["GET signed provider reference without cookie", providerReference.status === 200 && /^image\//i.test(providerReference.headers.get("content-type") || "")]);

    const asyncGenerated = await fetchJson("/api/proxy/external/image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId: asyncProviderId,
        providerModel: asyncModelId,
        model: asyncModelId,
        prompt: "verification async image",
        size: "1024x1024",
        n: 1,
        providerParams: { modelRecordId: asyncModelRecord?.id, size: "1024x1024" },
      }),
    });
    const asyncImageUrl = asyncGenerated.data?.imageUrls?.[0] || "";
    results.push(["POST /api/proxy/external/image polls async task result", asyncImageUrl.startsWith("/files/output/")]);
    const asyncSubmit = upstreamRequests.find((item) => item.kind === "async-submit");
    const asyncStatus = upstreamRequests.find((item) => item.kind === "async-status");
    results.push(["Async image submit forwards provider model", asyncSubmit?.body?.model === asyncModelId]);
    results.push(["Async image task status endpoint is queried", asyncStatus?.url === "/v1/tasks/task_image_verify_123"]);
    const asyncImage = await fetchText(asyncImageUrl);
    results.push(["GET async generated /files/output image", asyncImage.status === 200 && /^image\//i.test(asyncImage.contentType)]);

    const failed = results.filter(([, ok]) => !ok);
    for (const [name, ok] of results) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
    if (failed.length > 0) process.exit(1);
  } finally {
    if (cookie) {
      await fetchText(`/api/admin/providers/${providerId}`, { method: "DELETE" }).catch(() => undefined);
      await fetchText(`/api/admin/providers/${asyncProviderId}`, { method: "DELETE" }).catch(() => undefined);
    }
    upstream.server.close();
  }
}

function startMockOpenAiServer() {
  return new Promise((resolve) => {
    let asyncStatusCount = 0;
    let origin = "";
    const server = createServer(async (request, response) => {
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
        if (request.method === "GET" && request.url === "/v1/tasks/task_image_verify_123") {
          asyncStatusCount += 1;
          upstreamRequests.push({
            kind: "async-status",
            method: request.method,
            url: request.url,
            authorization: request.headers.authorization,
            body,
          });
          response.writeHead(200, { "content-type": "application/json" });
          if (asyncStatusCount === 1) {
            response.end(JSON.stringify({ code: 200, data: { status: "pending", progress: 0, estimated_time: 1 } }));
            return;
          }
          response.end(JSON.stringify({
            code: 200,
            data: {
              status: "completed",
              progress: 100,
              result: {
                images: [
                  {
                    url: [
                      `${origin}/assets/generated.png`,
                    ],
                  },
                ],
              },
            },
          }));
          return;
        }
        const kind = body.model === asyncModelId ? "async-submit" : "sync-submit";
        upstreamRequests.push({
          kind,
          method: request.method,
          url: request.url,
          authorization: request.headers.authorization,
          body,
        });
        response.writeHead(200, { "content-type": "application/json" });
        if (body.model === asyncModelId) {
          response.end(JSON.stringify({ code: 200, data: [{ task_id: "task_image_verify_123", status: "submitted" }] }));
          return;
        }
        response.end(JSON.stringify({ data: [{ b64_json: png1x1 }] }));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      origin = `http://127.0.0.1:${address.port}`;
      resolve({ server, url: origin });
    });
  });
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

function isSignedProviderReferenceUrl(value) {
  if (!value || !/^https?:\/\//i.test(String(value))) return false;
  const url = new URL(String(value));
  return url.pathname.startsWith("/api/provider-files/") && url.pathname.includes("/input/") && url.searchParams.has("exp") && url.searchParams.has("sig");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
