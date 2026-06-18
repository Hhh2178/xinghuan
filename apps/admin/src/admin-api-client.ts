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
  updateItem: (catalogId: string, payload: import("./admin-types").RunningHubAdminItemUpdatePayload) =>
    api<import("./admin-types").RunningHubAdminItem>(`/api/admin/runninghub/items/${encodeURIComponent(catalogId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  testItem: (catalogId: string) =>
    api<import("./admin-types").RunningHubAdminItemTestResult>(`/api/admin/runninghub/items/${encodeURIComponent(catalogId)}/test`, {
      method: "POST",
    }),
};
