const DYNAMIC_IMPORT_FAILURE_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
];

export const DYNAMIC_IMPORT_RECOVERY_KEY = "xh-web:dynamic-import-recovery";

type LazyModule<T = unknown> = { default: T };
type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type ReloadRecoveryOptions = {
  sessionStorage?: SessionStorageLike | null;
  reload?: () => void;
};

function resolveSessionStorage(explicit?: SessionStorageLike | null): SessionStorageLike | null {
  if (explicit !== undefined) return explicit;
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function resolveReload(explicit?: () => void) {
  if (explicit) return explicit;
  return () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };
}

export function isDynamicImportFetchFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return DYNAMIC_IMPORT_FAILURE_PATTERNS.some((pattern) => pattern.test(message));
}

export function createLazyImportWithReloadRecovery<T>(
  importer: () => Promise<LazyModule<T>>,
  options: ReloadRecoveryOptions = {},
) {
  return async () => {
    const storage = resolveSessionStorage(options.sessionStorage);
    const reload = resolveReload(options.reload);
    try {
      const module = await importer();
      storage?.removeItem(DYNAMIC_IMPORT_RECOVERY_KEY);
      return module;
    } catch (error) {
      const alreadyReloaded = storage?.getItem(DYNAMIC_IMPORT_RECOVERY_KEY) === "1";
      if (isDynamicImportFetchFailure(error) && !alreadyReloaded) {
        storage?.setItem(DYNAMIC_IMPORT_RECOVERY_KEY, "1");
        reload();
      }
      throw error;
    }
  };
}
