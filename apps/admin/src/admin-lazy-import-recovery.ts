export const ADMIN_LAZY_RECOVERY_KEY = "xh-admin:lazy-import-recovery";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createAdminLazyImportWithRecovery<T>(
  importer: () => Promise<{ default: T }>,
  options: {
    timeoutMs?: number;
    recoveryId?: string;
    sessionStorage?: StorageLike | null;
    reload?: () => void;
  } = {},
) {
  return async () => {
    const timeoutMs = Math.max(1, options.timeoutMs ?? 15_000);
    const key = options.recoveryId ? `${ADMIN_LAZY_RECOVERY_KEY}:${options.recoveryId}` : ADMIN_LAZY_RECOVERY_KEY;
    const storage = resolveStorage(options.sessionStorage);
    const reload = options.reload || (() => window.location.reload());
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`后台模块加载超时（${timeoutMs}ms）`)), timeoutMs);
      });
      const module = await Promise.race([importer(), timeoutPromise]);
      storage?.removeItem(key);
      return module;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "");
      const recoverable = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|后台模块加载超时/i.test(message);
      if (recoverable && storage?.getItem(key) !== "1") {
        storage?.setItem(key, "1");
        reload();
      }
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };
}

function resolveStorage(explicit?: StorageLike | null) {
  if (explicit !== undefined) return explicit;
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage; } catch { return null; }
}
