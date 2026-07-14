import type { RhCatalogItem } from "@xinghuan/shared";
import {
  DEFAULT_NODE_CAPABILITIES,
  buildEffectivePermissions,
  emptyGroupPermissionDeny,
  normalizeGroupPermissionPolicies,
  normalizeGroupPermissionPolicy,
  policyForUser,
  serializePolicyDeny,
  type GroupPermissionPolicy,
  type NodeCapabilityDefinition,
} from "./group-permission-policy.js";

type HttpErrorLike = new (statusCode: number, message: string, payload?: Record<string, unknown>) => Error;

interface UserGroupLike {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

interface UserLike {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  groupId?: string;
}

interface ResourceCategoryLike {
  id: string;
  kind: string;
  name: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

interface ResourceItemLike {
  id: string;
  kind: string;
  title: string;
  categoryId?: string;
  tags: string[];
  favorite: boolean;
  revision: number;
  createdAt: number;
  updatedAt: number;
  fileUrl?: string;
  url?: string;
  mime?: string;
  size?: number;
  note?: string;
  publishedBy?: string;
  publishedAt?: number;
}

interface AuthDbLike {
  userGroups: UserGroupLike[];
  users: UserLike[];
  groupPermissionPolicies: GroupPermissionPolicy[];
  sessions?: unknown[];
  loginAttempts?: unknown[];
}

interface SharedResourceCatalog {
  categories: ResourceCategoryLike[];
  items: ResourceItemLike[];
}

type RequestContextLike = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  startedAt?: number;
};

type CurrentUserLike = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  groupId?: string;
};

type ReadJsonBody = <T>(request: import("node:http").IncomingMessage) => Promise<T>;

type SendT8 = (
  response: import("node:http").ServerResponse,
  data: unknown,
  statusCode?: number,
  headers?: Record<string, string>,
) => void;

