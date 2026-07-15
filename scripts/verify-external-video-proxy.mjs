import { createServer } from "node:http";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const sameOriginHeaders = {
  origin: baseUrl,
  referer: `${baseUrl}/`,
};
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const videoBytes = Buffer.from("00000018667479706d703432000000006d703432", "hex");
const png1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==";

let cookie = "";
let upstreamRequests = [];

async function main() {
  const upstream = await startMockServer();
  const providerId = `verify-video-${Date.now()}`;
  const syncModelId = "verify-video-model";
  try {
    console.log("[verify] login");
    await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    console.log("[verify] create provider");
    await fetchJson("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerId,
        name: "Verify Video Provider",
        baseUrl: upstream.url,
        protocol: "openai",
        enabled: true,
        apiKey: "verify-video-key",
      }),
    });
    console.log("[verify] import model");
    const imported = await fetchJson(`/api/admin/providers/${providerId}/import-models`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ models: [{ modelId: syncModelId, capability: "video", displayName: "Verify Video Model" }] }),
    });
    const modelRecord = imported.data?.models?.find((model) => model.modelId === syncModelId);
    console.log("[verify] upload reference");
    const uploadForm = new FormData();
    uploadForm.set("file", new Blob([Buffer.from(png1x1, "base64")], { type: "image/png" }), "video-reference.png");
    const uploadedReference = await fetchJson("/api/files/upload", { method: "POST", body: uploadForm });
    const referenceUrl = uploadedReference.data?.url || "";
    assert(referenceUrl.startsWith("/files/input/"), "reference image was not uploaded");

    console.log("[verify] sync video");
    const generated = await fetchJson("/api/proxy/external/video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId,
        providerModel: syncModelId,
        model: syncModelId,
        prompt: "verification video",
        images: [referenceUrl],
        aspect_ratio: "16:9",
        duration: 6,
        resolution: "720p",
        providerParams: { modelRecordId: modelRecord?.id },
      }),
    });
    const videoUrl = generated.data?.videoUrls?.[0] || "";
    assert(videoUrl.startsWith("/files/output/"), "video was not saved locally");
    const syncSubmit = upstreamRequests.find((item) => item.kind === "sync-submit");
    assert(syncSubmit?.url === "/v1/videos/generations", "video endpoint mismatch");
    assert(syncSubmit?.body?.model === syncModelId, "video model mismatch");
    const providerReferenceUrl = syncSubmit?.body?.image?.[0] || "";
    assert(
      isSignedProviderReferenceUrl(providerReferenceUrl),
      "video reference URL was not signed",
    );
    assert(syncSubmit?.authorization === "Bearer verify-video-key", "video authorization missing");
    const providerReference = await fetch(providerReferenceUrl);
    assert(providerReference.ok && /^image\//i.test(providerReference.headers.get("content-type") || ""), "signed video reference is not anonymously accessible");
    const syncAsset = await fetch(`${baseUrl}${videoUrl}`, { headers: { cookie } });
    assert(syncAsset.ok && /^video\//i.test(syncAsset.headers.get("content-type") || ""), "saved sync video is not accessible");

    console.log("[verify] apimart async video");
    await fetchJson(`/api/admin/providers/${providerId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ protocol: "apimart" }),
    });
    console.log("[verify] generic async video");
    await fetchJson(`/api/admin/models/${modelRecord.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        modelId: "grok-imagine-1.5-video-apimart",
        displayName: "Verify APIMart Video Model",
        inputProfile: "prompt,image_reference",
        inputCapabilities: {
          prompt: true,
          imageReference: true,
          multiImage: false,
          firstFrame: false,
          lastFrame: false,
        },
        advancedConfig: {
          mode: "apimart_async_video",
          requestMapping: { ratio: "size", resolution: "quality", images: "image_urls" },
        },
      }),
    });

    upstreamRequests = [];
    const generatedAsync = await fetchJson("/api/proxy/external/video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId,
        providerModel: "grok-imagine-1.5-video-apimart",
        model: "grok-imagine-1.5-video-apimart",
        prompt: "verification apimart video",
        images: [referenceUrl],
        aspect_ratio: "16:9",
        duration: 6,
        resolution: "720p",
        providerParams: { modelRecordId: modelRecord?.id },
      }),
    });
    const asyncVideoUrl = generatedAsync.data?.videoUrls?.[0] || "";
    assert(asyncVideoUrl.startsWith("/files/output/"), "apimart video was not saved locally");
    const asyncSubmit = upstreamRequests.find((item) => item.kind === "apimart-submit");
    const asyncStatus = upstreamRequests.find((item) => item.kind === "apimart-status");
    assert(asyncSubmit?.body?.model === "grok-imagine-1.5-video-apimart", "apimart model mismatch");
    assert(asyncSubmit?.body?.size === "16:9", "apimart size mapping mismatch");
    assert(asyncSubmit?.body?.quality === "720p", "apimart quality mapping mismatch");
    assert(Array.isArray(asyncSubmit?.body?.image_urls) && asyncSubmit.body.image_urls.length === 1, "apimart image_urls mapping mismatch");
    assert(asyncStatus?.url === "/v1/tasks/task_verify_123", "apimart task status endpoint mismatch");
    const asyncAsset = await fetch(`${baseUrl}${asyncVideoUrl}`, { headers: { cookie } });
    assert(asyncAsset.ok && /^video\//i.test(asyncAsset.headers.get("content-type") || ""), "saved apimart video is not accessible");

    console.log("[verify] grok preview async video");
    await fetchJson(`/api/admin/models/${modelRecord.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        modelId: "grok-imagine-video-1.5-preview",
        displayName: "Verify Grok Preview Async Video Model",
        inputProfile: "prompt,image_reference",
        inputCapabilities: {
          prompt: true,
          imageReference: true,
          multiImage: false,
          firstFrame: false,
          lastFrame: false,
        },
        advancedConfig: {
          mode: "async_video_task",
          submitPath: "videos",
          taskIdPath: "task_id",
          pollPathTemplate: "videos/{task_id}",
          taskStatusPath: "status",
          resultVideoPath: "data.output",
          requestMapping: { ratio: "", duration: "seconds", resolution: "", images: "images" },
          requestValueTypes: { duration: "string" },
          requestValueTemplates: { size: "{preview_video_size}" },
        },
      }),
    });

    upstreamRequests = [];
    const generatedGenericAsync = await fetchJson("/api/proxy/external/video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId,
        providerModel: "grok-imagine-video-1.5-preview",
        model: "grok-imagine-video-1.5-preview",
        prompt: "verification generic async video",
        images: [referenceUrl],
        aspect_ratio: "16:9",
        duration: 6,
        resolution: "720p",
        providerParams: { modelRecordId: modelRecord?.id },
      }),
    });
    const genericAsyncVideoUrl = generatedGenericAsync.data?.videoUrls?.[0] || "";
    assert(genericAsyncVideoUrl.startsWith("/files/output/"), "generic async video was not saved locally");
    const genericAsyncSubmit = upstreamRequests.find((item) => item.kind === "generic-async-submit");
    const genericAsyncStatus = upstreamRequests.find((item) => item.kind === "generic-async-status");
    assert(genericAsyncSubmit?.url === "/v1/videos", "generic async submit endpoint mismatch");
    assert(genericAsyncSubmit?.body?.seconds === "6", "generic async duration mapping mismatch");
    assert(genericAsyncSubmit?.body?.size === "1280x720", "generic async size mapping mismatch");
    assert(Array.isArray(genericAsyncSubmit?.body?.images) && genericAsyncSubmit.body.images.length === 1, "generic async images mapping mismatch");
    assert(isSignedProviderReferenceUrl(genericAsyncSubmit.body.images[0]), "generic async reference image was not signed");
    assert(genericAsyncStatus?.url === "/v1/videos/task_preview_456", "generic async poll endpoint mismatch");

    await fetchJson(`/api/admin/models/${modelRecord.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        modelId: "agnes-video-v2.0",
        displayName: "Verify Agnes Async Video Model",
        inputProfile: "prompt,image_reference",
        inputCapabilities: {
          prompt: true,
          imageReference: true,
          multiImage: false,
          firstFrame: false,
          lastFrame: false,
        },
        advancedConfig: {
          mode: "async_video_task",
          submitPath: "videos",
          taskIdPath: "task_id",
          pollPathTemplate: "videos/{task_id}",
          taskStatusPath: "status",
          resultVideoPath: "video_url",
          finalResultTaskIdPath: "video_id",
          finalResultPathTemplate: "../agnesapi?video_id={task_id}",
          finalResultVideoPath: "remixed_from_video_id",
          requestMapping: { ratio: "aspect_ratio", duration: "duration", images: "image_urls" },
        },
      }),
    });

    upstreamRequests = [];
    const generatedAgnesAsync = await fetchJson("/api/proxy/external/video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId,
        providerModel: "agnes-video-v2.0",
        model: "agnes-video-v2.0",
        prompt: "verification agnes async video",
        images: [referenceUrl],
        aspect_ratio: "16:9",
        duration: 6,
        resolution: "720p",
        providerParams: { modelRecordId: modelRecord?.id },
      }),
    });
    const agnesAsyncVideoUrl = generatedAgnesAsync.data?.videoUrls?.[0] || "";
    assert(agnesAsyncVideoUrl.startsWith("/files/output/"), "agnes async video was not saved locally");
    const agnesAsyncSubmit = upstreamRequests.find((item) => item.kind === "agnes-async-submit");
    const agnesAsyncStatus = upstreamRequests.find((item) => item.kind === "agnes-async-status");
    const agnesAsyncFinal = upstreamRequests.find((item) => item.kind === "agnes-async-final");
    assert(agnesAsyncSubmit?.url === "/v1/videos", "agnes async submit endpoint mismatch");
    assert(agnesAsyncSubmit?.body?.aspect_ratio === "16:9", "agnes async ratio mapping mismatch");
    assert(Array.isArray(agnesAsyncSubmit?.body?.image_urls), "agnes async image_urls mapping mismatch");
    assert(agnesAsyncStatus?.url === "/v1/videos/task_verify_agnes", "agnes async poll endpoint mismatch");
    assert(agnesAsyncFinal?.url === "/agnesapi?video_id=video_verify_agnes", "agnes async final endpoint mismatch");

    console.log(JSON.stringify({ ok: true, videoUrl, asyncVideoUrl, genericAsyncVideoUrl, agnesAsyncVideoUrl, authorization: "present" }, null, 2));
  } finally {
    if (cookie) await fetchText(`/api/admin/providers/${providerId}`, { method: "DELETE" }).catch(() => undefined);
    upstream.server.close();
  }
}

