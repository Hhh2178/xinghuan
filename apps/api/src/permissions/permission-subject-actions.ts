import type {
  PermissionAction,
  PermissionSubject,
} from "@xinghuan/shared";

export function isPermissionLeaf(subject: PermissionSubject) {
  if (subject.exposureState === "retired") return false;
  if (subject.metadata.parent === true) return false;
  return !subject.subjectKey.endsWith("/*");
}

export function requiredPermissionActions(
  subject: PermissionSubject,
): PermissionAction[] {
  if (subject.domain === "provider" && subject.subjectType === "model") {
    return ["view", "execute"];
  }
  if (subject.domain === "runninghub") return ["view", "execute"];
  if (subject.domain === "canvas" && subject.subjectType === "node") {
    return ["view", "use"];
  }
  if (subject.domain === "resource" && subject.subjectType === "category") {
    return ["view"];
  }
  if (subject.domain === "resource" && subject.subjectType === "item") {
    return ["view", "use"];
  }
  return [];
}
