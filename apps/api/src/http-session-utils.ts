import type { IncomingMessage } from "node:http";

export const SESSION_COOKIE_NAME = "xh_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function readJsonBody<T = unknown>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

export function readCookie(request: IncomingMessage, name: string) {
  const raw = request.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

export function buildSessionCookie(request: IncomingMessage, sessionId: string) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${isSecureRequest(request) ? "; Secure" : ""}`;
}

export function expireSessionCookie(request: IncomingMessage) {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecureRequest(request) ? "; Secure" : ""}`;
}

export function isSecureRequest(request: IncomingMessage) {
  return request.headers["x-forwarded-proto"] === "https";
}
