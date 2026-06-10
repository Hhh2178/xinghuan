const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const adminEmail =
  process.env.XINGHUAN_VERIFY_EMAIL ??
  process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ??
  "admin@xinghuan.local";
const adminPassword =
  process.env.XINGHUAN_VERIFY_PASSWORD ??
  process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ??
  "admin123456";
const memberEmail =
  process.env.XINGHUAN_VERIFY_MEMBER_EMAIL ??
  process.env.XINGHUAN_BOOTSTRAP_MEMBER_EMAIL ??
  "member@xinghuan.local";
const memberPassword =
  process.env.XINGHUAN_VERIFY_MEMBER_PASSWORD ??
  process.env.XINGHUAN_BOOTSTRAP_MEMBER_PASSWORD ??
  "member123456";

let cookie = "";

async function main() {
  const results = [];

  await fetchJson("/api/auth/logout", { method: "POST" }).catch(() => undefined);

  const adminMeBefore = await fetchJson("/api/auth/admin-me");
  results.push([
    "GET /api/auth/admin-me unauthenticated",
    adminMeBefore.data?.authenticated === false && adminMeBefore.data?.user === null,
  ]);

  const memberAdminLogin = await fetchText("/api/auth/admin-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: memberEmail, password: memberPassword }),
  });
  results.push([
    "POST /api/auth/admin-login rejects member",
    memberAdminLogin.status === 403 && memberAdminLogin.text.includes("ADMIN_REQUIRED"),
  ]);

  const adminLogin = await fetchJson("/api/auth/admin-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  results.push([
    "POST /api/auth/admin-login accepts admin",
    adminLogin.data?.authenticated === true && adminLogin.data?.user?.role === "admin",
  ]);

  const adminMe = await fetchJson("/api/auth/admin-me");
  results.push([
    "GET /api/auth/admin-me authenticated",
    adminMe.data?.authenticated === true && adminMe.data?.user?.email === adminEmail,
  ]);

  const users = await fetchJson("/api/admin/users");
  const adminUser = Array.isArray(users.data)
    ? users.data.find((user) => user.email === adminEmail)
    : null;
  const memberUser = Array.isArray(users.data)
    ? users.data.find((user) => user.email === memberEmail)
    : null;
  results.push([
    "GET /api/admin/users exposes admin password state",
    Boolean(
      adminUser &&
        adminUser.passwordAvailable === true &&
        typeof adminUser.password === "string" &&
        adminUser.password.length > 0,
    ),
  ]);
  results.push([
    "GET /api/admin/users exposes member password state",
    Boolean(
      memberUser &&
        memberUser.passwordAvailable === true &&
        typeof memberUser.password === "string" &&
        memberUser.password.length > 0,
    ),
  ]);

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
  const payload = text ? JSON.parse(text) : {};
  return {
    status: response.status,
    data: payload.data,
    text,
  };
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
