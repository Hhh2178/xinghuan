const defaultHost = process.env.XINGHUAN_API_HOST ?? "127.0.0.1";
const defaultPort = process.env.XINGHUAN_API_PORT ?? "18200";
const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? `http://${defaultHost}:${defaultPort}`;
const requestOrigin = new URL(baseUrl).origin;
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";

let cookie = "";

async function main() {
  const requestId = `phase-e-audit-${Date.now()}`;
  const providerId = `obs-provider-${Date.now()}`;
  const providerName = `Observability ${Date.now()}`;
  let providerCreated = false;

  try {
    const statusResponse = await fetch(toUrl("/api/status"), {
      headers: {
        "x-request-id": "phase-e-observability-status-check",
      },
    });
    assert(statusResponse.ok, "status request failed");
    assert(statusResponse.headers.get("x-request-id"), "expected x-request-id header on /api/status");

    const login = await fetchJson("/api/auth/admin-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    assert(login.data?.authenticated === true, "admin login failed");

    await fetchJson("/api/admin/providers", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        id: providerId,
        name: providerName,
        baseUrl: "https://example.invalid",
        protocol: "openai",
        enabled: false,
        note: "phase e audit trace",
      }),
    });
    providerCreated = true;

    const target = await waitForAudit(
      (item) => item.action === "provider.create" && item.targetId === providerId,
      "expected provider.create audit record",
    );
    assert(target, "expected provider.create audit record");
    assert(target.requestId === requestId, "audit requestId mismatch");
    assert(typeof target.ip === "string", "audit ip should be string");
    assert(target.ip.length > 0, "audit ip missing");
    assert(typeof target.userAgent === "string", "audit userAgent should be string");
    assert(target.userAgent.length > 0, "audit userAgent missing");

    const readPaths = [
      "/api/auth/admin-me",
      "/api/admin/summary",
      "/api/admin/users",
      "/api/admin/sessions",
      "/api/admin/providers",
      "/api/admin/models",
      "/api/admin/tasks?page=1&pageSize=5",
      "/api/admin/system",
    ];
    for (const pathname of readPaths) {
      await fetchJson(pathname, {
        headers: {
          "x-request-id": requestId,
        },
      });
    }

    const expectedActions = [
      "auth.admin_me",
      "summary.read",
      "users.read",
      "sessions.read",
      "providers.read",
      "models.read",
      "tasks.read",
      "system.read",
    ];
    for (const action of expectedActions) {
      const item = await waitForAudit(
        (entry) => entry.action === action && entry.requestId === requestId,
        `expected ${action} audit record with requestId`,
      );
      assert(item, `expected ${action} audit record with requestId`);
    }

    console.log(JSON.stringify({
      ok: true,
      requestId,
      auditId: target.id,
      readAuditActions: expectedActions,
      ip: target.ip,
    }, null, 2));
  } finally {
    if (providerCreated) {
      await fetchJson(`/api/admin/providers/${encodeURIComponent(providerId)}`, {
        method: "DELETE",
      }).catch(() => undefined);
    }
  }
}

async function fetchJson(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${text}`);
  return JSON.parse(text);
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
  cookie = raw.split(";")[0];
}

function toUrl(pathname) {
  if (String(pathname).startsWith("http://") || String(pathname).startsWith("https://")) return pathname;
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

async function waitForAudit(predicate, errorMessage, attempts = 5, delayMs = 200) {
  for (let index = 0; index < attempts; index += 1) {
    const auditLogs = await fetchJson("/api/admin/audit");
    const items = Array.isArray(auditLogs.data) ? auditLogs.data : [];
    const matched = items.find(predicate);
    if (matched) return matched;
    if (index < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(errorMessage);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
