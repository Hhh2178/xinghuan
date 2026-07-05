const defaultHost = process.env.XINGHUAN_API_HOST ?? "127.0.0.1";
const defaultPort = process.env.XINGHUAN_API_PORT ?? "18200";
const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? `http://${defaultHost}:${defaultPort}`;
const requestOrigin = new URL(baseUrl).origin;
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const sourceEnvironment = normalizeEnvironment(process.env.XINGHUAN_SYNC_SOURCE_ENV);
const targetEnvironment = normalizeEnvironment(process.env.XINGHUAN_SYNC_TARGET_ENV);
const expectedDirection = resolveDirection(sourceEnvironment, targetEnvironment, defaultPort);

let cookie = "";

async function main() {
  const results = [];

  const login = await fetchJson("/api/auth/admin-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  results.push(["POST /api/auth/admin-login", login.data?.authenticated === true && login.data?.user?.role === "admin"]);

  const preview = await fetchJson("/api/admin/environment-sync/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sourceEnvironment: expectedDirection.sourceEnvironment,
      targetEnvironment: expectedDirection.targetEnvironment,
    }),
  });
  const previewData = preview.data || {};
  const providers = Array.isArray(previewData.providers) ? previewData.providers : [];
  const users = Array.isArray(previewData.users) ? previewData.users : [];
  results.push(["POST /api/admin/environment-sync/preview", preview.success === true]);
  results.push(["Preview includes provider rows", providers.length > 0]);
  results.push(["Preview includes user rows", users.length > 0]);

  const safeProvider = providers.find((row) => row?.id && row?.naturalKey);
  results.push(["Find provider row for no-op apply smoke", Boolean(safeProvider?.id)]);
  if (!safeProvider?.id) return finish(results, {
    direction: expectedDirection,
    previewCounts: buildPreviewCounts(previewData),
  });

  const apply = await fetchJson("/api/admin/environment-sync/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sourceEnvironment: expectedDirection.sourceEnvironment,
      targetEnvironment: expectedDirection.targetEnvironment,
      items: [
        {
          id: safeProvider.id,
          kind: "provider",
          selected: true,
          decision: "skip",
        },
      ],
    }),
  });
  const applyResults = Array.isArray(apply.data?.results) ? apply.data.results : [];
  const providerApply = applyResults.find((row) => row.kind === "provider" && row.id === safeProvider.id);
  results.push(["POST /api/admin/environment-sync/apply", apply.success === true]);
  results.push(["No-op provider apply result is skipped", providerApply?.status === "skipped"]);

  const audit = await fetchJson("/api/admin/audit");
  const auditRows = Array.isArray(audit.data) ? audit.data : [];
  const hasPreviewAudit = auditRows.some((item) => item.action === "environment_sync.preview");
  const hasApplyAudit = auditRows.some((item) => item.action === "environment_sync.apply");
  results.push(["Audit includes environment_sync.preview", hasPreviewAudit]);
  results.push(["Audit includes environment_sync.apply", hasApplyAudit]);

  return finish(results, {
    direction: expectedDirection,
    previewCounts: buildPreviewCounts(previewData),
    appliedProvider: {
      id: safeProvider.id,
      naturalKey: safeProvider.naturalKey,
      state: safeProvider.state,
      status: providerApply?.status || "missing",
      message: providerApply?.message || "",
    },
  });
}

function buildPreviewCounts(previewData) {
  return {
    providers: countStates(Array.isArray(previewData.providers) ? previewData.providers : []),
    users: countStates(Array.isArray(previewData.users) ? previewData.users : []),
  };
}

function countStates(rows) {
  const result = {
    identical: 0,
    conflict: 0,
    missing_in_target: 0,
    missing_in_source: 0,
  };
  for (const row of rows) {
    const state = String(row?.state || "");
    if (state in result) result[state] += 1;
  }
  return result;
}

function resolveDirection(source, target, fallbackPort) {
  if (source && target) return { sourceEnvironment: source, targetEnvironment: target };
  if (source && !target) return { sourceEnvironment: source, targetEnvironment: source === "gray" ? "production" : "gray" };
  if (!source && target) return { sourceEnvironment: target === "gray" ? "production" : "gray", targetEnvironment: target };
  const inferredSource = String(fallbackPort) === "18100" ? "production" : "gray";
  return {
    sourceEnvironment: inferredSource,
    targetEnvironment: inferredSource === "gray" ? "production" : "gray",
  };
}

function normalizeEnvironment(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (text === "gray" || text === "production") return text;
  throw new Error(`invalid environment ${value}`);
}

async function finish(results, extra = {}) {
  const failed = results.filter(([, ok]) => !ok);
  for (const [name, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  }
  console.log(JSON.stringify({
    ok: failed.length === 0,
    baseUrl,
    ...extra,
  }, null, 2));
  if (failed.length > 0) process.exit(1);
}

async function fetchJson(pathname, options = {}) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${text}`);
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
