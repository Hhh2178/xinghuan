import { createServer } from "node:http";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const png1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==";

let cookie = "";
let upstreamRequest = null;

async function main() {
  const upstream = await startMockServer();
  const providerId = `verify-chat-${Date.now()}`;
  const modelId = "verify-chat-model";
  try {
    await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    await fetchJson("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: providerId, name: "Verify Chat Provider", baseUrl: upstream.url, protocol: "openai", enabled: true, apiKey: "verify-chat-key" }),
    });
    const imported = await fetchJson(`/api/admin/providers/${providerId}/import-models`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ models: [{ modelId, capability: "chat", displayName: "Verify Chat Model" }] }),
    });
    const modelRecord = imported.data?.models?.find((model) => model.modelId === modelId);
    const uploadForm = new FormData();
    uploadForm.set("file", new Blob([Buffer.from(png1x1, "base64")], { type: "image/png" }), "chat-reference.png");
    const uploadedReference = await fetchJson("/api/files/upload", { method: "POST", body: uploadForm });
    const referenceUrl = uploadedReference.data?.url || "";
    assert(referenceUrl.startsWith("/files/input/"), "reference image was not uploaded");
    const generated = await fetchJson("/api/proxy/external/llm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId,
        providerModel: modelId,
        model: modelId,
        messages: [{ role: "user", content: [
          { type: "text", text: "verification chat" },
          { type: "image_url", image_url: { url: referenceUrl } },
        ] }],
        temperature: 0.3,
        max_tokens: 128,
        providerParams: { modelRecordId: modelRecord?.id },
      }),
    });
    assert(generated.data?.content === "verified chat reply", "chat reply mismatch");
    assert(upstreamRequest?.url === "/v1/chat/completions", "chat endpoint mismatch");
    assert(upstreamRequest?.body?.model === modelId, "chat model mismatch");
    const providerReferenceUrl = upstreamRequest?.body?.messages?.[0]?.content?.[1]?.image_url?.url || "";
    assert(providerReferenceUrl.startsWith(`${baseUrl}/api/provider-files/`) && providerReferenceUrl.includes("/input/") && providerReferenceUrl.includes("?exp="), "chat image URL was not signed");
    const providerReference = await fetch(providerReferenceUrl);
    assert(providerReference.ok && /^image\//i.test(providerReference.headers.get("content-type") || ""), "signed chat reference is not anonymously accessible");
    assert(upstreamRequest?.authorization === "Bearer verify-chat-key", "chat authorization missing");
    console.log(JSON.stringify({ ok: true, content: generated.data.content, model: upstreamRequest.body.model, authorization: "present" }, null, 2));
  } finally {
    if (cookie) await fetchText(`/api/admin/providers/${providerId}`, { method: "DELETE" }).catch(() => undefined);
    upstream.server.close();
  }
}

function startMockServer() {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      let text = "";
      request.on("data", (chunk) => { text += chunk; });
      request.on("end", () => {
        upstreamRequest = { url: request.url, authorization: request.headers.authorization, body: text ? JSON.parse(text) : {} };
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ choices: [{ message: { content: "verified chat reply" } }] }));
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
