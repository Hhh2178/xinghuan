import { readFile, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

export interface PrepareGrsaiReferenceImagesInput {
  dataDir: string;
  ownerId: string;
  values: string[];
  limit?: number;
}

export async function prepareGrsaiReferenceImages(input: PrepareGrsaiReferenceImagesInput) {
  const limit = Math.max(0, Math.min(16, Number(input.limit) || input.values.length || 0));
  const prepared: string[] = [];
  for (const value of input.values) {
    if (prepared.length >= limit) break;
    const text = safeText(value);
    if (!text) continue;
    const local = await tryInlineLocalImageReference(text, input.dataDir, input.ownerId);
    prepared.push(local || text);
  }
  return prepared;
}

async function tryInlineLocalImageReference(value: string, dataDir: string, ownerId: string) {
  if (/^data:image\//i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return "";
  const parsed = parseLocalImageReference(value);
  if (!parsed) return "";

  const baseDir = join(dataDir, "users", safeUserId(ownerId), parsed.bucket);
  const base = resolve(baseDir);
  const target = resolve(base, parsed.filename);
  if (target !== base && !target.startsWith(`${base}\\`) && !target.startsWith(`${base}/`)) return "";

  const info = await stat(target).catch(() => null);
  if (!info?.isFile()) return "";
  const mime = imageMimeFromFilename(parsed.filename);
  if (!mime) return "";
  const buffer = await readFile(target);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function parseLocalImageReference(value: string) {
  const text = safeText(value).replace(/^\/+/, "");
  const match = text.match(/^(?:files\/)?(input|output)\/(.+)$/i);
  if (!match) return null;
  const filename = basename(decodeURIComponent(match[2].split(/[?#]/)[0] || ""));
  if (!filename || filename === "." || filename === "..") return null;
  return { bucket: match[1].toLowerCase(), filename };
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

function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}
