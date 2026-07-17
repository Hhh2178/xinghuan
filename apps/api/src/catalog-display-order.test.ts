import { describe, expect, it } from 'vitest';

import {
  applyCatalogDisplayOrder,
  normalizeCatalogSortOrder,
  sortByCatalogDisplayOrder,
} from './catalog-display-order.js';

describe('catalog display order', () => {
  it('sorts by explicit order and keeps deterministic fallbacks', () => {
    expect(sortByCatalogDisplayOrder([
      { id: 'older', sortOrder: 10, createdAt: 1 },
      { id: 'newer', sortOrder: 10, createdAt: 2 },
      { id: 'first', sortOrder: 0, createdAt: 1 },
    ]).map((item) => item.id)).toEqual(['first', 'newer', 'older']);
  });

  it('assigns canonical ten-point steps for a complete scope', () => {
    const reordered = applyCatalogDisplayOrder([
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 10 },
      { id: 'c', sortOrder: 20 },
    ], ['c', 'a', 'b']);
    expect(sortByCatalogDisplayOrder(reordered).map((item) => [item.id, item.sortOrder])).toEqual([
      ['c', 0],
      ['a', 10],
      ['b', 20],
    ]);
  });

  it('rejects stale, partial, or duplicate reorder scopes', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(() => applyCatalogDisplayOrder(items, ['a'])).toThrow('CATALOG_DISPLAY_ORDER_SCOPE_MISMATCH');
    expect(() => applyCatalogDisplayOrder(items, ['a', 'a'])).toThrow('CATALOG_DISPLAY_ORDER_SCOPE_MISMATCH');
    expect(() => applyCatalogDisplayOrder(items, ['a', 'c'])).toThrow('CATALOG_DISPLAY_ORDER_SCOPE_MISMATCH');
  });

  it('normalizes invalid persisted values', () => {
    expect(normalizeCatalogSortOrder('12.9')).toBe(12);
    expect(normalizeCatalogSortOrder('invalid', 30)).toBe(30);
  });
});
