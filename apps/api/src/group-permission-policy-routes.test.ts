import { describe, expect, it } from "vitest";

import { createGroupPermissionPolicyRouteHandler } from "./group-permission-policy-routes.js";

class TestHttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

describe("GET /api/me/permissions", () => {
  it("projects unified node decisions while retaining unknown legacy denials", async () => {
    let responseBody: unknown;
    const handler = createGroupPermissionPolicyRouteHandler({
      readJsonBody: async <T>() => ({} as T),
      sendT8: (_response, data) => { responseBody = data; },
      HttpError: TestHttpError,
      safeText: (value, fallback = "") => typeof value === "string" ? value : fallback,
      readAuthDb: async () => ({
        userGroups: [],
        users: [],
        groupPermissionPolicies: [{
          groupId: "group-a",
          updatedAt: 1,
          deny: {
            sharedResourceCategoryIds: [],
            sharedResourceItemIds: [],
            runningHubAppCatalogIds: [],
            runningHubWorkflowCatalogIds: [],
            nodeTypes: ["custom-node"],
          },
        }],
      }),
      writeGroupPermissionPolicy: async () => undefined,
      readSharedResourceCatalog: async () => ({ categories: [], items: [] }),
      readRunningHubPermissionCatalog: async () => ({ apps: [], workflows: [] }),
      appendAudit: async () => undefined,
      nodeTypes: [
        { id: "image", label: "Image", group: "generation" },
        { id: "video", label: "Video", group: "generation" },
      ],
      resolveNodeTypeAllowed: async (_user, nodeType) => nodeType !== "image",
    });

    const handled = await handler({
      request: { method: "GET" } as import("node:http").IncomingMessage,
      response: {} as import("node:http").ServerResponse,
      url: new URL("http://127.0.0.1/api/me/permissions"),
      currentUser: { id: "member-a", email: "member@example.test", name: "Member", role: "member", groupId: "group-a" },
    });

    expect(handled).toBe(true);
    expect(responseBody).toEqual(expect.objectContaining({
      groupId: "group-a",
      isAdmin: false,
      deny: expect.objectContaining({ nodeTypes: ["custom-node", "image"] }),
    }));
  });
});
