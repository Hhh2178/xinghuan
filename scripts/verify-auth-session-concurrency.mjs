const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmail =
  process.env.XINGHUAN_VERIFY_EMAIL ??
  process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ??
  "admin@xinghuan.local";
const loginPassword =
  process.env.XINGHUAN_VERIFY_PASSWORD ??
  process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ??
  "admin123456";

async function main() {
  const sessionA = await login();
  const sessionB = await login();

  const meA = await fetchJson("/api/auth/me", undefined, sessionA.cookie, true);
  const meB = await fetchJson("/api/auth/me", undefined, sessionB.cookie, true);

  const ok =
    meA.status === 200 &&
    meA.data?.authenticated === true &&
    meA.data?.user?.email === loginEmail &&
    meB.status === 200 &&
    meB.data?.authenticated === true &&
    meB.data?.user?.email === loginEmail;

  console.log(`${ok ? "PASS" : "FAIL"} Concurrent sessions for same user remain authenticated`);
  if (!ok) {
    console.log(JSON.stringify({ sessionA: meA, sessionB: meB }, null, 2));
    process.exit(1);
  }
}

async function login() {
  const response = await fetchJson(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    },
    "",
    false,
  );
  const cookie = extractCookie(response.headers);
  if (!cookie || response.status !== 200 || response.data?.authenticated !== true) {
    throw new Error(`login failed: ${JSON.stringify(response.data)}`);
  }
  return { cookie, data: response.data };
}

async function fetchJson(pathname, options = {}, cookie = "", allowFailure = false) {
  const response = await fetch(toUrl(pathname), {
    ...options,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok && !allowFailure) {
    throw new Error(`${pathname} returned ${response.status}: ${text}`);
  }
  return {
    status: response.status,
    headers: response.headers,
    ...data,
  };
}

function extractCookie(headers) {
  const getSetCookie = headers?.getSetCookie;
  const raw =
    typeof getSetCookie === "function"
      ? getSetCookie.call(headers)?.[0]
      : headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

function toUrl(pathname) {
  if (String(pathname).startsWith("http://") || String(pathname).startsWith("https://")) return pathname;
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
