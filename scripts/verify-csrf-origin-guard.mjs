const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const goodOrigin = new URL(baseUrl).origin;
const evilOrigin = "https://evil.example";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";

async function main() {
  const blocked = await fetchJson(
    "/api/auth/login",
    {
      method: "POST",
      headers: {
        origin: evilOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    },
    { allowFailure: true },
  );
  assert(blocked.status === 403, "cross-site login should return 403");
  assert(
    blocked.error === "CSRF_ORIGIN_MISMATCH" || blocked.error === "CSRF_REFERER_MISMATCH" || blocked.error === "CSRF_ORIGIN_REQUIRED",
    "cross-site login error mismatch",
  );

  const allowed = await fetchJson("/api/auth/login", {
    method: "POST",
    headers: {
      origin: goodOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  assert(allowed.data?.authenticated === true, "same-origin login should succeed");

  console.log(JSON.stringify({
    ok: true,
    blockedStatus: blocked.status,
    blockedError: blocked.error,
    allowedAuthenticated: allowed.data?.authenticated === true,
  }, null, 2));
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
