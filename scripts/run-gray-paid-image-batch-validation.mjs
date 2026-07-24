const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL || "http://127.0.0.1:18200";
const email = process.env.XINGHUAN_VERIFY_EMAIL || process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL || "";
const password = process.env.XINGHUAN_VERIFY_PASSWORD || process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD || "";
const providerId = process.env.XINGHUAN_IMAGE_PROVIDER_ID || "grsai";
const modelId = process.env.XINGHUAN_IMAGE_MODEL_ID || "nano-banana-fast";
const modelRecordId = process.env.XINGHUAN_IMAGE_MODEL_RECORD_ID || `${providerId}-image-${modelId}`;
const generationCount = Math.max(1, Math.min(4, Number(process.env.XINGHUAN_IMAGE_GENERATION_COUNT || 3)));
const prompt = process.env.XINGHUAN_IMAGE_PROMPT || "A clean editorial product photo of a cobalt-blue glass perfume bottle on a pale stone plinth, soft studio light, square composition";

let cookie = "";

function assert(value, message) {
  if (!value) throw new Error(message);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { origin: baseUrl, referer: `${baseUrl}/`, ...(cookie ? { cookie } : {}), ...(options.headers || {}) },
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  const body = await response.text();
  if (!response.ok) throw new Error(`${pathname}:HTTP_${response.status}:${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : {};
}

async function main() {
  assert(process.env.XINGHUAN_ALLOW_PAID_IMAGE_TEST === "1", "PAID_IMAGE_TEST_NOT_EXPLICITLY_ENABLED");
  assert(email && password, "GRAY_LOGIN_CREDENTIALS_NOT_CONFIGURED");
  const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  assert(login.data?.authenticated === true, "GRAY_LOGIN_FAILED");
  const submitted = await request("/api/proxy/external/image/task", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerId,
      providerModel: modelId,
      model: modelId,
      prompt,
      size: "1024x1024",
      aspectRatio: "1:1",
      generationCount,
      n: 1,
      providerParams: { modelRecordId, sourceNodeId: "gray-paid-image-batch-validation", sourceCanvasId: "gray-paid-image-batch-validation" },
    }),
  });
  const taskId = String(submitted.data?.taskId || "");
  assert(taskId, "IMAGE_TASK_ID_MISSING");
  for (let attempt = 0; attempt < 180; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const result = await request(`/api/proxy/external/image/task/${encodeURIComponent(taskId)}`);
    const task = result.data || {};
    if (task.status === "succeeded") {
      const imageUrls = Array.isArray(task.imageUrls) ? task.imageUrls : [];
      assert(imageUrls.length === generationCount, `IMAGE_COUNT_MISMATCH:${imageUrls.length}`);
      console.log(JSON.stringify({ ok: true, taskId, generationCount, imageCount: imageUrls.length, imageUrls, generationArtifactIds: task.generationArtifactIds || [], providerRequestCount: task.raw?.providerRequestCount ?? task.providerRequestCount ?? null }, null, 2));
      return;
    }
    if (["failed", "cancelled"].includes(task.status)) throw new Error(`IMAGE_TASK_${task.status.toUpperCase()}:${task.error || task.failureReason || "unknown"}`);
  }
  throw new Error(`IMAGE_TASK_TIMEOUT:${taskId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
