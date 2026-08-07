import assert from "node:assert/strict";

const baseUrl = String(process.env.XINGHUAN_VERIFY_BASE_URL || "http://127.0.0.1:18100").replace(/\/$/, "");
const email = process.env.XINGHUAN_VERIFY_EMAIL || process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL || "";
const password = process.env.XINGHUAN_VERIFY_PASSWORD || process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD || "";
const environment = process.env.XINGHUAN_VERIFY_EXPECTED_ENVIRONMENT || "production";
const providerId = process.env.XINGHUAN_VERIFY_PROVIDER_ID || "";
const modelRecordId = process.env.XINGHUAN_VERIFY_MODEL_RECORD_ID || "";
const origin = new URL(baseUrl).origin;
const poolKeys = ["assistant-diagnosis", "admin-assistant-diagnosis", "supervision-planning"];
const agentPools = new Map([
  ["assistant-planner", "assistant-diagnosis"],
  ["admin-assistant-planner", "admin-assistant-diagnosis"],
  ["supervision-planner", "supervision-planning"],
]);
let cookie = "";

assert.equal(process.env.XINGHUAN_ALLOW_AGENT_BOOTSTRAP, "1", "AGENT_BOOTSTRAP_NOT_EXPLICITLY_ENABLED");
assert(email && password, "AGENT_BOOTSTRAP_CREDENTIALS_REQUIRED");
assert(providerId && modelRecordId, "AGENT_BOOTSTRAP_MODEL_REQUIRED");
assert(["gray", "production"].includes(environment), "AGENT_BOOTSTRAP_ENVIRONMENT_INVALID");

const login = await request("/api/auth/login", { method: "POST", body: { email, password } });
assert.equal(login.authenticated, true, "AGENT_BOOTSTRAP_LOGIN_FAILED");
const bootstrap = await request("/api/admin/agent-runtime/bootstrap", { method: "POST", body: {} });

const publishedPools = [];
for (const poolKey of poolKeys) {
  let pools = await request("/api/admin/agent-runtime/llm-pools");
  const pool = pools.find((item) => item?.poolKey === poolKey);
  assert(pool?.id, `AGENT_BOOTSTRAP_POOL_MISSING:${poolKey}`);
  let version = pool.versions?.find((item) => item?.publications?.some((publication) => publication?.environment === environment));
  if (!version || !version.entries?.some((entry) => entry?.providerId === providerId && entry?.modelId === modelRecordId && entry?.enabled !== false)) {
    version = await request(`/api/admin/agent-runtime/llm-pools/${encodeURIComponent(pool.id)}/versions`, {
      method: "POST",
      body: {
        policy: { failureThreshold: 2, cooldownMs: 30_000 },
        entries: [{
          providerId,
          modelId: modelRecordId,
          capabilityTags: ["text_chat"],
          priority: 0,
          weight: 1,
          estimatedCost: 0,
          enabled: true,
        }],
      },
    });
    version = await approveVersion("llm-pool-versions", version);
    await request(`/api/admin/agent-runtime/llm-pool-versions/${encodeURIComponent(version.id)}/publish`, {
      method: "POST",
      body: { environment },
    });
  }
  publishedPools.push({ poolKey, versionId: version.id });
}

const publishedAgents = [];
for (const [agentKey, poolKey] of agentPools) {
  let roles = await request("/api/admin/agent-runtime/roles");
  const role = roles.find((item) => item?.agentKey === agentKey);
  assert(role?.id, `AGENT_BOOTSTRAP_ROLE_MISSING:${agentKey}`);
  let version = role.versions?.find((item) => item?.publications?.some((publication) => publication?.environment === environment));
  if (!version || version.configuration?.llmPoolKey !== poolKey) {
    const source = [...(role.versions || [])].sort((left, right) => Number(right.version) - Number(left.version))[0];
    assert(source?.id, `AGENT_BOOTSTRAP_ROLE_VERSION_MISSING:${agentKey}`);
    if (source.configuration?.llmPoolKey === poolKey && ["draft", "review", "approved"].includes(source.status)) {
      version = source;
    } else {
      version = await request(`/api/admin/agent-runtime/roles/${encodeURIComponent(role.id)}/versions`, {
        method: "POST",
        body: { configuration: { ...(source.configuration || {}), llmPoolKey: poolKey } },
      });
    }
    version = await approveVersion("agent-configurations", version);
    await request(`/api/admin/agent-runtime/agent-configurations/${encodeURIComponent(version.id)}/publish`, {
      method: "POST",
      body: { environment },
    });
  }
  publishedAgents.push({ agentKey, versionId: version.id, poolKey });
}

const [roles, pools] = await Promise.all([
  request("/api/admin/agent-runtime/roles"),
  request("/api/admin/agent-runtime/llm-pools"),
]);
for (const [agentKey] of agentPools) {
  const role = roles.find((item) => item?.agentKey === agentKey);
  assert(role?.publications?.some((publication) => publication?.environment === environment), `AGENT_BOOTSTRAP_ROLE_PUBLICATION_FAILED:${agentKey}`);
}
for (const poolKey of poolKeys) {
  const pool = pools.find((item) => item?.poolKey === poolKey);
  assert(pool?.versions?.some((version) =>
    version?.publications?.some((publication) => publication?.environment === environment)
    && version?.entries?.some((entry) => entry?.providerId === providerId && entry?.modelId === modelRecordId && entry?.enabled !== false),
  ), `AGENT_BOOTSTRAP_POOL_PUBLICATION_FAILED:${poolKey}`);
}

console.log(JSON.stringify({
  ok: true,
  environment,
  bootstrap,
  publishedPools,
  publishedAgents,
  providerId,
  modelRecordId,
}, null, 2));

async function approveVersion(kind, version) {
  let status = version?.status;
  if (status === "draft") {
    version = await request(`/api/admin/agent-runtime/${kind}/${encodeURIComponent(version.id)}/status`, {
      method: "POST",
      body: { status: "review" },
    });
    status = version.status;
  }
  if (status === "review") {
    version = await request(`/api/admin/agent-runtime/${kind}/${encodeURIComponent(version.id)}/status`, {
      method: "POST",
      body: { status: "approved" },
    });
    status = version.status;
  }
  assert.equal(status, "approved", `AGENT_BOOTSTRAP_VERSION_NOT_APPROVED:${kind}:${status || "missing"}`);
  return version;
}

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
