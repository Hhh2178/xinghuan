import { readFile, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

export interface PrepareGrsaiReferenceImagesInput {
  dataDir: string;
  ownerId: string;
  values: string[];
  limit?: number;
}

export interface PrepareInlineImageReferencesInput extends PrepareGrsaiReferenceImagesInput {
  maxBytesPerImage?: number;
  maxTotalBytes?: number;
}

export async function prepareGrsaiReferenceImages(input: PrepareGrsaiReferenceImagesInput) {
  const limit = Math.max(0, Math.min(16, Number(input.limit) || input.values.length || 0));
  const prepared: string[] = [];
  for (const value of input.values) {
    if (prepared.length >= limit) break;
    const text = safeText(value);
    if (!text) continue;
    const local = await readLocalImageReference(text, input.dataDir, input.ownerId);
    prepared.push(local?.dataUrl || text);
  }
  return prepared;
}

export async function prepareInlineImageReferences(input: PrepareInlineImageReferencesInput) {
  const limit = Math.max(0, Math.min(16, Number(input.limit) || input.values.length || 0));
  const maxBytesPerImage = positiveInteger(input.maxBytesPerImage, 20 * 1024 * 1024);
  const maxTotalBytes = positiveInteger(input.maxTotalBytes, 64 * 1024 * 1024);
  const prepared: string[] = [];
  let totalBytes = 0;
  for (const [index, value] of input.values.entries()) {
    if (prepared.length >= limit) break;
    const text = safeText(value);
    if (!text) continue;
    if (/^data:image\//i.test(text)) {
      const byteLength = dataUrlByteLength(text);
      if (!byteLength) throw new Error(`参考图 ${index + 1} 不是受支持的 Base64 Data URL`);
      if (byteLength > maxBytesPerImage) throw new Error(`参考图 ${index + 1} 超过 Data URL 单图大小限制`);
      totalBytes += byteLength;
      if (totalBytes > maxTotalBytes) throw new Error("参考图总大小超过 Data URL 请求限制");
      prepared.push(text);
      continue;
    }
    const local = await readLocalImageReference(text, input.dataDir, input.ownerId);
    if (!local) throw new Error(`参考图 ${index + 1} 不是当前账号的本地素材，无法转换为 Data URL`);
    if (local.byteLength > maxBytesPerImage) throw new Error(`参考图 ${index + 1} 超过 Data URL 单图大小限制`);
    totalBytes += local.byteLength;
    if (totalBytes > maxTotalBytes) throw new Error("参考图总大小超过 Data URL 请求限制");
    prepared.push(local.dataUrl);
  }
  return prepared;
}

async function readLocalImageReference(value: string, dataDir: string, ownerId: string) {
  const parsed = parseLocalImageReference(value, ownerId);
  if (!parsed) return null;

  const baseDir = join(dataDir, "users", safeUserId(ownerId), parsed.bucket);
  const base = resolve(baseDir);
  const target = resolve(base, parsed.filename);
  if (target !== base && !target.startsWith(`${base}\\`) && !target.startsWith(`${base}/`)) return null;

  const info = await stat(target).catch(() => null);
  if (!info?.isFile()) return null;
  const mime = imageMimeFromFilename(parsed.filename);
  if (!mime) return null;
  const buffer = await readFile(target);
  return {
    dataUrl: `data:${mime};base64,${buffer.toString("base64")}`,
    byteLength: buffer.byteLength,
  };
}

function parseLocalImageReference(value: string, ownerId: string) {
  const text = safeText(value);
  if (/^https?:\/\//i.test(text)) return parseSignedProviderImageReference(text, ownerId);
  const match = text.replace(/^\/+/, "").match(/^(?:files\/)?(input|output)\/(.+)$/i);
  if (!match) return null;
  const filename = basename(decodeURIComponent(match[2].split(/[?#]/)[0] || ""));
  if (!filename || filename === "." || filename === "..") return null;
  return { bucket: match[1].toLowerCase(), filename };
}

function parseSignedProviderImageReference(value: string, ownerId: string) {
  try {
    const parts = new URL(value).pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
    const providerFilesIndex = parts.findIndex((part, index) => part === "provider-files" && parts[index - 1] === "api");
    if (providerFilesIndex < 0) return null;
    const tail = parts.slice(providerFilesIndex + 1);
    const userOffset = tail.length === 4 ? 1 : tail.length === 3 ? 0 : -1;
    if (userOffset < 0 || safeUserId(tail[userOffset]) !== safeUserId(ownerId)) return null;
    const bucket = tail[userOffset + 1]?.toLowerCase();
    const filename = basename(tail[userOffset + 2] || "");
    if (!isImageBucket(bucket) || !filename || filename === "." || filename === "..") return null;
    return { bucket, filename };
  } catch {
    return null;
  }
}

function imageMimeFromFilename(filename: string) {
  const ext = extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "";
}

function safeUserId(value: unknown) {
  return String(value || "guest").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function isImageBucket(value: string | undefined): value is "input" | "output" {
  return value === "input" || value === "output";
}

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function dataUrlByteLength(value: string) {
  const matched = value.match(/^data:image\/(?:png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!matched) return 0;
  const base64 = matched[1].replace(/\s+/g, "");
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
}

function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}
