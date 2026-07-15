import { api } from "../admin-api-client";
import type {
  PermissionAction,
  PermissionDecision,
  PermissionEffect,
  PermissionExposureState,
  PermissionHealth,
  PermissionPlatformState,
  PermissionPrincipalType,
  PermissionRule,
  PermissionSubject,
} from "./types";

export const permissionPlatformApi = {
  readState: () => api<PermissionPlatformState>("/api/admin/permission-subjects"),
  readHealth: () => api<PermissionHealth>("/api/admin/permission-health"),
  explain: (input: {
    user: { id: string; role: "member"; groupId?: string };
    checks: Array<{ subjectKey: string; action: PermissionAction }>;
  }) => api<{ decisions: PermissionDecision[] }>("/api/admin/permission-explain", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }),
  updateSubject: (
    subject: PermissionSubject,
    exposureState: PermissionExposureState,
    reason: string,
  ) => api<PermissionSubject>(
    `/api/admin/permission-subjects/${encodeURIComponent(subject.subjectKey)}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ exposureState, revision: subject.revision, reason }),
    },
  ),
  upsertRule: (input: {
    principalType: PermissionPrincipalType;
    principalId: string;
    subjectKey: string;
    action: PermissionAction;
    effect: PermissionEffect;
    reason: string;
    revision?: number;
  }) => api<PermissionRule>("/api/admin/permission-rules", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }),
  deleteRule: (id: string, revision: number, reason: string) => api<{ deleted: boolean; id: string }>(
    `/api/admin/permission-rules/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision, reason }),
    },
  ),
};
