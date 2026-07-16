import type {
  PermissionRule,
  PermissionSubject,
  PermissionedUser,
} from "@xinghuan/shared";

export type PermissionReadinessFailureCode =
  | "NO_PERMISSION_SUBJECTS"
  | "NO_PUBLISHED_SUBJECTS"
  | "INVALID_USER_GROUP_REFERENCE"
  | "ORPHAN_PERMISSION_RULE"
  | "ORPHAN_PERMISSION_PRINCIPAL"
  | "RETIRED_SUBJECT_RULE";

export interface PermissionReadinessFailure {
  code: PermissionReadinessFailureCode;
  message: string;
  count: number;
  principalIds?: string[];
  subjectKeys?: string[];
}

export interface PermissionReadinessReport {
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
}

export function evaluatePermissionReadiness(input: {
  subjects: PermissionSubject[];
  rules: PermissionRule[];
  groupIds: string[];
  users: Array<Pick<PermissionedUser, "id" | "role" | "groupId">>;
}): PermissionReadinessReport {
  const subjects = input.subjects.filter((subject) => Boolean(subject.subjectKey));
  const subjectKeys = new Set(subjects.map((subject) => subject.subjectKey));
  const groupIds = [...new Set(input.groupIds.filter(Boolean))];
  const validGroupIds = new Set(groupIds);
  const validUserIds = new Set(input.users.map((user) => user.id));
  const requiredPrincipalIds = [...groupIds, "ungrouped"];
  const failures: PermissionReadinessFailure[] = [];

  if (subjects.length === 0) {
    failures.push({
      code: "NO_PERMISSION_SUBJECTS",
      message: "No permission subjects are registered.",
      count: 0,
    });
  }

  const publishedSubjectCount = subjects.filter(
    (subject) => subject.exposureState === "published",
  ).length;
  if (publishedSubjectCount === 0) {
    failures.push({
      code: "NO_PUBLISHED_SUBJECTS",
      message: "No permission subjects are published.",
      count: 0,
    });
  }


  const invalidUserGroupIds = [...new Set(
    input.users
      .filter((user) => user.role !== "admin" && user.groupId && !validGroupIds.has(user.groupId))
      .map((user) => user.groupId as string),
  )];
  if (invalidUserGroupIds.length > 0) {
    failures.push({
      code: "INVALID_USER_GROUP_REFERENCE",
      message: "One or more members reference a missing user group.",
      count: invalidUserGroupIds.length,
      principalIds: invalidUserGroupIds,
    });
  }

  const orphanSubjectKeys = [...new Set(
    input.rules
      .filter((rule) => !subjectKeys.has(rule.subjectKey))
      .map((rule) => rule.subjectKey),
  )];
  if (orphanSubjectKeys.length > 0) {
    failures.push({
      code: "ORPHAN_PERMISSION_RULE",
      message: "One or more rules reference a missing permission subject.",
      count: orphanSubjectKeys.length,
      subjectKeys: orphanSubjectKeys,
    });
  }

  const orphanPrincipalIds = [...new Set(
    input.rules
      .filter((rule) => rule.principalType === "group"
        ? rule.principalId !== "ungrouped" && !validGroupIds.has(rule.principalId)
        : !validUserIds.has(rule.principalId))
      .map((rule) => `${rule.principalType}:${rule.principalId}`),
  )];
  if (orphanPrincipalIds.length > 0) {
    failures.push({
      code: "ORPHAN_PERMISSION_PRINCIPAL",
      message: "One or more rules reference a missing group or account.",
      count: orphanPrincipalIds.length,
      principalIds: orphanPrincipalIds,
    });
  }

  const retiredSubjectKeys = new Set(
    subjects.filter((subject) => subject.exposureState === "retired").map((subject) => subject.subjectKey),
  );
  const retiredRuleSubjectKeys = [...new Set(
    input.rules.filter((rule) => retiredSubjectKeys.has(rule.subjectKey)).map((rule) => rule.subjectKey),
  )];
  if (retiredRuleSubjectKeys.length > 0) {
    failures.push({
      code: "RETIRED_SUBJECT_RULE",
      message: "One or more rules still reference a retired subject.",
      count: retiredRuleSubjectKeys.length,
      subjectKeys: retiredRuleSubjectKeys,
    });
  }

  return {
    ready: failures.length === 0,
    failures,
    metrics: {
      subjectCount: subjects.length,
      publishedSubjectCount,
      restrictedSubjectCount: subjects.filter(
        (subject) => subject.exposureState === "restricted",
      ).length,
      retiredSubjectCount: subjects.filter(
        (subject) => subject.exposureState === "retired",
      ).length,
      ruleCount: input.rules.length,
      principalCount: requiredPrincipalIds.length,
    },
  };
}
