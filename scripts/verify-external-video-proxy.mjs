import { createServer } from "node:http";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const videoBytes = Buffer.from("00000018667479706d703432000000006d703432", "hex");
const png1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==";

let cookie = "";
let upstreamRequest = null;

async function main() {
  const upstream = await startMockServer();
  const providerId = `verify-video-${Date.now()}`;
  const modelId = "verify-video-model";
  try {
    await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    await fetchJson("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: providerId, name: "Verify Video Provider", baseUrl: upstream.url, protocol: "openai", enabled: true, apiKey: "verify-video-key" }),
    });
    const imported = await fetchJson(`/api/admin/providers/${providerId}/import-models`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ models: [{ modelId, capability: "video", displayName: "Verify Video Model" }] }),
    });
    const modelRecord = imported.data?.models?.find((model) => model.modelId === modelId);
    const uploadForm = new FormData();
    uploadForm.set("file", new Blob([Buffer.from(png1x1, "base64")], { type: "image/png" }), "video-reference.png");
    const uploadedReference = await fetchJson("/api/files/upload", { method: "POST", body: uploadForm });
    const referenceUrl = uploadedReference.data?.url || "";
    assert(referenceUrl.startsWith("/files/input/"), "reference image was not uploaded");
    const generated = await fetchJson("/api/proxy/external/video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId,
        providerModel: modelId,
        model: modelId,
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
    assert(upstreamRequest?.url === "/v1/videos/generations", "video endpoint mismatch");
    assert(upstreamRequest?.body?.model === modelId, "video model mismatch");
    const providerReferenceUrl = upstreamRequest?.body?.image?.[0] || "";
    assert(providerReferenceUrl.startsWith(`${baseUrl}/api/provider-files/`) && providerReferenceUrl.includes("/input/") && providerReferenceUrl.includes("?exp="), "video reference URL was not signed");
    assert(upstreamRequest?.authorization === "Bearer verify-video-key", "video authorization missing");
    const providerReference = await fetch(providerReferenceUrl);
    assert(providerReference.ok && /^image\//i.test(providerReference.headers.get("content-type") || ""), "signed video reference is not anonymously accessible");
    const asset = await fetch(`${baseUrl}${videoUrl}`, { headers: { cookie } });
    assert(asset.ok && /^video\//i.test(asset.headers.get("content-type") || ""), "saved video is not accessible");
    console.log(JSON.stringify({ ok: true, videoUrl, model: upstreamRequest.body.model, authorization: "present" }, null, 2));
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
      request.on("data", (chunk) => { text += chunk; });
      request.on("end", () => {
        upstreamRequest = { url: request.url, authorization: request.headers.authorization, body: text ? JSON.parse(text) : {} };
        const address = server.address();
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
  return { ...options, headers: { ...(cookie ? { cookie } : {}), ...(options.headers || {}) } };
}
function captureCookie(response) {
  const raw = response.headers.get("set-cookie");
  if (raw) cookie = raw.split(";")[0];
}
function assert(value, message) {
  if (!value) throw new Error(message);
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