function startMockServer() {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      if (request.url === "/asset.mp4") {
        response.writeHead(200, { "content-type": "video/mp4" });
        response.end(videoBytes);
        return;
      }
      let text = "";
      request.on("data", (chunk) => {
        text += chunk;
      });
      request.on("end", () => {
        const body = text ? JSON.parse(text) : {};
        const address = server.address();
        if (request.url === "/v1/videos/generations") {
          if (body.model === "grok-imagine-1.5-video-apimart") {
            upstreamRequests.push({ kind: "apimart-submit", url: request.url, authorization: request.headers.authorization, body });
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify({ code: 200, data: [{ task_id: "task_verify_123", status: "submitted" }] }));
            return;
          }
          upstreamRequests.push({ kind: "sync-submit", url: request.url, authorization: request.headers.authorization, body });
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ data: [{ url: `http://127.0.0.1:${address.port}/asset.mp4` }] }));
          return;
        }
        if (request.url === "/v1/videos" && body.model === "grok-imagine-video-1.5-preview") {
          upstreamRequests.push({ kind: "generic-async-submit", url: request.url, authorization: request.headers.authorization, body });
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ task_id: "task_preview_456", status: "queued" }));
          return;
        }
        if (request.url === "/v1/videos" && body.model === "agnes-video-v2.0") {
          upstreamRequests.push({ kind: "agnes-async-submit", url: request.url, authorization: request.headers.authorization, body });
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ id: "task_verify_agnes", task_id: "task_verify_agnes", video_id: "video_verify_agnes", status: "queued" }));
          return;
        }
        if (request.url === "/v1/tasks/task_verify_123") {
          upstreamRequests.push({ kind: "apimart-status", url: request.url, authorization: request.headers.authorization, body });
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ code: 200, data: { status: "completed", result: { videos: [`http://127.0.0.1:${address.port}/asset.mp4`] } } }));
          return;
        }
        if (request.url === "/v1/videos/task_preview_456") {
          upstreamRequests.push({ kind: "generic-async-status", url: request.url, authorization: request.headers.authorization, body });
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ task_id: "task_preview_456", status: "completed", data: { output: `http://127.0.0.1:${address.port}/asset.mp4` } }));
          return;
        }
        if (request.url === "/v1/videos/task_verify_agnes") {
          upstreamRequests.push({ kind: "agnes-async-status", url: request.url, authorization: request.headers.authorization, body });
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ id: "task_verify_agnes", status: "queued", video_id: "video_verify_agnes" }));
          return;
        }
        if (request.url === "/agnesapi?video_id=video_verify_agnes") {
          upstreamRequests.push({ kind: "agnes-async-final", url: request.url, authorization: request.headers.authorization, body });
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ id: "video_verify_agnes", status: "completed", remixed_from_video_id: `http://127.0.0.1:${address.port}/asset.mp4` }));
          return;
        }
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ data: [{ url: `http://127.0.0.1:${address.port}/asset.mp4` }] }));
      });
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function fetchJson(pathname, options) {
  const response = await fetch(`${baseUrl}${pathname}`, withCookie(options));
  captureCookie(response);
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${text}`);
  return JSON.parse(text);
}
async function fetchText(pathname, options) {
  const response = await fetch(`${baseUrl}${pathname}`, withCookie(options));
  captureCookie(response);
  return response.text();
}
function withCookie(options = {}) {
  return {
    ...options,
    headers: {
      ...sameOriginHeaders,
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  };
}
function captureCookie(response) {
  const raw = response.headers.get("set-cookie");
  if (raw) cookie = raw.split(";")[0];
}
function assert(value, message) {
  if (!value) throw new Error(message);
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
