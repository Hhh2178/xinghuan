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
  await loginFirstAvailable(loginEmailCandidates, loginPassword);

  const originalAssistant = await fetchJson("/api/admin/assistant/settings");
  assert(originalAssistant.data, "assistant settings missing");
  const originalAssistantRevision = Number(originalAssistant.data.revision) || 1;

  const updatedAssistant = await fetchJson("/api/admin/assistant/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...originalAssistant.data,
      backend: {
        ...originalAssistant.data.backend,
        defaultOpen: !originalAssistant.data.backend.defaultOpen,
      },
      revision: originalAssistantRevision,
    }),
  });
  assert(Number(updatedAssistant.data?.revision) === originalAssistantRevision + 1, "assistant revision did not increment");

  const staleAssistantWrite = await fetchJson(
    "/api/admin/assistant/settings",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...originalAssistant.data,
        backend: {
          ...originalAssistant.data.backend,
          defaultOpen: originalAssistant.data.backend.defaultOpen,
        },
        revision: originalAssistantRevision,
      }),
    },
    { allowFailure: true },
  );
  assert(staleAssistantWrite.status === 409, "stale assistant write should return 409");
  assert(staleAssistantWrite.error === "ADMIN_SETTINGS_REVISION_CONFLICT", "assistant stale error mismatch");
  assert(Number(staleAssistantWrite.currentRevision) === originalAssistantRevision + 1, "assistant stale currentRevision mismatch");

  const restoredAssistant = await fetchJson("/api/admin/assistant/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...updatedAssistant.data,
      backend: {
        ...updatedAssistant.data.backend,
        defaultOpen: originalAssistant.data.backend.defaultOpen,
      },
      revision: Number(updatedAssistant.data.revision),
    }),
  });
  assert(
    restoredAssistant.data?.backend?.defaultOpen === originalAssistant.data.backend.defaultOpen,
    "assistant settings restore failed",
  );

  const originalSystem = await fetchJson("/api/admin/system");
  assert(originalSystem.data?.taskQueueSettings, "system settings missing");
  const originalSystemRevision = Number(originalSystem.data.taskQueueSettingsRevision) || 1;
  const originalImageConcurrency = Number(originalSystem.data.taskQueueSettings.image?.concurrency) || 4;
  const originalImageUserConcurrency = Number(originalSystem.data.taskQueueSettings.image?.userConcurrency) || 4;
  const originalRunningHubEnabled = originalSystem.data.taskQueueSettings.runninghub?.enabled !== false;
  const temporaryImageConcurrency = originalImageConcurrency >= 4 ? 3 : originalImageConcurrency + 1;
  const temporaryImageUserConcurrency = originalImageUserConcurrency >= 4 ? 3 : originalImageUserConcurrency + 1;

  const updatedSystem = await fetchJson("/api/admin/system", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      taskQueueSettings: {
        ...originalSystem.data.taskQueueSettings,
        image: {
          ...originalSystem.data.taskQueueSettings.image,
          concurrency: temporaryImageConcurrency,
          userConcurrency: temporaryImageUserConcurrency,
        },
        runninghub: {
          ...originalSystem.data.taskQueueSettings.runninghub,
          enabled: !originalRunningHubEnabled,
        },
      },
      revision: originalSystemRevision,
    }),
  });
  assert(Number(updatedSystem.data?.revision) === originalSystemRevision + 1, "system revision did not increment");
  assert(
    Number(updatedSystem.data?.taskQueueSettings?.image?.userConcurrency) === temporaryImageUserConcurrency,
    "system image userConcurrency did not persist",
  );
  assert(
    Boolean(updatedSystem.data?.taskQueueSettings?.runninghub?.enabled) === !originalRunningHubEnabled,
    "system runninghub enabled flag did not persist",
  );

  const staleSystemWrite = await fetchJson(
    "/api/admin/system",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskQueueSettings: {
          ...originalSystem.data.taskQueueSettings,
          image: { concurrency: originalImageConcurrency },
        },
        revision: originalSystemRevision,
      }),
    },
    { allowFailure: true },
  );
  assert(staleSystemWrite.status === 409, "stale system write should return 409");
  assert(staleSystemWrite.error === "ADMIN_SETTINGS_REVISION_CONFLICT", "system stale error mismatch");
  assert(Number(staleSystemWrite.currentRevision) === originalSystemRevision + 1, "system stale currentRevision mismatch");

  const restoredSystem = await fetchJson("/api/admin/system", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      taskQueueSettings: {
        ...originalSystem.data.taskQueueSettings,
        image: {
          ...originalSystem.data.taskQueueSettings.image,
          concurrency: originalImageConcurrency,
          userConcurrency: originalImageUserConcurrency,
        },
        runninghub: {
          ...originalSystem.data.taskQueueSettings.runninghub,
          enabled: originalRunningHubEnabled,
        },
      },
      revision: Number(updatedSystem.data.revision),
    }),
  });
  assert(
    Number(restoredSystem.data?.taskQueueSettings?.image?.concurrency) === originalImageConcurrency,
    "system settings restore failed",
  );
  assert(
    Number(restoredSystem.data?.taskQueueSettings?.image?.userConcurrency) === originalImageUserConcurrency,
    "system image userConcurrency restore failed",
  );
  assert(
    Boolean(restoredSystem.data?.taskQueueSettings?.runninghub?.enabled) === originalRunningHubEnabled,
    "system runninghub enabled restore failed",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        assistantRevision: Number(restoredAssistant.data?.revision) || 0,
        systemRevision: Number(restoredSystem.data?.revision) || 0,
        staleAssistantWriteStatus: staleAssistantWrite.status,
        staleSystemWriteStatus: staleSystemWrite.status,
      },
      null,
      2,
    ),
  );
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
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
