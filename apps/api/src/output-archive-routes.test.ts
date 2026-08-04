import { describe, expect, it, vi } from "vitest";
import { createOutputArchiveRouteHandler } from "./output-archive-routes.js";

function route(pathname: string, method: string, repository: any) {
  const sendT8 = vi.fn();
  const result = createOutputArchiveRouteHandler({
    repository,
    currentUser: { id: "owner-1" },
    userDataDirs: () => ({ archiveDir: "D:/archive" }),
    request: { method } as any,
    response: {} as any,
    url: new URL(`http://localhost${pathname}`),
    sendT8,
    toHttpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  });
  return { result, sendT8 };
}

describe("output archive routes", () => {
  it("creates an archive job for the current owner", async () => {
    const repository = { createOrReuse: vi.fn(async () => ({ jobId: "archive-1", status: "queued" })) };
    const { result, sendT8 } = route("/api/tasks/task-1/output-archives", "POST", repository);

    await expect(result).resolves.toBe(true);
    expect(repository.createOrReuse).toHaveBeenCalledWith("task-1", "owner-1");
    expect(sendT8).toHaveBeenCalledWith(expect.anything(), { jobId: "archive-1", status: "queued" });
  });

  it("ignores unrelated paths", () => {
    const { result } = route("/api/tasks/task-1", "GET", {});
    expect(result).toBe(false);
  });
});
