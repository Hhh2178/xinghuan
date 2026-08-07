import assert from "node:assert/strict";

const baseUrl = String(process.env.XINGHUAN_VERIFY_BASE_URL || "http://127.0.0.1:18200").replace(/\/$/, "");
const email = process.env.XINGHUAN_VERIFY_EMAIL || process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL || "";
const password = process.env.XINGHUAN_VERIFY_PASSWORD || process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD || "";
const environment = process.env.XINGHUAN_VERIFY_EXPECTED_ENVIRONMENT || "gray";
const poolKey = process.env.XINGHUAN_VERIFY_POOL_KEY || "supervision-planning";
const providerId = process.env.XINGHUAN_VERIFY_PROVIDER_ID || "";
const modelRecordId = process.env.XINGHUAN_VERIFY_MODEL_RECORD_ID || "";
const origin = new URL(baseUrl).origin;
let cookie = "";

assert.equal(process.env.XINGHUAN_ALLOW_ROUTE_PUBLICATION, "1", "ROUTE_PUBLICATION_NOT_EXPLICITLY_ENABLED");
assert(email && password, "ROUTE_PUBLICATION_CREDENTIALS_REQUIRED");
assert(providerId && modelRecordId, "ROUTE_PUBLICATION_TARGET_REQUIRED");
assert(["gray", "production"].includes(environment), "ROUTE_PUBLICATION_ENVIRONMENT_INVALID");

const login = await request("/api/auth/login", { method: "POST", body: { email, password } });
assert.equal(login.authenticated, true, "ROUTE_PUBLICATION_LOGIN_FAILED");

const pools = await request("/api/admin/agent-runtime/llm-pools");
const pool = pools.find((item) => item?.poolKey === poolKey);
assert(pool?.id, `ROUTE_PUBLICATION_POOL_NOT_FOUND:${poolKey}`);
const current = pool.versions?.find((version) => version?.publications?.some((item) => item?.environment === environment));
assert(current?.id, `ROUTE_PUBLICATION_CURRENT_VERSION_MISSING:${poolKey}:${environment}`);

const existingEntries = (current.entries || []).filter((entry) => entry?.enabled !== false);
const alreadyPreferred = existingEntries.some((entry) =>
  entry?.providerId === providerId
  && entry?.modelId === modelRecordId
  && Number(entry?.priority) === 0,
);
if (alreadyPreferred) {
  console.log(JSON.stringify({ ok: true, changed: false, environment, poolKey, versionId: current.id }, null, 2));
  process.exit(0);
}

const target = {
  providerId,
  modelId: modelRecordId,
  capabilityTags: ["text_chat"],
  priority: 0,
  weight: 1,
  estimatedCost: 0,
  enabled: true,
};
const entries = [
  target,
  ...existingEntries
    .filter((entry) => !(entry?.providerId === providerId && entry?.modelId === modelRecordId))
    .map((entry) => ({
      providerId: entry.providerId,
      modelId: entry.modelId,
      capabilityTags: Array.isArray(entry.capabilityTags) ? entry.capabilityTags : ["text_chat"],
      priority: Math.max(1, Number(entry.priority) || 0),
      weight: Math.max(1, Number(entry.weight) || 1),
      estimatedCost: Math.max(0, Number(entry.estimatedCost) || 0),
      enabled: true,
    })),
];

const created = await request(`/api/admin/agent-runtime/llm-pools/${encodeURIComponent(pool.id)}/versions`, {
  method: "POST",
  body: { policy: current.policy || { failureThreshold: 2, cooldownMs: 30_000 }, entries },
});
assert(created?.id, "ROUTE_PUBLICATION_VERSION_CREATE_FAILED");
await request(`/api/admin/agent-runtime/llm-pool-versions/${encodeURIComponent(created.id)}/status`, {
  method: "POST",
  body: { status: "review" },
});
await request(`/api/admin/agent-runtime/llm-pool-versions/${encodeURIComponent(created.id)}/status`, {
  method: "POST",
  body: { status: "approved" },
});
await request(`/api/admin/agent-runtime/llm-pool-versions/${encodeURIComponent(created.id)}/publish`, {
  method: "POST",
  body: { environment },
});

const verifiedPools = await request("/api/admin/agent-runtime/llm-pools");
const verifiedPool = verifiedPools.find((item) => item?.poolKey === poolKey);
const published = verifiedPool?.versions?.find((version) =>
  version?.id === created.id
  && version?.publications?.some((item) => item?.environment === environment),
);
assert(published?.entries?.some((entry) =>
  entry?.providerId === providerId
  && entry?.modelId === modelRecordId
  && Number(entry?.priority) === 0
  && entry?.enabled !== false,
), "ROUTE_PUBLICATION_VERIFY_FAILED");

console.log(JSON.stringify({
  ok: true,
  changed: true,
  environment,
  poolKey,
  previousVersionId: current.id,
  publishedVersionId: created.id,
  preferredProviderId: providerId,
  preferredModelRecordId: modelRecordId,
  entryCount: entries.length,
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
    signal: AbortSignal.timeout(30_000),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  const raw = await response.text();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { message: raw }; }
  if (!response.ok) throw new Error(`${pathname}:HTTP_${response.status}:${JSON.stringify(payload).slice(0, 500)}`);
  return payload.data ?? payload;
}
