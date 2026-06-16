const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const requestOrigin = new URL(baseUrl).origin;
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";

let cookie = "";

async function main() {
  const login = await fetchJson("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  assert(login.data?.authenticated === true, "login failed");

  const created = await fetchJson("/api/admin/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: `phase-d cancel ${Date.now()}`,
      status: "queued",
      payload: { taskCapability: "chat", prompt: "phase d cancel" },
    }),
  });
  const taskId = created.data?.id;
  assert(Boolean(taskId), "task create failed");

  const cancelled = await fetchJson("/api/proxy/generation/cancel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ taskId, kind: "chat" }),
  });
  assert(cancelled.data?.cancelled === true, "cancelled flag missing");
  assert(cancelled.data?.cancelScope === "local_only", "cancel scope mismatch");
  assert(cancelled.data?.upstreamSupported === false, "upstreamSupported should be false for local-only task");

  const tasks = await fetchJson("/api/admin/tasks?page=1&pageSize=20");
  const taskItems = Array.isArray(tasks.data?.items) ? tasks.data.items : [];
  const cancelledTask = taskItems.find((item) => item.id === taskId);
  assert(cancelledTask?.status === "cancelled", "cancelled task status mismatch");
  assert(String(cancelledTask?.result?.cancelScope || "") === "local_only", "stored cancel scope mismatch");
  assert(String(cancelledTask?.result?.cancellationMessage || "").includes("本地任务"), "stored cancel message mismatch");

  console.log(JSON.stringify({
    ok: true,
    taskId,
    cancelScope: cancelled.data.cancelScope,
    upstreamSupported: cancelled.data.upstreamSupported,
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
  const raw = response.headers.get("set-cookie");
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
