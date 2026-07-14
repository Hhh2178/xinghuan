export const PERMISSION_ACTIONS = ["view", "use", "execute", "manage", "export"] as const;
export const PERMISSION_EXPOSURE_STATES = ["restricted", "published", "retired"] as const;
export const PERMISSION_PRINCIPAL_TYPES = ["group", "user"] as const;
export const PERMISSION_EFFECTS = ["allow", "deny"] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];
export type PermissionExposureState = (typeof PERMISSION_EXPOSURE_STATES)[number];
export type PermissionPrincipalType = (typeof PERMISSION_PRINCIPAL_TYPES)[number];
export type PermissionEffect = (typeof PERMISSION_EFFECTS)[number];

export interface PermissionSubject {
  subjectKey: string;
  domain: string;
  subjectType: string;
  parentKeys: string[];
  sourceId: string;
  exposureState: PermissionExposureState;
  displayName: string;
  metadata: Record<string, unknown>;
  revision: number;
}

export interface PermissionRule {
  id: string;
  principalType: PermissionPrincipalType;
  principalId: string;
  subjectKey: string;
  action: PermissionAction;
  effect: PermissionEffect;
  revision: number;
}

export interface PermissionedUser {
  id: string;
  role: "admin" | "member";
  groupId?: string;
}

export interface PermissionDecision {
  allowed: boolean;
  reason: "admin" | "subject-not-published" | "account-rule" | "group-rule" | "no-matching-rule";
  ruleId?: string;
}
