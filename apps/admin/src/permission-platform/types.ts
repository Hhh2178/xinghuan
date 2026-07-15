export type PermissionAction = "view" | "use" | "execute" | "manage" | "export";
export type PermissionEffect = "allow" | "deny";
export type PermissionExposureState = "restricted" | "published" | "retired";
export type PermissionPrincipalType = "group" | "user";

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

export interface PermissionDecision {
  subjectKey: string;
  action: PermissionAction;
  allowed: boolean;
  reason: "admin" | "subject-not-published" | "account-rule" | "group-rule" | "no-matching-rule";
  ruleId?: string;
}

export interface PermissionPlatformState {
  subjects: PermissionSubject[];
  rules: PermissionRule[];
}

export interface PermissionReadinessFailure {
  code: string;
  message: string;
  count: number;
}

export interface PermissionHealth {
  mode: "legacy" | "shadow" | "enforced";
  readiness: {
    ready: boolean;
    failures: PermissionReadinessFailure[];
    metrics: {
      subjectCount: number;
      publishedSubjectCount: number;
      restrictedSubjectCount: number;
      retiredSubjectCount: number;
      ruleCount: number;
      principalCount: number;
    };
  };
  shadowMismatches: Array<{
    domain: string;
    action: PermissionAction;
    legacyAllowed: boolean;
    unifiedAllowed: boolean;
    unifiedReason: string;
    count: number;
  }>;
}
