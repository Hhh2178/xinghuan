import type { IncomingMessage, ServerResponse } from "node:http";

import { readJsonBody } from "./http-session-utils.js";
import type { CanvasRunCommand, CanvasRunRecord } from "./canvas-run-repository.js";

const COMMANDS = new Set<CanvasRunCommand>(["start", "pause", "resume", "cancel", "retry"]);

export function createCanvasRunRouteHandler(deps: {
  sendT8: (response: ServerResponse, payload: unknown, statusCode?: number) => void;
  createRun: (input: {
    ownerId: string;
    canvasId: string;
    idempotencyKey: string;
    runScope?: CanvasRunRecord["runScope"];
    configuration?: Record<string, unknown>;
    budget?: Record<string, unknown>;
  }) => Promise<{ run: CanvasRunRecord; created: boolean }>;
  readRun: (ownerId: string, runId: string) => Promise<CanvasRunRecord>;
  readEvents: (ownerId: string, runId: string, afterSequence?: number, limit?: number) => Promise<unknown>;
  commandRun: (input: { ownerId: string; runId: string; command: CanvasRunCommand; idempotencyKey: string; request?: Record<string, unknown> }) => Promise<CanvasRunRecord>;
  decideApproval?: (input: { ownerId: string; runId: string; approvalId: string; decision: "approved" | "rejected"; reason?: string }) => Promise<unknown>;
  invalidRequest: (message: string) => Error;
  mapError?: (error: unknown) => Error;
}) {
  return async function handleCanvasRunRoutes(input: {
    request: IncomingMessage;
    response: ServerResponse;
    url: URL;
    currentUser: { id: string };
  }) {
    const { request, response, url, currentUser } = input;
    try {
    const approvalMatch = url.pathname.match(/^\/api\/canvas-runs\/([^/]+)\/approvals\/([^/]+)\/(approve|reject)$/);
    if (request.method === "POST" && approvalMatch && deps.decideApproval) {
      const body = await readJsonBody<Record<string, unknown>>(request);
      deps.sendT8(response, await deps.decideApproval({
        ownerId: currentUser.id,
        runId: decodeURIComponent(approvalMatch[1]),
        approvalId: decodeURIComponent(approvalMatch[2]),
        decision: approvalMatch[3] === "approve" ? "approved" : "rejected",
        reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : undefined,
      }));
      return true;
    }
    const streamMatch = url.pathname.match(/^\/api\/canvas-runs\/([^/]+)\/events\/stream$/);
    if (request.method === "GET" && streamMatch) {
      const runId = decodeURIComponent(streamMatch[1]);
      await deps.readRun(currentUser.id, runId);
      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      response.write(": connected\n\n");
      const headerSequence = numericHeader(request.headers["last-event-id"], 0);
      let afterSequence = Math.max(numericQuery(url, "after", 0), headerSequence);
      let reading = false;
      let closed = false;
      const flush = async () => {
        if (closed || reading) return;
        reading = true;
        try {
          const result = await deps.readEvents(currentUser.id, runId, afterSequence, 200) as {
            items?: Array<{ sequence?: number }>;
            nextSequence?: number;
          };
          for (const event of result.items || []) {
            response.write(`id: ${Number(event.sequence) || 0}\nevent: run-event\ndata: ${JSON.stringify(event)}\n\n`);
          }
          if (Number.isFinite(result.nextSequence)) afterSequence = Number(result.nextSequence);
        } catch (error) {
          response.write(`event: stream-error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : String(error) })}\n\n`);
        } finally {
          reading = false;
        }
      };
      await flush();
      const pollTimer = setInterval(() => void flush(), 1_000);
      const heartbeatTimer = setInterval(() => {
        if (!closed) response.write(": heartbeat\n\n");
      }, 15_000);
      request.once("close", () => {
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
      });
      return true;
    }

    if (url.pathname === "/api/canvas-runs" && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const canvasId = requiredText(body.canvasId, "canvasId", deps.invalidRequest);
      const idempotencyKey = requiredText(body.idempotencyKey, "idempotencyKey", deps.invalidRequest);
      const runScope = runScopeValue(body.runScope, deps.invalidRequest);
      const result = await deps.createRun({
        ownerId: currentUser.id,
        canvasId,
        idempotencyKey,
        runScope,
        configuration: objectValue(body.configuration),
        budget: objectValue(body.budget),
      });
      deps.sendT8(response, result.run, result.created ? 201 : 200);
      return true;
    }

    const match = url.pathname.match(/^\/api\/canvas-runs\/([^/]+)(?:\/([^/]+))?$/);
    if (!match) return false;
    const runId = decodeURIComponent(match[1]);
    if (request.method === "GET" && match[2] === "events") {
      deps.sendT8(response, await deps.readEvents(currentUser.id, runId, numericQuery(url, "after", 0), numericQuery(url, "limit", 200)));
      return true;
    }
    if (request.method === "GET" && !match[2]) {
      deps.sendT8(response, await deps.readRun(currentUser.id, runId));
      return true;
    }
    const command = match[2] as CanvasRunCommand | undefined;
    if (request.method === "POST" && command && COMMANDS.has(command)) {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const idempotencyKey = requiredText(body.idempotencyKey, "idempotencyKey", deps.invalidRequest);
      deps.sendT8(response, await deps.commandRun({ ownerId: currentUser.id, runId, command, idempotencyKey, request: objectValue(body.request) }));
      return true;
    }
      return false;
    } catch (error) {
      throw deps.mapError ? deps.mapError(error) : error;
    }
  };
}

export function canvasRunErrorStatus(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  if (code.includes("NOT_FOUND")) return 404;
  if (code.includes("CONFLICT") || code.includes("INVALID_TRANSITION") || code.includes("COMMAND_INVALID")) return 409;
  if (code === "CANVAS_RUN_DISABLED" || code === "CANVAS_RUN_POSTGRES_REQUIRED" || code.includes("AGENT_RUNTIME_CAPABILITY_DISABLED")) return 503;
  if (code === "CANVAS_RUN_PLAN_EMPTY") return 422;
  if (code.includes("CANVAS_RUN_LEGACY_NODE_UNSUPPORTED")) return 422;
  return 500;
}

function requiredText(value: unknown, field: string, invalidRequest: (message: string) => Error) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > 200) throw invalidRequest(`${field} 无效`);
  return text;
}

function runScopeValue(value: unknown, invalidRequest: (message: string) => Error): CanvasRunRecord["runScope"] {
  if (value === undefined || value === "canvas") return "canvas";
  if (value === "group" || value === "downstream") return value;
  throw invalidRequest("runScope 无效");
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function numericQuery(url: URL, key: string, fallback: number) {
  const raw = url.searchParams.get(key);
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.floor(value) : fallback;
}

function numericHeader(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}
