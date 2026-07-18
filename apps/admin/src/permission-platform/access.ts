import type {
  PermissionAction,
  PermissionDecision,
  PermissionEffect,
  PermissionSubject,
} from "./types";

export type ScopedAccessState =
  | "loading"
  | "allowed"
  | "denied"
  | "partial"
  | "global-restricted";

export function decisionKey(subjectKey: string, action: PermissionAction) {
  return `${subjectKey}\u0000${action}`;
}

export function supportedActions(subject: PermissionSubject): PermissionAction[] {
  if (subject.domain === "provider") return ["view", "execute"];
  if (subject.domain === "runninghub") return ["view", "execute"];
  if (subject.domain === "canvas") return ["view", "use"];
  if (subject.domain === "resource" && subject.subjectType.includes("category")) return ["view"];
  if (subject.domain === "resource") return ["view", "use"];
  return ["view"];
}

export function scopedAccessState(
  subject: PermissionSubject,
  decisions: Record<string, PermissionDecision>,
): ScopedAccessState {
  if (subject.exposureState !== "published") return "global-restricted";
  const actions = supportedActions(subject);
  const resolved = actions
    .map((action) => decisions[decisionKey(subject.subjectKey, action)])
    .filter((decision): decision is PermissionDecision => Boolean(decision));
  if (resolved.length !== actions.length) return "loading";
  const allowedCount = resolved.filter((decision) => decision.allowed).length;
  if (allowedCount === 0) return "denied";
  if (allowedCount === resolved.length) return "allowed";
  return "partial";
}

export function nextScopedEffect(state: ScopedAccessState): PermissionEffect {
  return state === "allowed" ? "deny" : "allow";
}
