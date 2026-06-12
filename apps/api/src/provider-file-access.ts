import { createHmac, timingSafeEqual } from "node:crypto";
import { basename } from "node:path";

export type ProviderFileBucket = "input" | "output";
export type ProviderFileScope = "local" | "gray" | "production";

export interface ProviderFileUser {
  id: string;
}

export interface ProviderFileAccessOptions {
  secret: Buffer;
  now?: number;
  ttlMs?: number;
  scope?: ProviderFileScope;
}

export interface ProviderFileAccessRequestOptions {
  secret: Buffer;
  now?: number;
}

export interface ProviderFileAccessSuccess {
  ok: true;
  scope: ProviderFileScope | "";
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
  const scope = normalizeProviderFileScope(options.scope);
  const sig = signProviderFile(userId, parsed.bucket, parsed.filename, exp, options.secret, scope);
  const prefix = scope ? `/api/provider-files/${scope}` : "/api/provider-files";
  const path = `${prefix}/${encodeURIComponent(userId)}/${parsed.bucket}/${encodeURIComponent(parsed.filename)}`;
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
  const parsedPath = parseProviderFileAccessPath(url.pathname);
  if (!parsedPath) return { ok: false, error: "INVALID_PROVIDER_FILE_URL" };
  const { scope, userId, bucket, filename } = parsedPath;
  const exp = Number(url.searchParams.get("exp") || 0);
  const sig = safeText(url.searchParams.get("sig"));
  if (!Number.isFinite(exp) || exp < (options.now ?? Date.now())) {
    return { ok: false, error: "PROVIDER_FILE_EXPIRED" };
  }
  if (!verifyProviderFileSignature(userId, bucket, filename, exp, sig, options.secret, scope)) {
    return { ok: false, error: "PROVIDER_FILE_SIGNATURE_INVALID" };
  }
  return { ok: true, scope, userId, bucket, filename };
}

export function signProviderFile(
  userId: string,
  bucket: ProviderFileBucket,
  filename: string,
  exp: number,
  secret: Buffer,
  scope: ProviderFileScope | "" = "",
) {
  return createHmac("sha256", secret)
    .update(`${normalizeProviderFileScope(scope)}:${safeUserId(userId)}:${bucket}:${filename}:${exp}`)
    .digest("hex");
}

export function verifyProviderFileSignature(
  userId: string,
  bucket: ProviderFileBucket,
  filename: string,
  exp: number,
  sig: string,
  secret: Buffer,
  scope: ProviderFileScope | "" = "",
) {
  const expected = signProviderFile(userId, bucket, filename, exp, secret, scope);
  const actual = safeText(sig);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function safeUserId(value: unknown) {
  return String(value || "user").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "user";
}

function parseProviderFileAccessPath(pathname: string) {
  const match = pathname.match(/^\/api\/provider-files\/(.+)$/);
  if (!match) return null;
  const parts = match[1].split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  if (parts.length === 3) {
    const userId = safeUserId(parts[0]);
    const bucket = parts[1] as ProviderFileBucket;
    const filename = basename(parts[2]);
    if (!isProviderFileBucket(bucket) || !filename || filename === "." || filename === "..") return null;
    return { scope: "" as const, userId, bucket, filename };
  }
  if (parts.length === 4) {
    const scope = normalizeProviderFileScope(parts[0]);
    const userId = safeUserId(parts[1]);
    const bucket = parts[2] as ProviderFileBucket;
    const filename = basename(parts[3]);
    if (!scope || !isProviderFileBucket(bucket) || !filename || filename === "." || filename === "..") return null;
    return { scope, userId, bucket, filename };
  }
  return null;
}

function normalizeProviderFileScope(value: unknown): ProviderFileScope | "" {
  const text = safeText(value).toLowerCase();
  return text === "local" || text === "gray" || text === "production" ? (text as ProviderFileScope) : "";
}

function isProviderFileBucket(value: string): value is ProviderFileBucket {
  return value === "input" || value === "output";
}

function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 240);
}
