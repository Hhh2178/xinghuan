import { openAsBlob } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";

const MAX_MEDIA_BYTES = 2 * 1024 * 1024 * 1024;

export async function prepareRunningHubStandardMediaValues(input: {
  dataDir: string;
  ownerId: string;
  baseUrl: string;
  apiKey: string;
  values: string[];
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl || fetch;
  const prepared: string[] = [];
  for (const value of input.values) {
    const media = await resolveOwnedMediaReference(input.dataDir, input.ownerId, value);
    prepared.push(media
      ? await uploadBinaryMedia({ ...input, fetchImpl, media })
      : assertRemoteOrDataMedia(value));
  }
  return prepared;
}

async function uploadBinaryMedia(input: {
  baseUrl: string;
  apiKey: string;
  fetchImpl: typeof fetch;
  media: { path: string; filename: string; mimeType: string };
}) {
  const form = new FormData();
  form.append("file", await openAsBlob(input.media.path, { type: input.media.mimeType }), input.media.filename);
  const response = await input.fetchImpl(`${normalizedBaseUrl(input.baseUrl)}/openapi/v2/media/upload/binary`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(180_000),
  });
  const rawText = await response.text();
  if (!response.ok) throw new Error(`RUNNINGHUB_STANDARD_MEDIA_UPLOAD_FAILED:${response.status}`);
  let raw: Record<string, unknown>;
  try {
    raw = rawText ? record(JSON.parse(rawText)) : {};
  } catch {
    throw new Error("RUNNINGHUB_STANDARD_MEDIA_UPLOAD_INVALID_RESPONSE");
  }
  const data = record(raw.data);
  const url = text(data.download_url || data.downloadUrl || data.url);
  if (!/^https?:\/\//i.test(url)) throw new Error("RUNNINGHUB_STANDARD_MEDIA_UPLOAD_URL_MISSING");
  return url;
}

async function resolveOwnedMediaReference(dataDir: string, ownerId: string, value: string) {
  const parsed = parseOwnedMediaReference(value, ownerId);
  if (!parsed) return null;
  const ownerDir = resolve(dataDir, "users", safeOwnerSegment(ownerId), parsed.directory);
  const path = resolve(ownerDir, parsed.filename);
  if (!path.startsWith(`${ownerDir}${sep}`)) throw new Error("RUNNINGHUB_STANDARD_MEDIA_URL_INVALID");
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) throw new Error("RUNNINGHUB_STANDARD_MEDIA_NOT_FOUND");
  if (info.size <= 0 || info.size > MAX_MEDIA_BYTES) throw new Error("RUNNINGHUB_STANDARD_MEDIA_SIZE_INVALID");
  return { path, filename: parsed.filename, mimeType: mediaMime(parsed.filename) };
}

function parseOwnedMediaReference(value: string, ownerId: string) {
  const raw = text(value);
  if (/^https?:\/\//i.test(raw)) return parseProtectedProviderUrl(raw, ownerId);
  const source = sourceDirectory(raw);
  if (!source) return null;
  return { directory: source.directory, filename: safeFilename(raw.slice(source.prefix.length)) };
}

function parseProtectedProviderUrl(value: string, ownerId: string) {
  let parts: string[];
  try {
    parts = new URL(value).pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  } catch {
    throw new Error("RUNNINGHUB_STANDARD_MEDIA_URL_INVALID");
  }
  const providerFilesIndex = parts.findIndex((part, index) => part === "provider-files" && parts[index - 1] === "api");
  if (providerFilesIndex < 0) return null;
  const tail = parts.slice(providerFilesIndex + 1);
  if (tail.length !== 3) throw new Error("RUNNINGHUB_STANDARD_MEDIA_URL_INVALID");
  if (safeOwnerSegment(tail[0]) !== safeOwnerSegment(ownerId)) throw new Error("RUNNINGHUB_STANDARD_MEDIA_OWNER_MISMATCH");
  if (tail[1] !== "input" && tail[1] !== "output") throw new Error("RUNNINGHUB_STANDARD_MEDIA_URL_INVALID");
  return { directory: tail[1], filename: safeFilename(tail[2]) };
}

function safeFilename(value: string) {
  let decoded = "";
  try {
    decoded = decodeURIComponent(value.split(/[?#]/)[0] || "");
  } catch {
    throw new Error("RUNNINGHUB_STANDARD_MEDIA_URL_INVALID");
  }
  if (!decoded || decoded !== basename(decoded) || decoded.includes("/") || decoded.includes("\\") || decoded === "." || decoded === "..") {
    throw new Error("RUNNINGHUB_STANDARD_MEDIA_URL_INVALID");
  }
  return decoded;
}

function sourceDirectory(value: string) {
  if (value.startsWith("/files/input/")) return { prefix: "/files/input/", directory: "input" as const };
  if (value.startsWith("/input/")) return { prefix: "/input/", directory: "input" as const };
  if (value.startsWith("/files/output/")) return { prefix: "/files/output/", directory: "output" as const };
  if (value.startsWith("/output/")) return { prefix: "/output/", directory: "output" as const };
  return null;
}

function assertRemoteOrDataMedia(value: string) {
  const normalized = text(value);
  if (/^https?:\/\//i.test(normalized) || /^data:(?:image|video|audio)\//i.test(normalized)) return normalized;
  throw new Error("RUNNINGHUB_STANDARD_MEDIA_URL_UNSUPPORTED");
}

function normalizedBaseUrl(value: string) {
  const raw = text(value).replace(/\/+$/, "").replace(/\/openapi\/v2$/i, "");
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") throw new Error();
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    throw new Error("RUNNINGHUB_BASE_URL_INVALID");
  }
}

function mediaMime(filename: string) {
  const extension = extname(filename).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".mp4") return "video/mp4";
  if (extension === ".webm") return "video/webm";
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".wav") return "audio/wav";
  if (extension === ".ogg") return "audio/ogg";
  return "application/octet-stream";
}

function safeOwnerSegment(value: string) {
  return String(value || "guest").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
