const defaultHost = process.env.XINGHUAN_API_HOST ?? "127.0.0.1";
const defaultPort = process.env.XINGHUAN_API_PORT ?? "18200";
const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? `http://${defaultHost}:${defaultPort}`;
const requestOrigin = new URL(baseUrl).origin;
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";

let cookie = "";

async function main() {
  const requestId = `phase-e-system-${Date.now()}`;
  const login = await fetchJson("/api/auth/admin-login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  assert(login.data?.authenticated === true, "admin login failed");

  const system = await fetchJson("/api/admin/system", {
    headers: {
      "x-request-id": requestId,
    },
  });
  const data = system.data || {};
  assert(typeof data.database?.currentDatabase === "string", "database.currentDatabase missing");
  assert(typeof data.database?.expectedDatabase === "string", "database.expectedDatabase missing");
  assert(typeof data.observability?.tasks?.total === "number", "observability.tasks.total missing");
  assert(typeof data.observability?.tasks?.queued === "number", "observability.tasks.queued missing");
  assert(typeof data.observability?.tasks?.running === "number", "observability.tasks.running missing");
  assert(typeof data.observability?.tasks?.failedLast1h === "number", "observability.tasks.failedLast1h missing");
  assert(typeof data.observability?.tasks?.failedLast24h === "number", "observability.tasks.failedLast24h missing");
  assert(typeof data.observability?.tasks?.failedLast7d === "number", "observability.tasks.failedLast7d missing");
  assert(typeof data.observability?.tasks?.failedLast30d === "number", "observability.tasks.failedLast30d missing");
  assert(typeof data.observability?.tasks?.health?.status === "string", "observability.tasks.health.status missing");
  assert(typeof data.observability?.tasks?.health?.summary === "string", "observability.tasks.health.summary missing");
  assert(typeof data.observability?.tasks?.trend?.failed24hDailyAverageBaseline === "number", "observability.tasks.trend.failed24hDailyAverageBaseline missing");
  assert(typeof data.observability?.tasks?.trend?.failed30dDailyAverageBaseline === "number", "observability.tasks.trend.failed30dDailyAverageBaseline missing");
  assert(typeof data.observability?.tasks?.trend?.failed24hVs7dDailyAverage === "number", "observability.tasks.trend.failed24hVs7dDailyAverage missing");
  assert(typeof data.observability?.tasks?.trend?.failed24hVs30dDailyAverage === "number", "observability.tasks.trend.failed24hVs30dDailyAverage missing");
  assert(typeof data.observability?.tasks?.trend?.failed7dDailyAverage === "number", "observability.tasks.trend.failed7dDailyAverage missing");
  assert(typeof data.observability?.tasks?.trend?.failed7dVs30dDailyAverage === "number", "observability.tasks.trend.failed7dVs30dDailyAverage missing");
  assert(typeof data.observability?.audits?.total === "number", "observability.audits.total missing");
  assert(typeof data.observability?.audits?.sampled === "number", "observability.audits.sampled missing");
  assert(typeof data.observability?.audits?.withRequestId === "number", "observability.audits.withRequestId missing");
  assert(typeof data.observability?.audits?.requestIdCoveragePercent === "number", "observability.audits.requestIdCoveragePercent missing");
  assert(typeof data.observability?.audits?.sampledLast24h === "number", "observability.audits.sampledLast24h missing");
  assert(typeof data.observability?.audits?.withRequestIdLast24h === "number", "observability.audits.withRequestIdLast24h missing");
  assert(typeof data.observability?.audits?.requestIdCoverageLast24hPercent === "number", "observability.audits.requestIdCoverageLast24hPercent missing");
  assert(typeof data.observability?.audits?.sampledLast7d === "number", "observability.audits.sampledLast7d missing");
  assert(typeof data.observability?.audits?.withRequestIdLast7d === "number", "observability.audits.withRequestIdLast7d missing");
  assert(typeof data.observability?.audits?.requestIdCoverageLast7dPercent === "number", "observability.audits.requestIdCoverageLast7dPercent missing");
  assert(typeof data.observability?.audits?.coverageHealth?.status === "string", "observability.audits.coverageHealth.status missing");
  assert(typeof data.observability?.audits?.coverageHealth?.summary === "string", "observability.audits.coverageHealth.summary missing");
  assert(typeof data.observability?.audits?.coverageTrend?.requestIdCoverageLast24hVsLatestSample === "number", "observability.audits.coverageTrend.requestIdCoverageLast24hVsLatestSample missing");
  assert(typeof data.observability?.audits?.coverageTrend?.requestIdCoverageLast7dVsLatestSample === "number", "observability.audits.coverageTrend.requestIdCoverageLast7dVsLatestSample missing");
  assert(typeof data.observability?.audits?.conflicts?.totalLast24h === "number", "observability.audits.conflicts.totalLast24h missing");
  assert(typeof data.observability?.audits?.conflicts?.totalLast7d === "number", "observability.audits.conflicts.totalLast7d missing");
  assert(typeof data.observability?.audits?.conflicts?.totalLast30d === "number", "observability.audits.conflicts.totalLast30d missing");
  assert(typeof data.observability?.audits?.conflicts?.canvasRevisionLast24h === "number", "observability.audits.conflicts.canvasRevisionLast24h missing");
  assert(typeof data.observability?.audits?.conflicts?.resourceRevisionLast24h === "number", "observability.audits.conflicts.resourceRevisionLast24h missing");
  assert(typeof data.observability?.audits?.conflicts?.adminSettingsRevisionLast24h === "number", "observability.audits.conflicts.adminSettingsRevisionLast24h missing");
  assert(typeof data.observability?.audits?.conflicts?.health?.status === "string", "observability.audits.conflicts.health.status missing");
  assert(typeof data.observability?.audits?.conflicts?.health?.summary === "string", "observability.audits.conflicts.health.summary missing");
  assert(typeof data.observability?.audits?.conflicts?.trend?.total7dDailyAverageBaseline === "number", "observability.audits.conflicts.trend.total7dDailyAverageBaseline missing");
  assert(typeof data.observability?.audits?.conflicts?.trend?.total30dDailyAverageBaseline === "number", "observability.audits.conflicts.trend.total30dDailyAverageBaseline missing");
  assert(typeof data.observability?.audits?.conflicts?.trend?.total24hVs7dDailyAverage === "number", "observability.audits.conflicts.trend.total24hVs7dDailyAverage missing");
  assert(typeof data.observability?.audits?.conflicts?.trend?.total24hVs30dDailyAverage === "number", "observability.audits.conflicts.trend.total24hVs30dDailyAverage missing");
  assert(typeof data.observability?.alerts?.activeCount === "number", "observability.alerts.activeCount missing");
  assert(typeof data.observability?.alerts?.highestSeverity === "string", "observability.alerts.highestSeverity missing");
  assert(Array.isArray(data.observability?.alerts?.items), "observability.alerts.items missing");
  assert(data.observability.audits.sampled >= 1, "expected at least one audit sample");
  assert(data.observability.audits.withRequestId >= 1, "expected requestId coverage sample after tagged write");
  assert(data.observability.audits.requestIdCoveragePercent > 0, "expected positive requestId coverage");
  assert(data.observability.audits.sampledLast24h >= 1, "expected recent 24h audit sample");
  assert(data.observability.audits.withRequestIdLast24h >= 1, "expected recent 24h requestId sample");
  assert(data.observability.audits.requestIdCoverageLast24hPercent > 0, "expected positive recent 24h requestId coverage");

  console.log(JSON.stringify({
    ok: true,
    database: {
      current: data.database.currentDatabase,
      expected: data.database.expectedDatabase,
      targetMatched: data.database.targetMatched,
    },
    tasks: data.observability.tasks,
    audits: data.observability.audits,
  }, null, 2));
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
