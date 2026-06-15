const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const adminEmailCandidates = uniqueNonEmpty([
  process.env.XINGHUAN_VERIFY_EMAIL,
  process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL,
  "admin@xinghuan.local",
]);
const adminPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const memberEmailCandidates = uniqueNonEmpty([
  process.env.XINGHUAN_VERIFY_MEMBER_EMAIL,
  process.env.XINGHUAN_BOOTSTRAP_MEMBER_EMAIL,
  "member@xinghuan.local",
]);
const memberPassword =
  process.env.XINGHUAN_VERIFY_MEMBER_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_MEMBER_PASSWORD ?? "member123456";

const adminJar = { cookie: "" };
const memberJar = { cookie: "" };

async function main() {
  await loginFirstAvailable(adminJar, adminEmailCandidates, adminPassword);
  const memberLogin = await loginFirstAvailable(memberJar, memberEmailCandidates, memberPassword);
  const memberEmail = memberLogin?.data?.user?.email || memberEmailCandidates[0] || "member@xinghuan.local";

  const beforeMe = await fetchJson("/api/auth/me", undefined, memberJar);
  assert(beforeMe.data?.authenticated === true, "member should be authenticated before revoke");

  const sessions = await fetchJson("/api/admin/sessions", undefined, adminJar);
  const memberSession = (sessions.data || []).find((item) => item.userEmail === memberEmail && item.current === false && !item.revokedAt);
  assert(memberSession, "member session not found in admin sessions");
  assert(memberSession.ip !== undefined, "member session ip missing");
  assert(memberSession.userAgent !== undefined, "member session userAgent missing");
  assert(Number(memberSession.lastSeenAt) >= Number(memberSession.createdAt), "member session lastSeenAt invalid");

  const revoke = await fetchJson(`/api/admin/sessions/${encodeURIComponent(memberSession.id)}/revoke`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  }, adminJar);
  assert(revoke.data?.ok === true, "session revoke failed");

  const afterMe = await fetchJson("/api/auth/me", undefined, memberJar);
  assert(afterMe.data?.authenticated === false, "member session should be revoked");

  const afterSessions = await fetchJson("/api/admin/sessions", undefined, adminJar);
  const revokedSession = (afterSessions.data || []).find((item) => item.id === memberSession.id);
  assert(revokedSession?.revokedAt, "revoked session should remain visible with revokedAt");

  console.log(JSON.stringify({
    ok: true,
    memberEmail,
    revokedSessionId: memberSession.id,
    revokedAt: revokedSession.revokedAt,
  }, null, 2));
}

async function loginFirstAvailable(jar, emailCandidates, password) {
  const failures = [];
  for (const email of emailCandidates) {
    const response = await fetchJson(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
      jar,
      { allowFailure: true },
    );
    if (response.status >= 200 && response.status < 300 && response.data?.authenticated === true) return response;
    failures.push(`${email}:${response.status}`);
  }
  throw new Error(`login failed (${failures.join(", ")})`);
}

async function fetchJson(pathname, options, jar, config = {}) {
  const response = await fetch(toUrl(pathname), withCookie(options, jar));
  captureCookie(response, jar);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok && !config.allowFailure) {
    throw new Error(`${pathname} returned ${response.status}: ${text}`);
  }
  return { status: response.status, ...payload };
}

function withCookie(options = {}, jar) {
  return {
    ...options,
    headers: {
      ...(jar?.cookie ? { cookie: jar.cookie } : {}),
      ...(options.headers || {}),
    },
  };
}

function captureCookie(response, jar) {
  const raw = response.headers.get("set-cookie");
  if (!raw || !jar) return;
  jar.cookie = raw.split(";")[0];
}

function toUrl(pathname) {
  if (String(pathname).startsWith("http://") || String(pathname).startsWith("https://")) return pathname;
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function uniqueNonEmpty(values) {
  return [...new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean))];
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
