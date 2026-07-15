import type {
  PermissionAction,
  PermissionDecision,
  PermissionedUser,
} from "@xinghuan/shared";

export const PERMISSION_RUNTIME_MODES = ["legacy", "shadow", "enforced"] as const;

export type PermissionRuntimeMode = (typeof PERMISSION_RUNTIME_MODES)[number];

export interface PermissionRuntimeDecision {
  allowed: boolean;
  authority: "admin" | "legacy" | "unified";
  mismatch: boolean;
  legacy: { allowed: boolean };
  unified?: PermissionDecision;
}

export interface PermissionRuntimeRequest {
  user: PermissionedUser;
  subjectKey: string;
  action: PermissionAction;
  legacyAllowed: boolean;
}

export interface PermissionShadowMismatch {
  user: PermissionedUser;
  subjectKey: string;
  action: PermissionAction;
  legacyAllowed: boolean;
  unified: PermissionDecision;
}

export function normalizePermissionRuntimeMode(
  value: unknown,
  fallback: PermissionRuntimeMode = "legacy",
): PermissionRuntimeMode {
  return value === "legacy" || value === "shadow" || value === "enforced"
    ? value
    : fallback;
}

export function createPermissionRuntime(deps: {
  mode: PermissionRuntimeMode;
  canUnified: (
    user: PermissionedUser,
    subjectKey: string,
    action: PermissionAction,
  ) => Promise<PermissionDecision>;
  onShadowMismatch?: (mismatch: PermissionShadowMismatch) => Promise<void> | void;
}) {
  return {
    mode: deps.mode,
    decide,
  };

  async function decide(
    request: PermissionRuntimeRequest,
  ): Promise<PermissionRuntimeDecision> {
    const legacy = { allowed: request.legacyAllowed };
    if (request.user.role === "admin") {
      return {
        allowed: true,
        authority: "admin",
        mismatch: false,
        legacy,
      };
    }

    if (deps.mode === "legacy") {
      return {
        allowed: request.legacyAllowed,
        authority: "legacy",
        mismatch: false,
        legacy,
      };
    }

    const unified = await deps.canUnified(
      request.user,
      request.subjectKey,
      request.action,
    );
    const mismatch = request.legacyAllowed !== unified.allowed;

    if (deps.mode === "shadow") {
      if (mismatch && deps.onShadowMismatch) {
        await Promise.resolve(
          deps.onShadowMismatch({
            user: request.user,
            subjectKey: request.subjectKey,
            action: request.action,
            legacyAllowed: request.legacyAllowed,
            unified,
          }),
        ).catch(() => undefined);
      }
      return {
        allowed: request.legacyAllowed,
        authority: "legacy",
        mismatch,
        legacy,
        unified,
      };
    }

    return {
      allowed: unified.allowed,
      authority: "unified",
      mismatch,
      legacy,
      unified,
    };
  }
}
