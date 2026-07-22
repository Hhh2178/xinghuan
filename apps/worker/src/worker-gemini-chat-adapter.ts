import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";

const MAX_NATIVE_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
const FILE_PROCESSING_ATTEMPTS = 60;

interface NativeVideoInput {
  fileUrl: string;
  mimeType?: string;
}

export async function executeGeminiChatTask(input: {
  dataDir: string;
  ownerId: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  messages: unknown[];
  nativeVideo?: NativeVideoInput;
  temperature?: number;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  signal?: AbortSignal;
}) {
  const fetchImpl = input.fetchImpl || fetch;
  const sleep = input.sleep || ((milliseconds: number) => new Promise<void>((resolvePromise) => setTimeout(resolvePromise, milliseconds)));
  const apiRoot = geminiApiRoot(input.baseUrl);
  const apiKey = String(input.apiKey || "").trim();
  const modelId = String(input.modelId || "").trim().replace(/^models\//, "");
  if (!apiKey) throw new Error("GEMINI_API_KEY_REQUIRED");
  if (!modelId) throw new Error("GEMINI_MODEL_REQUIRED");

  let providerFile: { name: string; uri: string; mimeType: string } | null = null;
  let providerFileName = "";
  try {
    if (input.nativeVideo) {
      const media = await resolveOwnedMedia(input.dataDir, input.ownerId, input.nativeVideo);
      providerFile = await uploadGeminiFile({
        apiRoot,
        apiKey,
        media,
        fetchImpl,
        sleep,
        signal: input.signal,
        onFileCreated: (name) => { providerFileName = name; },
      });
    }
    const requestBody = buildGenerateContentBody({
      messages: input.messages,
      providerFile,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });
    const response = await fetchImpl(`${apiRoot}/models/${encodeURIComponent(modelId)}:generateContent`, {
      method: "POST",
      headers: geminiJsonHeaders(apiKey),
      body: JSON.stringify(requestBody),
      signal: requestSignal(input.signal, 120_000),
    });
    const responseText = await response.text();
    if (!response.ok) throw new Error(`GEMINI_GENERATE_FAILED:${response.status}:${responseText.slice(0, 300)}`);
    const raw = responseText ? JSON.parse(responseText) : {};
    const candidate = objectValue(Array.isArray(raw.candidates) ? raw.candidates[0] : undefined);
    const content = objectValue(candidate.content);
    const text = (Array.isArray(content.parts) ? content.parts : [])
      .map((part) => String(objectValue(part).text || "").trim())
      .filter(Boolean)
      .join("\n");
    if (!text) throw new Error("GEMINI_GENERATE_EMPTY_CONTENT");
    return {
      adapter: "gemini-generate-content",
      content: text,
      text,
      finishReason: String(candidate.finishReason || ""),
    };
  } finally {
    const cleanupName = providerFile?.name || providerFileName;
    if (cleanupName) {
      await fetchImpl(`${apiRoot}/${cleanupName.replace(/^\/+/, "")}`, {
        method: "DELETE",
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(15_000),
      }).catch(() => undefined);
    }
  }
}

function buildGenerateContentBody(input: {
  messages: unknown[];
  providerFile: { uri: string; mimeType: string } | null;
  temperature?: number;
  maxTokens?: number;
}) {
  const contents: Array<{ role: "user" | "model"; parts: Array<Record<string, unknown>> }> = [];
  const systemParts: Array<{ text: string }> = [];
  for (const rawMessage of Array.isArray(input.messages) ? input.messages : []) {
    const message = objectValue(rawMessage);
    const role = String(message.role || "user").toLowerCase();
    const parts = geminiParts(message.content);
    if (parts.length === 0) continue;
    if (role === "system") {
      systemParts.push(...parts.flatMap((part) => typeof part.text === "string" ? [{ text: part.text }] : []));
      continue;
    }
    contents.push({ role: role === "assistant" ? "model" : "user", parts });
  }
  if (contents.length === 0) contents.push({ role: "user", parts: [{ text: "Analyze the provided media." }] });
  if (input.providerFile) {
    let target = [...contents].reverse().find((item) => item.role === "user");
    if (!target) {
      target = { role: "user", parts: [] };
      contents.push(target);
    }
    target.parts.push({ file_data: { mime_type: input.providerFile.mimeType, file_uri: input.providerFile.uri } });
  }
  const generationConfig: Record<string, unknown> = {};
  if (Number.isFinite(input.temperature)) generationConfig.temperature = Math.max(0, Math.min(2, Number(input.temperature)));
  if (Number.isFinite(input.maxTokens) && Number(input.maxTokens) > 0) generationConfig.maxOutputTokens = Math.min(200_000, Math.floor(Number(input.maxTokens)));
  return {
    contents,
    ...(systemParts.length > 0 ? { systemInstruction: { parts: systemParts } } : {}),
    ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
  };
}

async function uploadGeminiFile(input: {
  apiRoot: string;
  apiKey: string;
  media: { path: string; size: number; mimeType: string; displayName: string };
  fetchImpl: typeof fetch;
  sleep: (milliseconds: number) => Promise<void>;
  signal?: AbortSignal;
  onFileCreated: (name: string) => void;
}) {
  const uploadStart = await input.fetchImpl(geminiUploadEndpoint(input.apiRoot), {
    method: "POST",
    headers: {
      ...geminiJsonHeaders(input.apiKey),
      "x-goog-upload-protocol": "resumable",
      "x-goog-upload-command": "start",
      "x-goog-upload-header-content-length": String(input.media.size),
      "x-goog-upload-header-content-type": input.media.mimeType,
    },
    body: JSON.stringify({ file: { display_name: input.media.displayName } }),
    signal: requestSignal(input.signal, 30_000),
  });
  if (!uploadStart.ok) throw new Error(`GEMINI_FILE_START_FAILED:${uploadStart.status}`);
  const uploadUrl = uploadStart.headers.get("x-goog-upload-url") || "";
  assertAllowedUploadUrl(uploadUrl, input.apiRoot);

  const uploadResponse = await input.fetchImpl(uploadUrl, {
    method: "PUT",
    headers: {
      "content-length": String(input.media.size),
      "x-goog-upload-offset": "0",
      "x-goog-upload-command": "upload, finalize",
    },
    body: createReadStream(input.media.path) as any,
    signal: requestSignal(input.signal, 10 * 60_000),
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  const uploadText = await uploadResponse.text();
  if (!uploadResponse.ok) throw new Error(`GEMINI_FILE_UPLOAD_FAILED:${uploadResponse.status}`);
  let file = normalizeGeminiFile(objectValue(uploadText ? JSON.parse(uploadText).file : undefined), input.media.mimeType);
  if (!file.name) throw new Error("GEMINI_FILE_RESPONSE_INVALID");
  input.onFileCreated(file.name);

  for (let attempt = 0; file.state === "PROCESSING" && attempt < FILE_PROCESSING_ATTEMPTS; attempt += 1) {
    throwIfCancelled(input.signal);
    await input.sleep(2_000);
    const response = await input.fetchImpl(`${input.apiRoot}/${file.name.replace(/^\/+/, "")}`, {
      headers: { "x-goog-api-key": input.apiKey, accept: "application/json" },
      signal: requestSignal(input.signal, 15_000),
    });
    const responseText = await response.text();
    if (!response.ok) throw new Error(`GEMINI_FILE_STATUS_FAILED:${response.status}`);
    file = normalizeGeminiFile(responseText ? JSON.parse(responseText) : {}, input.media.mimeType);
  }
  if (file.state !== "ACTIVE" || !file.uri) throw new Error(`GEMINI_FILE_NOT_ACTIVE:${file.state || "UNKNOWN"}`);
  return { name: file.name, uri: file.uri, mimeType: file.mimeType };
}

function requestSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  throwIfCancelled(signal);
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function throwIfCancelled(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new Error("GEMINI_TASK_CANCELLED");
}

async function resolveOwnedMedia(dataDir: string, ownerId: string, input: NativeVideoInput) {
  const prefix = input.fileUrl.startsWith("/files/output/") ? "/files/output/" : input.fileUrl.startsWith("/output/") ? "/output/" : "";
  if (!prefix) throw new Error("GEMINI_MEDIA_URL_UNSUPPORTED");
  let filename = "";
  try {
    filename = decodeURIComponent(input.fileUrl.slice(prefix.length));
  } catch {
    throw new Error("GEMINI_MEDIA_URL_INVALID");
  }
  if (!filename || filename !== basename(filename) || filename.includes("/") || filename.includes("\\")) throw new Error("GEMINI_MEDIA_URL_INVALID");
  const outputDir = resolve(dataDir, "users", safeOwnerSegment(ownerId), "output");
  const path = resolve(outputDir, filename);
  if (!path.startsWith(`${outputDir}${sep}`)) throw new Error("GEMINI_MEDIA_URL_INVALID");
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) throw new Error("GEMINI_MEDIA_NOT_FOUND");
  if (info.size <= 0 || info.size > MAX_NATIVE_VIDEO_BYTES) throw new Error("GEMINI_MEDIA_SIZE_INVALID");
  return {
    path,
    size: info.size,
    displayName: basename(filename).slice(0, 120),
    mimeType: normalizeVideoMime(input.mimeType, filename),
  };
}

function geminiParts(content: unknown): Array<Record<string, unknown>> {
  if (typeof content === "string") return content.trim() ? [{ text: content.trim() }] : [];
  if (!Array.isArray(content)) return [];
  return content.flatMap((rawPart): Array<Record<string, unknown>> => {
    const part = objectValue(rawPart);
    if (part.type === "text" && String(part.text || "").trim()) return [{ text: String(part.text).trim() }];
    const imageUrl = objectValue(part.image_url).url;
    if (part.type === "image_url" && typeof imageUrl === "string") {
      const match = imageUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i);
      if (!match) throw new Error("GEMINI_IMAGE_INPUT_UNSUPPORTED");
      return [{ inline_data: { mime_type: match[1].toLowerCase(), data: match[2] } }];
    }
    return [];
  });
}

function normalizeGeminiFile(value: Record<string, unknown>, fallbackMime: string) {
  return {
    name: String(value.name || "").replace(/^\/+/, ""),
    uri: String(value.uri || ""),
    state: String(value.state || "ACTIVE").toUpperCase(),
    mimeType: String(value.mimeType || value.mime_type || fallbackMime),
  };
}

function geminiApiRoot(baseUrl: string) {
  const normalized = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(normalized)) throw new Error("GEMINI_BASE_URL_INVALID");
  return normalized.endsWith("/v1beta") ? normalized : `${normalized}/v1beta`;
}

