import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiServerPath = path.join(root, "apps/api/src/server.ts");
const adminTypesPath = path.join(root, "apps/admin/src/admin-types.ts");
const adminPanelPath = path.join(root, "apps/admin/src/admin-assistant-panel.tsx");

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
  const adminTypesSource = fs.readFileSync(adminTypesPath, "utf8");
  const adminPanelSource = fs.readFileSync(adminPanelPath, "utf8");
  const promptSource = apiSource.slice(
    apiSource.indexOf("function buildHermesAssistantChatPrompt"),
    apiSource.indexOf("function hermesProfileName"),
  );
  const streamSource = apiSource.slice(
    apiSource.indexOf("async function streamAssistantChatResponse"),
    apiSource.indexOf("function splitAssistantMessage"),
  );

  check("Admin AssistantChatRequest includes conversationId", () => {
    assert(adminTypesSource.includes("conversationId?: string"));
    assert(apiSource.includes("conversationId?: string"));
  });
  check("API caches Hermes sessions by assistant conversation", () => {
    assert(apiSource.includes("assistantHermesSessionCache"));
    assert(apiSource.includes("getHermesAssistantSessionId"));
    assert(apiSource.includes("assistantConversationKey"));
    assert(apiSource.includes('"/api/session/new"'));
  });
  check("Admin assistant chat uses Hermes WebUI start/stream path", () => {
    assert(apiSource.includes('"/api/chat/start"'));
    assert(apiSource.includes("/api/chat/stream?${new URLSearchParams({ stream_id: streamId }).toString()}"));
    assert(apiSource.includes("extractHermesSessionId"));
    assert(apiSource.includes("readHermesAssistantStream"));
  });
  check("Admin stream endpoint is available", () => {
    assert(apiSource.includes('url.pathname === "/api/admin/assistant/chat/stream"'));
    assert(apiSource.includes('scope: "admin"'));
  });
  check("Hermes profile and memory policy are explicit", () => {
    assert(apiSource.includes("XINGHUAN_HERMES_PROFILE"));
    assert(apiSource.includes("canvas-assistant"));
    assert(apiSource.includes("buildHermesSessionPayload"));
    assert(apiSource.includes("buildHermesChatPayload"));
    assert(apiSource.includes("persistMemory"));
    assert(apiSource.includes('input.scope === "admin" && Boolean(settings.integration.persistMemory)'));
  });
  check("Assistant attachments are summarized before Hermes prompt", () => {
    assert(apiSource.includes("summarizeAssistantAttachment"));
    assert(!/payload:\s*plainObject\(item\.payload\)/.test(promptSource));
    assert(!promptSource.includes("当前回退回复:"));
  });
  check("Admin assistant supports image uploads and preserves attachment URLs", () => {
    assert(adminPanelSource.includes('kind: "image"'));
    assert(adminPanelSource.includes('"/api/files/upload-base64"'));
    assert(adminPanelSource.includes("compactPayload.url = mediaUrl"));
    assert(apiSource.includes("summary.url = mediaUrl.slice(0, 240)"));
  });
  check("Stream response does not expose process raw JSON by default", () => {
    assert(!streamSource.includes('sendEvent("process"'));
    assert(streamSource.includes('sendEvent("done", { ...result, rawAssistant: "" })'));
  });

  return results;
}

async function runRuntimeSmoke() {
  const results = [];

  await fetchJson("/api/auth/logout", { method: "POST" }, false).catch(() => undefined);

  const login = await fetchJson("/api/auth/admin-login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: requestOrigin },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  }, true);
  results.push([
    "POST /api/auth/admin-login accepts admin",
    login.data?.authenticated === true && login.data?.user?.role === "admin",
  ]);

  const conversationId = `verify-admin-${Date.now()}`;
  const assistant = await fetchJson("/api/admin/assistant/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      conversationId,
      scope: "admin",
      message: "帮我判断这个 Provider 和模型配置是否还需要补充 adapter 层",
      attachments: [
        {
          kind: "provider",
          title: "APIMart",
          summary: "https://api.apimart.com/v1",
          payload: {
            name: "APIMart",
            baseUrl: "https://api.apimart.com/v1",
            protocol: "apimart",
          },
        },
        {
          kind: "model",
          title: "grok-imagine-1.5-video-apimart",
          summary: "video / prompt,image_reference",
          payload: {
            modelId: "grok-imagine-1.5-video-apimart",
            capability: "video",
            inputProfile: "prompt,image_reference",
            inputCapabilities: {
              prompt: true,
              imageReference: true,
              firstFrame: true,
              lastFrame: true,
            },
          },
        },
      ],
    }),
  }, false);

  results.push([
    "POST /api/admin/assistant/chat returns response text",
    typeof assistant.data?.message === "string" && assistant.data.message.length > 0,
  ]);
  results.push([
    "Admin assistant returns execution mode",
    typeof assistant.data?.mode === "string" &&
      ["hermes", "fallback"].includes(assistant.data.mode),
  ]);

  await fetchJson("/api/auth/admin-login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: requestOrigin },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  }, true);
  const audit = await fetchJson("/api/admin/audit", undefined, false);
  results.push([
    "Assistant chat action written to audit log",
    Array.isArray(audit.data) &&
      audit.data.some((item) => item.action === "assistant.chat"),
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
