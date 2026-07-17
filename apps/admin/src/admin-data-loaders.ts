import { adminAnnouncementApi, api } from "./admin-api-client";
import type {
  AdminAnnouncementRecord,
  AdminSessionRecord,
  AdminUser,
  AdminUserGroup,
  AssistantSettings,
  AuditRecord,
  ModelRecord,
  ProviderRecord,
  Summary,
  SystemInfo,
  TaskListPage,
} from "./admin-types";
import type { AdminWorkspaceId } from "./admin-view-model";

export interface AdminShellSnapshot {
  summary: Summary;
  assistantSettings: AssistantSettings;
}

export interface AdminWorkspaceSnapshot {
  users?: AdminUser[];
  userGroups?: AdminUserGroup[];
  sessions?: AdminSessionRecord[];
  providers?: ProviderRecord[];
  models?: ModelRecord[];
  taskPage?: TaskListPage;
  auditLogs?: AuditRecord[];
  announcements?: AdminAnnouncementRecord[];
  system?: SystemInfo;
}

export async function readAdminShellSnapshot(): Promise<AdminShellSnapshot> {
  const [summary, assistantSettings] = await Promise.all([
    api<Summary>("/api/admin/summary"),
    api<AssistantSettings>("/api/admin/assistant/settings"),
  ]);
  return { summary, assistantSettings };
}

export async function readAdminWorkspaceSnapshot(
  workspaceId: AdminWorkspaceId,
  taskPath: string,
): Promise<AdminWorkspaceSnapshot> {
  if (workspaceId === "overview") {
    const [providers, models, taskPage] = await Promise.all([
      api<ProviderRecord[]>("/api/admin/providers"),
      api<ModelRecord[]>("/api/admin/models"),
      api<TaskListPage>(taskPath),
    ]);
    return { providers, models, taskPage };
  }
  if (workspaceId === "organization" || workspaceId === "security") {
    const [users, userGroups, sessions] = await Promise.all([
      api<AdminUser[]>("/api/admin/users"),
      api<AdminUserGroup[]>("/api/admin/user-groups"),
      api<AdminSessionRecord[]>("/api/admin/sessions"),
    ]);
    return { users, userGroups, sessions };
  }
  if (workspaceId === "capabilities" || workspaceId === "rh") {
    const [providers, models] = await Promise.all([
      api<ProviderRecord[]>("/api/admin/providers"),
      api<ModelRecord[]>("/api/admin/models"),
    ]);
    return { providers, models };
  }
  if (workspaceId === "content") {
    return { announcements: await adminAnnouncementApi.listAnnouncements() };
  }
  if (workspaceId === "runtime") {
    return { taskPage: await api<TaskListPage>(taskPath) };
  }
  if (workspaceId === "analytics") {
    const [auditLogs, users, userGroups, providers] = await Promise.all([
      api<AuditRecord[]>("/api/admin/audit"),
      api<AdminUser[]>("/api/admin/users"),
      api<AdminUserGroup[]>("/api/admin/user-groups"),
      api<ProviderRecord[]>("/api/admin/providers"),
    ]);
    return { auditLogs, users, userGroups, providers };
  }
  if (workspaceId === "system") {
    return { system: await api<SystemInfo>("/api/admin/system") };
  }
  return {};
}
