const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const sameOriginHeaders = {
  origin: baseUrl,
  referer: `${baseUrl}/`,
};
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";

let cookie = "";

async function main() {
  const results = [];
  const providerId = `verify-catalog-${Date.now()}`;

  const unauth = await fetchText("/api/models");
  results.push(["Unauthenticated model catalog rejected", unauth.status === 401]);

  try {
    const login = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    results.push(["POST /api/auth/login", login.data?.authenticated === true]);

    const provider = await fetchJson("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerId,
        name: "Verify Catalog Provider",
        baseUrl: "https://verify.local",
        protocol: "openai",
        enabled: true,
        apiKey: "verify-key",
      }),
    });
    results.push(["POST /api/admin/providers for catalog", provider.data?.id === providerId]);

    const imported = await fetchJson(`/api/admin/providers/${providerId}/import-models`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        models: [{ modelId: "verify-image-model", capability: "image", displayName: "Verify Image Model" }],
      }),
    });
    results.push(["POST /api/admin/providers/:id/import-models for catalog", imported.data?.imported === 1]);

    const importedModel = imported.data?.models?.find((model) => model.modelId === "verify-image-model");
    const customSchema = {
      prompt: { type: "string", required: true },
      aspectRatio: { type: "select", options: ["4:3", "3:4"], default: "3:4" },
      size: { type: "select", options: ["800x1200"], default: "800x1200" },
      referenceImages: { type: "image[]", max: 5 },
    };
    const updated = await fetchJson(`/api/admin/models/${importedModel.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inputProfile: "prompt,image_reference,multi_image",
        inputCapabilities: {
          prompt: true,
          imageReference: true,
          multiImage: true,
          firstFrame: false,
          lastFrame: false,
        },
        advancedConfig: {
          requestMapping: {
            resolution: "size",
            referenceImages: "image_urls",
          },
        },
        parameterSchema: JSON.stringify(customSchema),
      }),
    });
    results.push(["PATCH model input profile and parameter schema", updated.data?.inputProfile === "prompt,image_reference,multi_image"]);

    const catalog = await fetchJson("/api/models");
    const data = catalog.data || {};
    const imageModels = Array.isArray(data.imageModels) ? data.imageModels : [];
    const chatModels = Array.isArray(data.chatModels) ? data.chatModels : [];
    const videoModels = Array.isArray(data.videoModels) ? data.videoModels : [];
    const allModels = Array.isArray(data.all) ? data.all : [...imageModels, ...chatModels, ...videoModels];
    const verifyImageModel = imageModels.find((model) => model.providerId === providerId && model.modelId === "verify-image-model");

    results.push(["GET /api/models grouped arrays", Array.isArray(data.imageModels) && Array.isArray(data.chatModels) && Array.isArray(data.videoModels)]);
    results.push(["GET /api/models has all", Array.isArray(data.all)]);
    results.push(["GET /api/models has image models", imageModels.length > 0]);
    results.push(["GET /api/models includes imported image model", Boolean(verifyImageModel)]);
    results.push(["GET /api/models only enabled rows", allModels.every((model) => model.enabled === true && model.provider?.enabled === true)]);
    results.push(["GET /api/models exposes model metadata", allModels.every((model) => model.id && model.providerId && model.modelId && model.capability && model.parameterSchema && model.ui)]);
    results.push(["GET /api/models image dynamic params", imageModels.every((model) => Array.isArray(model.ui?.sizes) && model.ui.sizes.length > 0 && Array.isArray(model.ui?.aspectRatios) && model.ui.aspectRatios.length > 0)]);
    results.push(["GET /api/models exposes edited input profile", verifyImageModel?.inputProfile === "prompt,image_reference,multi_image"]);
    results.push(["GET /api/models exposes edited dynamic schema", verifyImageModel?.ui?.defaultAspectRatio === "3:4" && verifyImageModel?.ui?.defaultSize === "800x1200" && verifyImageModel?.ui?.maxReferenceImages === 5]);
    results.push(["GET /api/models exposes input capabilities", verifyImageModel?.inputCapabilities?.multiImage === true && verifyImageModel?.ui?.inputCapabilities?.multiImage === true]);
    results.push(["GET /api/models exposes advanced config", verifyImageModel?.advancedConfig?.requestMapping?.resolution === "size"]);
    results.push(["GET /api/models no secrets", !JSON.stringify(data).match(/apiKey|api_key|enc:v1|scrypt\\$/i)]);
  } finally {
    if (cookie) {
      await fetchText(`/api/admin/providers/${providerId}`, { method: "DELETE" }).catch(() => undefined);
    }
  }

  const failed = results.filter(([, ok]) => !ok);
  for (const [name, ok] of results) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (failed.length > 0) process.exit(1);
}

async function fetchText(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  return { status: response.status, text: await response.text() };
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
      ...sameOriginHeaders,
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
