import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  ChannelFeedbackVote,
  ChannelHealthCapability,
  ChannelHealthFilters,
  ChannelHealthReport,
} from "@xinghuan/shared";

interface RouteUser {
  id: string;
  role: string;
}

interface ChannelHealthServiceRoutes {
  readReport(input: { audience: "member" | "admin"; ownerId?: string; filters?: ChannelHealthFilters }): Promise<ChannelHealthReport>;
  submitVote(input: {
    ownerId: string;
    providerId: string;
    modelRecordId: string;
    vote: ChannelFeedbackVote;
  }): Promise<{ kind: "saved"; vote: ChannelFeedbackVote; report: ChannelHealthReport } | { kind: "ineligible" } | { kind: "channel_missing" }>;
}

export function createChannelHealthRouteHandlers(deps: {
  service: ChannelHealthServiceRoutes;
  sendT8: (response: ServerResponse, data: unknown, statusCode?: number, headers?: Record<string, string>) => void;
  readJsonBody: (request: IncomingMessage) => Promise<unknown>;
  invalidRequest: (code: string) => Error;
  forbidden: (code: string) => Error;
  notFound: (code: string) => Error;
}) {
  return { handleMemberRoutes, handleAdminRoutes };

  async function handleMemberRoutes(input: {
    request: IncomingMessage;
    response: ServerResponse;
    url: URL;
    currentUser: RouteUser;
  }): Promise<boolean> {
    if (input.url.pathname === "/api/channel-health" && input.request.method === "GET") {
      await sendReport(input.request, input.response, await deps.service.readReport({ audience: "member", ownerId: input.currentUser.id }));
      return true;
    }
    if (input.url.pathname !== "/api/channel-health/feedback" || input.request.method !== "POST") return false;

    const body = await deps.readJsonBody(input.request) as { providerId?: unknown; modelId?: unknown; vote?: unknown };
    const providerId = requiredText(body.providerId, "CHANNEL_FEEDBACK_PROVIDER_REQUIRED");
    const modelRecordId = requiredText(body.modelId, "CHANNEL_FEEDBACK_MODEL_REQUIRED");
    const vote = parseVote(body.vote);
    const result = await deps.service.submitVote({ ownerId: input.currentUser.id, providerId, modelRecordId, vote });
    if (result.kind === "channel_missing") throw deps.notFound("CHANNEL_NOT_FOUND");
    if (result.kind === "ineligible") throw deps.forbidden("CHANNEL_FEEDBACK_INELIGIBLE");
    await sendReport(input.request, input.response, result.report);
    return true;
  }

  async function handleAdminRoutes(input: {
    request: IncomingMessage;
    response: ServerResponse;
    url: URL;
    currentUser: RouteUser;
  }): Promise<boolean> {
    if (input.url.pathname !== "/api/admin/analytics/model-success-rates" || input.request.method !== "GET") return false;
    if (input.currentUser.role !== "admin") throw deps.forbidden("ADMIN_REQUIRED");
    const filters = parseFilters(input.url);
    await sendReport(input.request, input.response, await deps.service.readReport({ audience: "admin", ownerId: input.currentUser.id, filters }));
    return true;
  }

  async function sendReport(request: IncomingMessage, response: ServerResponse, report: ChannelHealthReport) {
    const etag = `"${createHash("sha256").update(JSON.stringify(report)).digest("base64url")}"`;
    const headers = { etag, "cache-control": "private, max-age=0, must-revalidate" };
    if (request.headers["if-none-match"] === etag) {
      response.writeHead(304, headers);
      response.end();
      return;
    }
    deps.sendT8(response, report, 200, headers);
  }

  function requiredText(value: unknown, code: string): string {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) throw deps.invalidRequest(code);
    return text;
  }

  function parseVote(value: unknown): ChannelFeedbackVote {
    if (value === "up" || value === "down") return value;
    throw deps.invalidRequest("CHANNEL_FEEDBACK_VOTE_INVALID");
  }

  function parseFilters(url: URL): ChannelHealthFilters {
    const capabilityText = String(url.searchParams.get("capability") || "").trim().toLowerCase();
    const capability = capabilityText
      ? parseCapability(capabilityText)
      : undefined;
    const providerId = optionalText(url.searchParams.get("providerId"));
    const modelRecordId = optionalText(url.searchParams.get("modelId"));
    return { ...(capability ? { capability } : {}), ...(providerId ? { providerId } : {}), ...(modelRecordId ? { modelRecordId } : {}) };
  }

  function parseCapability(value: string): ChannelHealthCapability {
    if (value === "image" || value === "video" || value === "audio" || value === "chat") return value;
    throw deps.invalidRequest("CHANNEL_HEALTH_CAPABILITY_INVALID");
  }
}

function optionalText(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}
