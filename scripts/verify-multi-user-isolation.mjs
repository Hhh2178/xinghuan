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
const requestOrigin = new URL(baseUrl).origin;

const adminJar = { cookie: "" };
const memberJar = { cookie: "" };

async function main() {
  const startedAt = Date.now();
  const stamp = `${startedAt}`;
  const created = {
    adminCanvasId: "",
    memberCanvasId: "",
    adminResourceId: "",
    memberResourceId: "",
  };
  const verified = [];

  try {
    const adminLogin = await loginFirstAvailable(adminJar, adminEmailCandidates, adminPassword);
    verified.push("admin login ok");

    const memberLogin = await loginFirstAvailable(memberJar, memberEmailCandidates, memberPassword);
    verified.push("member login ok");

    const [initialAdminCanvases, initialMemberCanvases, initialAdminResources, initialMemberResources] = await Promise.all([
      fetchJson("/api/canvas", undefined, adminJar),
      fetchJson("/api/canvas", undefined, memberJar),
      fetchJson("/api/resources/items?kind=image", undefined, adminJar),
      fetchJson("/api/resources/items?kind=image", undefined, memberJar),
    ]);

    const adminCanvas = await fetchJson(
      "/api/canvas",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: `phase-a-admin-canvas-${stamp}` }),
      },
      adminJar,
    );
    created.adminCanvasId = safeText(adminCanvas.data?.id);
    assert(created.adminCanvasId, "admin canvas creation failed");

    const memberCanvas = await fetchJson(
      "/api/canvas",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: `phase-a-member-canvas-${stamp}` }),
      },
      memberJar,
    );
    created.memberCanvasId = safeText(memberCanvas.data?.id);
    assert(created.memberCanvasId, "member canvas creation failed");

    const adminListAfterCreate = asArray((await fetchJson("/api/canvas", undefined, adminJar)).data);
    const memberListAfterCreate = asArray((await fetchJson("/api/canvas", undefined, memberJar)).data);
    assert(adminListAfterCreate.some((item) => item?.id === created.adminCanvasId), "admin cannot see own canvas");
    assert(!adminListAfterCreate.some((item) => item?.id === created.memberCanvasId), "admin saw member canvas");
    assert(memberListAfterCreate.some((item) => item?.id === created.memberCanvasId), "member cannot see own canvas");
    assert(!memberListAfterCreate.some((item) => item?.id === created.adminCanvasId), "member saw admin canvas");
    verified.push("canvas list isolation ok");

    const foreignCanvasRead = await fetchJson(
      `/api/canvas/${encodeURIComponent(created.adminCanvasId)}`,
      undefined,
      memberJar,
      { allowFailure: true },
    );
    assert(
      foreignCanvasRead.status === 403 && responseContains(foreignCanvasRead, "CANVAS_OWNERSHIP_MISMATCH"),
      "foreign canvas read did not return ownership mismatch",
    );

    const fakePayload = {
      nodes: [{ id: "intruder-node", type: "text", position: { x: 10, y: 10 }, data: { title: "intruder", content: "blocked" } }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      nextNodeSerialId: 2,
    };
    const foreignCanvasPut = await fetchJson(
      `/api/canvas/${encodeURIComponent(created.adminCanvasId)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fakePayload),
      },
      memberJar,
      { allowFailure: true },
    );
    assert(
      foreignCanvasPut.status === 403 && responseContains(foreignCanvasPut, "CANVAS_OWNERSHIP_MISMATCH"),
      "foreign canvas put did not return ownership mismatch",
    );

    const foreignCanvasAutoSave = await fetchJson(
      `/api/canvas/${encodeURIComponent(created.adminCanvasId)}/auto-save`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fakePayload),
      },
      memberJar,
      { allowFailure: true },
    );
    assert(
      foreignCanvasAutoSave.status === 403 && responseContains(foreignCanvasAutoSave, "CANVAS_OWNERSHIP_MISMATCH"),
      "foreign canvas auto-save did not return ownership mismatch",
    );

    const adminCanvasAfterForeignWrite = await fetchJson(
      `/api/canvas/${encodeURIComponent(created.adminCanvasId)}`,
      undefined,
      adminJar,
    );
    assert(asArray(adminCanvasAfterForeignWrite.data?.nodes).length === 0, "foreign write changed admin canvas");
    verified.push("foreign canvas read/write rejection ok");

    const adminResource = await fetchJson(
      "/api/resources/items/add",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "image",
          title: `phase-a-admin-resource-${stamp}`,
          url: `/verify/admin-resource-${stamp}.png`,
          sourceUrl: `/verify/admin-resource-${stamp}.png`,
          mime: "image/png",
          size: 1,
        }),
      },
      adminJar,
    );
    created.adminResourceId = safeText(adminResource.data?.id);
    assert(created.adminResourceId, "admin resource creation failed");

    const memberResource = await fetchJson(
      "/api/resources/items/add",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "image",
          title: `phase-a-member-resource-${stamp}`,
          url: `/verify/member-resource-${stamp}.png`,
          sourceUrl: `/verify/member-resource-${stamp}.png`,
          mime: "image/png",
          size: 1,
        }),
      },
      memberJar,
    );
    created.memberResourceId = safeText(memberResource.data?.id);
    assert(created.memberResourceId, "member resource creation failed");

    const adminResourcesAfterCreate = asArray((await fetchJson("/api/resources/items?kind=image", undefined, adminJar)).data);
    const memberResourcesAfterCreate = asArray((await fetchJson("/api/resources/items?kind=image", undefined, memberJar)).data);
    assert(adminResourcesAfterCreate.some((item) => item?.id === created.adminResourceId), "admin cannot see own resource");
    assert(!adminResourcesAfterCreate.some((item) => item?.id === created.memberResourceId), "admin saw member resource");
    assert(memberResourcesAfterCreate.some((item) => item?.id === created.memberResourceId), "member cannot see own resource");
    assert(!memberResourcesAfterCreate.some((item) => item?.id === created.adminResourceId), "member saw admin resource");
    verified.push("resource list isolation ok");

    const memberAdminProviders = await fetchJson("/api/admin/providers", undefined, memberJar, { allowFailure: true });
    assert(memberAdminProviders.status === 403, "member admin access was not rejected");
    verified.push("member admin access blocked");

    await cleanupCreated(created, adminJar, memberJar);

    const adminCanvasesAfterCleanup = asArray((await fetchJson("/api/canvas", undefined, adminJar)).data);
    const memberCanvasesAfterCleanup = asArray((await fetchJson("/api/canvas", undefined, memberJar)).data);
    const adminResourcesAfterCleanup = asArray((await fetchJson("/api/resources/items?kind=image", undefined, adminJar)).data);
    const memberResourcesAfterCleanup = asArray((await fetchJson("/api/resources/items?kind=image", undefined, memberJar)).data);

    assert(!adminCanvasesAfterCleanup.some((item) => item?.id === created.adminCanvasId), "admin canvas cleanup failed");
    assert(!memberCanvasesAfterCleanup.some((item) => item?.id === created.memberCanvasId), "member canvas cleanup failed");
    assert(!adminResourcesAfterCleanup.some((item) => item?.id === created.adminResourceId), "admin resource cleanup failed");
    assert(!memberResourcesAfterCleanup.some((item) => item?.id === created.memberResourceId), "member resource cleanup failed");
    verified.push("temporary acceptance data cleaned");

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          verified,
          before: {
            adminCanvasCount: asArray(initialAdminCanvases.data).length,
            memberCanvasCount: asArray(initialMemberCanvases.data).length,
            adminImageResourceCount: asArray(initialAdminResources.data).length,
            memberImageResourceCount: asArray(initialMemberResources.data).length,
          },
          afterCleanup: {
            adminCanvasCount: adminCanvasesAfterCleanup.length,
            memberCanvasCount: memberCanvasesAfterCleanup.length,
            adminImageResourceCount: adminResourcesAfterCleanup.length,
            memberImageResourceCount: memberResourcesAfterCleanup.length,
          },
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await cleanupCreated(created, adminJar, memberJar).catch(() => undefined);
    throw error;
  }
}

async function cleanupCreated(created, admin, member) {
  if (created.adminResourceId) {
    await fetchJson(`/api/resources/items/${encodeURIComponent(created.adminResourceId)}`, { method: "DELETE" }, admin, {
      allowFailure: true,
    });
  }
  if (created.memberResourceId) {
    await fetchJson(
      `/api/resources/items/${encodeURIComponent(created.memberResourceId)}`,
      { method: "DELETE" },
      member,
      { allowFailure: true },
    );
  }
  if (created.adminCanvasId) {
    await fetchJson(`/api/canvas/${encodeURIComponent(created.adminCanvasId)}`, { method: "DELETE" }, admin, {
      allowFailure: true,
    });
  }
  if (created.memberCanvasId) {
    await fetchJson(`/api/canvas/${encodeURIComponent(created.memberCanvasId)}`, { method: "DELETE" }, member, {
      allowFailure: true,
    });
  }
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
    if (response.status >= 200 && response.status < 300 && response.data?.authenticated === true) {
      return { email, data: response.data };
    }
    failures.push(`${email}:${response.status}`);
  }
  throw new Error(`login failed for all candidates (${failures.join(", ")})`);
}

async function fetchJson(pathname, options, jar, config = {}) {
  const response = await fetch(toUrl(pathname), withCookie(options, jar));
  captureCookie(response, jar);
  const text = await response.text();
  const payload = safeJsonParse(text);
  if (!response.ok && !config.allowFailure) {
    throw new Error(`${pathname} returned ${response.status}: ${text}`);
  }
  return {
    status: response.status,
    text,
    ...payload,
  };
}

function responseContains(response, fragment) {
  const needle = safeText(fragment);
  if (!needle) return false;
  return JSON.stringify(response.data ?? response).includes(needle) || safeText(response.text).includes(needle);
}

function withCookie(options = {}, jar) {
  const method = String(options.method || "GET").toUpperCase();
  return {
    ...options,
    headers: {
      ...(jar?.cookie ? { cookie: jar.cookie } : {}),
      ...(method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE" ? { origin: requestOrigin } : {}),
      ...(options?.headers || {}),
    },
  };
}

function captureCookie(response, jar) {
  const raw = response.headers.get("set-cookie");
  if (!raw || !jar) return;
  jar.cookie = raw.split(";")[0];
}

function safeJsonParse(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { data: null };
  }
}

function toUrl(pathname) {
  if (String(pathname).startsWith("http://") || String(pathname).startsWith("https://")) return pathname;
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
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
