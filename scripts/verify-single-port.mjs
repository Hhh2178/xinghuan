import { copyFile, mkdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const verifyDataDir = process.env.XINGHUAN_DATA_DIR ? resolve(process.env.XINGHUAN_DATA_DIR) : "";
const sameOriginHeaders = {
  origin: baseUrl,
  referer: `${baseUrl}/`,
};
const loginEmailCandidates = uniqueNonEmpty([
  process.env.XINGHUAN_VERIFY_EMAIL,
  process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL,
  "admin@xinghuan.local",
]);
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const memberEmailCandidates = uniqueNonEmpty([
  process.env.XINGHUAN_VERIFY_MEMBER_EMAIL,
  process.env.XINGHUAN_BOOTSTRAP_MEMBER_EMAIL,
  "member@xinghuan.local",
]);
const memberPasswordFallback =
  process.env.XINGHUAN_VERIFY_MEMBER_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_MEMBER_PASSWORD ?? "member123456";
let cookie = "";

async function main() {
  const results = [];

  const home = await fetchText("/");
  results.push(["GET /", home.status === 200 && home.text.includes('<div id="root"></div>')]);

  const adminHome = await fetchText("/admin");
  results.push(["GET /admin", adminHome.status === 200 && adminHome.text.includes('<div id="root"></div>') && adminHome.text.includes("/admin/assets/")]);

  const status = await fetchJson("/api/status");
  results.push(["GET /api/status", status.data?.service === "xinghuan-api"]);

  const unauthCanvas = await fetchText("/api/canvas");
  results.push(["Unauthenticated canvas rejected", unauthCanvas.status === 401]);

  const unauthAdmin = await fetchText("/api/admin/summary");
  results.push(["Unauthenticated admin rejected", unauthAdmin.status === 401]);

  const adminLogin = await loginFirstAvailable(loginEmailCandidates, loginPassword, "/api/auth/login");
  results.push(["POST /api/auth/login", adminLogin.data?.authenticated === true && Boolean(adminLogin.data?.user?.id)]);

  const me = await fetchJson("/api/auth/me");
  results.push(["GET /api/auth/me", me.data?.authenticated === true && me.data?.user?.email === adminLogin.email]);

  const adminSummary = await fetchJson("/api/admin/summary");
  results.push(["GET /api/admin/summary", typeof adminSummary.data?.users === "number" && typeof adminSummary.data?.models === "number"]);

  const adminUsers = await fetchJson("/api/admin/users");
  results.push(["GET /api/admin/users", Array.isArray(adminUsers.data) && adminUsers.data.some((user) => user.email === adminLogin.email)]);

  const adminProviders = await fetchJson("/api/admin/providers");
  results.push(["GET /api/admin/providers", Array.isArray(adminProviders.data)]);

  const adminModels = await fetchJson("/api/admin/models");
  results.push(["GET /api/admin/models", Array.isArray(adminModels.data)]);

  const adminTasks = await fetchJson("/api/admin/tasks");
  results.push([
    "GET /api/admin/tasks",
    Array.isArray(adminTasks.data?.items) &&
      typeof adminTasks.data?.total === "number" &&
      typeof adminTasks.data?.page === "number",
  ]);

  const adminSystem = await fetchJson("/api/admin/system");
  results.push(["GET /api/admin/system database status", typeof adminSystem.data?.database?.status === "string"]);
  results.push(["GET /api/admin/system redis status", typeof adminSystem.data?.redis?.status === "string"]);

  const providerSecret = `verify-secret-${Date.now()}`;
  const providerId = `verify-provider-${Date.now()}`;
  const createdProvider = await fetchJson("/api/admin/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: providerId,
      name: "验收 Provider",
      baseUrl: "https://verify.local",
      apiKey: providerSecret,
      enabled: true,
    }),
  });
  results.push([
    "POST /api/admin/providers masks key",
    createdProvider.data?.hasApiKey === true &&
      String(createdProvider.data?.apiKeyPreview || "").endsWith(providerSecret.slice(-4)) &&
      !JSON.stringify(createdProvider.data).includes(providerSecret),
  ]);

  const audit = await fetchJson("/api/admin/audit");
  results.push([
    "GET /api/admin/audit",
    Array.isArray(audit.data) && audit.data.some((item) => item.targetId === providerId && item.action === "provider.create"),
  ]);

  const adminCanvasName = `单端口脚本验收画布-${Date.now()}`;
  const canvas = await fetchJson("/api/canvas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: adminCanvasName }),
  });
  const canvasId = canvas.data?.id;
  results.push(["POST /api/canvas", Boolean(canvasId)]);

  const savePayload = {
    nodes: [
      {
        id: "verify-node-script",
        type: "text",
        position: { x: 120, y: 140 },
        data: { title: "单端口脚本验收节点", content: "verify-single-port" },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    nextNodeSerialId: 2,
  };

  const saved = await fetchJson(`/api/canvas/${encodeURIComponent(canvasId)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(savePayload),
  });
  results.push(["PUT /api/canvas/:id", saved.data?.nodeCount === 1]);

  const readBack = await fetchJson(`/api/canvas/${encodeURIComponent(canvasId)}`);
  results.push(["GET /api/canvas/:id", Array.isArray(readBack.data?.nodes) && readBack.data.nodes.length === 1]);

  const adminCookie = cookie;
  const memberCredentials = resolveMemberCredentials(adminUsers.data);
  cookie = "";
  const memberLogin = await loginFirstAvailable(
    memberCredentials.emailCandidates,
    memberCredentials.password,
    "/api/auth/login",
  );
  results.push(["POST /api/auth/login member", memberLogin.data?.authenticated === true && memberLogin.data?.user?.role === "member"]);
  const memberList = await fetchJson("/api/canvas");
  const seesAdminCanvas = Array.isArray(memberList.data) && memberList.data.some((item) => item.id === canvasId || item.name === adminCanvasName);
  results.push(["Member cannot see admin canvas", !seesAdminCanvas]);
  const memberAdmin = await fetchText("/api/admin/summary");
  results.push(["Member admin rejected", memberAdmin.status === 403]);
  cookie = adminCookie;

  const uploadSource = join(rootDir, "package.json");
  const uploadForm = new FormData();
  uploadForm.set("file", new Blob([await readFile(uploadSource)]), basename(uploadSource));
  const upload = await fetchJson("/api/files/upload", { method: "POST", body: uploadForm });
  results.push(["POST /api/files/upload", Boolean(upload.data?.url)]);

  const uploaded = await fetchText(upload.data.url);
  results.push(["GET uploaded file", uploaded.status === 200 && uploaded.text.includes("xinghuan-canvas")]);

  const generationImageFile = await fetchJson("/api/files/upload-base64", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prefix: "verify-generation-library",
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn0k1sAAAAASUVORK5CYII=",
    }),
  });
  results.push(["POST /api/files/upload-base64", Boolean(generationImageFile.data?.url)]);

  const localVideoFile = await seedLocalVideoOutput();
  results.push(["Local sample video seeded", Boolean(localVideoFile)]);

  const generationImageTitle = `单端口生成库图片-${Date.now()}`;
  const generationImage = await fetchJson("/api/generation-library/items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "image",
      url: generationImageFile.data?.url,
      title: generationImageTitle,
      mime: generationImageFile.data?.mime || "image/png",
      size: generationImageFile.data?.size || 0,
    }),
  });
  results.push(["POST /api/generation-library/items image", generationImage.data?.kind === "image"]);

  const generationVideoTitle = `单端口生成库视频-${Date.now()}`;
  const generationVideo = localVideoFile
    ? await fetchJson("/api/generation-library/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "video",
          url: `/files/output/${encodeURIComponent(localVideoFile)}`,
          title: generationVideoTitle,
          mime: localVideoFile.endsWith(".webm") ? "video/webm" : localVideoFile.endsWith(".mov") ? "video/quicktime" : "video/mp4",
        }),
      })
    : { data: null };
  results.push(["POST /api/generation-library/items video", generationVideo.data?.kind === "video"]);

  const generationImages = await fetchJson("/api/generation-library/items?kind=image");
  const generationImageEntry = Array.isArray(generationImages.data)
    ? generationImages.data.find((item) => item.title === generationImageTitle)
    : null;
  results.push([
    "GET /api/generation-library/items image metadata",
    Boolean(
      generationImageEntry?.previewUrl &&
      generationImageEntry?.downloadUrl &&
      generationImageEntry?.openUrl &&
      generationImageEntry?.filename &&
      generationImageEntry?.canDownload === true &&
      generationImageEntry?.isExpired === false,
    ),
  ]);

  const generationVideos = await fetchJson("/api/generation-library/items?kind=video");
  const generationVideoEntry = Array.isArray(generationVideos.data)
    ? generationVideos.data.find((item) => item.title === generationVideoTitle)
    : null;
  results.push([
    "GET /api/generation-library/items video metadata",
    Boolean(
      generationVideoEntry?.previewUrl &&
      generationVideoEntry?.downloadUrl &&
      generationVideoEntry?.openUrl &&
      generationVideoEntry?.filename &&
      generationVideoEntry?.canDownload === true &&
      generationVideoEntry?.isExpired === false,
    ),
  ]);

  const imagePreview = generationImageEntry?.previewUrl ? await fetchBinary(generationImageEntry.previewUrl) : null;
  results.push([
    "GET generation image preview route",
    Boolean(imagePreview?.status === 200 && String(imagePreview.headers.get("content-type") || "").startsWith("image/")),
  ]);

  const imageDownload = generationImageEntry?.downloadUrl ? await fetchBinary(generationImageEntry.downloadUrl) : null;
  results.push([
    "GET generation image download route",
    Boolean(
      imageDownload?.status === 200 &&
      String(imageDownload.headers.get("content-disposition") || "").includes("attachment;"),
    ),
  ]);

  const videoPreview = generationVideoEntry?.previewUrl ? await fetchBinary(generationVideoEntry.previewUrl) : null;
  results.push([
    "GET generation video preview route",
    Boolean(videoPreview?.status === 200 && String(videoPreview.headers.get("content-type") || "").startsWith("video/")),
  ]);

  const videoDownload = generationVideoEntry?.downloadUrl ? await fetchBinary(generationVideoEntry.downloadUrl) : null;
  results.push([
    "GET generation video download route",
    Boolean(
      videoDownload?.status === 200 &&
      String(videoDownload.headers.get("content-disposition") || "").includes("attachment;"),
    ),
  ]);

  if (!(videoPreview?.status === 200 && String(videoPreview.headers.get("content-type") || "").startsWith("video/"))) {
    console.error("DEBUG generation video preview", JSON.stringify({
      localVideoFile,
      generationVideoEntry,
      previewStatus: videoPreview?.status || null,
      previewContentType: videoPreview?.headers?.get?.("content-type") || null,
      previewBody: videoPreview?.buffer ? videoPreview.buffer.toString("utf8") : null,
    }, null, 2));
  }
  if (!(videoDownload?.status === 200 && String(videoDownload.headers.get("content-disposition") || "").includes("attachment;"))) {
    console.error("DEBUG generation video download", JSON.stringify({
      localVideoFile,
      generationVideoEntry,
      downloadStatus: videoDownload?.status || null,
      downloadDisposition: videoDownload?.headers?.get?.("content-disposition") || null,
      downloadContentType: videoDownload?.headers?.get?.("content-type") || null,
      downloadBody: videoDownload?.buffer ? videoDownload.buffer.toString("utf8") : null,
    }, null, 2));
  }

  const fallback = await fetchText("/workspace/deep/link");
  results.push(["SPA fallback", fallback.status === 200 && fallback.text.includes('<div id="root"></div>')]);

  const failed = results.filter(([, ok]) => !ok);
  for (const [name, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

function resolveMemberCredentials(users) {
  const memberUser = Array.isArray(users)
    ? users.find((user) => user?.role === "member" && typeof user?.email === "string" && user.email.trim())
    : null;
  return {
    emailCandidates: uniqueNonEmpty([memberUser?.email, ...memberEmailCandidates]),
    password:
      typeof memberUser?.password === "string" && memberUser.password.trim()
        ? memberUser.password.trim()
        : memberPasswordFallback,
  };
}

async function loginFirstAvailable(emailCandidates, password, pathname) {
  const failures = [];
  for (const email of emailCandidates) {
    const response = await fetchJson(pathname, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }, { allowFailure: true });
    if (response.status >= 200 && response.status < 300 && response.data?.authenticated === true) {
      return { email, data: response.data };
    }
    failures.push(`${email}:${response.status}`);
  }
  throw new Error(`${pathname} login failed for all admin email candidates (${failures.join(", ")})`);
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
  if (!response.ok && !config.allowFailure) {
    throw new Error(`${pathname} returned ${response.status}: ${text}`);
  }
  const payload = text ? JSON.parse(text) : {};
  return {
    status: response.status,
    ...payload,
  };
}

async function fetchBinary(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  const buffer = Buffer.from(await response.arrayBuffer());
  return { status: response.status, headers: response.headers, buffer };
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

function uniqueNonEmpty(values) {
  return [...new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean))];
}

async function findLocalVideoOutput() {
  const outputDir = join(rootDir, "apps", "api", "data", "users", "usr-admin", "output");
  const { readdir } = await import("node:fs/promises");
  try {
    const entries = await readdir(outputDir, { withFileTypes: true });
    const file = entries.find((entry) => entry.isFile() && [".mp4", ".webm", ".mov"].some((ext) => entry.name.toLowerCase().endsWith(ext)));
    return file?.name || "";
  } catch {
    return "";
  }
}

async function seedLocalVideoOutput() {
  const sourceName = await findLocalVideoOutput();
  if (!sourceName) return "";
  const sourcePath = join(rootDir, "apps", "api", "data", "users", "usr-admin", "output", sourceName);
  const targetDir = verifyDataDir
    ? join(verifyDataDir, "users", "usr-admin", "output")
    : join(rootDir, "apps", "api", "data", "users", "usr-admin", "output");
  await mkdir(targetDir, { recursive: true });
  const targetName = `verify_seed_${Date.now()}_${sourceName}`;
  try {
    await copyFile(sourcePath, join(targetDir, targetName));
    return targetName;
  } catch {
    return "";
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
