import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { api, isAuthRequiredError } from "./admin-api-client";
import type { AuthUser, SystemInfo } from "./admin-types";

export type AdminSystemHealthRange = "1h" | "24h" | "7d" | "30d";

export function useAdminSystemHealth({
  isAdmin,
  isActive,
  setSystem,
  setCurrentUser,
  setError,
  setLastRefreshAt,
}: {
  isAdmin: boolean;
  isActive: boolean;
  setSystem: Dispatch<SetStateAction<SystemInfo | null>>;
  setCurrentUser: Dispatch<SetStateAction<AuthUser | null>>;
  setError: Dispatch<SetStateAction<string>>;
  setLastRefreshAt: Dispatch<SetStateAction<number>>;
}) {
  const [range, setRange] = useState<AdminSystemHealthRange>("24h");
  const [refreshing, setRefreshing] = useState(false);
  const requestSequence = useRef(0);
  const abortController = useRef<AbortController | null>(null);

  const load = useCallback(async function loadSystemHealth(
    nextRange = range,
    options: { quiet?: boolean } = {},
  ) {
    if (!isAdmin) return;
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    setRefreshing(true);
    if (!options.quiet) setError("");
    try {
      const nextSystem = await api<SystemInfo>(`/api/admin/system?range=${nextRange}`, { signal: controller.signal });
      if (sequence !== requestSequence.current) return;
      setSystem(nextSystem);
      setLastRefreshAt(Date.now());
    } catch (nextError) {
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      if (isAuthRequiredError(nextError)) {
        setCurrentUser(null);
        setError("登录状态已失效，请重新登录。");
      } else if (!options.quiet) {
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      }
    } finally {
      if (sequence === requestSequence.current) setRefreshing(false);
    }
  }, [isAdmin, range, setCurrentUser, setError, setLastRefreshAt, setSystem]);

  const changeRange = useCallback((nextRange: AdminSystemHealthRange) => {
    setRange(nextRange);
    void load(nextRange);
  }, [load]);

  useEffect(() => {
    if (!isAdmin || !isActive) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load(range, { quiet: true });
    };
    const timer = window.setInterval(refreshWhenVisible, 15_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isActive, isAdmin, load, range]);

  useEffect(() => () => abortController.current?.abort(), []);

  return { range, refreshing, load, changeRange };
}
