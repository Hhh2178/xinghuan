const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const requestOrigin = new URL(baseUrl).origin;

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
      title: `lifecycle task ${Date.now()}`,
      status: "queued",
      payload: { kind: "image", prompt: "task lifecycle" },
    }),
  });
  const taskId = created.data?.id;
  assert(Boolean(taskId), "task was not created");

  const cancelled = await fetchJson(`/api/admin/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "cancel" }),
  });
  assert(cancelled.data?.status === "cancelled", "task was not cancelled");

  const retried = await fetchJson(`/api/admin/tasks/${taskId}/retry`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const retriedTask = retried.data;
  assert(Boolean(retriedTask?.id), "retry task was not created");
  assert(retriedTask.id !== taskId, "retry must create a new task");
  assert(retriedTask.status === "queued", "retry task must be queued");
  assert(retriedTask.payload?.prompt === "task lifecycle", "retry task did not keep original payload");
  assert(retriedTask.result?.retryOfTaskId === taskId, "retry task did not record original task id");

  const tasks = await fetchJson("/api/admin/tasks?page=1&pageSize=50");
  const taskItems = Array.isArray(tasks.data?.items) ? tasks.data.items : [];
  const originalTask = taskItems.find((item) => item.id === taskId);
  const clonedTask = taskItems.find((item) => item.id === retriedTask.id);
  assert(originalTask?.status === "cancelled", "original task lost cancelled status");
  assert((originalTask?.logs || []).some((line) => String(line).includes("管理员取消")), "cancel log missing");
  assert((clonedTask?.logs || []).some((line) => String(line).includes("重试")), "retry log missing");

  console.log(
    JSON.stringify(
      {
        ok: true,
        originalTaskId: taskId,
        retryTaskId: retriedTask.id,
        originalStatus: originalTask.status,
        retryStatus: clonedTask.status,
      },
      null,
      2,
    ),
  );
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
  console.error(error);
  process.exit(1);
});
