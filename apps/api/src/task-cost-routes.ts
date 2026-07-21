import type { IncomingMessage, ServerResponse } from "node:http";

import type { MemberTaskCostSummary } from "./task-cost-display.js";

const MAX_TASK_IDS = 100;

export function createTaskCostRouteHandler(deps: {
  sendT8: (response: ServerResponse, data: unknown) => void;
  readTaskCostSummary: (taskIds: string[], ownerId: string) => Promise<MemberTaskCostSummary>;
  invalidRequest: (message: string) => Error;
}) {
  return async function handleTaskCostRoutes(input: {
    request: IncomingMessage;
    response: ServerResponse;
    url: URL;
    currentUser: { id: string };
  }): Promise<boolean> {
    const { request, response, url, currentUser } = input;
    if (url.pathname !== "/api/task-costs/summary" || request.method !== "GET") return false;

    const taskIds = parseTaskIds(url.searchParams.get("taskIds"));
    if (taskIds.length > MAX_TASK_IDS) throw deps.invalidRequest(`单次最多查询 ${MAX_TASK_IDS} 个任务费用`);
    deps.sendT8(response, await deps.readTaskCostSummary(taskIds, currentUser.id));
    return true;
  };
}

export function parseTaskIds(value: string | null): string[] {
  return [...new Set(String(value || "").split(",").map((item) => item.trim()).filter(Boolean))];
}