export function createGroupPermissionPolicyRouteHandler(deps: {
  readJsonBody: ReadJsonBody;
  sendT8: SendT8;
  HttpError: HttpErrorLike;
  safeText: (value: unknown, fallback?: string) => string;
  readAuthDb: () => Promise<AuthDbLike>;
  writeAuthDb: (updater: (authDb: AuthDbLike) => AuthDbLike, options?: { reason?: string }) => Promise<void>;
  readSharedResourceCatalog: () => Promise<SharedResourceCatalog>;
  readRunningHubPermissionCatalog: () => Promise<{ apps: RhCatalogItem[]; workflows: RhCatalogItem[] }>;
  appendAudit: (
    actor: CurrentUserLike,
    action: string,
    targetType: string,
    targetId: string,
    summary: string,
    context?: RequestContextLike | any,
  ) => Promise<void>;
  nodeTypes?: NodeCapabilityDefinition[];
}) {
  const {
    readJsonBody,
    sendT8,
    HttpError,
    safeText,
    readAuthDb,
    writeAuthDb,
    readSharedResourceCatalog,
    readRunningHubPermissionCatalog,
    appendAudit,
    nodeTypes = DEFAULT_NODE_CAPABILITIES,
  } = deps;

  function requireAdmin(currentUser: CurrentUserLike | null | undefined) {
    if (!currentUser || currentUser.role !== "admin") {
      throw new HttpError(403, "ADMIN_REQUIRED");
    }
    return currentUser;
  }

  function requireUser(currentUser: CurrentUserLike | null | undefined) {
    if (!currentUser) throw new HttpError(401, "UNAUTHORIZED");
    return currentUser;
  }

  function listAddressableGroups(authDb: AuthDbLike) {
    const groups = [...authDb.userGroups].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "zh-CN"));
    return [
      ...groups,
      {
        id: "ungrouped",
        name: "未分组",
        description: "没有分组的账号默认归入这里",
        sortOrder: Number.MAX_SAFE_INTEGER,
        createdAt: 0,
        updatedAt: 0,
      },
    ];
  }

  function buildPolicyResponse(group: UserGroupLike, authDb: AuthDbLike) {
    const policy = policyForUser(
      { id: "permission-preview", role: "member", groupId: group.id },
      authDb.groupPermissionPolicies,
    ) || {
      groupId: group.id,
      updatedAt: 0,
      updatedBy: undefined,
      deny: emptyGroupPermissionDeny(),
    };
    const memberCount = group.id === "ungrouped"
      ? authDb.users.filter((user) => !safeText(user.groupId)).length
      : authDb.users.filter((user) => safeText(user.groupId) === group.id).length;
    return {
      groupId: group.id,
      groupName: group.name,
      memberCount,
      deny: serializePolicyDeny(policy.deny),
      updatedAt: policy.updatedAt,
      updatedBy: policy.updatedBy,
    };
  }

  return async function handleGroupPermissionPolicyRoutes({
    request,
    response,
    url,
    currentUser,
    requestContext,
  }: {
    request: import("node:http").IncomingMessage;
    response: import("node:http").ServerResponse;
    url: URL;
    currentUser: CurrentUserLike | null;
    requestContext?: RequestContextLike;
  }) {
    if (url.pathname === "/api/me/permissions" && request.method === "GET") {
      const authDb = await readAuthDb();
      sendT8(response, buildEffectivePermissions(requireUser(currentUser), authDb.groupPermissionPolicies));
      return true;
    }

    if (url.pathname === "/api/admin/group-permission-policies" && request.method === "GET") {
      const actor = requireAdmin(currentUser);
      const authDb = await readAuthDb();
      const groups = listAddressableGroups(authDb);
      sendT8(response, groups.map((group) => buildPolicyResponse(group, authDb)));
      await appendAudit(actor, "groupPermissionPolicy.read", "group-permission-policy", "all", "查看分组权限策略列表", requestContext);
      return true;
    }

    const groupPolicyMatch = url.pathname.match(/^\/api\/admin\/group-permission-policies\/([^/]+)$/);
    if (groupPolicyMatch) {
      const actor = requireAdmin(currentUser);
      const groupId = decodeURIComponent(groupPolicyMatch[1]);
      const authDb = await readAuthDb();
      const group = listAddressableGroups(authDb).find((item) => item.id === groupId);
      if (!group) throw new HttpError(404, "GROUP_NOT_FOUND");
      if (request.method === "GET") {
        sendT8(response, buildPolicyResponse(group, authDb));
        await appendAudit(actor, "groupPermissionPolicy.read", "group-permission-policy", groupId, `查看分组权限策略 ${group.name}`, requestContext);
        return true;
      }
      if (request.method === "PUT") {
        const body = await readJsonBody<{ deny?: unknown }>(request);
        const nextPolicy = normalizeGroupPermissionPolicy({
          groupId,
          updatedAt: Date.now(),
          updatedBy: actor.id,
          deny: body.deny,
        });
        const nextPolicies = normalizeGroupPermissionPolicies([
          ...authDb.groupPermissionPolicies.filter((item) => item.groupId !== groupId),
          nextPolicy,
        ]);
        await writeAuthDb(
          (currentAuthDb) => ({ ...currentAuthDb, groupPermissionPolicies: nextPolicies }),
          { reason: "group-permission-policy-update" },
        );
        sendT8(response, buildPolicyResponse(group, { ...authDb, groupPermissionPolicies: nextPolicies }));
        const denyCount =
          nextPolicy.deny.sharedResourceCategoryIds.length +
          nextPolicy.deny.sharedResourceItemIds.length +
          nextPolicy.deny.runningHubAppCatalogIds.length +
          nextPolicy.deny.runningHubWorkflowCatalogIds.length +
          nextPolicy.deny.nodeTypes.length;
        await appendAudit(
          actor,
          "groupPermissionPolicy.update",
          "group-permission-policy",
          groupId,
          `更新分组权限策略 ${group.name}，限制项 ${denyCount} 个`,
          requestContext,
        );
        return true;
      }
      return false;
    }

    if (url.pathname === "/api/admin/permission-catalog" && request.method === "GET") {
      const actor = requireAdmin(currentUser);
      const [authDb, sharedResources, runningHubCatalog] = await Promise.all([
        readAuthDb(),
        readSharedResourceCatalog(),
        readRunningHubPermissionCatalog(),
      ]);
      sendT8(response, {
        userGroups: listAddressableGroups(authDb),
        sharedResourceCategories: sharedResources.categories,
        sharedResourceItems: sharedResources.items,
        runningHubApps: runningHubCatalog.apps,
        runningHubWorkflows: runningHubCatalog.workflows,
        nodeTypes,
      });
      await appendAudit(actor, "permissionCatalog.read", "permission-catalog", "default", "查看权限目录", requestContext);
      return true;
    }

    return false;
  };
}
