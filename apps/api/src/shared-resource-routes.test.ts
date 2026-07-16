import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { createSharedResourceRouteHandler } from "./shared-resource-routes.js";

class TestHttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

describe("shared resource administrator boundary", () => {
  it("returns 403 for every public resource management route when called by a member", async () => {
    const handler = createSharedResourceRouteHandler({
      adminDir: ".",
      sharedResourceDbPath: "unused-shared-resources.json",
      safeText: (value, fallback = "") => typeof value === "string" ? value : fallback,
      inferMime: () => "application/octet-stream",
      normalizeResourceKind: (value) => value === "image" ? "image" : "",
      resourceRevisionFromPayload: () => undefined,
      readJsonBody: async <T>() => ({} as T),
      sendT8: (response, data, statusCode = 200) => {
        response.statusCode = statusCode;
        response.end(JSON.stringify(data));
      },
      HttpError: TestHttpError,
      readResourceDb: async () => ({ categories: [], items: [] }),
      writeResourceDb: async () => undefined,
      usePostgresRepository: () => false,
      upsertResourceItemPostgres: async (item) => item,
      readGroupPermissionPolicies: async () => [],
      filterSharedResourceItemsForUser: (items) => items,
    });
    const member = { id: "member-a", email: "member@example.test", name: "Member", role: "member" as const };
    const server = createServer(async (request, response) => {
      try {
        const handled = await handler({
          request,
          response,
          url: new URL(request.url || "/", "http://127.0.0.1"),
          currentUser: member,
        });
        if (!handled) {
          response.statusCode = 404;
          response.end();
        }
      } catch (error) {
        response.statusCode = error instanceof TestHttpError ? error.statusCode : 500;
        response.end(error instanceof Error ? error.message : "UNKNOWN_ERROR");
      }
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS_UNAVAILABLE");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const managementRequests = [
      ["POST", "/api/shared-resources/categories"],
      ["PUT", "/api/shared-resources/categories/category-a"],
      ["DELETE", "/api/shared-resources/categories/category-a"],
      ["POST", "/api/shared-resources/items/add"],
      ["POST", "/api/shared-resources/sets/add"],
      ["POST", "/api/shared-resources/poses/add"],
      ["POST", "/api/shared-resources/workflows/add"],
      ["PUT", "/api/shared-resources/items/item-a"],
      ["DELETE", "/api/shared-resources/items/item-a"],
    ] as const;

    for (const [method, path] of managementRequests) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(response.status, `${method} ${path}`).toBe(403);
      expect(await response.text()).toBe("ADMIN_REQUIRED");
    }
  });
});
