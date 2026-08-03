import { isOperatorAdministrator, isRootAdministrator } from "@xinghuan/shared";

export const USER_NOT_FOUND = "USER_NOT_FOUND";
export const ADMINISTRATOR_MANAGEMENT_REQUIRES_ROOT = "ADMINISTRATOR_MANAGEMENT_REQUIRES_ROOT";
export const LAST_ROOT_REQUIRED = "LAST_ROOT_REQUIRED";

export type AdministratorIdentity = {
  id: string;
  role: "admin" | "member";
  administratorTier?: string;
};

export type AdministratorMutationAction = "update" | "disable" | "delete" | "demote";

export interface AdministratorSessionIdentity {
  id: string;
  userId: string;
  userRole: "admin" | "member";
  administratorTier?: string;
}

export function canViewAdministratorIdentity(viewer: AdministratorIdentity, target: AdministratorIdentity) {
  if (isRootAdministrator(viewer)) return true;
  if (isOperatorAdministrator(viewer) && isRootAdministrator(target)) return false;
  return true;
}

export function visibleUsersForAdministrator<T extends AdministratorIdentity>(viewer: AdministratorIdentity, users: T[]) {
  return users.filter((user) => canViewAdministratorIdentity(viewer, user));
}

export function visibleSessionsForAdministrator<T extends AdministratorSessionIdentity>(
  viewer: AdministratorIdentity,
  sessions: T[],
  usersById: Map<string, AdministratorIdentity>,
) {
  return sessions.filter((session) => {
    const target = usersById.get(session.userId) || {
      id: session.userId,
      role: session.userRole,
      administratorTier: session.administratorTier,
    };
    return canViewAdministratorIdentity(viewer, target);
  });
}

export function assertAdministratorAccountCreation(input: {
  viewer: AdministratorIdentity;
  role: "admin" | "member";
}) {
  if (input.role === "admin" && !isRootAdministrator(input.viewer)) {
    throw new Error(ADMINISTRATOR_MANAGEMENT_REQUIRES_ROOT);
  }
}

export function assertAdministratorAccountMutation(input: {
  viewer: AdministratorIdentity;
  target: AdministratorIdentity;
  action: AdministratorMutationAction;
  enabledRootCount?: number;
}) {
  if (!canViewAdministratorIdentity(input.viewer, input.target)) throw new Error(USER_NOT_FOUND);
  if (!isRootAdministrator(input.viewer) && input.target.role === "admin") {
    throw new Error(ADMINISTRATOR_MANAGEMENT_REQUIRES_ROOT);
  }
  if (isRootAdministrator(input.target) && (input.action === "disable" || input.action === "delete" || input.action === "demote") && (input.enabledRootCount ?? 2) <= 1) {
    throw new Error(LAST_ROOT_REQUIRED);
  }
}

export function projectAuditForAdministrator<T extends { actorId?: string; actorEmail?: string; action?: string }>(viewer: AdministratorIdentity, audit: T, rootUserIds: string[]) {
  const isRootActor = Boolean(audit.actorId && rootUserIds.includes(audit.actorId));
  if (isRootActor && (audit.action?.startsWith("auth.admin_") || audit.action?.startsWith("admin.user_"))) return null;
  if (isRootActor && !isRootAdministrator(viewer)) return { ...audit, actorId: "", actorEmail: "系统操作" };
  return audit;
}
