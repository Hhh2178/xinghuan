const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
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

  const catalog = await fetchJson("/api/runninghub/catalog");
  const workflows = Array.isArray(catalog.data?.workflows) ? catalog.data.workflows : [];
  const apps = Array.isArray(catalog.data?.apps) ? catalog.data.apps : [];
  const firstWorkflow = workflows[0] || null;

  if (firstWorkflow) {
    assert(typeof firstWorkflow.catalogId === "string" && firstWorkflow.catalogId.length > 0, "catalogId missing");
    assert(typeof firstWorkflow.runTargetId === "string" && firstWorkflow.runTargetId.length > 0, "runTargetId missing");
    assert(Array.isArray(firstWorkflow.fields), "workflow fields missing");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        workflowCount: workflows.length,
        appCount: apps.length,
        firstWorkflow: firstWorkflow
          ? {
              catalogId: firstWorkflow.catalogId,
              title: firstWorkflow.title,
              runTargetId: firstWorkflow.runTargetId,
              fieldCount: Array.isArray(firstWorkflow.fields) ? firstWorkflow.fields.length : 0,
            }
          : null,
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
