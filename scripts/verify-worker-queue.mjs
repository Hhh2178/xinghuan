const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
let cookie = "";

const login = await fetchJson("/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: loginEmail, password: loginPassword }),
});
assert(login.data?.authenticated === true, "login failed");

const system = await fetchJson("/api/admin/system");
assert(system.data?.redis?.status === "connected", "redis is not connected");
assert(system.data?.database?.status === "connected", "database is not connected");

const title = `worker 队列验收任务 ${Date.now()}`;
const created = await fetchJson("/api/admin/tasks", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ title, status: "queued" }),
});
const taskId = created.data?.id;
assert(Boolean(taskId), "task was not created");

let task;
for (let attempt = 0; attempt < 30; attempt += 1) {
  await sleep(1000);
  const tasks = await fetchJson("/api/admin/tasks");
  task = tasks.data?.find((item) => item.id === taskId);
  if (task?.status === "succeeded") break;
  if (task?.status === "failed") throw new Error(`task failed: ${(task.logs || []).join(" | ")}`);
}

assert(task?.status === "succeeded", `task did not succeed, current status=${task?.status || "missing"}`);
assert((task.logs || []).some((line) => String(line).includes("执行完成")), "task completion log missing");

console.log(JSON.stringify({
  ok: true,
  taskId,
  status: task.status,
  redisStatus: system.data.redis.status,
  databaseStatus: system.data.database.status,
}, null, 2));

async function fetchJson(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}: ${text}`);
  }
  return JSON.parse(text);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
