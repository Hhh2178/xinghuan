import type { IncomingMessage, ServerResponse } from "node:http";

import { readJsonBody } from "./http-session-utils.js";

export function createQualityRecoveryRouteHandler(deps: {
  sendT8: (response: ServerResponse, payload: unknown, statusCode?: number) => void;
  evaluate: (input: any, currentUser: { id: string }, publicOrigin: string) => Promise<unknown>;
  select: (input: any) => Promise<unknown>;
  recover: (input: any) => Promise<unknown>;
  publicOrigin: (request: IncomingMessage) => string;
  invalidRequest: (message: string) => Error;
}) {
  return async function handleQualityRecoveryRoutes(input: { request: IncomingMessage; response: ServerResponse; url: URL; currentUser: { id: string } }) {
    const match = input.url.pathname.match(/^\/api\/canvas-runs\/([^/]+)\/steps\/([^/]+)\/(evaluations|selections|recovery-decisions)$/);
    if (!match || input.request.method !== "POST") return false;
    const body = await readJsonBody<Record<string, unknown>>(input.request);
    const base = {
      ...body,
      ownerId: input.currentUser.id,
      canvasRunId: decodeURIComponent(match[1]),
      runStepId: decodeURIComponent(match[2]),
      idempotencyKey: requiredText(body.idempotencyKey, "idempotencyKey", deps.invalidRequest),
    };
    if (match[3] === "evaluations") {
      requiredText(body.artifactId, "artifactId", deps.invalidRequest);
      deps.sendT8(input.response, await deps.evaluate(base, input.currentUser, deps.publicOrigin(input.request)), 201);
      return true;
    }
    if (match[3] === "selections") {
      if (!Array.isArray(body.candidates) || body.candidates.length === 0) throw deps.invalidRequest("candidates 无效");
      deps.sendT8(input.response, await deps.select(base), 201);
      return true;
    }
    if (!body.error || typeof body.error !== "object" || Array.isArray(body.error)) throw deps.invalidRequest("error 无效");
    deps.sendT8(input.response, await deps.recover(base), 201);
    return true;
  };
}

function requiredText(value: unknown, field: string, invalidRequest: (message: string) => Error) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > 200) throw invalidRequest(`${field} 无效`);
  return text;
}
