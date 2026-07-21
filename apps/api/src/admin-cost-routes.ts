import type { IncomingMessage, ServerResponse } from "node:http";

import type { AdminCostFilters } from "./task-cost-repository.js";
import type { ModelPricingInput } from "./task-cost-domain.js";

interface AdminActor { id: string; email: string; name: string; role: "admin" | "member" }
interface RequestContext { requestId: string; method: string; path: string; ip: string; userAgent: string; startedAt: number }

export function createAdminCostRouteHandler(deps: {
  sendT8: (response: ServerResponse, payload: unknown, statusCode?: number) => void;
  readJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  readModelPricing: () => Promise<unknown[]>;
  writeModelPricing: (modelId: string, actorId: string, input: ModelPricingInput) => Promise<unknown>;
  readCostSummary: (filters: AdminCostFilters) => Promise<unknown>;
  appendAudit: (actor: AdminActor, action: string, targetType: string, targetId: string, summary: string, context: RequestContext) => Promise<void>;
}) {
  return async function handleAdminCostRoutes(input: {
    request: IncomingMessage;
    response: ServerResponse;
    url: URL;
    currentUser: AdminActor;
    requestContext: RequestContext;
  }) {
    const { request, response, url, currentUser, requestContext } = input;
    if (url.pathname === "/api/admin/model-pricing" && request.method === "GET") {
      deps.sendT8(response, await deps.readModelPricing());
      return true;
    }
    const pricingMatch = url.pathname.match(/^\/api\/admin\/model-pricing\/([^/]+)$/);
    if (pricingMatch && request.method === "PUT") {
      const modelId = decodeURIComponent(pricingMatch[1]);
      const saved = await deps.writeModelPricing(modelId, currentUser.id, await deps.readJsonBody<ModelPricingInput>(request));
      await deps.appendAudit(currentUser, "model.pricing.update", "model", modelId, "创建模型价格版本", requestContext);
      deps.sendT8(response, saved);
      return true;
    }
    if (url.pathname === "/api/admin/analytics/cost-summary" && request.method === "GET") {
      const now = Date.now();
      const from = finiteNumber(url.searchParams.get("from"), now - 29 * 86_400_000);
      const to = finiteNumber(url.searchParams.get("to"), now);
      const filters: AdminCostFilters = {
        from: Math.min(from, to),
        to: Math.max(from, to),
        currency: /^[A-Z]{3}$/.test(url.searchParams.get("currency") || "") ? url.searchParams.get("currency")! : "CNY",
        groupId: text(url.searchParams.get("groupId")),
        userId: text(url.searchParams.get("userId")),
        providerId: text(url.searchParams.get("providerId")),
        modelId: text(url.searchParams.get("modelId")),
      };
      await deps.appendAudit(currentUser, "analytics.cost_summary.read", "analytics", "cost-summary", "查看费用统计", requestContext);
      deps.sendT8(response, await deps.readCostSummary(filters));
      return true;
    }
    return false;
  };
}

function finiteNumber(value: string | null, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function text(value: string | null) {
  return String(value || "").trim() || undefined;
}
