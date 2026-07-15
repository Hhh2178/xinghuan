import type {
  PermissionAction,
  PermissionDecision,
} from "@xinghuan/shared";

export interface PermissionShadowMetric {
  domain: string;
  action: PermissionAction;
  legacyAllowed: boolean;
  unifiedAllowed: boolean;
  unifiedReason: PermissionDecision["reason"];
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
}

export function createPermissionShadowMetrics(
  now: () => number = () => Date.now(),
) {
  const metrics = new Map<string, PermissionShadowMetric>();

  return {
    record,
    snapshot: () => [...metrics.values()].sort((left, right) => right.count - left.count),
    clear: () => metrics.clear(),
  };

  function record(input: {
    subjectKey: string;
    action: PermissionAction;
    legacyAllowed: boolean;
    unified: PermissionDecision;
  }) {
    const domain = permissionDomain(input.subjectKey);
    const key = [
      domain,
      input.action,
      String(input.legacyAllowed),
      String(input.unified.allowed),
      input.unified.reason,
    ].join("\u0000");
    const timestamp = now();
    const current = metrics.get(key);
    metrics.set(key, current
      ? { ...current, count: current.count + 1, lastSeenAt: timestamp }
      : {
          domain,
          action: input.action,
          legacyAllowed: input.legacyAllowed,
          unifiedAllowed: input.unified.allowed,
          unifiedReason: input.unified.reason,
          count: 1,
          firstSeenAt: timestamp,
          lastSeenAt: timestamp,
        });
  }
}

function permissionDomain(subjectKey: string) {
  const prefix = String(subjectKey || "").split("/", 1)[0];
  const separator = prefix.indexOf(".");
  return (separator >= 0 ? prefix.slice(0, separator) : prefix) || "unknown";
}
