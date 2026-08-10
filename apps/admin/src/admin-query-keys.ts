export const adminQueryKeys = {
  shell: ["shell"] as const,
  providers: ["providers"] as const,
  models: ["models"] as const,
  directory: ["directory"] as const,
  permissions: ["permissions"] as const,
  runninghub: ["runninghub"] as const,
  comfyui: ["comfyui"] as const,
  sharedResources: ["shared-resources"] as const,
  tasks: ["tasks"] as const,
  announcements: ["content", "announcements"] as const,
  audit: ["analytics", "audit"] as const,
  system: ["system"] as const,
} as const;

export type AdminQueryDomain = keyof typeof adminQueryKeys;

export function adminMutationDomains(pathname: string): AdminQueryDomain[] {
  const path = pathname.split("?", 1)[0];
  if (path.startsWith("/api/admin/providers/") || path === "/api/admin/providers") return ["providers", "models", "shell"];
  if (path.startsWith("/api/admin/models/") || path === "/api/admin/models" || path.startsWith("/api/admin/model-pricing")) return ["models", "providers", "shell"];
  if (path.startsWith("/api/admin/users") || path.startsWith("/api/admin/user-groups") || path.startsWith("/api/admin/sessions")) return ["directory", "shell"];
  if (path.startsWith("/api/admin/permission") || path.startsWith("/api/admin/group-permission")) return ["permissions", "directory", "shell"];
  if (path.startsWith("/api/admin/runninghub")) return ["runninghub", "providers", "permissions", "shell"];
  if (path.startsWith("/api/admin/comfyui")) return ["comfyui", "providers", "shell"];
  if (path.startsWith("/api/shared-resources")) return ["sharedResources", "permissions", "shell"];
  if (path.startsWith("/api/admin/announcements")) return ["announcements", "shell"];
  if (path.startsWith("/api/admin/system") || path.startsWith("/api/admin/assistant")) return ["system", "shell"];
  if (path.startsWith("/api/admin/tasks") || path.startsWith("/api/tasks")) return ["tasks", "shell"];
  if (path.startsWith("/api/admin/audit")) return ["audit"];
  return ["shell"];
}
