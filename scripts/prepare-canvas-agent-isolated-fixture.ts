import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const baseUrl = requiredLoopbackUrl("XINGHUAN_AGENT_FIXTURE_BASE_URL");
const useLocalBootstrap = process.env.XINGHUAN_AGENT_FIXTURE_LOCAL_BOOTSTRAP === "true";
const adminEmail = optionalEnvironment("XINGHUAN_AGENT_FIXTURE_ADMIN_EMAIL") || (useLocalBootstrap ? "admin@xinghuan.local" : requiredEnvironment("XINGHUAN_AGENT_FIXTURE_ADMIN_EMAIL"));
const adminPassword = optionalEnvironment("XINGHUAN_AGENT_FIXTURE_ADMIN_PASSWORD") || (useLocalBootstrap ? "admin123456" : requiredEnvironment("XINGHUAN_AGENT_FIXTURE_ADMIN_PASSWORD"));
const runKey = `agent-fixture-${randomUUID()}`;
const requestOrigin = new URL(baseUrl).origin;
let cookie = "";

const mock = await startMockChatProvider();
try {
  await request("/api/auth/login", {
    method: "POST",
    body: { email: adminEmail, password: adminPassword },
    captureCookie: true,
  });

  await request("/api/admin/agent-runtime/bootstrap", { method: "POST", body: {} });
  const providerId = `${runKey}-provider`;
  await request("/api/admin/providers", {
    method: "POST",
    body: { id: providerId, name: "Isolated Agent Fixture Provider", baseUrl: mock.url, protocol: "openai", enabled: true, apiKey: "fixture-only" },
  });
  const imported = await request<{ models?: Array<{ id?: string; modelId?: string }> }>(`/api/admin/providers/${providerId}/import-models`, {
    method: "POST",
    body: { models: [{ modelId: "fixture-chat", capability: "chat", displayName: "Isolated Fixture Chat" }] },
  });
  const modelId = String(imported.models?.find((model) => model.modelId === "fixture-chat")?.id || "");
  assert(modelId, "FIXTURE_CHAT_MODEL_NOT_IMPORTED");

  const roles = await request<Array<{ id: string; agentKey: string }>>("/api/admin/agent-runtime/roles");
  const planner = roles.find((role) => role.agentKey === "assistant-planner");
  assert(planner, "FIXTURE_ASSISTANT_PLANNER_MISSING");
  const configuration = await request<{ id: string }>(`/api/admin/agent-runtime/roles/${encodeURIComponent(planner.id)}/versions`, {
    method: "POST",
    body: { configuration: { fixture: true, maxTurns: 1 } },
  });
  await transitionAndPublish(`/api/admin/agent-runtime/agent-configurations/${encodeURIComponent(configuration.id)}`, "gray");

  const pool = await request<{ id: string }>("/api/admin/agent-runtime/llm-pools", {
    method: "POST",
    body: { poolKey: `${runKey}-assistant`, name: "Isolated Assistant Route", role: "planner", scenario: "assistant-chat" },
  });
  const poolVersion = await request<{ id: string }>(`/api/admin/agent-runtime/llm-pools/${encodeURIComponent(pool.id)}/versions`, {
    method: "POST",
    body: {
      policy: { failureThreshold: 2, cooldownMs: 1_000 },
      entries: [{ modelId, providerId, capabilityTags: ["planner"], priority: 1, weight: 1, estimatedCost: 0, enabled: true }],
    },
  });
  await transitionAndPublish(`/api/admin/agent-runtime/llm-pool-versions/${encodeURIComponent(poolVersion.id)}`, "gray");

  const knowledge = await request<Array<{ id: string; collectionKey: string }>>("/api/admin/agent-runtime/knowledge");
  const collection = knowledge.find((item) => item.collectionKey === "public-canvas");
  assert(collection, "FIXTURE_PUBLIC_KNOWLEDGE_COLLECTION_MISSING");
  const document = await request<{ id: string }>(`/api/admin/agent-runtime/knowledge/collections/${encodeURIComponent(collection.id)}/documents`, {
    method: "POST",
    body: {
      documentKey: `${runKey}-public`,
      title: "Isolated Canvas Agent Fixture",
      body: "This public fixture document verifies the published knowledge retrieval path.",
      source: { fixture: true },
    },
  });
  await transitionAndPublish(`/api/admin/agent-runtime/knowledge/documents/${encodeURIComponent(document.id)}`, "gray");

  const controls = await request<Array<{ environment: string; revision: number }>>("/api/admin/agent-runtime/controls");
  const gray = controls.find((control) => control.environment === "gray") || { environment: "gray", revision: 1 };
  await request(`/api/admin/agent-runtime/controls/gray`, {
    method: "PATCH",
    body: {
      revision: gray.revision,
      values: { agentEnabled: true, canvasRunsEnabled: true, automaticRecoveryEnabled: true, qualityEvaluationEnabled: true },
    },
  });

  console.log(JSON.stringify({ ok: true, fixture: "canvas-agent-isolated", provider: "mock", plannerPublished: true, routePublished: true, knowledgePublished: true, controlsEnabled: true }));
} finally {
  await mock.close();
}

async function transitionAndPublish(prefix: string, environment: "gray") {
  await request(`${prefix}/status`, { method: "POST", body: { status: "review" } });
  await request(`${prefix}/status`, { method: "POST", body: { status: "approved" } });
  await request(`${prefix}/publish`, { method: "POST", body: { environment } });
}

async function request<T = Record<string, unknown>>(path: string, input: { method?: string; body?: unknown; captureCookie?: boolean } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method: input.method || "GET",
    headers: {
      accept: "application/json",
      ...(input.body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
      ...(input.method && input.method !== "GET" ? { origin: requestOrigin } : {}),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  if (input.captureCookie) cookie = String(response.headers.get("set-cookie") || "").split(";")[0];
  const text = await response.text();
  const parsed = text ? JSON.parse(text) as { data?: T; error?: string; message?: string } : {};
  if (!response.ok) throw new Error(`FIXTURE_API_FAILED:${input.method || "GET"}:${path}:${response.status}:${parsed.error || parsed.message || "unknown"}`);
  return (parsed.data ?? parsed) as T;
}

function startMockChatProvider() {
  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    const server = createServer((request, response) => {
      if (request.method === "POST" && /\/chat\/completions$/.test(request.url || "")) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ id: "fixture-chat", choices: [{ message: { role: "assistant", content: "Fixture assistant response." } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
        return;
      }
      response.writeHead(404).end();
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object", "FIXTURE_MOCK_ADDRESS_MISSING");
      resolve({ url: `http://127.0.0.1:${address.port}`, close: () => new Promise((done, reject) => server.close((error) => error ? reject(error) : done())) });
    });
  });
}

function requiredEnvironment(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function optionalEnvironment(name: string) {
  return String(process.env[name] || "").trim();
}

function requiredLoopbackUrl(name: string) {
  const value = requiredEnvironment(name);
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`${name}_LOOPBACK_REQUIRED`);
  return url.toString();
}
