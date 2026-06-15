const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmailCandidates = uniqueNonEmpty([
  process.env.XINGHUAN_VERIFY_EMAIL,
  process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL,
  "admin@xinghuan.local",
]);
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const requestOrigin = new URL(baseUrl).origin;

let cookie = "";

async function main() {
  const createdCanvasIds = [];
  try {
    await loginFirstAvailable(loginEmailCandidates, loginPassword);

    const created = await fetchJson("/api/canvas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `phase-b-revision-${Date.now()}` }),
    });
    const canvasId = created.data?.id;
    if (!canvasId) throw new Error("canvas creation failed");
    createdCanvasIds.push(canvasId);

    const original = await fetchJson(`/api/canvas/${encodeURIComponent(canvasId)}`);
    assert(Number(original.data?.revision) === 1, "expected initial revision=1");

    const payload = {
      nodes: [
        {
          id: "revision-node-1",
          type: "text",
          position: { x: 120, y: 140 },
          data: { title: "版本校验", content: "phase-b" },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      revision: original.data.revision,
      nextNodeSerialId: 2,
    };
    const saved = await fetchJson(`/api/canvas/${encodeURIComponent(canvasId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert(Number(saved.data?.revision) === 2, "expected save revision=2");

    const autoSaved = await fetchJson(`/api/canvas/${encodeURIComponent(canvasId)}/auto-save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert(autoSaved.data?.path, "auto-save path missing");

    const afterAutoSave = await fetchJson(`/api/canvas/${encodeURIComponent(canvasId)}`);
    assert(Number(afterAutoSave.data?.revision) === 2, "auto-save should not bump postgres revision");

    const staleWrite = await fetchJson(
      `/api/canvas/${encodeURIComponent(canvasId)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...payload,
          nodes: [...payload.nodes, { id: "revision-node-2", type: "text", position: { x: 260, y: 140 }, data: { title: "冲突", content: "stale" } }],
          nextNodeSerialId: 3,
        }),
      },
      { allowFailure: true },
    );
    assert(staleWrite.status === 409, "stale write should return 409");
    assert(staleWrite.error === "CANVAS_REVISION_CONFLICT", "stale write error code mismatch");
    assert(Number(staleWrite.currentRevision) === 2, "stale write currentRevision mismatch");

    console.log(
      JSON.stringify(
        {
          ok: true,
          canvasId,
          initialRevision: original.data.revision,
          savedRevision: saved.data.revision,
          postAutoSaveRevision: afterAutoSave.data.revision,
          staleWriteStatus: staleWrite.status,
          staleWriteError: staleWrite.error,
          currentRevision: staleWrite.currentRevision,
        },
        null,
        2,
      ),
    );
  } finally {
    for (const canvasId of createdCanvasIds) {
      await fetchText(`/api/canvas/${encodeURIComponent(canvasId)}`, { method: "DELETE" }).catch(() => undefined);
    }
  }
}

async function loginFirstAvailable(emailCandidates, password) {
  const failures = [];
  for (const email of emailCandidates) {
    const response = await fetchJson(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
      { allowFailure: true },
    );
    if (response.status >= 200 && response.status < 300 && response.data?.authenticated === true) return;
    failures.push(`${email}:${response.status}`);
  }
  throw new Error(`login failed (${failures.join(", ")})`);
}

async function fetchText(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  return { status: response.status, text: await response.text() };
}

async function fetchJson(pathname, options, config = {}) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok && !config.allowFailure) {
    throw new Error(`${pathname} returned ${response.status}: ${text}`);
  }
  return { status: response.status, ...payload };
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

function uniqueNonEmpty(values) {
  return [...new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean))];
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
