import { adminAnnouncementApi, api } from "./admin-api-client";
import { readAdminQuery } from "./admin-query-client";
import { adminQueryKeys } from "./admin-query-keys";
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
    readAdminQuery([...adminQueryKeys.shell, "summary"], (signal) => api<Summary>("/api/admin/summary", { signal }), { maxAgeMs: 5_000 }),
    readAdminQuery([...adminQueryKeys.shell, "assistant-settings"], (signal) => api<AssistantSettings>("/api/admin/assistant/settings", { signal }), { maxAgeMs: 5_000 }),
  ]);
  return { summary, assistantSettings };
}

export async function readAdminWorkspaceSnapshot(
  workspaceId: AdminWorkspaceId,
  taskPath: string,
  systemHealthRange: "1h" | "24h" | "7d" | "30d" = "24h",
  subpageId?: string,
): Promise<AdminWorkspaceSnapshot> {
  if (workspaceId === "overview") {
    const [providers, models, taskPage] = await Promise.all([
      readAdminQuery(["providers"], (signal) => api<ProviderRecord[]>("/api/admin/providers", { signal }), { maxAgeMs: 5_000 }),
      readAdminQuery(["models"], (signal) => api<ModelRecord[]>("/api/admin/models", { signal }), { maxAgeMs: 5_000 }),
      readAdminQuery(["tasks", taskPath], (signal) => api<TaskListPage>(taskPath, { signal }), { maxAgeMs: 1_000 }),
    ]);
    return { providers, models, taskPage };
  }
  if (workspaceId === "organization" || workspaceId === "security") {
    if (subpageId === "sessions") {
      return { sessions: await readAdminQuery(["directory", "sessions"], (signal) => api<AdminSessionRecord[]>("/api/admin/sessions", { signal }), { maxAgeMs: 2_000 }) };
    }
    if (!subpageId || subpageId === "overview" || subpageId === "accounts" || subpageId === "groups" || subpageId === "permissions") {
      const usersPromise = readAdminQuery(["directory", "users"], (signal) => api<AdminUser[]>("/api/admin/users", { signal }), { maxAgeMs: 5_000 });
      const groupsPromise = readAdminQuery(["directory", "groups"], (signal) => api<AdminUserGroup[]>("/api/admin/user-groups", { signal }), { maxAgeMs: 5_000 });
      const [users, userGroups] = await Promise.all([usersPromise, groupsPromise]);
      if (subpageId === "permissions") return { users, userGroups };
      if (subpageId === "accounts" || subpageId === "groups") return { users, userGroups };
      const sessions = await readAdminQuery(["directory", "sessions"], (signal) => api<AdminSessionRecord[]>("/api/admin/sessions", { signal }), { maxAgeMs: 2_000 });
      return { users, userGroups, sessions };
    }
    return {};
  }
  if (workspaceId === "capabilities" || workspaceId === "rh" || workspaceId === "automation") {
    const [providers, models] = await Promise.all([
      readAdminQuery(["providers"], (signal) => api<ProviderRecord[]>("/api/admin/providers", { signal }), { maxAgeMs: 5_000 }),
      readAdminQuery(["models"], (signal) => api<ModelRecord[]>("/api/admin/models", { signal }), { maxAgeMs: 5_000 }),
    ]);
    return { providers, models };
  }
  if (workspaceId === "resources") {
    return {};
  }
  if (workspaceId === "content") {
    return { announcements: await readAdminQuery(["content", "announcements"], () => adminAnnouncementApi.listAnnouncements(), { maxAgeMs: 5_000 }) };
  }
  if (workspaceId === "runtime") {
    return { taskPage: await readAdminQuery(["tasks", taskPath], (signal) => api<TaskListPage>(taskPath, { signal }), { maxAgeMs: 1_000 }) };
  }
  if (workspaceId === "analytics") {
    if (subpageId === "reliability") {
      const [providerRows, models] = await Promise.all([
        readAdminQuery(["providers"], (signal) => api<ProviderRecord[]>("/api/admin/providers", { signal }), { maxAgeMs: 5_000 }),
        readAdminQuery(["models"], (signal) => api<ModelRecord[]>("/api/admin/models", { signal }), { maxAgeMs: 5_000 }),
      ]);
      return { providers: providerRows, models };
    }
    const users = readAdminQuery(["directory", "users"], (signal) => api<AdminUser[]>("/api/admin/users", { signal }), { maxAgeMs: 5_000 });
    const userGroups = readAdminQuery(["directory", "groups"], (signal) => api<AdminUserGroup[]>("/api/admin/user-groups", { signal }), { maxAgeMs: 5_000 });
    const providers = readAdminQuery(["providers"], (signal) => api<ProviderRecord[]>("/api/admin/providers", { signal }), { maxAgeMs: 5_000 });
    if (subpageId === "audit") {
      const [auditLogs, usersResult, groupsResult, providersResult, models] = await Promise.all([
        readAdminQuery(["analytics", "audit"], (signal) => api<AuditRecord[]>("/api/admin/audit", { signal }), { maxAgeMs: 3_000 }),
        users,
        userGroups,
        providers,
        readAdminQuery(["models"], (signal) => api<ModelRecord[]>("/api/admin/models", { signal }), { maxAgeMs: 5_000 }),
      ]);
      return { auditLogs, users: usersResult, userGroups: groupsResult, providers: providersResult, models };
    }
    const [usersResult, groupsResult, providersResult, models] = await Promise.all([
      users,
      userGroups,
      providers,
      readAdminQuery(["models"], (signal) => api<ModelRecord[]>("/api/admin/models", { signal }), { maxAgeMs: 5_000 }),
    ]);
    return { users: usersResult, userGroups: groupsResult, providers: providersResult, models };
  }
  if (workspaceId === "system") {
    return { system: await readAdminQuery(["system", systemHealthRange], (signal) => api<SystemInfo>(`/api/admin/system?range=${systemHealthRange}`, { signal }), { maxAgeMs: 2_000 }) };
  }
  return {};
}
