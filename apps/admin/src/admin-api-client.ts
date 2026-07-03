export class AdminApiError extends Error {
  status?: number;
  code?: string;
  currentRevision?: number;
  settingsKey?: string;
  retryAfterSec?: number;

  constructor(message: string, payload?: Record<string, unknown>, status?: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = typeof payload?.error === "string" ? payload.error : undefined;
    this.currentRevision = Number.isFinite(Number(payload?.currentRevision))
      ? Number(payload?.currentRevision)
      : undefined;
    this.settingsKey = typeof payload?.settingsKey === "string" ? payload.settingsKey : undefined;
    this.retryAfterSec = Number.isFinite(Number(payload?.retryAfterSec))
      ? Number(payload?.retryAfterSec)
      : undefined;
  }
}

export async function api<T = unknown>(pathname: string, options?: RequestInit): Promise<T> {
  const response = await fetch(pathname, { ...options, credentials: "same-origin" });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok || payload?.success === false || payload?.ok === false) {
    throw new AdminApiError(payload?.error || `${pathname} ${response.status}`, payload, response.status);
  }
  return payload.data as T;
}

export const adminAuditApi = {
  readUsageSummary: (
    filters: {
      range?: "today" | "7d" | "30d";
      from?: number;
      to?: number;
      groupId?: string;
      userId?: string;
      capability?: import("./admin-types").UsageCapability;
      providerId?: string;
      modelId?: string;
      rhCatalogId?: string;
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (filters.range) query.set("range", filters.range);
    if (typeof filters.from === "number") query.set("from", String(filters.from));
    if (typeof filters.to === "number") query.set("to", String(filters.to));
    if (filters.groupId) query.set("groupId", filters.groupId);
    if (filters.userId) query.set("userId", filters.userId);
    if (filters.capability) query.set("capability", filters.capability);
    if (filters.providerId) query.set("providerId", filters.providerId);
    if (filters.modelId) query.set("modelId", filters.modelId);
    if (filters.rhCatalogId) query.set("rhCatalogId", filters.rhCatalogId);
    const suffix = query.toString();
    return api<import("./admin-types").AdminUsageSummary>(`/api/admin/audit/usage-summary${suffix ? `?${suffix}` : ""}`);
  },
};

export const adminPermissionApi = {
  listPolicies: () =>
    api<import("./admin-types").AdminGroupPermissionPolicy[]>("/api/admin/group-permission-policies"),
  readPolicy: (groupId: string) =>
    api<import("./admin-types").AdminGroupPermissionPolicy>(
      `/api/admin/group-permission-policies/${encodeURIComponent(groupId)}`,
    ),
  updatePolicy: (groupId: string, payload: { deny: import("./admin-types").GroupPermissionDeny }) =>
    api<import("./admin-types").AdminGroupPermissionPolicy>(
      `/api/admin/group-permission-policies/${encodeURIComponent(groupId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  readCatalog: () => api<import("./admin-types").AdminPermissionCatalog>("/api/admin/permission-catalog"),
  readEffectivePermissions: () => api<import("./admin-types").EffectivePermissions>("/api/me/permissions"),
};

export const adminRunningHubApi = {
  listItems: () =>
    api<{ items: import("./admin-types").RunningHubAdminItem[] }>("/api/admin/runninghub/items").then((result) => result.items),
  listKeyPool: (providerId: string) =>
    api<import("./admin-types").RunningHubKeyPoolItem[]>(`/api/admin/providers/${encodeURIComponent(providerId)}/runninghub/key-pool`),
  saveKeyPool: (
    providerId: string,
    payload: {
      rhKeyPool: Array<import("./admin-types").RunningHubKeyPoolItem & { apiKey?: string }>;
    },
  ) =>
    api<import("./admin-types").RunningHubKeyPoolItem[]>(`/api/admin/providers/${encodeURIComponent(providerId)}/runninghub/key-pool`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteKeyPoolItem: (providerId: string, keyId: string) =>
    api<import("./admin-types").RunningHubKeyPoolItem[]>(`/api/admin/providers/${encodeURIComponent(providerId)}/runninghub/key-pool/${encodeURIComponent(keyId)}`, {
      method: "DELETE",
    }),
  createItem: (payload: import("./admin-types").RunningHubAdminItemCreatePayload) =>
    api<import("./admin-types").RunningHubAdminItem>("/api/admin/runninghub/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateItem: (catalogId: string, payload: import("./admin-types").RunningHubAdminItemUpdatePayload) =>
    api<import("./admin-types").RunningHubAdminItem>(`/api/admin/runninghub/items/${encodeURIComponent(catalogId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteItem: (catalogId: string) =>
    api<{ deleted: boolean; catalogId: string }>(`/api/admin/runninghub/items/${encodeURIComponent(catalogId)}`, {
      method: "DELETE",
    }),
  testItem: (catalogId: string, payload: { testPayload?: string }) =>
    api<import("./admin-types").RunningHubAdminItemTestResult>(`/api/admin/runninghub/items/${encodeURIComponent(catalogId)}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  analyzeItemDraft: (payload: import("./admin-types").RunningHubAnalyzePayload) =>
    api<import("./admin-types").RunningHubAnalyzeDraft>("/api/admin/runninghub/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  fetchRemoteAppInfo: (runTargetId: string) =>
    api<Record<string, unknown>>(`/api/proxy/runninghub/app-info?webappId=${encodeURIComponent(runTargetId)}`),
};

export const adminComfyuiApi = {
  listInstances: () =>
    api<{
      revision: number;
      updatedAt: number;
      instances: import("./admin-types").ComfyuiInstanceRecord[];
      sharedWorkflows: import("./admin-types").ComfyuiWorkflowDraft[];
      workflowCount: number;
    }>("/api/admin/comfyui/instances"),
  createInstance: (payload: Partial<import("./admin-types").ComfyuiInstanceRecord> & { capabilities?: unknown }) =>
    api<import("./admin-types").ComfyuiInstanceRecord>("/api/admin/comfyui/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateInstance: (instanceId: string, payload: Partial<import("./admin-types").ComfyuiInstanceRecord> & { capabilities?: unknown }) =>
    api<import("./admin-types").ComfyuiInstanceRecord>(`/api/admin/comfyui/instances/${encodeURIComponent(instanceId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteInstance: (instanceId: string) =>
    api<{ deleted: boolean; instanceId: string }>(`/api/admin/comfyui/instances/${encodeURIComponent(instanceId)}`, {
      method: "DELETE",
    }),
  heartbeatInstance: (instanceId: string, payload: Partial<import("./admin-types").ComfyuiInstanceRecord> & { capabilities?: unknown }) =>
    api<import("./admin-types").ComfyuiInstanceRecord>(`/api/admin/comfyui/instances/${encodeURIComponent(instanceId)}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  testConnection: (instanceId: string) =>
    api<import("./admin-types").ComfyuiConnectionTestResult>(`/api/admin/comfyui/instances/${encodeURIComponent(instanceId)}/test-connection`, {
      method: "POST",
    }),
  updateCapabilities: (instanceId: string, capabilities: string[]) =>
    api<import("./admin-types").ComfyuiInstanceRecord>(`/api/admin/comfyui/instances/${encodeURIComponent(instanceId)}/capabilities`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capabilities }),
    }),
  listWorkflows: (instanceId: string) =>
    api<{ instanceId: string; workflows: import("./admin-types").ComfyuiWorkflowDraft[] }>(
      `/api/admin/comfyui/instances/${encodeURIComponent(instanceId)}/workflows`,
    ).then((result) => result.workflows),
  createWorkflow: (instanceId: string, payload: Partial<import("./admin-types").ComfyuiWorkflowDraft> & {
    workflowJson?: Record<string, unknown> | string;
    inputSchema?: unknown;
    exposedFields?: unknown;
    defaultValues?: unknown;
    hiddenFields?: unknown;
    outputSchema?: unknown;
  }) =>
    api<import("./admin-types").ComfyuiWorkflowDraft>(`/api/admin/comfyui/instances/${encodeURIComponent(instanceId)}/workflows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateWorkflow: (instanceId: string, workflowId: string, payload: Partial<import("./admin-types").ComfyuiWorkflowDraft> & {
    workflowJson?: Record<string, unknown> | string;
    inputSchema?: unknown;
    exposedFields?: unknown;
    defaultValues?: unknown;
    hiddenFields?: unknown;
    outputSchema?: unknown;
  }) =>
    api<import("./admin-types").ComfyuiWorkflowDraft>(`/api/admin/comfyui/instances/${encodeURIComponent(instanceId)}/workflows/${encodeURIComponent(workflowId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteWorkflow: (instanceId: string, workflowId: string) =>
    api<{ deleted: boolean; instanceId: string; workflowId: string }>(
      `/api/admin/comfyui/instances/${encodeURIComponent(instanceId)}/workflows/${encodeURIComponent(workflowId)}`,
      { method: "DELETE" },
    ),
  pushWorkflowToShared: (instanceId: string, workflowId: string) =>
    api<{
      workflow: import("./admin-types").ComfyuiWorkflowDraft;
      sharedWorkflow: import("./admin-types").ComfyuiWorkflowDraft;
    }>(`/api/admin/comfyui/instances/${encodeURIComponent(instanceId)}/workflows/${encodeURIComponent(workflowId)}/push-to-shared`, {
      method: "POST",
    }),
};

export const adminAnnouncementApi = {
  listAnnouncements: () => api<import("./admin-types").AdminAnnouncementRecord[]>("/api/admin/announcements"),
  createAnnouncement: (payload: import("./admin-types").AdminAnnouncementUpsertPayload) =>
    api<import("./admin-types").AdminAnnouncementRecord>("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateAnnouncement: (id: string, payload: import("./admin-types").AdminAnnouncementUpsertPayload) =>
    api<import("./admin-types").AdminAnnouncementRecord>(`/api/admin/announcements/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  publishAnnouncement: (
    id: string,
    payload: { confirmTitle: string; confirmStrongReminder: boolean; confirmPinned: boolean },
  ) =>
    api<import("./admin-types").AdminAnnouncementRecord>(`/api/admin/announcements/${encodeURIComponent(id)}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  archiveAnnouncement: (id: string) =>
    api<import("./admin-types").AdminAnnouncementRecord>(`/api/admin/announcements/${encodeURIComponent(id)}/archive`, {
      method: "POST",
    }),
  deleteAnnouncement: (id: string) =>
    api<{ deleted: true; id: string }>(`/api/admin/announcements/${encodeURIComponent(id)}`, {
      method: "DELETE",
  }),
};

export const adminSharedResourceApi = {
  listCategories: (kind?: import("./admin-types").ResourceKind) =>
    api<import("./admin-types").ResourceCategory[]>(
      `/api/shared-resources/categories${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`,
    ),
  createCategory: (payload: { kind: import("./admin-types").ResourceKind; name: string }) =>
    api<import("./admin-types").ResourceCategory>("/api/shared-resources/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  renameCategory: (id: string, payload: { name: string; revision?: number }) =>
    api<import("./admin-types").ResourceCategory>(`/api/shared-resources/categories/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteCategory: (id: string, revision?: number) =>
    api<{ movedTo: string }>(`/api/shared-resources/categories/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(revision ? { revision } : {}),
    }),
  listItems: (params: { kind?: import("./admin-types").ResourceKind; categoryId?: string; q?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.kind) query.set("kind", params.kind);
    if (params.categoryId && params.categoryId !== "all") query.set("categoryId", params.categoryId);
    if (params.q) query.set("q", params.q);
    const suffix = query.toString();
    return api<import("./admin-types").SharedResourceItem[]>(`/api/shared-resources/items${suffix ? `?${suffix}` : ""}`);
  },
  createItem: (payload: {
    kind: import("./admin-types").ResourceMediaKind;
    url: string;
    title?: string;
    originalName?: string;
    mime?: string;
    size?: number;
    categoryId?: string;
    tags?: string[];
    note?: string;
  }) =>
    api<import("./admin-types").SharedResourceItem>("/api/shared-resources/items/add", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  createWorkflow: (payload: {
    workflowFragment: Record<string, unknown>;
    title?: string;
    categoryId?: string;
    tags?: string[];
    note?: string;
    sourceCanvasId?: string;
    sourceNodeId?: string;
    favorite?: boolean;
  }) =>
    api<import("./admin-types").SharedResourceItem>("/api/shared-resources/workflows/add", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateItem: (
    id: string,
    payload: Partial<Pick<import("./admin-types").SharedResourceItem, "title" | "categoryId" | "tags" | "favorite" | "note">> & {
      revision?: number;
    },
  ) =>
    api<import("./admin-types").SharedResourceItem>(`/api/shared-resources/items/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteItem: (id: string, revision?: number) =>
    api<void>(`/api/shared-resources/items/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(revision ? { revision } : {}),
    }),
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/files/upload", { method: "POST", body: formData, credentials: "same-origin" });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok || payload?.success === false) {
      throw new AdminApiError(payload?.error || `upload ${response.status}`, payload, response.status);
    }
    return payload.data as { filename: string; url: string; size: number; mime: string };
  },
};

export const adminGenerationLibraryApi = {
  listItems: (params: { kind?: import("./admin-types").GenerationLibraryKind; q?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.kind) query.set("kind", params.kind);
    if (params.q) query.set("q", params.q);
    const suffix = query.toString();
    return api<import("./admin-types").GenerationLibraryItem[]>(
      `/api/generation-library/items${suffix ? `?${suffix}` : ""}`,
    );
  },
  deleteItem: (id: string) =>
    api<void>(`/api/generation-library/items/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  createSharedResourceItem: (payload: {
    kind: import("./admin-types").ResourceMediaKind;
    url: string;
    title?: string;
    originalName?: string;
    mime?: string;
    size?: number;
    categoryId?: string;
    tags?: string[];
    note?: string;
  }) =>
    adminSharedResourceApi.createItem(payload),
};
