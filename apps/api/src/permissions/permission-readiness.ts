import type {
  PermissionRule,
  PermissionSubject,
  PermissionedUser,
} from "@xinghuan/shared";
import {
  isPermissionLeaf,
  requiredPermissionActions,
} from "./permission-subject-actions.js";

export type PermissionReadinessFailureCode =
  | "NO_PERMISSION_SUBJECTS"
  | "NO_PUBLISHED_SUBJECTS"
  | "NO_PERMISSION_RULES"
  | "MISSING_PRINCIPAL_COVERAGE"
  | "MISSING_SUBJECT_ACTION_COVERAGE"
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
  const coveredPrincipalIds = new Set(
    input.rules
      .filter((rule) => rule.principalType === "group")
      .map((rule) => rule.principalId),
  );
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

  if (input.rules.length === 0) {
    failures.push({
      code: "NO_PERMISSION_RULES",
      message: "No unified permission rules exist.",
      count: 0,
    });
  }

  const missingPrincipalIds = requiredPrincipalIds.filter(
    (principalId) => !coveredPrincipalIds.has(principalId),
  );
  if (missingPrincipalIds.length > 0) {
    failures.push({
      code: "MISSING_PRINCIPAL_COVERAGE",
      message: "One or more groups do not have an explicit unified baseline.",
      count: missingPrincipalIds.length,
      principalIds: missingPrincipalIds,
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

  const missingSubjectActionCoverage: string[] = [];
  const publishedLeaves = subjects.filter(
    (subject) => subject.exposureState === "published" && isPermissionLeaf(subject),
  );
  for (const principalId of requiredPrincipalIds) {
    for (const subject of publishedLeaves) {
      const matchingSubjectKeys = new Set([subject.subjectKey, ...subject.parentKeys]);
      for (const action of requiredPermissionActions(subject)) {
        const covered = input.rules.some((rule) => (
          rule.principalType === "group" &&
          rule.principalId === principalId &&
          rule.action === action &&
          matchingSubjectKeys.has(rule.subjectKey)
        ));
        if (!covered) {
          missingSubjectActionCoverage.push(`${principalId}:${subject.subjectKey}:${action}`);
        }
      }
    }
  }
  if (missingSubjectActionCoverage.length > 0) {
    failures.push({
      code: "MISSING_SUBJECT_ACTION_COVERAGE",
      message: "Published subjects are missing explicit group action coverage.",
      count: missingSubjectActionCoverage.length,
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
