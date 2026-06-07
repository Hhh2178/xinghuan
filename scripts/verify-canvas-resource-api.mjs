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

  const canvases = await fetchJson("/api/canvas");
  const canvasItems = Array.isArray(canvases.data) ? canvases.data : [];

  let firstCanvasSummary = null;
  if (canvasItems[0]?.id) {
    const canvasDetail = await fetchJson(`/api/canvas/${encodeURIComponent(canvasItems[0].id)}`);
    assert(Array.isArray(canvasDetail.data?.nodes), "canvas detail nodes missing");
    assert(Array.isArray(canvasDetail.data?.edges), "canvas detail edges missing");
    firstCanvasSummary = {
      id: canvasItems[0].id,
      nodeCount: canvasDetail.data.nodes.length,
      edgeCount: canvasDetail.data.edges.length,
    };
  }

  const resources = await fetchJson("/api/resources/items?kind=image");
  const resourceItems = Array.isArray(resources.data) ? resources.data : [];

  console.log(
    JSON.stringify(
      {
        ok: true,
        canvasCount: canvasItems.length,
        firstCanvas: firstCanvasSummary,
        imageResourceCount: resourceItems.length,
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
