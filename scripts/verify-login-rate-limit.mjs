const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const requestOrigin = new URL(baseUrl).origin;
const adminEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const adminPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";

async function main() {
  const memberProbe = `rate-limit-member-${Date.now()}@example.invalid`;
  const adminProbe = `rate-limit-admin-${Date.now()}@example.invalid`;

  const memberStatuses = await runFailureSequence("/api/auth/login", memberProbe);
  const adminStatuses = await runFailureSequence("/api/auth/admin-login", adminProbe);

  const success = await fetchJson("/api/auth/admin-login", {
    method: "POST",
    headers: {
      origin: requestOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  assert(success.status === 200, "admin login should still succeed with valid credentials");
  assert(success.data?.authenticated === true, "admin login should authenticate");

  console.log(JSON.stringify({
    ok: true,
    memberStatuses,
    adminStatuses,
    adminAuthenticated: success.data?.authenticated === true,
  }, null, 2));
}

async function runFailureSequence(pathname, email) {
  const statuses = [];
  for (let index = 0; index < 5; index += 1) {
    const response = await attemptLogin(pathname, email, "wrong-password");
    assert(response.status === 401, `${pathname} invalid attempt #${index + 1} should return 401`);
    assert(response.error === "INVALID_CREDENTIALS", `${pathname} invalid attempt #${index + 1} error mismatch`);
    statuses.push({ status: response.status, error: response.error });
  }
  const blocked = await attemptLogin(pathname, email, "wrong-password");
  assert(blocked.status === 429, `${pathname} blocked attempt should return 429`);
  assert(blocked.error === "LOGIN_RATE_LIMITED", `${pathname} blocked error mismatch`);
  assert(Number(blocked.retryAfterSec) > 0, `${pathname} retryAfterSec missing`);
  statuses.push({ status: blocked.status, error: blocked.error, retryAfterSec: blocked.retryAfterSec });
  return statuses;
}

async function attemptLogin(pathname, email, password) {
  return fetchJson(
    pathname,
    {
      method: "POST",
      headers: {
        origin: requestOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
    { allowFailure: true },
  );
}

async function fetchJson(pathname, options, config = {}) {
  const response = await fetch(toUrl(pathname), options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok && !config.allowFailure) {
    throw new Error(`${pathname} returned ${response.status}: ${text}`);
  }
  return { status: response.status, ...payload };
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
