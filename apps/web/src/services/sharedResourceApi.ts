import type {
  AddResourcePayload,
  AddResourcePosePayload,
  AddResourceSetPayload,
  AddResourceWorkflowPayload,
  ResourceCategory,
  ResourceItem,
  ResourceKind,
  Result,
} from './api';

const BASE = '/api';

async function safeSharedRequest<T>(url: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        ...(json && typeof json === 'object' ? json : {}),
        status: res.status,
        error: json?.error || `HTTP ${res.status}`,
      };
    }
    if (json && typeof json === 'object' && 'success' in json) return json as Result<T>;
    return { success: true, data: json as T };
  } catch (e: any) {
    return { success: false, error: e?.message || '网络错误' };
  }
}

export function getSharedResourceCategories(kind?: ResourceKind) {
  const q = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return safeSharedRequest<ResourceCategory[]>(`${BASE}/shared-resources/categories${q}`);
}

export function addSharedResourceCategory(kind: ResourceKind, name: string) {
  return safeSharedRequest<ResourceCategory>(`${BASE}/shared-resources/categories`, {
    method: 'POST',
    body: JSON.stringify({ kind, name }),
  });
}

export function renameSharedResourceCategory(id: string, name: string, revision?: number) {
  return safeSharedRequest<ResourceCategory>(`${BASE}/shared-resources/categories/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ name, ...(revision ? { revision } : {}) }),
  });
}

export function deleteSharedResourceCategory(id: string, revision?: number) {
  return safeSharedRequest<{ movedTo: string }>(`${BASE}/shared-resources/categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify(revision ? { revision } : {}),
  });
}

export function getSharedResourceItems(params: {
  kind?: ResourceKind;
  categoryId?: string;
  q?: string;
  favorite?: boolean;
} = {}) {
  const sp = new URLSearchParams();
  if (params.kind) sp.set('kind', params.kind);
  if (params.categoryId && params.categoryId !== 'all') sp.set('categoryId', params.categoryId);
  if (params.q) sp.set('q', params.q);
  if (params.favorite) sp.set('favorite', '1');
  const qs = sp.toString();
  return safeSharedRequest<ResourceItem[]>(`${BASE}/shared-resources/items${qs ? `?${qs}` : ''}`);
}

export function addSharedResourceItem(payload: AddResourcePayload) {
  return safeSharedRequest<ResourceItem & { duplicate?: boolean }>(`${BASE}/shared-resources/items/add`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadSharedResourceFile(file: File) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${BASE}/files/upload`, {
      method: 'POST',
      body: formData,
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json?.success === false) {
      return {
        success: false as const,
        status: response.status,
        error: json?.error || `HTTP ${response.status}`,
      };
    }
    return {
      success: true as const,
      data: json?.data as { filename: string; url: string; size: number; mime: string },
    };
  } catch (e: any) {
    return { success: false as const, error: e?.message || '文件上传失败' };
  }
}

export function addSharedResourceSet(payload: AddResourceSetPayload) {
  return safeSharedRequest<ResourceItem & { duplicate?: boolean }>(`${BASE}/shared-resources/sets/add`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function addSharedResourcePose(payload: AddResourcePosePayload) {
  return safeSharedRequest<ResourceItem & { duplicate?: boolean }>(`${BASE}/shared-resources/poses/add`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function addSharedResourceWorkflow(payload: AddResourceWorkflowPayload) {
  return safeSharedRequest<ResourceItem & { duplicate?: boolean }>(`${BASE}/shared-resources/workflows/add`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateSharedResourceItem(
  id: string,
  patch: Partial<Pick<ResourceItem, 'title' | 'categoryId' | 'tags' | 'favorite'>> & { touch?: boolean; revision?: number },
) {
  return safeSharedRequest<ResourceItem>(`${BASE}/shared-resources/items/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export function deleteSharedResourceItem(id: string, revision?: number) {
  return safeSharedRequest<void>(`${BASE}/shared-resources/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify(revision ? { revision } : {}),
  });
}
