const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";

let cookie = "";

await fetchJson("/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: loginEmail, password: loginPassword }),
});

const status = await fetchJson("/api/ai-watermark/status");
assert(status.data?.installed === false, "default ai watermark status should be unavailable until adapter is configured");
assert(Array.isArray(status.data?.markKeys), "ai watermark markKeys missing");
assert(Array.isArray(status.data?.setupHints) && status.data.setupHints.length > 0, "ai watermark setup hints missing");

const processResponse = await fetchText("/api/ai-watermark/process", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ source: "/files/input/example.png", kind: "image", mode: "smart" }),
});
assert(processResponse.status === 501, "ai watermark process should return a structured not-configured response");
assert(processResponse.text.includes("AI_WATERMARK_NOT_CONFIGURED"), "ai watermark process error code missing");

console.log("PASS ai watermark API returns structured status and not-configured process response");

async function fetchJson(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${text}`);
  return JSON.parse(text);
}

async function fetchText(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  return { status: response.status, text: await response.text() };
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
