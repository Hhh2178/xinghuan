import type { PermissionAction, PermissionDecision, PermissionEffect, PermissionPrincipalType, PermissionRule, PermissionSubject, PermissionedUser } from "@xinghuan/shared";

type CurrentUser = PermissionedUser & { email: string; name: string };
type HttpErrorLike = new (statusCode: number, message: string, payload?: Record<string, unknown>) => Error;

export function createPermissionRouteHandler(deps: {
  sendT8: (response: import("node:http").ServerResponse, data: unknown, statusCode?: number) => void;
  readJsonBody: <T>(request: import("node:http").IncomingMessage) => Promise<T>;
  HttpError: HttpErrorLike;
  readAuthorizationState: () => Promise<{ subjects: PermissionSubject[]; rules: PermissionRule[] }>;
  upsertSubject: (subject: PermissionSubject) => Promise<PermissionSubject>;
  upsertRule: (rule: PermissionRule & { reason?: string; createdBy?: string }) => Promise<PermissionRule>;
  deleteRule: (id: string, revision: number) => Promise<void>;
  explain: (user: PermissionedUser, subjectKey: string, action: PermissionAction) => Promise<PermissionDecision>;
  appendAudit: (actor: CurrentUser, action: string, targetType: string, targetId: string, summary: string, context?: any) => Promise<void>;
  createId: () => string;
  now: () => number;
  reconcileSubjects?: () => Promise<void>;
  readHealth?: () => Promise<unknown>;
  principalExists?: (principalType: PermissionPrincipalType, principalId: string) => Promise<boolean>;
}) {
  function requireAdmin(currentUser: CurrentUser | null) {
    if (!currentUser || currentUser.role !== "admin") throw new deps.HttpError(403, "ADMIN_REQUIRED");
    return currentUser;
  }

  async function writeWithRevisionConflict<T>(
    operation: () => Promise<T>,
    conflictCode: "PERMISSION_SUBJECT_REVISION_CONFLICT" | "PERMISSION_RULE_REVISION_CONFLICT",
    conflictPayload?: () => Promise<Record<string, unknown>>,
  ) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Error && error.message === conflictCode) {
        throw new deps.HttpError(409, conflictCode, conflictPayload ? await conflictPayload() : undefined);
      }
      throw error;
    }
  }

  return async function handlePermissionRoutes({ request, response, url, currentUser, requestContext }: {
    request: import("node:http").IncomingMessage;
    response: import("node:http").ServerResponse;
    url: URL;
    currentUser: CurrentUser | null;
    requestContext?: any;
  }) {
    if (url.pathname === "/api/admin/permission-health" && request.method === "GET") {
      const actor = requireAdmin(currentUser);
      deps.sendT8(response, await deps.readHealth?.());
      await deps.appendAudit(actor, "permission.health.read", "permission-health", "current", "查看统一权限健康状态", requestContext);
      return true;
    }

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
      const body = await deps.readJsonBody<{ exposureState?: unknown; revision?: unknown; reason?: unknown }>(request);
      const state = await deps.readAuthorizationState();
      const current = state.subjects.find((item) => item.subjectKey === subjectKey);
      if (!current) throw new deps.HttpError(404, "PERMISSION_SUBJECT_NOT_FOUND");
      if (Number(body.revision) !== current.revision) {
        throw new deps.HttpError(409, "PERMISSION_SUBJECT_REVISION_CONFLICT", { currentRevision: current.revision });
      }
      const reason = text(body.reason);
      if (!reason) throw new deps.HttpError(400, "PERMISSION_CHANGE_REASON_REQUIRED");
      const exposureState = body.exposureState === "published" || body.exposureState === "retired" ? body.exposureState : "restricted";
      const updated = await writeWithRevisionConflict(
        () => deps.upsertSubject({ ...current, exposureState, revision: current.revision + 1 }),
        "PERMISSION_SUBJECT_REVISION_CONFLICT",
        async () => {
          const latest = (await deps.readAuthorizationState()).subjects.find((item) => item.subjectKey === subjectKey);
          return latest ? { currentRevision: latest.revision } : {};
        },
      );
      deps.sendT8(response, updated);
      await deps.appendAudit(actor, "permission.subject.update", "permission-subject", subjectKey, `更新权限 subject ${subjectKey} 为 ${exposureState}：${reason}`, requestContext);
      return true;
    }

    if (url.pathname === "/api/admin/permission-rules" && request.method === "POST") {
      const actor = requireAdmin(currentUser);
      const body = await deps.readJsonBody<{ principalType?: unknown; principalId?: unknown; subjectKey?: unknown; action?: unknown; effect?: unknown; reason?: unknown; revision?: unknown }>(request);
      const principalType: PermissionPrincipalType = body.principalType === "user" ? "user" : "group";
      const action = normalizeAction(body.action);
      const effect: PermissionEffect = body.effect === "deny" ? "deny" : "allow";
      const principalId = text(body.principalId);
      const subjectKey = text(body.subjectKey);
      const reason = text(body.reason);
      if (!principalId || !subjectKey) throw new deps.HttpError(400, "PERMISSION_RULE_INVALID");
      if (!reason) throw new deps.HttpError(400, "PERMISSION_CHANGE_REASON_REQUIRED");
      if (deps.principalExists && !(await deps.principalExists(principalType, principalId))) {
        throw new deps.HttpError(404, "PERMISSION_PRINCIPAL_NOT_FOUND");
      }
      const state = await deps.readAuthorizationState();
      if (!state.subjects.some((item) => item.subjectKey === subjectKey)) throw new deps.HttpError(404, "PERMISSION_SUBJECT_NOT_FOUND");
      const previous = state.rules.find((item) => item.principalType === principalType && item.principalId === principalId && item.subjectKey === subjectKey && item.action === action);
      if (previous && Number(body.revision) !== previous.revision) {
        throw new deps.HttpError(409, "PERMISSION_RULE_REVISION_CONFLICT");
      }
      const rule = await writeWithRevisionConflict(
        () => deps.upsertRule({ id: previous?.id || deps.createId(), principalType, principalId, subjectKey, action, effect, revision: (previous?.revision || 0) + 1, reason, createdBy: actor.id }),
        "PERMISSION_RULE_REVISION_CONFLICT",
      );
      deps.sendT8(response, rule);
      await deps.appendAudit(actor, "permission.rule.upsert", "permission-rule", rule.id, `更新 ${principalType}:${principalId} 的 ${subjectKey} ${action}=${effect}：${reason}`, requestContext);
      return true;
    }

    const ruleMatch = url.pathname.match(/^\/api\/admin\/permission-rules\/([^/]+)$/);
    if (ruleMatch && request.method === "DELETE") {
      const actor = requireAdmin(currentUser);
      const id = decodeURIComponent(ruleMatch[1]);
      const body = await deps.readJsonBody<{ reason?: unknown; revision?: unknown }>(request);
      const reason = text(body.reason);
      if (!reason) throw new deps.HttpError(400, "PERMISSION_CHANGE_REASON_REQUIRED");
      const state = await deps.readAuthorizationState();
      const current = state.rules.find((item) => item.id === id);
      if (!current) throw new deps.HttpError(404, "PERMISSION_RULE_NOT_FOUND");
      if (Number(body.revision) !== current.revision) {
        throw new deps.HttpError(409, "PERMISSION_RULE_REVISION_CONFLICT");
      }
      await writeWithRevisionConflict(
        () => deps.deleteRule(id, current.revision),
        "PERMISSION_RULE_REVISION_CONFLICT",
      );
      deps.sendT8(response, { deleted: true, id });
      await deps.appendAudit(actor, "permission.rule.delete", "permission-rule", id, `删除权限规则 ${id}：${reason}`, requestContext);
      return true;
    }

    if (url.pathname === "/api/admin/permission-explain" && request.method === "POST") {
      requireAdmin(currentUser);
      const body = await deps.readJsonBody<{
        user?: PermissionedUser;
        subjectKey?: unknown;
        action?: unknown;
        checks?: Array<{ subjectKey?: unknown; action?: unknown }>;
      }>(request);
      if (!body.user) throw new deps.HttpError(400, "PERMISSION_EXPLAIN_INVALID");
      if (Array.isArray(body.checks)) {
        const checks = body.checks.slice(0, 500)
          .map((check) => ({ subjectKey: text(check.subjectKey), action: normalizeAction(check.action) }))
          .filter((check) => Boolean(check.subjectKey));
        if (checks.length === 0) throw new deps.HttpError(400, "PERMISSION_EXPLAIN_INVALID");
        const decisions = await Promise.all(checks.map(async (check) => ({
          ...check,
          ...await deps.explain(body.user!, check.subjectKey, check.action),
        })));
        deps.sendT8(response, { decisions });
        return true;
      }
      if (!text(body.subjectKey)) throw new deps.HttpError(400, "PERMISSION_EXPLAIN_INVALID");
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
