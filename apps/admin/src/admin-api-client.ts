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

export const adminRunningHubApi = {
  listItems: () =>
    api<{ items: import("./admin-types").RunningHubAdminItem[] }>("/api/admin/runninghub/items").then((result) => result.items),
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
