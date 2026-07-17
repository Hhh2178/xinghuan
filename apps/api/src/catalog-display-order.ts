export interface DisplayOrderedRecord {
  id: string;
  sortOrder?: number;
  createdAt?: number;
}

export function normalizeCatalogSortOrder(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : Math.trunc(fallback);
}

export function sortByCatalogDisplayOrder<T extends DisplayOrderedRecord>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const orderDelta = normalizeCatalogSortOrder(left.sortOrder) - normalizeCatalogSortOrder(right.sortOrder);
    if (orderDelta !== 0) return orderDelta;
    const createdDelta = normalizeCatalogSortOrder(right.createdAt) - normalizeCatalogSortOrder(left.createdAt);
    if (createdDelta !== 0) return createdDelta;
    return String(left.id).localeCompare(String(right.id));
  });
}

export function applyCatalogDisplayOrder<T extends DisplayOrderedRecord>(items: T[], orderedIds: unknown): T[] {
  const ids = Array.isArray(orderedIds) ? orderedIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
  const currentIds = items.map((item) => item.id);
  if (ids.length !== currentIds.length || new Set(ids).size !== ids.length) {
    throw new Error('CATALOG_DISPLAY_ORDER_SCOPE_MISMATCH');
  }
  const currentIdSet = new Set(currentIds);
  if (ids.some((id) => !currentIdSet.has(id))) {
    throw new Error('CATALOG_DISPLAY_ORDER_SCOPE_MISMATCH');
  }
  const orderById = new Map(ids.map((id, index) => [id, index * 10]));
  return items.map((item) => ({ ...item, sortOrder: orderById.get(item.id) ?? 0 }));
}
