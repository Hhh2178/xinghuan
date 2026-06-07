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

const payload = {
  kind: "image",
  prompt: "payload contract prompt",
  size: "1024x1024",
  aspectRatio: "1:1",
  n: 1,
};
const result = { adapter: "contract", imageUrls: ["data:image/png;base64,AA=="] };

const created = await fetchJson("/api/admin/tasks", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    title: `payload contract ${Date.now()}`,
    status: "cancelled",
    payload,
    result,
  }),
});

const taskId = created.data?.id;
assert(Boolean(taskId), "task was not created");
assert(created.data?.payload?.prompt === payload.prompt, "created task payload missing");
assert(created.data?.result?.adapter === result.adapter, "created task result missing");

const tasks = await fetchJson("/api/admin/tasks");
const task = tasks.data?.find((item) => item.id === taskId);
assert(task?.payload?.size === payload.size, "listed task payload missing");
assert(task?.result?.imageUrls?.[0] === result.imageUrls[0], "listed task result missing");

console.log(JSON.stringify({ ok: true, taskId, payload: task.payload, result: task.result }, null, 2));

async function fetchJson(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${text}`);
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
