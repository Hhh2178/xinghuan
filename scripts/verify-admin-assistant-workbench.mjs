import { readFileSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const adminEmail =
  process.env.XINGHUAN_VERIFY_EMAIL ??
  process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ??
  "admin@xinghuan.local";
const adminPassword =
  process.env.XINGHUAN_VERIFY_PASSWORD ??
  process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ??
  "admin123456";
const requireHermes = process.env.XINGHUAN_VERIFY_REQUIRE_HERMES === "1";
const requireLiveServer = process.env.XINGHUAN_VERIFY_LIVE_ADMIN === "1";

let cookie = "";

async function main() {
  const results = [];
  results.push(...verifyStaticUiContract());

  if (!requireLiveServer) {
    printResults(results);
    return;
  }

  await fetchJson("/api/auth/logout", { method: "POST" }).catch(() => undefined);

  const adminMeBefore = await fetchJson("/api/auth/admin-me");
  results.push([
    "GET /api/auth/admin-me unauthenticated",
    adminMeBefore.data?.authenticated === false && adminMeBefore.data?.user === null,
  ]);

  const login = await fetchJson("/api/auth/admin-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  results.push([
    "POST /api/auth/admin-login",
    login.data?.authenticated === true && login.data?.user?.role === "admin",
  ]);

  const adminHome = await fetchText("/admin");
  results.push([
    "GET /admin returns admin shell",
    adminHome.status === 200 && adminHome.text.includes('<div id="root"></div>') && adminHome.text.includes("/admin/assets/"),
  ]);

  const analysis = await fetchJson("/api/admin/assistant/analyze-provider", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerName: "APIMart",
      baseUrl: "https://api.apimart.com/v1",
      protocolHint: "apimart",
      capability: "video",
      modelId: "grok-imagine-1.5-video-apimart",
      sampleRequest: '{"model":"grok-imagine-1.5-video-apimart","prompt":"test"}',
      sampleResponse: '{"task_id":"task_123","status":"queued","result":{"videos":[]}}',
      notes: "支持首帧、尾帧，需要任务轮询",
    }),
  });

  const payload = analysis.data;
  results.push([
    "POST /api/admin/assistant/analyze-provider returns summary",
    typeof payload?.summary === "string" && payload.summary.length > 0,
  ]);
  results.push([
    "Assistant result includes layer and protocol",
    ["default", "advanced", "adapter"].includes(payload?.recommendedLayer) &&
      typeof payload?.protocol === "string" &&
      payload.protocol.length > 0,
  ]);
  results.push([
    "Assistant result includes drafts",
    Boolean(
      payload?.drafts?.provider?.name &&
      payload?.drafts?.model?.modelId &&
      typeof payload?.drafts?.model?.parameterSchema === "string",
    ),
  ]);
  results.push([
    "Assistant result includes checklist",
    Array.isArray(payload?.checklist) && payload.checklist.length > 0,
  ]);
  results.push([
    requireHermes ? "Assistant result runs through Hermes mode" : "Assistant result returns execution mode",
    (requireHermes ? payload?.mode === "hermes" : typeof payload?.mode === "string" && payload.mode.length > 0) &&
      typeof payload?.rawAssistant === "string" &&
      payload.rawAssistant.length > 0,
  ]);

  const audit = await fetchJson("/api/admin/audit");
  results.push([
    "Assistant action written to audit log",
    Array.isArray(audit.data) &&
      audit.data.some((item) => item.action === "assistant.analyzeProvider"),
  ]);

  printResults(results);
}

function verifyStaticUiContract() {
  const root = process.cwd();
  const source = readFileSync(
    join(root, "apps", "admin", "src", "admin-api-settings-panel.tsx"),
    "utf8",
  );
  return [
    [
      "Provider settings expose AI assisted configuration",
      source.includes("AI 协助配置"),
    ],
    [
      "Provider assistant calls analyze-provider API",
      source.includes("/api/admin/assistant/analyze-provider"),
    ],
    [
      "Provider draft requires explicit apply action",
      source.includes("applyAssistantProviderDraft"),
    ],
    [
      "Assistant draft is not auto-saved",
      !source.includes("autoSaveAssistantDraft"),
    ],
    [
      "Assistant result only applies after admin confirmation",
      source.includes("AI 草案已应用到表单，仍需点击保存才会生效。"),
    ],
  ];
}

function printResults(results) {
  const failed = results.filter(([, ok]) => !ok);
  for (const [name, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  }
  if (failed.length > 0) process.exit(1);
}

async function fetchText(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  return { status: response.status, text: await response.text() };
}

async function fetchJson(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

function withCookie(options = {}) {
  return {
    ...options,
    headers: {
      ...(cookie ? { cookie } : {}),
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
  cookie = raw.split(";")[0];
}

function toUrl(pathname) {
  if (String(pathname).startsWith("http://") || String(pathname).startsWith("https://")) return pathname;
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
