const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const requestOrigin = new URL(baseUrl).origin;
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";

let cookie = "";

async function main() {
  const login = await fetchJson("/api/auth/admin-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  assert(login.data?.authenticated === true, "login failed");

  const suffix = Date.now();
  for (let index = 0; index < 7; index += 1) {
    await fetchJson("/api/admin/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `phase-d page ${suffix}-${index}`,
        status: index % 2 === 0 ? "queued" : "failed",
        payload: { taskCapability: index % 3 === 0 ? "video" : "image", prompt: `task ${index}` },
      }),
    });
  }

  const page1 = await fetchJson("/api/admin/tasks?page=1&pageSize=5");
  const page2 = await fetchJson("/api/admin/tasks?page=2&pageSize=5");
  const failedOnly = await fetchJson("/api/admin/tasks?page=1&pageSize=10&status=failed");
  const imageOnly = await fetchJson("/api/admin/tasks?page=1&pageSize=10&capability=image");
  const seededImageTitles = new Set([0, 1, 2, 4, 5].map((index) => `phase-d page ${suffix}-${index}`));
  const seededVideoTitles = new Set([3, 6].map((index) => `phase-d page ${suffix}-${index}`));

  assert(Array.isArray(page1.data?.items), "page1 items missing");
  assert(page1.data.items.length <= 5, "page1 size mismatch");
  assert(page2.data.page === 2, "page2 page number mismatch");
  assert(Number(page1.data.total) >= 7, "total should include seeded tasks");
  assert(typeof page1.data.hasMore === "boolean", "hasMore missing");
  assert((failedOnly.data.items || []).every((item) => item.status === "failed"), "status filter mismatch");
  for (const page of [page1, page2, failedOnly, imageOnly]) {
    assert((page.data.items || []).every((item) => !("payload" in item) && !("result" in item) && !("logs" in item)), "task list leaked heavy fields");
  }
  const seededImageItems = (imageOnly.data.items || []).filter((item) => seededImageTitles.has(item.title));
  assert(seededImageItems.length > 0, "capability filter did not return seeded image tasks");
  assert(seededImageItems.every((item) => !seededVideoTitles.has(item.title)), "capability filter returned seeded video task");

  console.log(JSON.stringify({
    ok: true,
    page1: { total: page1.data.total, size: page1.data.items.length, hasMore: page1.data.hasMore },
    page2: { page: page2.data.page, size: page2.data.items.length },
    failedCount: failedOnly.data.items.length,
    imageCount: imageOnly.data.items.length,
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
