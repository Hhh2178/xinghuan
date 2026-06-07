import { createHmac, timingSafeEqual } from "node:crypto";
import { basename } from "node:path";

export type ProviderFileBucket = "input" | "output";

export interface ProviderFileUser {
  id: string;
}

export interface ProviderFileAccessOptions {
  secret: Buffer;
  now?: number;
  ttlMs?: number;
}

export interface ProviderFileAccessRequestOptions {
  secret: Buffer;
  now?: number;
}

export interface ProviderFileAccessSuccess {
  ok: true;
  userId: string;
  bucket: ProviderFileBucket;
  filename: string;
}

export interface ProviderFileAccessFailure {
  ok: false;
  error: "INVALID_PROVIDER_FILE_URL" | "PROVIDER_FILE_EXPIRED" | "PROVIDER_FILE_SIGNATURE_INVALID";
}

export type ProviderFileAccessRequest = ProviderFileAccessSuccess | ProviderFileAccessFailure;

const providerFileTtlMs = 20 * 60 * 1000;

export function normalizeProviderReferenceUrl(
  value: string,
  publicOrigin: string,
  user: ProviderFileUser | undefined,
  options: ProviderFileAccessOptions,
) {
  const text = safeText(value);
  if (!text) return "";
  if (/^data:image\//i.test(text) || /^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/files/") || text.startsWith("/input/") || text.startsWith("/output/")) {
    return user ? providerFileAccessUrl(text, user, publicOrigin, options) : new URL(text, publicOrigin).toString();
  }
  if (/^(files|input|output)\//i.test(text)) {
    return user ? providerFileAccessUrl(`/${text}`, user, publicOrigin, options) : new URL(`/${text}`, publicOrigin).toString();
  }
  return text;
}

export function normalizeProviderReferenceUrls(
  values: string[],
  publicOrigin: string,
  user: ProviderFileUser | undefined,
  options: ProviderFileAccessOptions,
) {
  return values.map((value) => normalizeProviderReferenceUrl(value, publicOrigin, user, options)).filter(Boolean);
}

export function providerFileAccessUrl(
  value: string,
  user: ProviderFileUser,
  publicOrigin: string,
  options: ProviderFileAccessOptions,
) {
  const parsed = parseLocalProviderFileReference(value);
  if (!parsed) return new URL(value, publicOrigin).toString();
  const now = options.now ?? Date.now();
  const exp = now + (options.ttlMs ?? providerFileTtlMs);
  const userId = safeUserId(user.id);
  const sig = signProviderFile(userId, parsed.bucket, parsed.filename, exp, options.secret);
  const path = `/api/provider-files/${encodeURIComponent(userId)}/${parsed.bucket}/${encodeURIComponent(parsed.filename)}`;
  const url = new URL(path, publicOrigin);
  url.searchParams.set("exp", String(exp));
  url.searchParams.set("sig", sig);
  return url.toString();
}

export function parseLocalProviderFileReference(value: string): { bucket: ProviderFileBucket; filename: string } | null {
  const text = safeText(value).replace(/^\/+/, "");
  const match = text.match(/^(?:files\/)?(input|output)\/(.+)$/i);
  if (!match) return null;
  const filename = basename(decodeURIComponent(match[2]));
  if (!filename || filename === "." || filename === "..") return null;
  return { bucket: match[1].toLowerCase() as ProviderFileBucket, filename };
}

export function parseProviderFileAccessRequest(url: URL, options: ProviderFileAccessRequestOptions): ProviderFileAccessRequest {
  const match = url.pathname.match(/^\/api\/provider-files\/([^/]+)\/(input|output)\/([^/]+)$/);
  if (!match) return { ok: false, error: "INVALID_PROVIDER_FILE_URL" };
  const userId = safeUserId(decodeURIComponent(match[1]));
  const bucket = match[2] as ProviderFileBucket;
  const filename = basename(decodeURIComponent(match[3]));
  const exp = Number(url.searchParams.get("exp") || 0);
  const sig = safeText(url.searchParams.get("sig"));
  if (!Number.isFinite(exp) || exp < (options.now ?? Date.now())) {
    return { ok: false, error: "PROVIDER_FILE_EXPIRED" };
  }
  if (!verifyProviderFileSignature(userId, bucket, filename, exp, sig, options.secret)) {
    return { ok: false, error: "PROVIDER_FILE_SIGNATURE_INVALID" };
  }
  return { ok: true, userId, bucket, filename };
}

export function signProviderFile(
  userId: string,
  bucket: ProviderFileBucket,
  filename: string,
  exp: number,
  secret: Buffer,
) {
  return createHmac("sha256", secret)
    .update(`${safeUserId(userId)}:${bucket}:${filename}:${exp}`)
    .digest("hex");
}

export function verifyProviderFileSignature(
  userId: string,
  bucket: ProviderFileBucket,
  filename: string,
  exp: number,
  sig: string,
  secret: Buffer,
) {
  const expected = signProviderFile(userId, bucket, filename, exp, secret);
  const actual = safeText(sig);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function safeUserId(value: unknown) {
  return String(value || "user").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "user";
}

function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 240);
}
