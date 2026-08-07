import assert from "node:assert/strict";

const baseUrl = String(process.env.XINGHUAN_VERIFY_BASE_URL || "http://127.0.0.1:18200").replace(/\/$/, "");
const email = process.env.XINGHUAN_VERIFY_EMAIL || process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL || "";
const password = process.env.XINGHUAN_VERIFY_PASSWORD || process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD || "";
const providerId = process.env.XINGHUAN_VERIFY_PROVIDER_ID || "";
const modelId = process.env.XINGHUAN_VERIFY_MODEL_ID || "";
const modelRecordId = process.env.XINGHUAN_VERIFY_MODEL_RECORD_ID || "";
const origin = new URL(baseUrl).origin;
let cookie = "";

assert.equal(process.env.XINGHUAN_ALLOW_REAL_LLM_TEST, "1", "REAL_LLM_TEST_NOT_EXPLICITLY_ENABLED");
assert(email && password, "CHAT_MODEL_PROBE_CREDENTIALS_REQUIRED");
assert(providerId && modelId && modelRecordId, "CHAT_MODEL_PROBE_TARGET_REQUIRED");

const login = await request("/api/auth/login", { method: "POST", body: { email, password } });
assert.equal(login.authenticated, true, "CHAT_MODEL_PROBE_LOGIN_FAILED");

const result = await request("/api/proxy/external/llm", {
  method: "POST",
  body: {
    providerId,
    providerModel: modelId,
    model: modelId,
    messages: [{ role: "user", content: "Reply with exactly: probe-ok" }],
    temperature: 0,
    max_tokens: 32,
    providerParams: { modelRecordId },
  },
});
const content = String(result.content || "").trim();
assert(content, "CHAT_MODEL_PROBE_EMPTY_RESPONSE");

console.log(JSON.stringify({
  ok: true,
  providerId,
  modelId,
  contentLength: content.length,
  containsProbeOk: /probe-ok/i.test(content),
}, null, 2));

async function request(pathname, input = {}) {
  const response = await fetch(new URL(pathname, `${baseUrl}/`), {
    method: input.method || "GET",
    headers: {
      accept: "application/json",
      ...(input.body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
      ...(input.method && input.method !== "GET" ? { origin, referer: `${origin}/` } : {}),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    signal: AbortSignal.timeout(90_000),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  const raw = await response.text();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { message: raw }; }
  if (!response.ok) throw new Error(`${pathname}:HTTP_${response.status}:${JSON.stringify(payload).slice(0, 500)}`);
  return payload.data ?? payload;
}
