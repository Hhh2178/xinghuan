import type { PermissionAction, PermissionEffect, PermissionPrincipalType, PermissionRule, PermissionSubject, PermissionedUser } from "@xinghuan/shared";

type CurrentUser = PermissionedUser & { email: string; name: string };
type HttpErrorLike = new (statusCode: number, message: string, payload?: Record<string, unknown>) => Error;

export function createPermissionRouteHandler(deps: {
  sendT8: (response: import("node:http").ServerResponse, data: unknown, statusCode?: number) => void;
  readJsonBody: <T>(request: import("node:http").IncomingMessage) => Promise<T>;
  HttpError: HttpErrorLike;
  readAuthorizationState: () => Promise<{ subjects: PermissionSubject[]; rules: PermissionRule[] }>;
  upsertSubject: (subject: PermissionSubject) => Promise<PermissionSubject>;
  upsertRule: (rule: PermissionRule & { reason?: string; createdBy?: string }) => Promise<PermissionRule>;
  deleteRule: (id: string) => Promise<void>;
  explain: (user: PermissionedUser, subjectKey: string, action: PermissionAction) => Promise<unknown>;
  appendAudit: (actor: CurrentUser, action: string, targetType: string, targetId: string, summary: string, context?: any) => Promise<void>;
  createId: () => string;
  now: () => number;
  reconcileSubjects?: () => Promise<void>;
}) {
  function requireAdmin(currentUser: CurrentUser | null) {
    if (!currentUser || currentUser.role !== "admin") throw new deps.HttpError(403, "ADMIN_REQUIRED");
    return currentUser;
  }

  return async function handlePermissionRoutes({ request, response, url, currentUser, requestContext }: {
    request: import("node:http").IncomingMessage;
    response: import("node:http").ServerResponse;
    url: URL;
    currentUser: CurrentUser | null;
    requestContext?: any;
  }) {
    if (url.pathname === "/api/admin/permission-subjects" && request.method === "GET") {
      const actor = requireAdmin(currentUser);
      await deps.reconcileSubjects?.();
      const state = await deps.readAuthorizationState();
      deps.sendT8(response, { subjects: state.subjects, rules: state.rules });
      await deps.appendAudit(actor, "permission.subjects.read", "permission-subject", "all", "查看统一权限目录", requestContext);
      return true;
    }

    const subjectMatch = url.pathname.match(/^\/api\/admin\/permission-subjects\/([^/]+)$/);
    if (subjectMatch && request.method === "PUT") {
      const actor = requireAdmin(currentUser);
      const subjectKey = decodeURIComponent(subjectMatch[1]);
      const body = await deps.readJsonBody<{ exposureState?: unknown; revision?: unknown }>(request);
      const state = await deps.readAuthorizationState();
      const current = state.subjects.find((item) => item.subjectKey === subjectKey);
      if (!current) throw new deps.HttpError(404, "PERMISSION_SUBJECT_NOT_FOUND");
      if (Number(body.revision) !== current.revision) throw new deps.HttpError(409, "PERMISSION_SUBJECT_REVISION_CONFLICT");
      const exposureState = body.exposureState === "published" || body.exposureState === "retired" ? body.exposureState : "restricted";
      const updated = await deps.upsertSubject({ ...current, exposureState, revision: current.revision + 1 });
      deps.sendT8(response, updated);
      await deps.appendAudit(actor, "permission.subject.update", "permission-subject", subjectKey, `更新权限 subject ${subjectKey} 为 ${exposureState}`, requestContext);
      return true;
    }

    if (url.pathname === "/api/admin/permission-rules" && request.method === "POST") {
      const actor = requireAdmin(currentUser);
      const body = await deps.readJsonBody<{ principalType?: unknown; principalId?: unknown; subjectKey?: unknown; action?: unknown; effect?: unknown; reason?: unknown }>(request);
      const principalType: PermissionPrincipalType = body.principalType === "user" ? "user" : "group";
      const action = normalizeAction(body.action);
      const effect: PermissionEffect = body.effect === "deny" ? "deny" : "allow";
      const principalId = text(body.principalId);
      const subjectKey = text(body.subjectKey);
      if (!principalId || !subjectKey) throw new deps.HttpError(400, "PERMISSION_RULE_INVALID");
      const state = await deps.readAuthorizationState();
      if (!state.subjects.some((item) => item.subjectKey === subjectKey)) throw new deps.HttpError(404, "PERMISSION_SUBJECT_NOT_FOUND");
      const previous = state.rules.find((item) => item.principalType === principalType && item.principalId === principalId && item.subjectKey === subjectKey && item.action === action);
      const rule = await deps.upsertRule({ id: previous?.id || deps.createId(), principalType, principalId, subjectKey, action, effect, revision: (previous?.revision || 0) + 1, reason: text(body.reason), createdBy: actor.id });
      deps.sendT8(response, rule);
      await deps.appendAudit(actor, "permission.rule.upsert", "permission-rule", rule.id, `更新 ${principalType}:${principalId} 的 ${subjectKey} ${action}=${effect}`, requestContext);
      return true;
    }

    const ruleMatch = url.pathname.match(/^\/api\/admin\/permission-rules\/([^/]+)$/);
    if (ruleMatch && request.method === "DELETE") {
      const actor = requireAdmin(currentUser);
      const id = decodeURIComponent(ruleMatch[1]);
      await deps.deleteRule(id);
      deps.sendT8(response, { deleted: true, id });
      await deps.appendAudit(actor, "permission.rule.delete", "permission-rule", id, `删除权限规则 ${id}`, requestContext);
      return true;
    }

    if (url.pathname === "/api/admin/permission-explain" && request.method === "POST") {
      requireAdmin(currentUser);
      const body = await deps.readJsonBody<{ user?: PermissionedUser; subjectKey?: unknown; action?: unknown }>(request);
      if (!body.user || !text(body.subjectKey)) throw new deps.HttpError(400, "PERMISSION_EXPLAIN_INVALID");
      deps.sendT8(response, await deps.explain(body.user, text(body.subjectKey), normalizeAction(body.action)));
      return true;
    }
    return false;
  };
}

function normalizeAction(value: unknown): PermissionAction {
  return value === "use" || value === "execute" || value === "manage" || value === "export" ? value : "view";
}
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
