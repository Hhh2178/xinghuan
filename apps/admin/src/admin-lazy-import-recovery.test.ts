import { describe, expect, it, vi } from "vitest";

import { ADMIN_LAZY_RECOVERY_KEY, createAdminLazyImportWithRecovery } from "./admin-lazy-import-recovery.js";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe("admin lazy import recovery", () => {
  it("reloads once when a chunk fails or an import remains pending past the timeout", async () => {
    const sessionStorage = storage();
    const reload = vi.fn();
    const chunkLoader = createAdminLazyImportWithRecovery(async () => { throw new Error("Failed to fetch dynamically imported module"); }, { sessionStorage, reload, timeoutMs: 20 });
    await expect(chunkLoader()).rejects.toThrow(/dynamically imported/);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(ADMIN_LAZY_RECOVERY_KEY)).toBe("1");

    await expect(chunkLoader()).rejects.toThrow(/dynamically imported/);
    expect(reload).toHaveBeenCalledTimes(1);

    sessionStorage.removeItem(ADMIN_LAZY_RECOVERY_KEY);
    const pendingLoader = createAdminLazyImportWithRecovery(() => new Promise(() => undefined), { sessionStorage, reload, timeoutMs: 5 });
    await expect(pendingLoader()).rejects.toThrow("后台模块加载超时");
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("clears the recovery marker after a successful import", async () => {
    const sessionStorage = storage();
    sessionStorage.setItem(ADMIN_LAZY_RECOVERY_KEY, "1");
    const loader = createAdminLazyImportWithRecovery(async () => ({ default: "ok" }), { sessionStorage, reload: vi.fn(), timeoutMs: 20 });
    await expect(loader()).resolves.toEqual({ default: "ok" });
    expect(sessionStorage.getItem(ADMIN_LAZY_RECOVERY_KEY)).toBeNull();
  });
});
