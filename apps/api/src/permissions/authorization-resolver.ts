import type { PermissionAction, PermissionDecision, PermissionRule, PermissionSubject, PermissionedUser } from "@xinghuan/shared";

const UNGROUPED = "ungrouped";

export function resolvePermission(input: {
  user: PermissionedUser;
  subject: PermissionSubject;
  action: PermissionAction;
  rules: PermissionRule[];
}): PermissionDecision {
  if (input.user.role === "admin") return { allowed: true, reason: "admin" };
  if (input.subject.exposureState !== "published") return { allowed: false, reason: "subject-not-published" };
  const accountRule = findBestRule("user", input.user.id, input.subject, input.action, input.rules);
  if (accountRule) return { allowed: accountRule.effect === "allow", reason: "account-rule", ruleId: accountRule.id };
  const groupRule = findBestRule("group", input.user.groupId || UNGROUPED, input.subject, input.action, input.rules);
  if (groupRule) return { allowed: groupRule.effect === "allow", reason: "group-rule", ruleId: groupRule.id };
  return { allowed: true, reason: "published-default-allow" };
}

function findBestRule(
  principalType: PermissionRule["principalType"],
  principalId: string,
  subject: PermissionSubject,
  action: PermissionAction,
  rules: PermissionRule[],
) {
  const candidates = rules
    .filter((rule) => rule.principalType === principalType && rule.principalId === principalId && rule.action === action)
    .map((rule) => ({ rule, specificity: subjectSpecificity(subject, rule.subjectKey) }))
    .filter((entry): entry is { rule: PermissionRule; specificity: number } => entry.specificity >= 0)
    .sort((left, right) => right.specificity - left.specificity || Number(right.rule.effect === "deny") - Number(left.rule.effect === "deny"));
  return candidates[0]?.rule;
}

function subjectSpecificity(subject: PermissionSubject, candidate: string) {
  if (candidate === subject.subjectKey) return subject.parentKeys.length + 1;
  const index = subject.parentKeys.indexOf(candidate);
  return index < 0 ? -1 : subject.parentKeys.length - index;
}
