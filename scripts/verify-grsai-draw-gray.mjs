const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const providerNameHint = (process.env.XINGHUAN_VERIFY_GRSAI_PROVIDER_NAME ?? "grsai").toLowerCase();
const modelNameHint = (process.env.XINGHUAN_VERIFY_GRSAI_MODEL_ID ?? "gpt-image-2").toLowerCase();
const requestOrigin = new URL(baseUrl).origin;
const workerTaskTimeoutSeconds = Math.min(600, Math.max(30, Number(process.env.XINGHUAN_VERIFY_GRSAI_TASK_TIMEOUT_SECONDS ?? 360) || 360));

let cookie = "";

async function main() {
  const results = [];
  const login = await fetchJson("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  results.push(["POST /api/auth/login", login.data?.authenticated === true]);

  const providers = await fetchJson("/api/admin/providers");
  const provider = (providers.data || []).find((item) =>
    String(item?.protocol || "").toLowerCase() === "grsai_draw"
    && (String(item?.id || "").toLowerCase().includes(providerNameHint) || String(item?.name || "").toLowerCase().includes(providerNameHint))
    && item?.enabled === true,
  );
  results.push(["Find enabled grsai_draw provider", Boolean(provider?.id)]);
  if (!provider?.id) return finish(results);

  const models = await fetchJson("/api/admin/models");
  const model = (models.data || []).find((item) =>
    item?.providerId === provider.id
    && String(item?.capability || "").toLowerCase() === "image"
    && item?.enabled === true
    && String(item?.modelId || "").toLowerCase().includes(modelNameHint),
  );
  results.push(["Find enabled GRSAI image model", Boolean(model?.id)]);
  if (!model?.id) return finish(results);

  const syncPrompt = `灰度同步 GRSAI 验收 ${Date.now()}`;
  const generated = await fetchJson("/api/proxy/external/image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerId: provider.id,
      providerModel: model.modelId,
      model: model.modelId,
      prompt: syncPrompt,
      size: "1024x1024",
      n: 1,
      providerParams: {
        modelRecordId: model.id,
        aspectRatio: "1:1",
        size: "1024x1024",
      },
    }),
  });
  const syncImageUrl = generated.data?.imageUrls?.[0] || "";
  results.push(["POST /api/proxy/external/image returns local image", syncImageUrl.startsWith("/files/output/")]);
  if (syncImageUrl) {
    const image = await fetchText(syncImageUrl);
    results.push(["GET sync generated image", image.status === 200 && /^image\//i.test(image.contentType)]);
  } else {
    results.push(["GET sync generated image", false]);
  }

  const taskCreated = await fetchJson("/api/admin/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: `灰度 GRSAI Worker 验收 ${Date.now()}`,
      status: "queued",
      providerId: provider.id,
      modelId: model.id,
      payload: {
        kind: "image",
        taskCapability: "image",
        prompt: `灰度异步 GRSAI 验收 ${Date.now()}`,
        size: "1024x1024",
        aspectRatio: "1:1",
        n: 1,
      },
    }),
  });
  const taskId = taskCreated.data?.id || "";
  results.push(["POST /api/admin/tasks creates queued task", Boolean(taskId)]);
  if (!taskId) return finish(results);

  let task = null;
  for (let attempt = 0; attempt < workerTaskTimeoutSeconds; attempt += 1) {
    await sleep(1000);
    const taskResponse = await fetchJson(`/api/admin/tasks/${encodeURIComponent(taskId)}`);
    task = taskResponse.data || null;
    if (task?.status === "succeeded" || task?.status === "failed") break;
  }

  results.push(["Worker task succeeds", task?.status === "succeeded"]);
  results.push(["Worker uses grsai image adapter", task?.result?.adapter === "grsai-image"]);
  const workerImageUrl =
    (Array.isArray(task?.result?.materializedImageUrls) ? task.result.materializedImageUrls[0] || "" : "")
    || (Array.isArray(task?.result?.imageUrls) ? task.result.imageUrls[0] || "" : "");
  results.push(["Worker result has image URL", /^https?:\/\//i.test(workerImageUrl) || workerImageUrl.startsWith("/files/output/")]);
  if (/^https?:\/\//i.test(workerImageUrl) || workerImageUrl.startsWith("/files/output/")) {
    const image = await fetchText(workerImageUrl);
    results.push(["GET worker generated image", image.status === 200 && /^image\//i.test(image.contentType)]);
  } else {
    results.push(["GET worker generated image", false]);
  }

  return finish(results);
}

async function finish(results) {
  const failed = results.filter(([, ok]) => !ok);
  for (const [name, ok] of results) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (failed.length > 0) process.exit(1);
}

async function fetchText(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  return { status: response.status, text: await response.text(), contentType: response.headers.get("content-type") || "" };
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
      ...(options.method && options.method !== "GET" ? { origin: requestOrigin } : {}),
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
