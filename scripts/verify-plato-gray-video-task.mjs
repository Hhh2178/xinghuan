const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const providerNameHint = (process.env.XINGHUAN_VERIFY_PLATO_PROVIDER_NAME ?? "柏拉图").toLowerCase();
const providerBaseUrlHint = (process.env.XINGHUAN_VERIFY_PLATO_BASE_URL ?? "api.apilio.ai").toLowerCase();
const modelIdHint = (process.env.XINGHUAN_VERIFY_PLATO_MODEL_ID ?? "grok-imagine-video-1.5-preview").toLowerCase();
const taskPollAttempts = Number.parseInt(process.env.XINGHUAN_VERIFY_TASK_POLL_ATTEMPTS ?? "180", 10);
const taskPollIntervalMs = Number.parseInt(process.env.XINGHUAN_VERIFY_TASK_POLL_INTERVAL_MS ?? "3000", 10);
const jpg512 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAIAAgADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9K6KKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/2Q==";

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
    item?.enabled === true
    && String(item?.protocol || "").toLowerCase() === "apimart"
    && (
      String(item?.name || "").toLowerCase().includes(providerNameHint)
      || String(item?.baseUrl || "").toLowerCase().includes(providerBaseUrlHint)
      || String(item?.id || "").toLowerCase().includes("apilio")
    ),
  );
  results.push(["Find enabled Plato provider", Boolean(provider?.id)]);
  if (!provider?.id) return finish(results);

  const models = await fetchJson("/api/admin/models");
  const model = (models.data || []).find((item) =>
    item?.providerId === provider.id
    && item?.enabled === true
    && String(item?.capability || "").toLowerCase() === "video"
    && String(item?.modelId || "").toLowerCase() === modelIdHint,
  );
  results.push(["Find enabled Plato preview model", Boolean(model?.id)]);
  if (!model?.id) return finish(results);

  const advancedConfig = plainObject(model.advancedConfig);
  results.push(["Model submitPath uses /v1/videos", String(advancedConfig.submitPath || "") === "videos" || String(advancedConfig.submitPath || "").includes("/v1/videos")]);
  results.push(["Model pollPathTemplate uses /v1/videos/{task_id}", String(advancedConfig.pollPathTemplate || "") === "videos/{task_id}" || String(advancedConfig.pollPathTemplate || "").includes("/v1/videos/{task_id}")]);
  results.push(["Model resultVideoPath uses data.output", String(advancedConfig.resultVideoPath || "") === "data.output"]);
  results.push(["Model requestMapping.images uses images", plainObject(advancedConfig.requestMapping).images === "images"]);
  results.push(["Model requestMapping.duration uses seconds", plainObject(advancedConfig.requestMapping).duration === "seconds"]);

  const uploadForm = new FormData();
  uploadForm.set("file", new Blob([Buffer.from(jpg512, "base64")], { type: "image/jpeg" }), "plato-gray-reference.jpg");
  const uploadedReference = await fetchJson("/api/files/upload", { method: "POST", body: uploadForm });
  const referenceUrl = uploadedReference.data?.url || "";
  results.push(["POST /api/files/upload returns reference image", referenceUrl.startsWith("/files/input/")]);
  if (!referenceUrl) return finish(results);

  const submitPayload = {
    providerId: provider.id,
    providerModel: model.modelId,
    model: model.modelId,
    prompt: `灰度柏拉图 6 秒视频验收 ${Date.now()}`,
    images: [referenceUrl],
    aspect_ratio: "16:9",
    duration: 6,
    resolution: "720p",
    providerParams: {
      modelRecordId: model.id,
    },
  };

  const created = await fetchJson("/api/proxy/external/video/task", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submitPayload),
  });
  const taskId = created.data?.taskId || created.data?.id || "";
  results.push(["POST /api/proxy/external/video/task returns taskId", Boolean(taskId)]);
  if (!taskId) return finish(results);

  let task = null;
  for (let attempt = 0; attempt < taskPollAttempts; attempt += 1) {
    await sleep(taskPollIntervalMs);
    task = await fetchJson(`/api/proxy/external/video/task/${encodeURIComponent(taskId)}`);
    if (task.data?.status === "succeeded" || task.data?.status === "failed" || task.data?.status === "cancelled") break;
  }

  const finalStatus = task?.data?.status || "";
  results.push(["Queued Plato task reaches terminal status", Boolean(finalStatus)]);
  results.push(["Queued Plato task succeeded", finalStatus === "succeeded"]);

  const videoUrl = task?.data?.videoUrls?.[0] || "";
  const remoteVideoUrl = task?.data?.remoteVideoUrls?.[0] || "";
  results.push(["Task result contains local or remote video URL", videoUrl.startsWith("/files/output/") || /^https?:\/\//i.test(remoteVideoUrl)]);

  if (videoUrl.startsWith("/files/output/")) {
    const savedVideo = await fetchText(videoUrl);
    results.push(["GET local generated video", savedVideo.status === 200 && /^video\//i.test(savedVideo.contentType)]);
  }

  console.log(JSON.stringify({
    ok: results.every(([, ok]) => ok),
    provider: {
      id: provider.id,
      name: provider.name,
      protocol: provider.protocol,
      baseUrl: provider.baseUrl,
    },
    model: {
      id: model.id,
      modelId: model.modelId,
      displayName: model.displayName,
    },
    task: {
      id: taskId,
      status: finalStatus,
      progress: task?.data?.progress || "",
      error: task?.data?.error || "",
      logs: Array.isArray(task?.data?.logs) ? task.data.logs : [],
      videoUrl,
      remoteVideoUrl,
      raw: task?.data?.raw || {},
    },
    checks: results.map(([name, ok]) => ({ name, ok })),
  }, null, 2));

  const failed = results.filter(([, ok]) => !ok);
  if (failed.length > 0) {
    throw new Error(`Plato gray verification failed at ${failed.map(([name]) => name).join(", ")}`);
  }
}

async function finish(results) {
  const failed = results.filter(([, ok]) => !ok);
  console.log(JSON.stringify({
    ok: failed.length === 0,
    checks: results.map(([name, ok]) => ({ name, ok })),
  }, null, 2));
  if (failed.length > 0) {
    process.exit(1);
  }
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
  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}: ${text}`);
  }
  return JSON.parse(text);
}

function withCookie(options = {}) {
  return {
    ...options,
    headers: {
      origin: baseUrl,
      referer: `${baseUrl}/`,
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

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
