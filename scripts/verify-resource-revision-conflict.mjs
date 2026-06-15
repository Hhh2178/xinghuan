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
  const created = {
    categoryId: "",
    itemId: "",
    finalCategoryRevision: 0,
    finalItemRevision: 0,
  };
  try {
    await loginFirstAvailable(loginEmailCandidates, loginPassword);

    const createdCategory = await fetchJson("/api/resources/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "image", name: `phase-b-resource-${Date.now()}` }),
    });
    created.categoryId = createdCategory.data?.id || "";
    assert(created.categoryId, "resource category creation failed");
    assert(Number(createdCategory.data?.revision) === 1, "expected initial category revision=1");

    const renamedCategory = await fetchJson(`/api/resources/categories/${encodeURIComponent(created.categoryId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `${createdCategory.data.name}-renamed`, revision: createdCategory.data.revision }),
    });
    created.finalCategoryRevision = Number(renamedCategory.data?.revision) || 0;
    assert(created.finalCategoryRevision === 2, "expected category revision=2 after rename");

    const staleCategoryWrite = await fetchJson(
      `/api/resources/categories/${encodeURIComponent(created.categoryId)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "stale-category-write", revision: createdCategory.data.revision }),
      },
      { allowFailure: true },
    );
    assert(staleCategoryWrite.status === 409, "stale category write should return 409");
    assert(staleCategoryWrite.error === "RESOURCE_REVISION_CONFLICT", "stale category write error mismatch");
    assert(Number(staleCategoryWrite.currentRevision) === 2, "stale category currentRevision mismatch");

    const createdItem = await fetchJson("/api/resources/items/add", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "image",
        title: "phase-b-resource-item",
        url: "/files/output/phase-b-resource-item.png",
        mime: "image/png",
        categoryId: created.categoryId,
      }),
    });
    created.itemId = createdItem.data?.id || "";
    assert(created.itemId, "resource item creation failed");
    assert(Number(createdItem.data?.revision) === 1, "expected initial item revision=1");

    const updatedItem = await fetchJson(`/api/resources/items/${encodeURIComponent(created.itemId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ favorite: true, revision: createdItem.data.revision }),
    });
    created.finalItemRevision = Number(updatedItem.data?.revision) || 0;
    assert(created.finalItemRevision === 2, "expected item revision=2 after update");
    assert(updatedItem.data?.favorite === true, "expected favorite=true after update");

    const staleItemWrite = await fetchJson(
      `/api/resources/items/${encodeURIComponent(created.itemId)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "stale-item-write", revision: createdItem.data.revision }),
      },
      { allowFailure: true },
    );
    assert(staleItemWrite.status === 409, "stale item write should return 409");
    assert(staleItemWrite.error === "RESOURCE_REVISION_CONFLICT", "stale item write error mismatch");
    assert(Number(staleItemWrite.currentRevision) === 2, "stale item currentRevision mismatch");

    const staleItemDelete = await fetchJson(
      `/api/resources/items/${encodeURIComponent(created.itemId)}`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision: createdItem.data.revision }),
      },
      { allowFailure: true },
    );
    assert(staleItemDelete.status === 409, "stale item delete should return 409");
    assert(staleItemDelete.error === "RESOURCE_REVISION_CONFLICT", "stale item delete error mismatch");
    assert(Number(staleItemDelete.currentRevision) === 2, "stale item delete currentRevision mismatch");

    console.log(
      JSON.stringify(
        {
          ok: true,
          categoryId: created.categoryId,
          categoryRevision: created.finalCategoryRevision,
          itemId: created.itemId,
          itemRevision: created.finalItemRevision,
          staleCategoryWriteStatus: staleCategoryWrite.status,
          staleItemWriteStatus: staleItemWrite.status,
          staleItemDeleteStatus: staleItemDelete.status,
        },
        null,
        2,
      ),
    );
  } finally {
    if (created.itemId && created.finalItemRevision > 0) {
      await fetchText(`/api/resources/items/${encodeURIComponent(created.itemId)}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision: created.finalItemRevision }),
      }).catch(() => undefined);
    }
    if (created.categoryId && created.finalCategoryRevision > 0) {
      await fetchText(`/api/resources/categories/${encodeURIComponent(created.categoryId)}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision: created.finalCategoryRevision }),
      }).catch(() => undefined);
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
