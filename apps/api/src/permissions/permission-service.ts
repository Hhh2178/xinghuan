import type { PermissionAction, PermissionDecision, PermissionRule, PermissionSubject, PermissionedUser } from "@xinghuan/shared";
import { resolvePermission } from "./authorization-resolver.js";

export interface PermissionAuthorizationState {
  subjects: PermissionSubject[];
  rules: PermissionRule[];
}

export class PermissionDeniedError extends Error {
  code = "PERMISSION_DENIED";

  constructor() {
    super("PERMISSION_DENIED");
  }
}

export function createPermissionService(deps: { readAuthorizationState: () => Promise<PermissionAuthorizationState> }) {
  let authorizationStatePromise: Promise<PermissionAuthorizationState> | null = null;

  return { can, filter, assertAllowed, explain };

  function readAuthorizationSnapshot() {
    if (authorizationStatePromise) return authorizationStatePromise;
    const current = deps.readAuthorizationState();
    authorizationStatePromise = current;
    const clear = () => queueMicrotask(() => {
      if (authorizationStatePromise === current) authorizationStatePromise = null;
    });
    void current.then(clear, clear);
    return current;
  }

  async function can(user: PermissionedUser, subjectKey: string, action: PermissionAction): Promise<PermissionDecision> {
    const state = await readAuthorizationSnapshot();
    const subject = state.subjects.find((item) => item.subjectKey === subjectKey);
    if (!subject) return { allowed: user.role === "admin", reason: user.role === "admin" ? "admin" : "subject-not-published" };
    return resolvePermission({ user, subject, action, rules: state.rules });
  }

  async function filter<T extends PermissionSubject>(user: PermissionedUser, subjects: T[], action: PermissionAction): Promise<T[]> {
    const state = await readAuthorizationSnapshot();
    return subjects.filter((subject) => resolvePermission({ user, subject, action, rules: state.rules }).allowed);
  }

  async function assertAllowed(user: PermissionedUser, subjectKey: string, action: PermissionAction): Promise<void> {
    const decision = await can(user, subjectKey, action);
    if (!decision.allowed) throw new PermissionDeniedError();
  }

  async function explain(user: PermissionedUser, subjectKey: string, action: PermissionAction): Promise<PermissionDecision> {
    return can(user, subjectKey, action);
  }
}