function geminiUploadEndpoint(apiRoot: string) {
  return apiRoot.replace(/\/v1beta$/, "/upload/v1beta/files");
}

function assertAllowedUploadUrl(uploadUrl: string, apiRoot: string) {
  let upload: URL;
  let api: URL;
  try {
    upload = new URL(uploadUrl);
    api = new URL(apiRoot);
  } catch {
    throw new Error("GEMINI_UPLOAD_URL_INVALID");
  }
  const googleHost = upload.hostname === "googleapis.com" || upload.hostname.endsWith(".googleapis.com");
  if (upload.protocol !== "https:" || (upload.hostname !== api.hostname && !googleHost)) throw new Error("GEMINI_UPLOAD_URL_INVALID");
}

function geminiJsonHeaders(apiKey: string) {
  return { "x-goog-api-key": apiKey, accept: "application/json", "content-type": "application/json" };
}

function normalizeVideoMime(value: unknown, filename: string) {
  const requested = String(value || "").toLowerCase();
  if (["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"].includes(requested)) return requested;
  const extension = extname(filename).toLowerCase();
  if (extension === ".webm") return "video/webm";
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".m4v") return "video/x-m4v";
  return "video/mp4";
}

function safeOwnerSegment(value: string) {
  return String(value || "guest").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}
