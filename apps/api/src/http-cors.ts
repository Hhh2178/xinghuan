import type { IncomingMessage, ServerResponse } from "node:http";

type CorsEnvironment = {
  XINGHUAN_CORS_ALLOWED_ORIGINS?: string;
};

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function requestPublicOrigin(request: IncomingMessage) {
  const forwardedProto = firstHeaderValue(request.headers["x-forwarded-proto"]).split(",")[0].trim();
  const forwardedHost = firstHeaderValue(request.headers["x-forwarded-host"]).split(",")[0].trim();
  const host = forwardedHost || firstHeaderValue(request.headers.host).trim();
  return normalizeOrigin(`${forwardedProto || "http"}://${host}`);
}

function configuredOrigins(environment: CorsEnvironment) {
  return new Set(
    String(environment.XINGHUAN_CORS_ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => normalizeOrigin(value.trim()))
      .filter(Boolean),
  );
}

export function resolveCorsHeaders(request: IncomingMessage, environment: CorsEnvironment = process.env) {
  const requestOrigin = normalizeOrigin(firstHeaderValue(request.headers.origin).trim());
  if (!requestOrigin) return {};

  const allowedOrigins = configuredOrigins(environment);
  allowedOrigins.add(requestPublicOrigin(request));
  if (!allowedOrigins.has(requestOrigin)) return {};

  return {
    "access-control-allow-origin": requestOrigin,
    "access-control-allow-credentials": "true",
    vary: "Origin",
  };
}

export function applyCorsHeaders(
  request: IncomingMessage,
  response: ServerResponse,
  environment: CorsEnvironment = process.env,
) {
  for (const [name, value] of Object.entries(resolveCorsHeaders(request, environment))) {
    response.setHeader(name, value);
  }
}

export function handleCorsPreflight(
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
  environment: CorsEnvironment = process.env,
) {
  if (request.method !== "OPTIONS") return false;

  const corsHeaders = resolveCorsHeaders(request, environment);
  if (firstHeaderValue(request.headers.origin).trim() && Object.keys(corsHeaders).length === 0) {
    response.writeHead(403, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-request-id": requestId,
    });
    response.end(JSON.stringify({ ok: false, success: false, error: "CORS_ORIGIN_NOT_ALLOWED" }));
    return true;
  }

  for (const [name, value] of Object.entries(corsHeaders)) {
    response.setHeader(name, value);
  }
  response.writeHead(204, {
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type",
    "x-request-id": requestId,
  });
  response.end();
  return true;
}
