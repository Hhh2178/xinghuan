import { describe, expect, it, vi } from "vitest";

import { createTaskCostRouteHandler, parseTaskIds } from "./task-cost-routes.js";

describe("member task cost routes", () => {
  it("normalizes and deduplicates requested task ids", () => {
    expect(parseTaskIds(" task-a,task-b,task-a,, ")).toEqual(["task-a", "task-b"]);
  });

  it("passes the authenticated owner to the repository", async () => {
    const readTaskCostSummary = vi.fn(async () => ({ visible: false } as any));
    const sendT8 = vi.fn();
    const handler = createTaskCostRouteHandler({
      sendT8,
      readTaskCostSummary,
      invalidRequest: (message) => new Error(message),
    });
    const handled = await handler({
      request: { method: "GET" } as any,
      response: {} as any,
      url: new URL("http://localhost/api/task-costs/summary?taskIds=task-a,task-b"),
      currentUser: { id: "owner-a" },
    });
    expect(handled).toBe(true);
    expect(readTaskCostSummary).toHaveBeenCalledWith(["task-a", "task-b"], "owner-a");
    expect(sendT8).toHaveBeenCalledWith(expect.anything(), { visible: false });
  });
});
