import { openAsBlob } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";

const MAX_MEDIA_BYTES = 2 * 1024 * 1024 * 1024;

interface RunningHubNodeInfoItem {
  nodeId: string;
  fieldName: string;
  fieldValue: unknown;
}

export async function materializeRunningHubNodeInfo(input: {
  dataDir: string;
  ownerId: string;
  baseUrl: string;
  apiKey: string;
  nodeInfoList: RunningHubNodeInfoItem[];
  fetcher?: typeof fetch;
}) {
  const fetcher = input.fetcher || fetch;
  const result: RunningHubNodeInfoItem[] = [];
  for (const item of input.nodeInfoList) {
    const fieldValue = typeof item.fieldValue === "string" ? item.fieldValue.trim() : item.fieldValue;
    result.push({
      nodeId: item.nodeId,
      fieldName: item.fieldName,
      fieldValue: isInternalMediaReference(fieldValue)
        ? await uploadOwnedMedia({ ...input, fetcher, fileUrl: fieldValue })
        : assertSafeFieldValue(fieldValue),
    });
  }
  return result;
}

function assertSafeFieldValue(value: unknown) {
  if (typeof value !== "string") return value;
  if (/^(?:https?:)?\/\//i.test(value) || value.startsWith("/")) throw new Error("RUNNINGHUB_MEDIA_URL_UNSUPPORTED");
  return value;
}

function isInternalMediaReference(value: unknown): value is string {
  return typeof value === "string" && ["/files/input/", "/input/", "/files/output/", "/output/"].some((prefix) => value.startsWith(prefix));
}

async function uploadOwnedMedia(input: {
  dataDir: string;
  ownerId: string;
  baseUrl: string;
  apiKey: string;
  fetcher: typeof fetch;
  fileUrl: string;
}) {
  const media = await resolveOwnedMedia(input.dataDir, input.ownerId, input.fileUrl);
  const form = new FormData();
  form.append("apiKey", input.apiKey);
  form.append("fileType", "input");
  form.append("file", await openAsBlob(media.path, { type: media.mimeType }), media.filename);
  const response = await input.fetcher(`${normalizedBaseUrl(input.baseUrl)}/task/openapi/upload`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(180_000),
  });
  const rawText = await response.text();
  if (!response.ok) throw new Error(`RUNNINGHUB_MEDIA_UPLOAD_FAILED:${response.status}`);
  let raw: Record<string, unknown>;
  try {
    raw = rawText ? JSON.parse(rawText) as Record<string, unknown> : {};
  } catch {
    throw new Error("RUNNINGHUB_MEDIA_UPLOAD_INVALID_RESPONSE");
  }
  const data = record(raw.data);
  const fileName = text(data.fileName || data.filename || raw.fileName);
  if (!fileName) throw new Error("RUNNINGHUB_MEDIA_UPLOAD_FILE_NAME_MISSING");
  return fileName;
}

async function resolveOwnedMedia(dataDir: string, ownerId: string, fileUrl: string) {
  const source = sourceDirectory(fileUrl);
  if (!source) throw new Error("RUNNINGHUB_MEDIA_URL_UNSUPPORTED");
  let filename = "";
  try {
    filename = decodeURIComponent(fileUrl.slice(source.prefix.length));
  } catch {
    throw new Error("RUNNINGHUB_MEDIA_URL_INVALID");
  }
  if (!filename || filename !== basename(filename) || filename.includes("/") || filename.includes("\\")) throw new Error("RUNNINGHUB_MEDIA_URL_INVALID");
  const ownerDir = resolve(dataDir, "users", safeOwnerSegment(ownerId), source.directory);
  const path = resolve(ownerDir, filename);
  if (!path.startsWith(`${ownerDir}${sep}`)) throw new Error("RUNNINGHUB_MEDIA_URL_INVALID");
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) throw new Error("RUNNINGHUB_MEDIA_NOT_FOUND");
  if (info.size <= 0 || info.size > MAX_MEDIA_BYTES) throw new Error("RUNNINGHUB_MEDIA_SIZE_INVALID");
  return { path, filename, mimeType: mediaMime(filename) };
}

function sourceDirectory(fileUrl: string) {
  if (fileUrl.startsWith("/files/input/")) return { prefix: "/files/input/", directory: "input" };
  if (fileUrl.startsWith("/input/")) return { prefix: "/input/", directory: "input" };
  if (fileUrl.startsWith("/files/output/")) return { prefix: "/files/output/", directory: "output" };
  if (fileUrl.startsWith("/output/")) return { prefix: "/output/", directory: "output" };
  return null;
}

function normalizedBaseUrl(value: string) {
  const baseUrl = String(value || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(baseUrl)) throw new Error("RUNNINGHUB_BASE_URL_INVALID");
  return baseUrl;
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
