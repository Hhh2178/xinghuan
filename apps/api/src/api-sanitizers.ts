import { basename, extname } from "node:path";

export function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 240);
}

export function safeLongText(value: unknown, fallback = "", maxLength = 16_000) {
  const length = Number.isFinite(maxLength) ? Math.max(0, Math.floor(maxLength)) : 16_000;
  return String(value ?? fallback).trim().slice(0, length);
}

export function safePromptText(value: unknown, fallback = "", maxLength = 16_000) {
  return safeLongText(value, fallback, maxLength);
}

export function safeEmail(value: unknown) {
  const email = safeText(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function safeSlug(value: unknown, fallback = "item") {
  return String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80) || fallback;
}

export function safeJsonText(value: unknown, fallback = "{}") {
  const text = String(value ?? fallback).trim() || fallback;
  try {
    JSON.parse(text);
    return text;
  } catch {
    return fallback;
  }
}

export function safeFilename(value: unknown, fallback = "file") {
  const base = basename(String(value || fallback)).replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
  return base || fallback;
}

export function safeUserId(value: unknown) {
  return String(value || "user").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "user";
}

export function inferMime(filename: string) {
  const ext = extname(filename).toLowerCase();
  if ([".html"].includes(ext)) return "text/html; charset=utf-8";
  if ([".js", ".mjs"].includes(ext)) return "text/javascript; charset=utf-8";
  if ([".css"].includes(ext)) return "text/css; charset=utf-8";
  if ([".json"].includes(ext)) return "application/json; charset=utf-8";
  if ([".svg"].includes(ext)) return "image/svg+xml";
  if ([".txt"].includes(ext)) return "text/plain; charset=utf-8";
  if ([".png"].includes(ext)) return "image/png";
  if ([".jpg", ".jpeg"].includes(ext)) return "image/jpeg";
  if ([".webp"].includes(ext)) return "image/webp";
  if ([".gif"].includes(ext)) return "image/gif";
  if ([".mp4"].includes(ext)) return "video/mp4";
  if ([".webm"].includes(ext)) return "video/webm";
  if ([".mp3"].includes(ext)) return "audio/mpeg";
  if ([".wav"].includes(ext)) return "audio/wav";
  if ([".mid", ".midi"].includes(ext)) return "audio/midi";
  if ([".woff"].includes(ext)) return "font/woff";
  if ([".woff2"].includes(ext)) return "font/woff2";
  return "application/octet-stream";
}
