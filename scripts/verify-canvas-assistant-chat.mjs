import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiServerPath = path.join(root, "apps/api/src/server.ts");
const webApiPath = path.join(root, "apps/web/src/services/api.ts");

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const requestOrigin = new URL(baseUrl).origin;
const adminEmail =
  process.env.XINGHUAN_VERIFY_EMAIL ??
  process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ??
  "admin@xinghuan.local";
const adminPassword =
  process.env.XINGHUAN_VERIFY_PASSWORD ??
  process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ??
  "admin123456";

let cookie = "";

async function main() {
  const results = [];
  results.push(...runStaticContracts());

  if (await serviceAvailable()) {
    results.push(...await runRuntimeSmoke());
  } else {
    results.push([
      `Runtime smoke skipped because ${baseUrl} is not reachable`,
      true,
    ]);
  }

  const failed = results.filter(([, ok]) => !ok);
  for (const [name, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  }
  if (failed.length > 0) process.exit(1);
}

function runStaticContracts() {
  const results = [];
  const check = (name, fn) => {
    try {
      fn();
      results.push([name, true]);
    } catch (error) {
      results.push([`${name}: ${error instanceof Error ? error.message : String(error)}`, false]);
    }
  };

  const apiSource = fs.readFileSync(apiServerPath, "utf8");
  const webApiSource = fs.readFileSync(webApiPath, "utf8");
  const promptSource = apiSource.slice(
    apiSource.indexOf("function buildHermesAssistantChatPrompt"),
    apiSource.indexOf("function hermesProfileName"),
  );
  const fallbackSource = apiSource.slice(
    apiSource.indexOf("function buildFallbackAssistantChat"),
    apiSource.indexOf("function defaultAssistantParameterSchema"),
  );
  const streamSource = apiSource.slice(
    apiSource.indexOf("async function streamAssistantChatResponse"),
    apiSource.indexOf("function splitAssistantMessage"),
  );

  check("Canvas assistant service payload accepts conversationId", () => {
    assert(webApiSource.includes("conversationId?: string"));
    assert(apiSource.includes("conversationId?: string"));
  });
  check("API caches Hermes sessions by workspace scope actor and conversation", () => {
    assert(apiSource.includes("assistantHermesSessionCache"));
    assert(apiSource.includes("getHermesAssistantSessionId"));
    assert(apiSource.includes("assistantConversationKey"));
    assert(apiSource.includes("[workspace, scope, actor.id || actor.email, conversationId]"));
  });
  check("Canvas assistant chat uses Hermes WebUI start/stream path", () => {
    assert(apiSource.includes('"/api/chat/start"'));
    assert(apiSource.includes("/api/chat/stream?${new URLSearchParams({ stream_id: streamId }).toString()}"));
    assert(apiSource.includes("extractHermesSessionId"));
    assert(apiSource.includes("readHermesAssistantStream"));
  });
  check("Hermes profile env and default profile are supported", () => {
    assert(apiSource.includes("XINGHUAN_HERMES_PROFILE"));
    assert(apiSource.includes("canvas-assistant"));
    assert(apiSource.includes("buildHermesSessionPayload"));
    assert(apiSource.includes("buildHermesChatPayload"));
  });
  check("Canvas scope forces non-persistent memory", () => {
    assert(apiSource.includes('input.scope === "admin" && Boolean(settings.integration.persistMemory)'));
    assert(apiSource.includes("persistMemory: false"));
  });
  check("Assistant attachments are summarized and full payload is not prompted", () => {
    assert(apiSource.includes("summarizeAssistantAttachment"));
    assert(!/payload:\s*plainObject\(item\.payload\)/.test(promptSource));
    assert(!promptSource.includes("当前回退回复:"));
    assert(fallbackSource.includes("rawAssistant: \"\""));
  });
  check("Canvas media attachments preserve uploaded or remote URLs for assistant transport", () => {
    assert(webApiSource.includes("payload?: Record<string, unknown>"));
    assert(apiSource.includes("summary.url = mediaUrl.slice(0, 240)"));
    assert(apiSource.includes("payload.url || payload.sourceUrl"));
  });
  check("Stream response does not emit process events by default", () => {
    assert(!streamSource.includes('sendEvent("process"'));
    assert(streamSource.includes('rawAssistant: ""'));
  });

  return results;
}

async function runRuntimeSmoke() {
  const results = [];

  await fetchJson("/api/auth/logout", { method: "POST" }, false).catch(() => undefined);

  const login = await fetchJson("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: requestOrigin },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  }, true);
  results.push([
    "POST /api/auth/admin-login accepts canvas smoke user",
    login.data?.authenticated === true && login.data?.user?.email === adminEmail,
  ]);

  const conversationId = `verify-canvas-${Date.now()}`;
  const assistant = await fetchJson("/api/assistant/chat", {
    method: "POST",
    headers: { "content-type": "application/json", origin: requestOrigin },
    body: JSON.stringify({
      conversationId,
      scope: "canvas",
      message: "帮我分析这个测试工作流可能存在哪些问题",
      attachments: [
        {
          kind: "workflow",
          title: "测试工作流",
          summary: "2 节点 / 1 连线",
          payload: {
            canvasId: "canvas-test",
            nodes: [
              { id: "node-image", type: "image", data: { prompt: "test image" } },
              { id: "node-video", type: "video", data: { prompt: "test video" } },
            ],
            edges: [{ source: "node-image", target: "node-video" }],
          },
        },
        {
          kind: "image",
          title: "参考图",
          summary: "https://example.com/test-image.png",
          payload: {
            nodeId: "node-image",
            url: "https://example.com/test-image.png",
          },
        },
      ],
    }),
  }, false);

  results.push([
    "POST /api/assistant/chat returns response text",
    typeof assistant.data?.message === "string" && assistant.data.message.length > 0,
  ]);
  results.push([
    "Canvas assistant returns execution mode",
    typeof assistant.data?.mode === "string" &&
      ["hermes", "fallback"].includes(assistant.data.mode),
  ]);

  return results;
}

async function serviceAvailable() {
  try {
    const response = await fetch(toUrl("/api/status"), { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchJson(pathname, options, refreshCookie = false) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  if (refreshCookie) captureCookie(response);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

function withCookie(options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  return {
    ...options,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE" ? { origin: requestOrigin } : {}),
      ...(options.headers || {}),
    },
  };
}

function captureCookie(response) {
  const getSetCookie = response.headers?.getSetCookie;
  const raw =
    typeof getSetCookie === "function"
      ? getSetCookie.call(response.headers)?.[0]
      : response.headers.get("set-cookie");
  if (!raw) return;
  const nextCookie = raw.split(";")[0];
  if (!nextCookie || /=$/.test(nextCookie)) return;
  cookie = nextCookie;
}

function toUrl(pathname) {
  if (String(pathname).startsWith("http://") || String(pathname).startsWith("https://")) return pathname;
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
