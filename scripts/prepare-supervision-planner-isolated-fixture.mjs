import assert from "node:assert/strict";

const baseUrl = requiredLoopbackUrl("XINGHUAN_AGENT_FIXTURE_BASE_URL");
const email = requiredEnvironment("XINGHUAN_AGENT_FIXTURE_ADMIN_EMAIL");
const password = requiredEnvironment("XINGHUAN_AGENT_FIXTURE_ADMIN_PASSWORD");
let cookie = "";

assert.equal(process.env.XINGHUAN_ALLOW_ISOLATED_GRAY_TEST, "1", "ISOLATED_GRAY_TEST_NOT_EXPLICITLY_ENABLED");

const status = await request("/api/status");
assert.equal(status.environment, "gray", `GRAY_CANDIDATE_REQUIRED:${status.environment || "unknown"}`);
const login = await request("/api/auth/login", { method: "POST", body: { email, password } });
assert.equal(login.authenticated, true, "GRAY_LOGIN_FAILED");
await request("/api/admin/agent-runtime/bootstrap", { method: "POST", body: {} });

let roles = await request("/api/admin/agent-runtime/roles");
let planner = roles.find((role) => role.agentKey === "supervision-planner");
assert(planner, "SUPERVISION_PLANNER_MISSING_AFTER_BOOTSTRAP");
let plannerPublication = planner.publications?.find((publication) => publication.environment === "gray");
if (!plannerPublication) {
  const version = [...(planner.versions || [])].sort((left, right) => right.version - left.version)[0];
  assert(version, "SUPERVISION_PLANNER_VERSION_MISSING");
  await approveAndPublish(`/api/admin/agent-runtime/agent-configurations/${encodeURIComponent(version.id)}`, version.status);
  roles = await request("/api/admin/agent-runtime/roles");
  planner = roles.find((role) => role.agentKey === "supervision-planner");
  plannerPublication = planner?.publications?.find((publication) => publication.environment === "gray");
}
assert(plannerPublication, "SUPERVISION_PLANNER_GRAY_PUBLICATION_MISSING");

let pools = await request("/api/admin/agent-runtime/llm-pools");
let supervisionPool = pools.find((pool) => pool.poolKey === "supervision-planning");
assert(supervisionPool, "SUPERVISION_ROUTE_POOL_MISSING_AFTER_BOOTSTRAP");
let supervisionVersion = supervisionPool.versions?.find((version) => version.publications?.some((publication) => publication.environment === "gray"));
if (!supervisionVersion) {
  const donorVersion = pools
    .filter((pool) => pool.role === "planner" && pool.scenario === "assistant-chat")
    .flatMap((pool) => pool.versions || [])
    .filter((version) => version.publications?.some((publication) => publication.environment === "gray"))
    .sort((left, right) => right.version - left.version)
    .find((version) => version.entries?.some((entry) => entry.enabled));
  assert(donorVersion, "PUBLISHED_ASSISTANT_ROUTE_DONOR_MISSING");
  const created = await request(`/api/admin/agent-runtime/llm-pools/${encodeURIComponent(supervisionPool.id)}/versions`, {
    method: "POST",
    body: {
      policy: donorVersion.policy || { failureThreshold: 2, cooldownMs: 30_000 },
      entries: donorVersion.entries.filter((entry) => entry.enabled).map((entry) => ({
        modelId: entry.modelId,
        providerId: entry.providerId,
        capabilityTags: [...(entry.capabilityTags || [])],
        priority: entry.priority,
        weight: entry.weight,
        estimatedCost: entry.estimatedCost,
        enabled: true,
      })),
    },
  });
  await approveAndPublish(`/api/admin/agent-runtime/llm-pool-versions/${encodeURIComponent(created.id)}`, created.status || "draft");
  pools = await request("/api/admin/agent-runtime/llm-pools");
  supervisionPool = pools.find((pool) => pool.poolKey === "supervision-planning");
  supervisionVersion = supervisionPool?.versions?.find((version) => version.publications?.some((publication) => publication.environment === "gray"));
}
assert(supervisionVersion, "SUPERVISION_ROUTE_GRAY_PUBLICATION_MISSING");

console.log(JSON.stringify({
  ok: true,
  fixture: "isolated-supervision-planner",
  environment: "gray",
  agentDefinitionId: planner.id,
  agentConfigurationVersionId: plannerPublication.configurationVersionId,
  routePoolId: supervisionPool.id,
  routePoolVersionId: supervisionVersion.id,
  routeEntryCount: supervisionVersion.entries.filter((entry) => entry.enabled).length,
}, null, 2));

async function approveAndPublish(prefix, initialStatus) {
  let status = initialStatus;
  if (status === "draft") {
    await request(`${prefix}/status`, { method: "POST", body: { status: "review" } });
    status = "review";
  }
  if (status === "review") {
    await request(`${prefix}/status`, { method: "POST", body: { status: "approved" } });
    status = "approved";
  }
  assert.equal(status, "approved", `FIXTURE_VERSION_NOT_APPROVABLE:${status}`);
  await request(`${prefix}/publish`, { method: "POST", body: { environment: "gray" } });
}

async function request(pathname, input = {}) {
  const response = await fetch(new URL(pathname, baseUrl), {
    method: input.method || "GET",
    headers: {
      accept: "application/json",
      ...(input.body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
      ...(input.method && input.method !== "GET" ? { origin: new URL(baseUrl).origin, referer: `${new URL(baseUrl).origin}/` } : {}),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  const raw = await response.text();
  const parsed = raw ? JSON.parse(raw) : {};
  if (!response.ok) throw new Error(`${pathname}:HTTP_${response.status}:${text(parsed.error || parsed.message || raw).slice(0, 400)}`);
  return parsed.data ?? parsed;
}

function requiredEnvironment(name) {
  const value = text(process.env[name]);
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function requiredLoopbackUrl(name) {
  const value = requiredEnvironment(name);
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`${name}_LOOPBACK_REQUIRED`);
  return url.toString();
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
